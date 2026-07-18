import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { SlcService } from '../slc/slc.service';

export interface BattleState {
  battleId: string;
  status: string;
  playerHp: number;
  playerMaxHp: number;
  playerSp: number;
  playerMaxSp: number;
  monsterHp: number;
  monsterMaxHp: number;
  monsterSp: number;
  monsterName: string;
  monsterAttack: number;
  monsterDefense: number;
  monsterWeakness?: string;
  turnCount: number;
  log: BattleLogEntry[];
}

export interface BattleLogEntry {
  turn: number;
  actor: 'player' | 'monster' | 'system';
  action: string;
  value?: number;
  message: string;
}

export interface BattleReward {
  slc: number;
  xp: number;
  won: boolean;
}

@Injectable()
export class BattleService {
  private readonly logger = new Logger(BattleService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly slcService: SlcService,
  ) {}

  async startBattle(userId: string, monsterId: string): Promise<BattleState> {
    const monster = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM monsters WHERE id = $1',
      [monsterId],
    );

    if (!monster) {
      throw new NotFoundException('Monster not found');
    }

    const battleId = uuidv4();
    const playerMaxHp = 100;
    const playerMaxSp = 20;
    const monsterMaxHp = parseInt(String(monster.hp || 50), 10);
    const monsterSp = parseInt(String(monster.sp || 10), 10);
    const monsterName = monster.name as string;

    const log: BattleLogEntry[] = [
      {
        turn: 0,
        actor: 'system',
        action: 'start',
        message: `Battle started against ${monsterName}!`,
      },
    ];

