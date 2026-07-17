import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { SlcService } from '../slc/slc.service';
import { LlmService } from '../../llm/llm.service';

export interface BattlepassSeason {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  finalRewardCardId?: string;
  description?: string;
  createdAt: Date;
}

export interface BattlepassTier {
  id: string;
  seasonId: string;
  tierNumber: number;
  expRequired: number;
  rewards: Record<string, unknown>[];
  createdAt: Date;
}

export interface UserBattlepass {
  id: string;
  userId: string;
  seasonId: string;
  currentTier: number;
  totalExp: number;
  claimedRewards: Record<string, unknown>[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EventMission {
  id: string;
  seasonId?: string;
  title: string;
  description?: string;
  expReward: number;
  slcReward: number;
  difficulty: string;
  isActive: boolean;
  generatedByAi: boolean;
  targetUserId?: string;
  createdAt: Date;
}

@Injectable()
export class BattlepassService {
  private readonly logger = new Logger(BattlepassService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly slcService: SlcService,
    private readonly llmService: LlmService,
  ) {}

  async getCurrentSeason(): Promise<BattlepassSeason | null> {
    const result = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM battlepass_seasons WHERE is_active = TRUE ORDER BY start_date DESC LIMIT 1',
    );

    if (!result) return null;
    return this.mapSeason(result);
  }

  async getUserProgress(userId: string, seasonId?: string): Promise<UserBattlepass> {
    if (!seasonId) {
      const season = await this.getCurrentSeason();
      if (!season) {
        throw new NotFoundException('No active season');
      }
      seasonId = season.id;
    }

    const result = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM user_battlepass WHERE user_id = $1 AND season_id = $2',
      [userId, seasonId],
    );

    if (!result) {
      const id = uuidv4();
      const now = new Date();
      const inserted = await this.db.queryOne<Record<string, unknown>>(
        `INSERT INTO user_battlepass (id, user_id, season_id, current_tier, total_exp, claimed_rewards, created_at, updated_at)
         VALUES ($1, $2, $3, 1, 0, '[]', $4, $5) RETURNING *`,
        [id, userId, seasonId, now, now],
      );
      return this.mapUserBattlepass(inserted!);
    }

    return this.mapUserBattlepass(result);
  }

  async addExp(userId: string, seasonId?: string, amount: number = 0): Promise<UserBattlepass> {
    const userBP = await this.getUserProgress(userId, seasonId);

    const newTotalExp = userBP.totalExp + amount;
    const tiers = await this.db.queryMany<Record<string, unknown>>(
      'SELECT * FROM battlepass_tiers WHERE season_id = $1 ORDER BY tier_number ASC',
      [userBP.seasonId],
    );

    let newTier = userBP.currentTier;
    for (const tier of tiers) {
      if (newTotalExp >= parseInt(String(tier.exp_required || 0), 10)) {
        newTier = parseInt(String(tier.tier_number || 1), 10);
      }
    }

    const result = await this.db.queryOne<Record<string, unknown>>(
      `UPDATE user_battlepass SET total_exp = $1, current_tier = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [newTotalExp, newTier, userBP.id],
    );

    await this.db.query(
      `INSERT INTO xp_records (id, user_id, source, amount, description, created_at) VALUES ($1, $2, 'event_mission', $3, $4, NOW())`,
      [uuidv4(), userId, amount, 'Battlepass EXP added'],
    );

    return this.mapUserBattlepass(result!);
  }

  async claimReward(
    userId: string,
    seasonId?: string,
    tierId?: string,
  ): Promise<{ claimed: boolean; reward: Record<string, unknown> }> {
    if (!tierId) {
      throw new BadRequestException('Tier ID is required');
    }

    const userBP = await this.getUserProgress(userId, seasonId);

    const tier = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM battlepass_tiers WHERE id = $1',
      [tierId],
    );
    if (!tier) throw new NotFoundException('Tier not found');

    if (userBP.currentTier < parseInt(String(tier.tier_number || 1), 10)) {
      throw new BadRequestException('Tier not yet unlocked');
    }

    const claimedRewards = Array.isArray(userBP.claimedRewards) ? userBP.claimedRewards : [];
    if (claimedRewards.some((r: Record<string, unknown>) => r.tierId === tierId)) {
      throw new BadRequestException('Reward already claimed');
    }

    const rewards =
      typeof tier.rewards === 'string' ? JSON.parse(tier.rewards) : tier.rewards || [];
    for (const reward of rewards) {
      if (reward.type === 'slc') {
        await this.slcService.addSLC(userId, {
          amount: reward.amount || 0,
          source: 'battlepass',
          description: `Battlepass tier ${tier.tier_number} reward`,
        });
      } else if (reward.type === 'card' && reward.cardId) {
        const existing = await this.db.queryOne(
          'SELECT * FROM user_cards WHERE user_id = $1 AND card_id = $2',
          [userId, reward.cardId],
        );
        if (existing) {
          await this.db.query(
            'UPDATE user_cards SET quantity = quantity + 1 WHERE user_id = $1 AND card_id = $2',
            [userId, reward.cardId],
          );
        } else {
          await this.db.query(
            'INSERT INTO user_cards (id, user_id, card_id, quantity, acquired_at) VALUES ($1, $2, $3, 1, NOW())',
            [uuidv4(), userId, reward.cardId],
          );
        }
      }
    }

    claimedRewards.push({ tierId, claimedAt: new Date() });
    await this.db.query(
      'UPDATE user_battlepass SET claimed_rewards = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(claimedRewards), userBP.id],
    );

    return { claimed: true, reward: rewards[0] || {} };
  }

  async getMissions(userId: string): Promise<EventMission[]> {
    const season = await this.getCurrentSeason();
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT em.* FROM event_missions em
       WHERE em.is_active = TRUE AND (em.target_user_id IS NULL OR em.target_user_id = $1)
       AND (em.season_id IS NULL OR em.season_id = $2)
       ORDER BY em.created_at DESC`,
      [userId, season?.id],
    );

    return rows.map((r) => this.mapEventMission(r));
  }

