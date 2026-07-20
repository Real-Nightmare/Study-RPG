import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    const poolMin = this.configService.get<number>('DATABASE_POOL_MIN', 2);
    const poolMax = this.configService.get<number>('DATABASE_POOL_MAX', 10);

    if (connectionString) {
      // Primary connection method: single DATABASE_URL connection string.
      const sslEnabled =
        this.configService.get<string>('DATABASE_SSL') === 'true' ||
        /[?&]sslmode=require/.test(connectionString);

      this.pool = new Pool({
        connectionString,
        ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
        min: poolMin,
        max: poolMax,
        keepAlive: true,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 30000,
      });
    } else {
      // Fallback: individual connection variables.
      // OpsCtrl injects multiple aliases for each field; prefer DATABASE_*,
      // then DB_*, then POSTGRES_*, then PG* (libpq-compatible).
      const host = this.configService.get<string>('DATABASE_HOST') ??
        this.configService.get<string>('DB_HOST') ??
        this.configService.get<string>('POSTGRES_HOST') ??
        this.configService.get<string>('PGHOST') ??
        'localhost';

      const port = this.configService.get<number>('DATABASE_PORT') ??
        this.configService.get<number>('DB_PORT') ??
        this.configService.get<number>('POSTGRES_PORT') ??
        this.configService.get<number>('PGPORT') ??
        5432;

      const user = this.configService.get<string>('DATABASE_USER') ??
        this.configService.get<string>('DATABASE_USERNAME') ??
        this.configService.get<string>('DB_USER') ??
        this.configService.get<string>('DB_USERNAME') ??
        this.configService.get<string>('POSTGRES_USER') ??
        this.configService.get<string>('PGUSER') ??
        'postgres';

      const password = this.configService.get<string>('DATABASE_PASSWORD') ??
        this.configService.get<string>('DB_PASSWORD') ??
        this.configService.get<string>('POSTGRES_PASSWORD') ??
        this.configService.get<string>('PGPASSWORD') ??
        '';

      const database = this.configService.get<string>('DATABASE_NAME') ??
        this.configService.get<string>('DB_NAME') ??
        this.configService.get<string>('DB_DATABASE') ??
        this.configService.get<string>('POSTGRES_DB') ??
        this.configService.get<string>('PGDATABASE') ??
        'study_rpg';

      this.pool = new Pool({
        host,
        port,
        user,
        password,
        database,
        min: poolMin,
        max: poolMax,
        keepAlive: true,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 30000,
      });
    }

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle client', err);
    });

    try {
      const client = await this.pool.connect();
      client.release();
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('Database connection pool closed');
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      this.logger.debug(`Query executed in ${duration}ms: ${text.substring(0, 100)}...`);
      return result;
    } catch (error) {
      this.logger.error(`Query failed: ${text}`, error);
      throw error;
    }
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  }

  async queryMany<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
