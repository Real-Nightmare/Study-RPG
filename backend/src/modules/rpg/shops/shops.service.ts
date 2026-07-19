import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { SlcService } from '../slc/slc.service';

export interface Ability {
  id: string;
  name: string;
  description?: string;
  spCost: number;
  effectType: string;
  effectValue: number;
  priceSlc: number;
  target: string;
  createdAt: Date;
}

export interface UserAbility {
  id: string;
  userId: string;
  abilityId: string;
  quantity: number;
  acquiredAt: Date;
  ability: Ability;
}

export interface Item {
  id: string;
  name: string;
  description?: string;
  itemType: string;
  effectType: string;
  effectValue: number;
  priceSlc: number;
  countersMonsterType?: string;
  maxStack: number;
  createdAt: Date;
}

export interface UserItem {
  id: string;
  userId: string;
  itemId: string;
  quantity: number;
  acquiredAt: Date;
  item: Item;
}

export interface Cosmetic {
  id: string;
  name: string;
  type: string;
  priceSlc: number;
  imageUrl?: string;
  rarity: string;
  createdAt: Date;
}

export interface UserCosmetic {
  id: string;
  userId: string;
  cosmeticId: string;
  isEquipped: boolean;
  acquiredAt: Date;
  cosmetic: Cosmetic;
}

@Injectable()
export class ShopsService {
  private readonly logger = new Logger(ShopsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly slcService: SlcService,
  ) {}