  async claimMission(userId: string, missionId: string): Promise<{ slc: number; xp: number }> {
    const mission = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM event_missions WHERE id = $1',
      [missionId],
    );
    if (!mission) throw new NotFoundException('Mission not found');

    const userMission = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM user_event_missions WHERE user_id = $1 AND event_mission_id = $2',
      [userId, missionId],
    );

    if (!userMission) {
      const id = uuidv4();
      await this.db.query(
        `INSERT INTO user_event_missions (id, user_id, event_mission_id, status, progress, claimed, started_at)
         VALUES ($1, $2, $3, 'completed', 100, TRUE, NOW())`,
        [id, userId, missionId],
      );
    } else {
      await this.db.query(
        'UPDATE user_event_missions SET status = $1, progress = $2, claimed = TRUE, completed_at = NOW() WHERE id = $3',
        ['completed', 100, userMission.id],
      );
    }

    await this.slcService.addSLC(userId, {
      amount: parseFloat(String(mission.slc_reward || 0)),
      source: 'event_mission',
      referenceId: missionId,
      description: `Event mission reward: ${mission.title}`,
    });

    await this.db.query(
      `INSERT INTO xp_records (id, user_id, source, amount, description, created_at) VALUES ($1, $2, 'event_mission', $3, $4, NOW())`,
      [
        uuidv4(),
        userId,
        parseInt(String(mission.exp_reward || 0), 10),
        `Event mission: ${mission.title}`,
      ],
    );

    await this.addExp(
      userId,
      mission.season_id as string,
      parseInt(String(mission.exp_reward || 0), 10),
    );

    return {
      slc: parseFloat(String(mission.slc_reward || 0)),
      xp: parseInt(String(mission.exp_reward || 0), 10),
    };
  }

  async generateEventMissions(userId: string, seasonId?: string): Promise<EventMission[]> {
    const user = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM users WHERE id = $1',
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');

    const recentNotes = await this.db.queryMany<Record<string, unknown>>(
      'SELECT title, content FROM notes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [userId],
    );

    const notesText = recentNotes.map((n) => `${n.title}: ${n.content}`).join('\n\n');

    try {
      const prompt = `Generate 3 study event missions for a student based on their recent notes. Return as JSON array with objects having: title, description, exp_reward (number), slc_reward (number), difficulty (easy/medium/hard). Notes: ${notesText || 'No notes available'}`;

      const response = await this.llmService.callWithFallback(prompt, {
        temperature: 0.7,
        maxTokens: 1000,
        responseFormat: { type: 'json_object' },
      });

      const parsed = JSON.parse(response);
      const missions: EventMission[] = [];

      for (const m of Array.isArray(parsed) ? parsed : parsed.missions || []) {
        const id = uuidv4();
        const result = await this.db.queryOne<Record<string, unknown>>(
          `INSERT INTO event_missions (id, season_id, title, description, exp_reward, slc_reward, difficulty, is_active, generated_by_ai, target_user_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE, $8, NOW()) RETURNING *`,
          [
            id,
            seasonId || null,
            m.title,
            m.description,
            m.exp_reward || 50,
            m.slc_reward || 25,
            m.difficulty || 'medium',
            userId,
          ],
        );
        missions.push(this.mapEventMission(result!));
      }

      return missions;
    } catch (error) {
      this.logger.error(`Failed to generate AI missions: ${error.message}`);

      const defaultMissions: Array<{
        title: string;
        description: string;
        exp: number;
        slc: number;
        difficulty: string;
      }> = [
        {
          title: 'Review Flashcards',
          description: 'Review 20 flashcards from any study set',
          exp: 50,
          slc: 25,
          difficulty: 'easy',
        },
        {
          title: 'Take a Quiz',
          description: 'Complete any quiz with a score above 70%',
          exp: 75,
          slc: 35,
          difficulty: 'medium',
        },
        {
          title: 'Study Session',
          description: 'Spend 30 minutes studying any topic',
          exp: 100,
          slc: 50,
          difficulty: 'hard',
        },
      ];

      const missions: EventMission[] = [];
      for (const m of defaultMissions) {
        const id = uuidv4();
        const result = await this.db.queryOne<Record<string, unknown>>(
          `INSERT INTO event_missions (id, season_id, title, description, exp_reward, slc_reward, difficulty, is_active, generated_by_ai, target_user_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE, $8, NOW()) RETURNING *`,
          [id, seasonId || null, m.title, m.description, m.exp, m.slc, m.difficulty, userId],
        );
        missions.push(this.mapEventMission(result!));
      }

      return missions;
    }
  }

  async createSeason(body: Record<string, unknown>): Promise<BattlepassSeason> {
    const id = uuidv4();
    const now = new Date();
    const result = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO battlepass_seasons (id, name, start_date, end_date, is_active, final_reward_card_id, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        id,
        body.name,
        body.startDate,
        body.endDate,
        body.isActive || false,
        body.finalRewardCardId || null,
        body.description || null,
        now,
      ],
    );
    return this.mapSeason(result!);
  }

  async createTier(body: Record<string, unknown>): Promise<BattlepassTier> {
    const id = uuidv4();
    const now = new Date();
    const result = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO battlepass_tiers (id, season_id, tier_number, exp_required, rewards, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        id,
        body.seasonId,
        body.tierNumber,
        body.expRequired,
        JSON.stringify(body.rewards || []),
        now,
      ],
    );
    return this.mapTier(result!);
  }

  private mapSeason(row: Record<string, unknown>): BattlepassSeason {
    return {
      id: row.id as string,
      name: row.name as string,
      startDate: new Date(row.start_date as string),
      endDate: new Date(row.end_date as string),
      isActive: row.is_active as boolean,
      finalRewardCardId: row.final_reward_card_id as string | undefined,
      description: row.description as string | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapTier(row: Record<string, unknown>): BattlepassTier {
    return {
      id: row.id as string,
      seasonId: row.season_id as string,
      tierNumber: parseInt(String(row.tier_number || 1), 10),
      expRequired: parseInt(String(row.exp_required || 0), 10),
      rewards: typeof row.rewards === 'string' ? JSON.parse(row.rewards) : row.rewards || [],
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapUserBattlepass(row: Record<string, unknown>): UserBattlepass {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      seasonId: row.season_id as string,
      currentTier: parseInt(String(row.current_tier || 1), 10),
      totalExp: parseInt(String(row.total_exp || 0), 10),
      claimedRewards:
        typeof row.claimed_rewards === 'string'
          ? JSON.parse(row.claimed_rewards)
          : row.claimed_rewards || [],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapEventMission(row: Record<string, unknown>): EventMission {
    return {
      id: row.id as string,
      seasonId: row.season_id as string | undefined,
      title: row.title as string,
      description: row.description as string | undefined,
      expReward: parseInt(String(row.exp_reward || 0), 10),
      slcReward: parseFloat(String(row.slc_reward || 0)),
      difficulty: row.difficulty as string,
      isActive: row.is_active as boolean,
      generatedByAi: row.generated_by_ai as boolean,
      targetUserId: row.target_user_id as string | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}