    await this.db.query(
      `INSERT INTO battles (id, user_id, monster_id, status, player_hp, player_max_hp, player_sp, player_max_sp, monster_hp, monster_sp, log, started_at)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        battleId,
        userId,
        monsterId,
        playerMaxHp,
        playerMaxHp,
        playerMaxSp,
        playerMaxSp,
        monsterMaxHp,
        monsterSp,
        JSON.stringify(log),
      ],
    );

    return {
      battleId,
      status: 'active',
      playerHp: playerMaxHp,
      playerMaxHp,
      playerSp: playerMaxSp,
      playerMaxSp,
      monsterHp: monsterMaxHp,
      monsterMaxHp,
      monsterSp,
      monsterName,
      monsterAttack: parseInt(String(monster.attack || 5), 10),
      monsterDefense: parseInt(String(monster.defense || 0), 10),
      monsterWeakness: monster.weakness as string | undefined,
      turnCount: 0,
      log,
    };
  }

  async playCard(
    userId: string,
    battleId: string,
    cardId: string,
    _target?: string,
  ): Promise<BattleState> {
    const battle = await this.getBattle(battleId, userId);
    if (battle.status !== 'active') {
      throw new BadRequestException('Battle is not active');
    }

    const card = this.getCardData(cardId);
    const playerSp = (battle.playerSp as number) - card.spCost;

    if (playerSp < 0) {
      throw new BadRequestException('Insufficient SP to play this card');
    }

    const monster = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM monsters WHERE id = $1',
      [battle.monsterId],
    );

    const log = [...(battle.log as BattleLogEntry[])];
    let monsterHp = battle.monsterHp as number;
    let damage = card.damage;
    let message = '';

    if (monster && monster.weakness && card.effect === 'attack') {
      damage = Math.floor(damage * 1.5);
      message = `Weakness hit! ${damage} damage!`;
    } else {
      message = `Dealt ${damage} damage!`;
    }

    const monsterDefense = monster ? parseInt(String(monster.defense || 0), 10) : 0;
    const actualDamage = Math.max(1, damage - monsterDefense);
    monsterHp = Math.max(0, monsterHp - actualDamage);

    if (card.heal > 0) {
      message += ` Healed ${card.heal} HP!`;
    }

    log.push({
      turn: (battle.turnCount as number) + 1,
      actor: 'player',
      action: card.effect,
      value: actualDamage,
      message,
    });

    let battleStatus = battle.status;
    if (monsterHp <= 0) {
      battleStatus = 'won';
    }

    await this.db.query(
      `UPDATE battles SET player_sp = $1, monster_hp = $2, log = $3, turn_count = $4, status = $5 WHERE id = $6`,
      [
        playerSp,
        monsterHp,
        JSON.stringify(log),
        (battle.turnCount as number) + 1,
        battleStatus,
        battleId,
      ],
    );

    if (battleStatus === 'won') {
      await this.db.query('UPDATE battles SET ended_at = NOW() WHERE id = $1', [battleId]);
    }

    return this.buildBattleState(battleId, userId);
  }

  async monsterTurn(userId: string, battleId: string): Promise<BattleState> {
    const battle = await this.getBattle(battleId, userId);
    if (battle.status !== 'active') {
      throw new BadRequestException('Battle is not active');
    }

    const monster = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM monsters WHERE id = $1',
      [battle.monsterId],
    );

    if (!monster) {
      throw new NotFoundException('Monster data not found');
    }

    const log = [...(battle.log as BattleLogEntry[])];
    const attackPatternRaw = monster.attack_pattern;
    const attackPattern: Record<string, unknown>[] = Array.isArray(attackPatternRaw)
      ? attackPatternRaw
      : typeof attackPatternRaw === 'string'
        ? JSON.parse(attackPatternRaw)
        : [];
    const patternIndex = (battle.turnCount as number) % (attackPattern.length || 1);
    const pattern =
      attackPattern.length > 0
        ? (attackPattern[patternIndex] as Record<string, unknown>)
        : { damage: 5, type: 'attack' };

    const monsterAttack = parseInt(String(monster.attack || 5), 10);
    const baseDamage = ((pattern.damage as number) || 5) + monsterAttack;
    const damage = Math.max(1, baseDamage);

    log.push({
      turn: (battle.turnCount as number) + 1,
      actor: 'monster',
      action: (pattern.type as string) || 'attack',
      value: damage,
      message: `${monster.name as string} attacks for ${damage} damage!`,
    });

    let battleStatus = battle.status;
    if (Math.max(0, (battle.playerHp as number) - damage) <= 0) {
      battleStatus = 'lost';
    }

    const newSp = Math.min(battle.playerMaxSp as number, (battle.playerSp as number) + 3);

    await this.db.query(
      `UPDATE battles SET player_hp = $1, player_sp = $2, log = $3, turn_count = $4, status = $5 WHERE id = $6`,
      [
        Math.max(0, (battle.playerHp as number) - damage),
        newSp,
        JSON.stringify(log),
        (battle.turnCount as number) + 1,
        battleStatus,
        battleId,
      ],
    );

    if (battleStatus === 'lost') {
      await this.db.query('UPDATE battles SET ended_at = NOW() WHERE id = $1', [battleId]);
    }

    return this.buildBattleState(battleId, userId);
  }

  async endBattle(
    userId: string,
    battleId: string,
  ): Promise<{ battle: BattleState; reward: BattleReward }> {
    const battle = await this.getBattle(battleId, userId);

    if (battle.status === 'active') {
      throw new BadRequestException('Battle is still active');
    }

    if (battle.status === 'won') {
      const monster = await this.db.queryOne<Record<string, unknown>>(
        'SELECT * FROM monsters WHERE id = $1',
        [battle.monsterId],
      );

      const drops = monster?.drops
        ? typeof monster.drops === 'string'
          ? JSON.parse(monster.drops)
          : monster.drops
        : { slc: 10, xp: 20 };
      const slcReward = parseFloat(String(drops.slc || 10)) + (battle.turnCount as number) * 2;
      const xpReward = parseInt(String(drops.xp || 20), 10) + (battle.turnCount as number) * 5;

      await this.db.transaction(async (client) => {
        await this.slcService.addSLCTx(
          userId,
          {
            amount: slcReward,
            source: 'battle',
            referenceId: battleId,
            description: `Battle victory reward`,
          },
          client,
        );

        await client.query(
          `INSERT INTO xp_records (id, user_id, source, amount, description, created_at)
           VALUES ($1, $2, 'battle', $3, $4, NOW())`,
          [uuidv4(), userId, xpReward, 'Battle victory XP'],
        );

        await client.query(`UPDATE battles SET reward_slc = $1, reward_xp = $2 WHERE id = $3`, [
          slcReward,
          xpReward,
          battleId,
        ]);
      });

      return {
        battle: await this.buildBattleState(battleId, userId),
        reward: { slc: slcReward, xp: xpReward, won: true },
      };
    }

    return {
      battle: await this.buildBattleState(battleId, userId),
      reward: { slc: 0, xp: 0, won: false },
    };
  }

  async getBattleState(userId: string, battleId: string): Promise<BattleState> {
    return this.buildBattleState(battleId, userId);
  }

  async fleeBattle(userId: string, battleId: string): Promise<BattleState> {
    const battle = await this.getBattle(battleId, userId);
    if (battle.status !== 'active') {
      throw new BadRequestException('Cannot flee from completed battle');
    }

    await this.db.query(`UPDATE battles SET status = 'fled', ended_at = NOW() WHERE id = $1`, [
      battleId,
    ]);

    return this.buildBattleState(battleId, userId);
  }

  private async getBattle(battleId: string, userId: string): Promise<Record<string, unknown>> {
    const battle = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM battles WHERE id = $1 AND user_id = $2',
      [battleId, userId],
    );

    if (!battle) {
      throw new NotFoundException('Battle not found');
    }

    return battle;
  }

  private async buildBattleState(battleId: string, userId: string): Promise<BattleState> {
    const battle = await this.getBattle(battleId, userId);
    const monster = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM monsters WHERE id = $1',
      [battle.monsterId],
    );

    const log =
      typeof battle.log === 'string' ? JSON.parse(battle.log as string) : battle.log || [];

    return {
      battleId: battle.id as string,
      status: battle.status as string,
      playerHp: battle.player_hp as number,
      playerMaxHp: battle.player_max_hp as number,
      playerSp: battle.player_sp as number,
      playerMaxSp: battle.player_max_sp as number,
      monsterHp: battle.monster_hp as number,
      monsterMaxHp: monster?.max_hp
        ? parseInt(String(monster.max_hp), 10)
        : (battle.monster_hp as number),
      monsterSp: battle.monster_sp as number,
      monsterName: (monster?.name as string) || 'Unknown Monster',
      monsterAttack: monster?.attack ? parseInt(String(monster.attack), 10) : 5,
      monsterDefense: monster?.defense ? parseInt(String(monster.defense), 10) : 0,
      monsterWeakness: monster?.weakness as string | undefined,
      turnCount: battle.turn_count as number,
      log,
    };
  }

  private getCardData(cardId: string): {
    spCost: number;
    rarity: string;
    damage: number;
    heal: number;
    effect: string;
  } {
    const CARD_DB: Record<
      string,
      { spCost: number; rarity: string; damage: number; heal: number; effect: string }
    > = {
      basic_attack: { spCost: 1, rarity: 'common', damage: 10, heal: 0, effect: 'attack' },
      heavy_strike: { spCost: 2, rarity: 'super_rare', damage: 20, heal: 0, effect: 'attack' },
      knowledge_shield: { spCost: 1, rarity: 'common', damage: 0, heal: 5, effect: 'defend' },
      iron_will: { spCost: 2, rarity: 'super_rare', damage: 0, heal: 10, effect: 'defend' },
      study_heal: { spCost: 2, rarity: 'common', damage: 0, heal: 15, effect: 'heal' },
      focus_boost: { spCost: 1, rarity: 'legendary', damage: 5, heal: 0, effect: 'buff' },
      exam_crush: { spCost: 3, rarity: 'legendary', damage: 35, heal: 0, effect: 'attack' },
      wisdom_blast: { spCost: 4, rarity: 'mythic', damage: 50, heal: 0, effect: 'attack' },
    };

    return (
      CARD_DB[cardId] || { spCost: 1, rarity: 'common', damage: 10, heal: 0, effect: 'attack' }
    );
  }
}
