import api from './api';
import { ENDPOINTS } from '@/config/api';
import type {
  RPGWallet,
  RPGTransaction,
  RGBattleState,
  RPGCard,
  RPGUserCards,
  RPGWorld,
  RPGArea,
  RPGSubsection,
  RGBattlepassSeason,
  RGBattlepassProgress,
  BattlepassReward,
  RPGAbility,
  RPGItem,
  RPGCosmetic,
  RPGRevisionSession,
  CreateProgrammeRequest,
  RPGProgramme,
  RGPCBTExam,
  CBTAnswer,
  CBTResult,
} from '@/types';

// ==================== SLC / Currency ====================

export async function getWallet(): Promise<RPGWallet> {
  const { data } = await api.get(ENDPOINTS.rpg.slc.wallet);
  return data;
}

export async function getTransactionHistory(): Promise<RPGTransaction[]> {
  const { data } = await api.get(ENDPOINTS.rpg.slc.transactions);
  return data.data || data;
}

export async function getRevisionCentreFunds(): Promise<{ balance: number; streak: number }> {
  const { data } = await api.get(ENDPOINTS.rpg.slc.revisionFunds);
  return data;
}

// ==================== Battle ====================

export async function startBattle(areaId: string, subsectionId?: string): Promise<RGBattleState> {
  const { data } = await api.post(ENDPOINTS.rpg.battle.start, { areaId, subsectionId });
  return data;
}

export async function playCard(battleId: string, cardId: string, targetId?: string): Promise<RGBattleState> {
  const { data } = await api.post(ENDPOINTS.rpg.battle.playCard, { battleId, cardId, targetId });
  return data;
}

export async function monsterTurn(battleId: string): Promise<RGBattleState> {
  const { data } = await api.post(ENDPOINTS.rpg.battle.monsterTurn, { battleId });
  return data;
}

export async function endBattle(battleId: string): Promise<{ victory: boolean; rewards: { slc: number; xp: number; cards?: string[] } }> {
  const { data } = await api.post(ENDPOINTS.rpg.battle.end, { battleId });
  return data;
}

export async function getBattleState(battleId: string): Promise<RGBattleState> {
  const { data } = await api.get(ENDPOINTS.rpg.battle.state(battleId));
  return data;
}

// ==================== Cards ====================

export async function getAllCards(): Promise<RPGCard[]> {
  const { data } = await api.get(ENDPOINTS.rpg.cards.all);
  return data.data || data;
}

export async function getUserCards(): Promise<RPGUserCards> {
  const { data } = await api.get(ENDPOINTS.rpg.cards.user);
  return data;
}

export async function buyCard(cardId: string): Promise<RPGUserCards> {
  const { data } = await api.post(ENDPOINTS.rpg.cards.buy, { cardId });
  return data;
}

export async function equipCards(cardIds: string[]): Promise<RPGUserCards> {
  const { data } = await api.post(ENDPOINTS.rpg.cards.equip, { cardIds });
  return data;
}

export async function getMarketplace(): Promise<RPGCard[]> {
  const { data } = await api.get(ENDPOINTS.rpg.cards.marketplace);
  return data.data || data;
}

// ==================== Areas & Worlds ====================

export async function getWorlds(): Promise<RPGWorld[]> {
  const { data } = await api.get(ENDPOINTS.rpg.areas.worlds);
  return data.data || data;
}

export async function getAreas(worldId?: string): Promise<RPGArea[]> {
  const { data } = await api.get(ENDPOINTS.rpg.areas.areas, {
    params: worldId ? { worldId } : undefined,
  });
  return data.data || data;
}

export async function unlockArea(areaId: string): Promise<RPGArea> {
  const { data } = await api.post(ENDPOINTS.rpg.areas.unlock(areaId));
  return data;
}

export async function completeSubsection(areaId: string, subsectionId: string): Promise<RPGSubsection> {
  const { data } = await api.post(ENDPOINTS.rpg.areas.completeSubsection(areaId, subsectionId));
  return data;
}

// ==================== Battlepass ====================

export async function getCurrentSeason(): Promise<RGBattlepassSeason> {
  const { data } = await api.get(ENDPOINTS.rpg.battlepass.currentSeason);
  return data;
}

