import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { SlcService } from '../slc/slc.service';

export interface Card {
  id: string;
  name: string;
  rarity: string;
  spCost: number;
  abilities: Record<string, unknown>[];
  effectDescription: string;
  imageUrl?: string;
  isBattlepassExclusive: boolean;
  maxQuantity: number;
  createdAt: Date;
}

export interface UserCard {
  id: string;
  userId: string;
  cardId: string;
  quantity: number;
  card: Card;
  acquiredAt: Date;
}

export interface UserDeck {
  id: string;
  userId: string;
  cardIds: string[];
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly slcService: SlcService,
  ) {}

  async getAllCards(): Promise<Card[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT c.*, cm.price_slc, cm.is_available
       FROM cards c
       LEFT JOIN card_marketplace cm ON c.id = cm.card_id
       WHERE cm.is_available = TRUE OR cm.id IS NULL
       ORDER BY c.rarity ASC, c.name ASC`,
    );

    return rows.map((r) => this.mapCard(r));
  }

  async getUserCards(userId: string): Promise<UserCard[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT uc.*, c.name as card_name, c.rarity, c.sp_cost, c.abilities, c.effect_description, c.image_url, c.is_battlepass_exclusive
       FROM user_cards uc
       JOIN cards c ON uc.card_id = c.id
       WHERE uc.user_id = $1
       ORDER BY c.rarity ASC, c.name ASC`,
      [userId],
    );

    return rows.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      cardId: r.card_id as string,
      quantity: parseInt(String(r.quantity || 1), 10),
      acquiredAt: new Date(r.acquired_at as string),
      card: {
        id: r.card_id as string,
        name: r.card_name as string,
        rarity: r.rarity as string,
        spCost: parseInt(String(r.sp_cost || 1), 10),
        abilities: typeof r.abilities === 'string' ? JSON.parse(r.abilities) : r.abilities || [],
        effectDescription: r.effect_description as string,
        imageUrl: r.image_url as string | undefined,
        isBattlepassExclusive: r.is_battlepass_exclusive as boolean,
        maxQuantity: 99,
        createdAt: new Date(r.acquired_at as string),
      },
    }));
  }

  async buyCard(userId: string, cardId: string): Promise<UserCard> {
    const card = await this.db.queryOne<Record<string, unknown>>(
      'SELECT c.*, cm.price_slc, cm.stock FROM cards c JOIN card_marketplace cm ON c.id = cm.card_id WHERE c.id = $1 AND cm.is_available = TRUE',
      [cardId],
    );

    if (!card) {
      throw new NotFoundException('Card not available in marketplace');
    }

    const stock = card.stock;
    if (stock !== null && stock !== undefined && stock !== -1 && parseInt(String(stock), 10) <= 0) {
      throw new BadRequestException('Card is out of stock');
    }

    const price = parseFloat(String(card.price_slc || 0));

    await this.db.transaction(async (client) => {
      await this.slcService.deductSLCTx(
        userId,
        {
          amount: price,
          reason: 'card_purchase',
          description: `Purchased card: ${card.name}`,
        },
        client,
      );

      const existingRows = await client.query(
        'SELECT * FROM user_cards WHERE user_id = $1 AND card_id = $2',
        [userId, cardId],
      );
      const existing = existingRows.rows[0];

      if (existing) {
        await client.query(
          'UPDATE user_cards SET quantity = quantity + 1 WHERE user_id = $1 AND card_id = $2',
          [userId, cardId],
        );
      } else {
        await client.query(
          'INSERT INTO user_cards (id, user_id, card_id, quantity, acquired_at) VALUES ($1, $2, $3, 1, NOW())',
          [uuidv4(), userId, cardId],
        );
      }

      if (stock !== null && stock !== undefined && stock !== -1) {
        await client.query('UPDATE card_marketplace SET stock = stock - 1 WHERE card_id = $1', [
          cardId,
        ]);
      }
    });

    this.logger.log(`User ${userId} purchased card ${cardId}`);

    const rows = await this.db.queryMany<Record<string, unknown>>(
      'SELECT uc.*, c.name as card_name, c.rarity, c.sp_cost, c.abilities, c.effect_description FROM user_cards uc JOIN cards c ON uc.card_id = c.id WHERE uc.user_id = $1 AND uc.card_id = $2',
      [userId, cardId],
    );

    const r = rows[0];
    return {
      id: r.id as string,
      userId: r.user_id as string,
      cardId: r.card_id as string,
      quantity: parseInt(String(r.quantity || 1), 10),
      acquiredAt: new Date(r.acquired_at as string),
      card: {
        id: r.card_id as string,
        name: r.card_name as string,
        rarity: r.rarity as string,
        spCost: parseInt(String(r.sp_cost || 1), 10),
        abilities: typeof r.abilities === 'string' ? JSON.parse(r.abilities) : r.abilities || [],
        effectDescription: r.effect_description as string,
        imageUrl: undefined,
        isBattlepassExclusive: false,
        maxQuantity: 99,
        createdAt: new Date(r.acquired_at as string),
      },
    };
  }

  async equipCards(userId: string, cardIds: string[]): Promise<UserDeck> {
    if (cardIds.length > 5) {
      throw new BadRequestException('Deck cannot exceed 5 cards');
    }

    const userCards = await this.db.queryMany<Record<string, unknown>>(
      'SELECT card_id FROM user_cards WHERE user_id = $1',
      [userId],
    );

    const ownedCardIds = new Set(userCards.map((c) => c.card_id as string));
    for (const cid of cardIds) {
      if (!ownedCardIds.has(cid)) {
        throw new BadRequestException(`Card ${cid} not owned`);
      }
    }

    const existing = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM user_decks WHERE user_id = $1',
      [userId],
    );

    if (existing) {
      await this.db.query(
        'UPDATE user_decks SET card_ids = $1, updated_at = NOW() WHERE user_id = $2',
        [JSON.stringify(cardIds), userId],
      );
    } else {
      await this.db.query(
        'INSERT INTO user_decks (id, user_id, card_ids, name, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())',
        [uuidv4(), userId, JSON.stringify(cardIds), 'Default Deck'],
      );
    }

    const result = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM user_decks WHERE user_id = $1',
      [userId],
    );

    return this.mapDeck(result!);
  }

  async getDeck(userId: string): Promise<UserDeck | null> {
    const result = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM user_decks WHERE user_id = $1',
      [userId],
    );

    if (!result) return null;
    return this.mapDeck(result);
  }

  async createCard(body: Record<string, unknown>): Promise<Card> {
    const id = uuidv4();
    const now = new Date();

    const result = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO cards (id, name, rarity, sp_cost, abilities, effect_description, image_url, is_battlepass_exclusive, max_quantity, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        body.name,
        body.rarity || 'common',
        body.spCost || 1,
        JSON.stringify(body.abilities || []),
        body.effectDescription || null,
        body.imageUrl || null,
        body.isBattlepassExclusive || false,
        body.maxQuantity || 99,
        now,
      ],
    );

    await this.db.query(
      'INSERT INTO card_marketplace (id, card_id, price_slc, is_available, stock) VALUES ($1, $2, $3, TRUE, -1)',
      [uuidv4(), id, body.priceSLC || 100],
    );

    return this.mapCard(result!);
  }

  private mapCard(row: Record<string, unknown>): Card {
    return {
      id: row.id as string,
      name: row.name as string,
      rarity: row.rarity as string,
      spCost: parseInt(String(row.sp_cost || 1), 10),
      abilities:
        typeof row.abilities === 'string' ? JSON.parse(row.abilities) : row.abilities || [],
      effectDescription: row.effect_description as string,
      imageUrl: row.image_url as string | undefined,
      isBattlepassExclusive: row.is_battlepass_exclusive as boolean,
      maxQuantity: parseInt(String(row.max_quantity || 99), 10),
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapDeck(row: Record<string, unknown>): UserDeck {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      cardIds: typeof row.card_ids === 'string' ? JSON.parse(row.card_ids) : row.card_ids || [],
      name: row.name as string,
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
