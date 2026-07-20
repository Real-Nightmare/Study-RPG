import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (redisUrl) {
      this.client = new Redis(redisUrl, {
        db: this.configService.get<number>('REDIS_DB', 0),
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });
    } else {
      this.client = new Redis({
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
        db: this.configService.get<number>('REDIS_DB', 0),
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });
    }

    this.client.on('error', (err) => {
      this.logger.error('Redis error', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connection established');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  getClient(): Redis {
    return this.client;
  }
}