export async function getUserProgress(): Promise<RGBattlepassProgress> {
  const { data } = await api.get(ENDPOINTS.rpg.battlepass.progress);
  return data;
}

export async function claimReward(tierId: string): Promise<{ claimed: boolean; reward: BattlepassReward }> {
  const { data } = await api.post(ENDPOINTS.rpg.battlepass.claimReward(tierId));
  return data;
}

// ==================== Shops ====================

export async function getShopInventory() {
  const { data } = await api.get('/rpg/shop');
  return data;
}

export async function buyAbility(abilityId: string): Promise<RPGAbility> {
  const { data } = await api.post(ENDPOINTS.rpg.shop.buyAbility, { abilityId });
  return data;
}

export async function buyItem(itemId: string, quantity = 1): Promise<{ item: RPGItem; remainingBalance: number }> {
  const { data } = await api.post(ENDPOINTS.rpg.shop.buyItem, { itemId, quantity });
  return data;
}

export async function buyCosmetic(cosmeticId: string): Promise<RPGCosmetic> {
  const { data } = await api.post(ENDPOINTS.rpg.shop.buyCosmetic, { cosmeticId });
  return data;
}

export async function getAbilities(): Promise<RPGAbility[]> {
  const { data } = await api.get(ENDPOINTS.rpg.shop.abilities);
  return data.data || data;
}

export async function getItems(): Promise<RPGItem[]> {
  const { data } = await api.get(ENDPOINTS.rpg.shop.items);
  return data.data || data;
}

export async function getCosmetics(): Promise<RPGCosmetic[]> {
  const { data } = await api.get(ENDPOINTS.rpg.shop.cosmetics);
  return data.data || data;
}

// ==================== Revision Centre ====================

export async function applyRevisionCentre(topic: string): Promise<RPGRevisionSession> {
  const { data } = await api.post(ENDPOINTS.rpg.revisionCentre.apply, { topic });
  return data;
}

export async function takeQuiz(sessionId: string): Promise<RPGRevisionSession> {
  const { data } = await api.post(ENDPOINTS.rpg.revisionCentre.quiz, { sessionId });
  return data;
}

export async function submitQuiz(sessionId: string, answers: Record<string, string>): Promise<RPGRevisionSession> {
  const { data } = await api.post(ENDPOINTS.rpg.revisionCentre.submit, { sessionId, answers });
  return data;
}

export async function getQuizResults(sessionId: string): Promise<RPGRevisionSession> {
  const { data } = await api.get(ENDPOINTS.rpg.revisionCentre.results(sessionId));
  return data;
}

// ==================== Programmes ====================

export async function createProgramme(request: CreateProgrammeRequest): Promise<RPGProgramme> {
  const { data } = await api.post(ENDPOINTS.rpg.programmes.create, request);
  return data;
}

export async function listProgrammes(): Promise<RPGProgramme[]> {
  const { data } = await api.get(ENDPOINTS.rpg.programmes.list);
  return data.data || data;
}

export async function approveProgramme(id: string): Promise<RPGProgramme> {
  const { data } = await api.post(ENDPOINTS.rpg.programmes.approve(id));
  return data;
}

export async function rejectProgramme(id: string, note?: string): Promise<RPGProgramme> {
  const { data } = await api.post(ENDPOINTS.rpg.programmes.reject(id), { note });
  return data;
}

// ==================== CBT ====================

export async function getUpcomingCBT(): Promise<RGPCBTExam[]> {
  const { data } = await api.get(ENDPOINTS.rpg.cbt.upcoming);
  return data.data || data;
}

export async function joinCBT(examId: string): Promise<RGPCBTExam> {
  const { data } = await api.post(ENDPOINTS.rpg.cbt.join, { examId });
  return data;
}

export async function submitCBT(examId: string, answers: CBTAnswer[]): Promise<CBTResult> {
  const { data } = await api.post(ENDPOINTS.rpg.cbt.submit, { examId, answers });
  return data;
}

export async function getCBTResults(examId: string): Promise<CBTResult> {
  const { data } = await api.get(ENDPOINTS.rpg.cbt.results(examId));
  return data;
}
