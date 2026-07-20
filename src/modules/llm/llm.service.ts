import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export type ProviderType = 'openrouter' | 'groq' | 'together' | 'navy' | 'custom_openai';

export interface LlmProvider {
  id: string;
  name: string;
  providerType: ProviderType;
  apiKey: string | null;
  baseUrl: string;
  modelName: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProviderDto {
  name: string;
  providerType: ProviderType;
  apiKey?: string;
  baseUrl: string;
  modelName: string;
  priority?: number;
  isActive?: boolean;
}

export interface UpdateProviderDto {
  name?: string;
  providerType?: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
  priority?: number;
  isActive?: boolean;
}

export interface CallOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' | 'text' };
  timeoutMs?: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async getProviders(): Promise<LlmProvider[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT * FROM llm_providers WHERE is_active = TRUE ORDER BY priority ASC, created_at ASC`,
    );
    return rows.map((r) => this.mapProvider(r));
  }

  async getProvider(id: string): Promise<LlmProvider | null> {
    const row = await this.db.queryOne<Record<string, unknown>>(
      `SELECT * FROM llm_providers WHERE id = $1`,
      [id],
    );
    return row ? this.mapProvider(row) : null;
  }

  async addProvider(dto: CreateProviderDto): Promise<LlmProvider> {
    const id = uuidv4();
    const now = new Date();
    const row = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO llm_providers
        (id, name, provider_type, api_key, base_url, model_name, priority, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        dto.name,
        dto.providerType,
        dto.apiKey ?? null,
        dto.baseUrl,
        dto.modelName,
        dto.priority ?? 0,
        dto.isActive ?? true,
        now,
        now,
      ],
    );
    return this.mapProvider(row!);
  }

  async updateProvider(id: string, dto: UpdateProviderDto): Promise<LlmProvider> {
    const existing = await this.getProvider(id);
    if (!existing) {
      throw new NotFoundException('LLM provider not found');
    }

    const name = dto.name ?? existing.name;
    const providerType = dto.providerType ?? existing.providerType;
    const apiKey = dto.apiKey !== undefined ? dto.apiKey : existing.apiKey;
    const baseUrl = dto.baseUrl ?? existing.baseUrl;
    const modelName = dto.modelName ?? existing.modelName;
    const priority = dto.priority ?? existing.priority;
    const isActive = dto.isActive ?? existing.isActive;

    const row = await this.db.queryOne<Record<string, unknown>>(
      `UPDATE llm_providers
       SET name = $1, provider_type = $2, api_key = $3, base_url = $4, model_name = $5,
           priority = $6, is_active = $7, updated_at = $8
       WHERE id = $9
       RETURNING *`,
      [name, providerType, apiKey, baseUrl, modelName, priority, isActive, new Date(), id],
    );
    return this.mapProvider(row!);
  }

  async deleteProvider(id: string): Promise<void> {
    const result = await this.db.query('DELETE FROM llm_providers WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new NotFoundException('LLM provider not found');
    }
  }

  /**
   * Tries each active provider (ordered by priority) until one returns a
   * successful chat completion. Falls through on rate-limit / 5xx / timeout.
   */
  async callWithFallback(prompt: string, options: CallOptions = {}): Promise<string> {
    const providers = await this.getProviders();
    const systemProviders = this.getSystemProviders();

    const candidates = [...providers, ...systemProviders];

    if (candidates.length === 0) {
      throw new Error('No LLM providers configured');
    }

    let lastError: Error | null = null;

    for (const provider of candidates) {
      try {
        const text = await this.callProvider(provider, prompt, options);
        return text;
      } catch (error) {
        const err = error as Error;
        lastError = err;
        this.logger.warn(
          `Provider ${(provider as { name?: string }).name ?? 'system'} failed: ${err.message}`,
        );
        continue;
      }
    }

    throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
  }

  private async callProvider(
    provider: { apiKey?: string | null; baseUrl: string; modelName: string },
    prompt: string,
    options: CallOptions,
  ): Promise<string> {
    const client = new OpenAI({
      apiKey: provider.apiKey || 'not-needed',
      baseURL: provider.baseUrl,
      timeout: options.timeoutMs ?? 120000,
    });

    const response = await client.chat.completions.create({
      model: provider.modelName,
      messages: [
        { role: 'system', content: 'You are a helpful study assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      ...(options.responseFormat && { response_format: options.responseFormat }),
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * System-provided provider derived from OPENROUTER_API_KEY (used as a
   * fallback seed so the platform works out of the box).
   */
  private getSystemProviders(): Array<{
    apiKey: string | null;
    baseUrl: string;
    modelName: string;
  }> {
    const key = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!key || key.includes('your-')) return [];
    return [
      {
        apiKey: key,
        baseUrl: this.configService.get<string>(
          'OPENROUTER_BASE_URL',
          'https://openrouter.ai/api/v1',
        ),
        modelName: this.configService.get<string>('OPENROUTER_DEFAULT_MODEL', 'openai/gpt-4o-mini'),
      },
    ];
  }

  private mapProvider(row: Record<string, unknown>): LlmProvider {
    return {
      id: row.id as string,
      name: row.name as string,
      providerType: row.provider_type as ProviderType,
      apiKey: row.api_key as string | null,
      baseUrl: row.base_url as string,
      modelName: row.model_name as string,
      priority: parseInt(String(row.priority), 10) || 0,
      isActive: (row.is_active as boolean) ?? true,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
