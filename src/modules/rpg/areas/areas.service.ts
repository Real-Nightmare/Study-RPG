import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';

export interface World {
  id: string;
  name: string;
  description?: string;
  unlockCondition: Record<string, unknown>;
  orderIndex: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Area {
  id: string;
  worldId: string;
  name: string;
  description?: string;
  requiredLevel: number;
  orderIndex: number;
  isUnlocked: boolean;
  theme: string;
  createdAt: Date;
}

export interface Subsection {
  id: string;
  areaId: string;
  name: string;
  description?: string;
  orderIndex: number;
  xpReward: number;
  slcReward: number;
  isUnlocked: boolean;
}

export interface UserProgress {
  id: string;
  userId: string;
  areaId: string;
  subsectionId?: string;
  status: string;
  score: number;
  attempts: number;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AreasService {
  private readonly logger = new Logger(AreasService.name);

  constructor(private readonly db: DatabaseService) {}

  async getWorlds(): Promise<World[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      'SELECT * FROM worlds ORDER BY order_index ASC',
    );

    return rows.map((r) => this.mapWorld(r));
  }

  async getAreas(
    userId: string,
    worldId: string,
  ): Promise<{ areas: Area[]; progress: Record<string, UserProgress> }> {
    const areas = await this.db.queryMany<Record<string, unknown>>(
      'SELECT * FROM areas WHERE world_id = $1 ORDER BY order_index ASC',
      [worldId],
    );

    const progressRows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT up.*, u.current_level FROM user_progress up
       JOIN user_levels u ON up.user_id = u.user_id
       WHERE up.user_id = $1 AND up.area_id IN (SELECT id FROM areas WHERE world_id = $2)`,
      [userId, worldId],
    );

    const progressMap: Record<string, UserProgress> = {};
    for (const row of progressRows) {
      progressMap[row.area_id as string] = this.mapUserProgress(row);
    }

    const mappedAreas = areas.map((a) => this.mapArea(a));

    for (const area of mappedAreas) {
      const userLevel = await this.getUserLevel(userId);
      area.isUnlocked = userLevel >= area.requiredLevel;

      if (!progressMap[area.id]) {
        progressMap[area.id] = {
          id: '',
          userId,
          areaId: area.id,
          status: area.isUnlocked ? 'active' : 'locked',
          score: 0,
          attempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    }

    return { areas: mappedAreas, progress: progressMap };
  }

  async unlockArea(userId: string, areaId: string): Promise<{ success: boolean; message: string }> {
    const area = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM areas WHERE id = $1',
      [areaId],
    );

    if (!area) {
      throw new NotFoundException('Area not found');
    }

    const userLevel = await this.getUserLevel(userId);
    const requiredLevel = parseInt(String(area.required_level || 1), 10);

    if (userLevel < requiredLevel) {
      throw new BadRequestException(`Level ${requiredLevel} required to unlock this area`);
    }

    const existing = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM user_progress WHERE user_id = $1 AND area_id = $2',
      [userId, areaId],
    );

    if (existing) {
      if ((existing.status as string) !== 'locked') {
        return { success: true, message: 'Area already unlocked' };
      }

      await this.db.query(
        `UPDATE user_progress SET status = 'active', updated_at = NOW() WHERE user_id = $1 AND area_id = $2`,
        [userId, areaId],
      );
    } else {
      await this.db.query(
        `INSERT INTO user_progress (id, user_id, area_id, status, created_at, updated_at) VALUES ($1, $2, $3, 'active', NOW(), NOW())`,
        [uuidv4(), userId, areaId],
      );
    }

    return { success: true, message: 'Area unlocked successfully' };
  }

  async completeSubsection(
    userId: string,
    subsectionId: string,
    score: number,
  ): Promise<UserProgress> {
    const subsection = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM subsections WHERE id = $1',
      [subsectionId],
    );

    if (!subsection) {
      throw new NotFoundException('Subsection not found');
    }

    const existing = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM user_progress WHERE user_id = $1 AND subsection_id = $2',
      [userId, subsectionId],
    );

    const now = new Date();

    if (existing) {
      await this.db.query(
        `UPDATE user_progress SET status = 'completed', score = $1, attempts = attempts + 1, completed_at = $2, updated_at = NOW() WHERE id = $3`,
        [score, now, existing.id],
      );
    } else {
      await this.db.query(
        `INSERT INTO user_progress (id, user_id, area_id, subsection_id, status, score, attempts, completed_at, created_at, updated_at) VALUES ($1, $2, $3, $4, 'completed', $5, 1, $6, NOW(), NOW())`,
        [uuidv4(), userId, subsection.area_id, subsectionId, score, now],
      );
    }

    const xpReward = parseInt(String(subsection.xp_reward || 50), 10);
    await this.db.query(
      `INSERT INTO xp_records (id, user_id, source, amount, description, created_at) VALUES ($1, $2, 'study_session', $3, $4, NOW())`,
      [uuidv4(), userId, xpReward, `Completed subsection: ${subsection.name}`],
    );

    const result = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM user_progress WHERE user_id = $1 AND subsection_id = $2',
      [userId, subsectionId],
    );

    return this.mapUserProgress(result!);
  }

  async getUserProgress(userId: string): Promise<UserProgress[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      'SELECT * FROM user_progress WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId],
    );

    return rows.map((r) => this.mapUserProgress(r));
  }

  async createWorld(body: Record<string, unknown>): Promise<World> {
    const id = uuidv4();
    const now = new Date();
    const result = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO worlds (id, name, description, unlock_condition, order_index, is_active, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        id,
        body.name,
        body.description || null,
        JSON.stringify(body.unlockCondition || {}),
        body.orderIndex || 0,
        body.isActive !== false,
        now,
      ],
    );
    return this.mapWorld(result!);
  }

  async createArea(body: Record<string, unknown>): Promise<Area> {
    const id = uuidv4();
    const now = new Date();
    const result = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO areas (id, world_id, name, description, required_level, order_index, is_unlocked, theme, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        id,
        body.worldId,
        body.name,
        body.description || null,
        body.requiredLevel || 1,
        body.orderIndex || 0,
        body.isUnlocked || false,
        body.theme || 'standard',
        now,
      ],
    );
    return this.mapArea(result!);
  }

  async updateArea(id: string, body: Record<string, unknown>): Promise<Area> {
    const existing = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM areas WHERE id = $1',
      [id],
    );
    if (!existing) throw new NotFoundException('Area not found');

    const result = await this.db.queryOne<Record<string, unknown>>(
      `UPDATE areas SET name = COALESCE($1, name), description = COALESCE($2, description), required_level = COALESCE($3, required_level), is_unlocked = COALESCE($4, is_unlocked), updated_at = NOW() WHERE id = $5 RETURNING *`,
      [
        body.name || existing.name,
        body.description !== undefined ? body.description : existing.description,
        body.requiredLevel ?? existing.required_level,
        body.isUnlocked ?? existing.is_unlocked,
        id,
      ],
    );

    return this.mapArea(result!);
  }

  private async getUserLevel(userId: string): Promise<number> {
    const result = await this.db.queryOne<Record<string, unknown>>(
      'SELECT current_level FROM user_levels WHERE user_id = $1',
      [userId],
    );
    return result ? parseInt(String(result.current_level || 1), 10) : 1;
  }

  private mapWorld(row: Record<string, unknown>): World {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      unlockCondition:
        typeof row.unlock_condition === 'string'
          ? JSON.parse(row.unlock_condition)
          : row.unlock_condition || {},
      orderIndex: parseInt(String(row.order_index || 0), 10),
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapArea(row: Record<string, unknown>): Area {
    return {
      id: row.id as string,
      worldId: row.world_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      requiredLevel: parseInt(String(row.required_level || 1), 10),
      orderIndex: parseInt(String(row.order_index || 0), 10),
      isUnlocked: row.is_unlocked as boolean,
      theme: row.theme as string,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapUserProgress(row: Record<string, unknown>): UserProgress {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      areaId: row.area_id as string,
      subsectionId: row.subsection_id as string | undefined,
      status: row.status as string,
      score: parseInt(String(row.score || 0), 10),
      attempts: parseInt(String(row.attempts || 0), 10),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
