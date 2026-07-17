import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface AuditLogEntry {
  id: string;
  actorUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: Date;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  async log(
    actorUsername: string,
    action: string,
    targetType: string,
    targetId: string,
    oldValue?: unknown,
    newValue?: unknown,
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO audit_logs (actor_username, action, target_type, target_id, old_value, new_value, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          actorUsername,
          action,
          targetType,
          targetId,
          oldValue !== undefined ? JSON.stringify(oldValue) : null,
          newValue !== undefined ? JSON.stringify(newValue) : null,
        ],
      );
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${error}`);
    }
  }

  async list(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
    const rows = await this.db.queryMany<{
      id: string;
      actor_username: string;
      action: string;
      target_type: string;
      target_id: string;
      old_value: unknown;
      new_value: unknown;
      timestamp: Date;
    }>(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1 OFFSET $2`, [limit, offset]);

    return rows.map((r) => this.mapRow(r));
  }

  async listByActor(actorUsername: string, limit = 100): Promise<AuditLogEntry[]> {
    const rows = await this.db.queryMany<{
      id: string;
      actor_username: string;
      action: string;
      target_type: string;
      target_id: string;
      old_value: unknown;
      new_value: unknown;
      timestamp: Date;
    }>(`SELECT * FROM audit_logs WHERE actor_username = $1 ORDER BY timestamp DESC LIMIT $2`, [
      actorUsername,
      limit,
    ]);

    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: {
    id: string;
    actor_username: string;
    action: string;
    target_type: string;
    target_id: string;
    old_value: unknown;
    new_value: unknown;
    timestamp: Date;
  }): AuditLogEntry {
    return {
      id: r.id,
      actorUsername: r.actor_username,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      oldValue: typeof r.old_value === 'string' ? JSON.parse(r.old_value) : r.old_value,
      newValue: typeof r.new_value === 'string' ? JSON.parse(r.new_value) : r.new_value,
      timestamp: new Date(r.timestamp),
    };
  }
}
