import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { AddSLCDto, DeductSLCDto } from './dto';

export interface SlcWallet {
  id: string;
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlcTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'credit' | 'debit';
  source: string;
  referenceId?: string;
  description?: string;
  balanceAfter?: number;
  createdAt: Date;
}

export interface RevisionCentreFunds {
  id: string;
  userId: string;
  balance: number;
  streak: number;
  lastPassedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SlcService {
  private readonly logger = new Logger(SlcService.name);

  constructor(private readonly db: DatabaseService) {}

  async createInitialWallet(userId: string): Promise<SlcWallet> {
    const id = uuidv4();
    const now = new Date();

    const result = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO slc_wallets (id, user_id, balance, total_earned, created_at, updated_at)
       VALUES ($1, $2, 500, 500, $3, $4)
       RETURNING *`,
      [id, userId, now, now],
    );

    await this.db.query(
      `INSERT INTO slc_transactions (id, user_id, amount, type, source, description, balance_after, created_at)
       VALUES ($1, $2, 500, 'credit', 'joining_bonus', 'Joining bonus', 500, $3)`,
      [uuidv4(), userId, now],
    );

    this.logger.log(`Created initial SLC wallet for user: ${userId}`);
    return this.mapWallet(result!);
  }

  async getWallet(userId: string): Promise<SlcWallet> {
    const result = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM slc_wallets WHERE user_id = $1',
      [userId],
    );

    if (!result) {
      return this.createInitialWallet(userId);
    }

    return this.mapWallet(result);
  }

  async addSLC(userId: string, dto: AddSLCDto): Promise<SlcWallet> {
    const wallet = await this.getWallet(userId);
    const newBalance = wallet.balance + dto.amount;
    const newTotalEarned = wallet.totalEarned + dto.amount;

    const result = await this.db.queryOne<Record<string, unknown>>(
      `UPDATE slc_wallets SET balance = $1, total_earned = $2, updated_at = NOW() WHERE user_id = $3 RETURNING *`,
      [newBalance, newTotalEarned, userId],
    );

    await this.db.query(
      `INSERT INTO slc_transactions (id, user_id, amount, type, source, reference_id, description, balance_after, created_at)
       VALUES ($1, $2, $3, 'credit', $4, $5, $6, $7, NOW())`,
      [
        uuidv4(),
        userId,
        dto.amount,
        dto.source,
        dto.referenceId || null,
        dto.description || null,
        newBalance,
      ],
    );

    this.logger.log(`Added ${dto.amount} SLC to user ${userId} from ${dto.source}`);
    return this.mapWallet(result!);
  }

  async deductSLC(userId: string, dto: DeductSLCDto): Promise<SlcWallet> {
    const wallet = await this.getWallet(userId);

    if (wallet.balance < dto.amount) {
      throw new BadRequestException('Insufficient SLC balance');
    }

    const newBalance = wallet.balance - dto.amount;
    const newTotalSpent = wallet.totalSpent + dto.amount;

    const result = await this.db.queryOne<Record<string, unknown>>(
      `UPDATE slc_wallets SET balance = $1, total_spent = $2, updated_at = NOW() WHERE user_id = $3 RETURNING *`,
      [newBalance, newTotalSpent, userId],
    );

    await this.db.query(
      `INSERT INTO slc_transactions (id, user_id, amount, type, source, description, balance_after, created_at)
       VALUES ($1, $2, $3, 'debit', $4, $5, $6, NOW())`,
      [uuidv4(), userId, dto.amount, dto.reason, dto.description || null, newBalance],
    );

    this.logger.log(`Deducted ${dto.amount} SLC from user ${userId} for ${dto.reason}`);
    return this.mapWallet(result!);
  }

  async addSLCTx(
    userId: string,
    dto: AddSLCDto,
    client: { query: (sql: string, params?: any[]) => { rows: any[] } },
  ): Promise<SlcWallet> {
    const wallet = await this.getWallet(userId);
    const newBalance = wallet.balance + dto.amount;
    const newTotalEarned = wallet.totalEarned + dto.amount;

    const result = await client.query(
      `UPDATE slc_wallets SET balance = $1, total_earned = $2, updated_at = NOW() WHERE user_id = $3 RETURNING *`,
      [newBalance, newTotalEarned, userId],
    );

    await client.query(
      `INSERT INTO slc_transactions (id, user_id, amount, type, source, reference_id, description, balance_after, created_at)
       VALUES ($1, $2, $3, 'credit', $4, $5, $6, $7, NOW())`,
      [
        uuidv4(),
        userId,
        dto.amount,
        dto.source,
        dto.referenceId || null,
        dto.description || null,
        newBalance,
      ],
    );

    this.logger.log(`Added ${dto.amount} SLC to user ${userId} from ${dto.source}`);
    return this.mapWallet(result.rows[0]!);
  }

  async deductSLCTx(
    userId: string,
    dto: DeductSLCDto,
    client: { query: (sql: string, params?: any[]) => { rows: any[] } },
  ): Promise<SlcWallet> {
    const wallet = await this.getWallet(userId);

    if (wallet.balance < dto.amount) {
      throw new BadRequestException('Insufficient SLC balance');
    }

    const newBalance = wallet.balance - dto.amount;
    const newTotalSpent = wallet.totalSpent + dto.amount;

    const result = await client.query(
      `UPDATE slc_wallets SET balance = $1, total_spent = $2, updated_at = NOW() WHERE user_id = $3 RETURNING *`,
      [newBalance, newTotalSpent, userId],
    );

    await client.query(
      `INSERT INTO slc_transactions (id, user_id, amount, type, source, description, balance_after, created_at)
       VALUES ($1, $2, $3, 'debit', $4, $5, $6, NOW())`,
      [uuidv4(), userId, dto.amount, dto.reason, dto.description || null, newBalance],
    );

    this.logger.log(`Deducted ${dto.amount} SLC from user ${userId} for ${dto.reason}`);
    return this.mapWallet(result.rows[0]!);
  }

  async getTransactionHistory(userId: string, limit = 50, offset = 0): Promise<SlcTransaction[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT * FROM slc_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    return rows.map((r) => this.mapTransaction(r));
  }

  async getRevisionCentreFunds(userId: string): Promise<RevisionCentreFunds> {
    const result = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM revision_centre_funds WHERE user_id = $1',
      [userId],
    );

    if (!result) {
      const id = uuidv4();
      const now = new Date();
      const inserted = await this.db.queryOne<Record<string, unknown>>(
        `INSERT INTO revision_centre_funds (id, user_id, balance, streak, created_at, updated_at)
         VALUES ($1, $2, 0, 0, $3, $4) RETURNING *`,
        [id, userId, now, now],
      );
      return this.mapRevisionCentreFunds(inserted!);
    }

    return this.mapRevisionCentreFunds(result);
  }

  async updateRevisionCentreFunds(
    userId: string,
    scorePercent: number,
    _totalQuestions: number,
  ): Promise<RevisionCentreFunds> {
    const funds = await this.getRevisionCentreFunds(userId);
    const now = new Date();

    if (scorePercent >= 30) {
      const reward = Math.round((scorePercent / 100) * 100 * 100) / 100;
      const newBalance = funds.balance + reward;
      let newStreak = funds.streak;

      if (funds.lastPassedAt) {
        const lastPassed = new Date(funds.lastPassedAt);
        const hoursDiff = (now.getTime() - lastPassed.getTime()) / (1000 * 60 * 60);
        if (hoursDiff <= 168) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
      } else {
        newStreak = 1;
      }

      const result = await this.db.queryOne<Record<string, unknown>>(
        `UPDATE revision_centre_funds SET balance = $1, streak = $2, last_passed_at = $3, updated_at = NOW() WHERE user_id = $4 RETURNING *`,
        [newBalance, newStreak, now, userId],
      );

      await this.addSLC(userId, {
        amount: reward,
        source: 'revision_centre',
        description: `Revision Centre quiz reward (${scorePercent.toFixed(1)}%)`,
      });

      await this.db.query(
        `INSERT INTO xp_records (id, user_id, source, amount, description, created_at)
         VALUES ($1, $2, 'revision_centre', $3, $4, NOW())`,
        [uuidv4(), userId, Math.round(scorePercent * 2), `Revision Centre quiz completed`],
      );

      return this.mapRevisionCentreFunds(result!);
    } else {
      const slashAmount = funds.balance * 0.15;
      const newBalance = Math.max(0, funds.balance - slashAmount);
      const newStreak = 0;

      const result = await this.db.queryOne<Record<string, unknown>>(
        `UPDATE revision_centre_funds SET balance = $1, streak = $2, last_passed_at = NULL, updated_at = NOW() WHERE user_id = $3 RETURNING *`,
        [newBalance, newStreak, userId],
      );

      this.logger.log(
        `Slashed ${slashAmount} SLC from user ${userId} Revision Centre funds (score: ${scorePercent}%)`,
      );
      return this.mapRevisionCentreFunds(result!);
    }
  }

  async getAllWallets() {
    const wallets = await this.db.queryMany<Record<string, unknown>>(
      `SELECT w.*, u.username, u.name FROM slc_wallets w JOIN users u ON w.user_id = u.id ORDER BY w.balance DESC`,
    );

    return wallets.map((w) => ({
      id: w.id,
      userId: w.user_id,
      username: w.username,
      name: w.name,
      balance: parseFloat(String(w.balance)),
      totalEarned: parseFloat(String(w.total_earned)),
      totalSpent: parseFloat(String(w.total_spent)),
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    }));
  }

  private mapWallet(row: Record<string, unknown>): SlcWallet {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      balance: parseFloat(String(row.balance)),
      totalEarned: parseFloat(String(row.total_earned)),
      totalSpent: parseFloat(String(row.total_spent)),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapTransaction(row: Record<string, unknown>): SlcTransaction {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      amount: parseFloat(String(row.amount)),
      type: row.type as 'credit' | 'debit',
      source: row.source as string,
      referenceId: row.reference_id as string | undefined,
      description: row.description as string | undefined,
      balanceAfter: row.balance_after ? parseFloat(String(row.balance_after)) : undefined,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapRevisionCentreFunds(row: Record<string, unknown>): RevisionCentreFunds {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      balance: parseFloat(String(row.balance)),
      streak: parseInt(String(row.streak || 0), 10),
      lastPassedAt: row.last_passed_at ? new Date(row.last_passed_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
