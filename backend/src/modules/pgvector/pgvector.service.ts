import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface VectorPoint {
  id: string;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  payload?: Record<string, unknown>;
}

export interface CollectionInfo {
  name: string;
  vectorSize: number;
  pointsCount: number;
}

@Injectable()
export class PgVectorService {
  private readonly logger = new Logger(PgVectorService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * No-op for pgvector. The table (kb_chunks) already exists; this method is
   * kept for interface compatibility with the previous QdrantService.
   */
  async createCollection(_collectionName: string): Promise<void> {
    return;
  }

  async upsertBatch(collectionName: string, points: VectorPoint[]): Promise<void> {
    if (points.length === 0) return;

    const table = this.resolveTable(collectionName);

    // Use ON CONFLICT (id) DO UPDATE for upsert semantics.
    const placeholders: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const point of points) {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      values.push(
        point.id,
        `[${point.vector.join(',')}]`,
        point.payload ? JSON.stringify(point.payload) : null,
        JSON.stringify(point.payload || {}),
      );
    }

    const query = `
      INSERT INTO ${table} (id, embedding, metadata, payload)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id) DO UPDATE
      SET embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          payload = EXCLUDED.payload
    `;

    await this.db.query(query, values);
  }

  /**
   * Hybrid search: combines pgvector cosine similarity with full-text search.
   * Returns results ordered by a weighted blend of both relevance signals.
   */
  async search(
    collectionName: string,
    vector: number[],
    limit = 10,
    filter?: Record<string, unknown>,
    queryText?: string,
  ): Promise<SearchResult[]> {
    const table = this.resolveTable(collectionName);
    const embeddingLiteral = `[${vector.join(',')}]`;

    const conditions: string[] = [];
    const params: unknown[] = [embeddingLiteral];

    if (filter) {
      this.applyFilters(conditions, params, filter);
    }

    // Optional full-text search term (hybrid search). When provided, rank by a
    // weighted blend of cosine similarity and ts_rank; otherwise rank by cosine.
    let orderClause = '(1 - (embedding <=> $1)) DESC';
    if (queryText && queryText.trim().length > 0) {
      params.push(queryText);
      const textParam = `$${params.length}`;
      orderClause = `(0.7 * (1 - (embedding <=> $1)) + 0.3 * COALESCE(ts_rank_cd(content_tsv, plainto_tsquery('english', ${textParam})), 0)) DESC`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        id,
        metadata,
        1 - (embedding <=> $1) AS cosine_score
      FROM ${table}
      ${whereClause}
      ORDER BY ${orderClause}
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    const rows = await this.db.queryMany<{
      id: string;
      metadata: unknown;
      cosine_score: string;
    }>(query, params);

    return rows.map((r) => ({
      id: r.id,
      score: parseFloat(r.cosine_score) || 0,
      payload: (r.metadata as Record<string, unknown>) || {},
    }));
  }

  async searchWithPayloadFilter(
    collectionName: string,
    vector: number[],
    limit: number,
    payloadFilter: Record<string, unknown> | Array<{ key: string; match: { value: unknown } }>,
  ): Promise<SearchResult[]> {
    const filter: Record<string, unknown> = {};

    // Support both the record form and the legacy Qdrant-style array form.
    if (Array.isArray(payloadFilter)) {
      for (const clause of payloadFilter) {
        if (clause && clause.key) {
          filter[clause.key] = clause.match?.value;
        }
      }
    } else {
      Object.assign(filter, payloadFilter);
    }

    // Map logical payload keys (knowledgeBaseId, documentId) to column conditions
    if (filter['knowledgeBaseId']) {
      filter['knowledge_base_id'] = filter['knowledgeBaseId'];
      delete filter['knowledgeBaseId'];
    }
    if (filter['documentId']) {
      filter['document_id'] = filter['documentId'];
      delete filter['documentId'];
    }

    return this.search(collectionName, vector, limit, filter);
  }

  async deleteByFilter(collectionName: string, filter: Record<string, unknown>): Promise<void> {
    const table = this.resolveTable(collectionName);
    const conditions: string[] = [];
    const params: unknown[] = [];

    this.applyFilters(conditions, params, filter);

    if (conditions.length === 0) {
      this.logger.warn(`deleteByFilter called without conditions on ${table} - skipping`);
      return;
    }

    await this.db.query(`DELETE FROM ${table} WHERE ${conditions.join(' AND ')}`, params);
  }

  async deletePoints(collectionName: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const table = this.resolveTable(collectionName);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    await this.db.query(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids);
  }

  async getPoint(collectionName: string, id: string): Promise<VectorPoint | null> {
    const table = this.resolveTable(collectionName);
    const row = await this.db.queryOne<{
      id: string;
      embedding: number[];
      payload: unknown;
    }>(`SELECT id, embedding, metadata AS payload FROM ${table} WHERE id = $1`, [id]);

    if (!row) return null;

    return {
      id: row.id,
      vector: row.embedding,
      payload: (row.payload as Record<string, unknown>) || {},
    };
  }

  async getCollectionInfo(collectionName: string): Promise<CollectionInfo | null> {
    const table = this.resolveTable(collectionName);
    const row = await this.db
      .queryOne<{
        count: string;
      }>(`SELECT COUNT(*)::text AS count FROM ${table}`, [])
      .catch(() => null);

    if (!row) return null;

    return {
      name: table,
      vectorSize: 1536,
      pointsCount: parseInt(row.count || '0', 10),
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.db.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private resolveTable(collectionName: string): string {
    // Map logical collection names to physical tables.
    switch (collectionName) {
      case 'knowledge_base':
      case 'knowledge-base':
        return 'kb_chunks';
      default:
        return collectionName;
    }
  }

  private applyFilters(
    conditions: string[],
    params: unknown[],
    filter: Record<string, unknown>,
  ): void {
    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined || value === null) continue;

      // Support Qdrant-style nested filter objects passed as { must: [...] }
      if (key === 'must' && Array.isArray(value)) {
        for (const clause of value) {
          if (clause && typeof clause === 'object' && 'key' in clause && 'match' in clause) {
            const c = clause as { key: string; match: { value: unknown } };
            conditions.push(`${c.key} = $${params.length + 1}`);
            params.push(c.match.value);
          }
        }
        continue;
      }

      conditions.push(`${key} = $${params.length + 1}`);
      params.push(value);
    }
  }
}