  async getAbilities(): Promise<Ability[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      'SELECT * FROM abilities ORDER BY price_slc ASC',
    );
    return rows.map((r) => this.mapAbility(r));
  }

  async buyAbility(userId: string, abilityId: string): Promise<UserAbility> {
    const ability = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM abilities WHERE id = $1',
      [abilityId],
    );
    if (!ability) throw new NotFoundException('Ability not found');

    const price = parseFloat(String(ability.price_slc || 0));

    await this.db.transaction(async (client) => {
      await this.slcService.deductSLCTx(
        userId,
        {
          amount: price,
          reason: 'ability_purchase',
          description: `Purchased ability: ${ability.name}`,
        },
        client,
      );

      const existingRows = await client.query(
        'SELECT * FROM user_abilities WHERE user_id = $1 AND ability_id = $2',
        [userId, abilityId],
      );
      const existing = existingRows.rows[0];

      if (existing) {
        await client.query(
          'UPDATE user_abilities SET quantity = quantity + 1 WHERE user_id = $1 AND ability_id = $2',
          [userId, abilityId],
        );
      } else {
        await client.query(
          'INSERT INTO user_abilities (id, user_id, ability_id, quantity, acquired_at) VALUES ($1, $2, $3, 1, NOW())',
          [uuidv4(), userId, abilityId],
        );
      }
    });

    this.logger.log(`User ${userId} purchased ability ${abilityId}`);
    return this.getUserAbilities(userId).then(
      (list) => list.find((a) => a.abilityId === abilityId)!,
    );
  }

  async getItems(): Promise<Item[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      'SELECT * FROM items ORDER BY price_slc ASC',
    );
    return rows.map((r) => this.mapItem(r));
  }

  async buyItem(userId: string, itemId: string): Promise<UserItem> {
    const item = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM items WHERE id = $1',
      [itemId],
    );
    if (!item) throw new NotFoundException('Item not found');

    const price = parseFloat(String(item.price_slc || 0));

    await this.db.transaction(async (client) => {
      await this.slcService.deductSLCTx(
        userId,
        {
          amount: price,
          reason: 'item_purchase',
          description: `Purchased item: ${item.name}`,
        },
        client,
      );

      const existingRows = await client.query(
        'SELECT * FROM user_items WHERE user_id = $1 AND item_id = $2',
        [userId, itemId],
      );
      const existing = existingRows.rows[0];

      if (existing) {
        const currentQty = parseInt(String(existing.quantity || 0), 10);
        const maxStack = parseInt(String(item.max_stack || 10), 10);
        if (currentQty >= maxStack) {
          throw new BadRequestException('Item stack limit reached');
        }

        await client.query(
          'UPDATE user_items SET quantity = quantity + 1 WHERE user_id = $1 AND item_id = $2',
          [userId, itemId],
        );
      } else {
        await client.query(
          'INSERT INTO user_items (id, user_id, item_id, quantity, acquired_at) VALUES ($1, $2, $3, 1, NOW())',
          [uuidv4(), userId, itemId],
        );
      }
    });

    this.logger.log(`User ${userId} purchased item ${itemId}`);
    return this.getUserItems(userId).then((list) => list.find((i) => i.itemId === itemId)!);
  }

  async getCosmetics(): Promise<Cosmetic[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      'SELECT * FROM cosmetics ORDER BY price_slc ASC',
    );
    return rows.map((r) => this.mapCosmetic(r));
  }

  async buyCosmetic(userId: string, cosmeticId: string): Promise<UserCosmetic> {
    const cosmetic = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM cosmetics WHERE id = $1',
      [cosmeticId],
    );
    if (!cosmetic) throw new NotFoundException('Cosmetic not found');

    const price = parseFloat(String(cosmetic.price_slc || 0));

    await this.db.transaction(async (client) => {
      await this.slcService.deductSLCTx(
        userId,
        {
          amount: price,
          reason: 'cosmetic_purchase',
          description: `Purchased cosmetic: ${cosmetic.name}`,
        },
        client,
      );

      const existingRows = await client.query(
        'SELECT * FROM user_cosmetics WHERE user_id = $1 AND cosmetic_id = $2',
        [userId, cosmeticId],
      );
      const existing = existingRows.rows[0];

      if (existing) {
        throw new BadRequestException('Cosmetic already owned');
      }

      await client.query(
        'INSERT INTO user_cosmetics (id, user_id, cosmetic_id, is_equipped, acquired_at) VALUES ($1, $2, $3, FALSE, NOW())',
        [uuidv4(), userId, cosmeticId],
      );
    });

    this.logger.log(`User ${userId} purchased cosmetic ${cosmeticId}`);
    return this.getUserCosmetics(userId).then(
      (list) => list.find((c) => c.cosmeticId === cosmeticId)!,
    );
  }

  async getInventory(userId: string) {
    const abilities = await this.getUserAbilities(userId);
    const items = await this.getUserItems(userId);
    const cosmetics = await this.getUserCosmetics(userId);

    return { abilities, items, cosmetics };
  }

  async createAbility(body: Record<string, unknown>): Promise<Ability> {
    const id = uuidv4();
    const now = new Date();
    const result = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO abilities (id, name, description, sp_cost, effect_type, effect_value, price_slc, target, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        id,
        body.name,
        body.description || null,
        body.spCost || 1,
        body.effectType,
        body.effectValue || 0,
        body.priceSlc || 0,
        body.target || 'self',
        now,
      ],
    );
    return this.mapAbility(result!);
  }

  async createItem(body: Record<string, unknown>): Promise<Item> {
    const id = uuidv4();
    const now = new Date();
    const result = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO items (id, name, description, item_type, effect_type, effect_value, price_slc, counters_monster_type, max_stack, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        id,
        body.name,
        body.description || null,
        body.itemType,
        body.effectType,
        body.effectValue || 0,
        body.priceSlc || 0,
        body.countersMonsterType || null,
        body.maxStack || 10,
        now,
      ],
    );
    return this.mapItem(result!);
  }

  async createCosmetic(body: Record<string, unknown>): Promise<Cosmetic> {
    const id = uuidv4();
    const now = new Date();
    const result = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO cosmetics (id, name, type, price_slc, image_url, rarity, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        id,
        body.name,
        body.type,
        body.priceSlc || 0,
        body.imageUrl || null,
        body.rarity || 'common',
        now,
      ],
    );
    return this.mapCosmetic(result!);
  }

  private async getUserAbilities(userId: string): Promise<UserAbility[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT ua.*, a.name as ability_name, a.sp_cost, a.effect_type, a.effect_value, a.target, a.description
       FROM user_abilities ua JOIN abilities a ON ua.ability_id = a.id WHERE ua.user_id = $1`,
      [userId],
    );

    return rows.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      abilityId: r.ability_id as string,
      quantity: parseInt(String(r.quantity || 1), 10),
      acquiredAt: new Date(r.acquired_at as string),
      ability: {
        id: r.ability_id as string,
        name: r.ability_name as string,
        description: r.description as string | undefined,
        spCost: parseInt(String(r.sp_cost || 1), 10),
        effectType: r.effect_type as string,
        effectValue: parseFloat(String(r.effect_value || 0)),
        priceSlc: 0,
        target: r.target as string,
        createdAt: new Date(r.acquired_at as string),
      },
    }));
  }

  private async getUserItems(userId: string): Promise<UserItem[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT ui.*, i.name as item_name, i.item_type, i.effect_type, i.effect_value, i.counters_monster_type, i.max_stack
       FROM user_items ui JOIN items i ON ui.item_id = i.id WHERE ui.user_id = $1`,
      [userId],
    );

    return rows.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      itemId: r.item_id as string,
      quantity: parseInt(String(r.quantity || 1), 10),
      acquiredAt: new Date(r.acquired_at as string),
      item: {
        id: r.item_id as string,
        name: r.item_name as string,
        description: undefined,
        itemType: r.item_type as string,
        effectType: r.effect_type as string,
        effectValue: parseFloat(String(r.effect_value || 0)),
        priceSlc: 0,
        countersMonsterType: r.counters_monster_type as string | undefined,
        maxStack: parseInt(String(r.max_stack || 10), 10),
        createdAt: new Date(r.acquired_at as string),
      },
    }));
  }

  private async getUserCosmetics(userId: string): Promise<UserCosmetic[]> {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT uc.*, c.name as cosmetic_name, c.type, c.price_slc, c.image_url, c.rarity
       FROM user_cosmetics uc JOIN cosmetics c ON uc.cosmetic_id = c.id WHERE uc.user_id = $1`,
      [userId],
    );

    return rows.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      cosmeticId: r.cosmetic_id as string,
      isEquipped: r.is_equipped as boolean,
      acquiredAt: new Date(r.acquired_at as string),
      cosmetic: {
        id: r.cosmetic_id as string,
        name: r.cosmetic_name as string,
        type: r.type as string,
        priceSlc: parseFloat(String(r.price_slc || 0)),
        imageUrl: r.image_url as string | undefined,
        rarity: r.rarity as string,
        createdAt: new Date(r.acquired_at as string),
      },
    }));
  }

  private mapAbility(row: Record<string, unknown>): Ability {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      spCost: parseInt(String(row.sp_cost || 1), 10),
      effectType: row.effect_type as string,
      effectValue: parseFloat(String(row.effect_value || 0)),
      priceSlc: parseFloat(String(row.price_slc || 0)),
      target: row.target as string,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapItem(row: Record<string, unknown>): Item {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      itemType: row.item_type as string,
      effectType: row.effect_type as string,
      effectValue: parseFloat(String(row.effect_value || 0)),
      priceSlc: parseFloat(String(row.price_slc || 0)),
      countersMonsterType: row.counters_monster_type as string | undefined,
      maxStack: parseInt(String(row.max_stack || 10), 10),
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapCosmetic(row: Record<string, unknown>): Cosmetic {
    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as string,
      priceSlc: parseFloat(String(row.price_slc || 0)),
      imageUrl: row.image_url as string | undefined,
      rarity: row.rarity as string,
      createdAt: new Date(row.created_at as string),
    };
  }
}
