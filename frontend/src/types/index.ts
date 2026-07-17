// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: 'free' | 'pro' | 'team';
  billingCycle?: 'monthly' | 'yearly' | null;
  educationLevel?: string;
  subjects?: string[];
  profileCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Study Set types
export interface StudySet {
  id: string;
  userId: string;
  title: string;
  description?: string;
  isPublic: boolean;
  tags: string[];
  coverImageUrl?: string;
  examDate?: string;
  examSubject?: string;
  flashcardsCount: number;
  documentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudySetRequest {
  title: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  coverImageUrl?: string;
  examDate?: string;
  examSubject?: string;
}

export interface UpdateStudySetRequest {
  title?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  coverImageUrl?: string;
  examDate?: string;
  examSubject?: string;
}

// Document types
export interface Document {
  id: string;
  studySetId: string;
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  createdAt: string;
}

// Flashcard types
export type FlashcardType = 'standard' | 'cloze' | 'image_occlusion';

export interface Flashcard {
  id: string;
  studySetId: string;
  front: string;
  back: string;
  notes?: string;
  tags: string[];
  type?: FlashcardType;
  difficulty: number;
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReviewAt?: string;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Cloze deletion utilities
export const CLOZE_REGEX = /\{\{(.+?)\}\}/g;

export function hasClozeMarkers(text: string): boolean {
  return CLOZE_REGEX.test(text);
}

export function extractClozeBlanks(text: string): string[] {
  const matches = text.match(CLOZE_REGEX);
  return matches ? matches.map((m) => m.slice(2, -2)) : [];
}

export function renderClozeWithBlanks(text: string, revealedIndices: Set<number>): { segments: Array<{ text: string; isBlank: boolean; index: number; answer: string }> } {
  const segments: Array<{ text: string; isBlank: boolean; index: number; answer: string }> = [];
  let lastIndex = 0;
  let blankIndex = 0;
  const regex = /\{\{(.+?)\}\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), isBlank: false, index: -1, answer: '' });
    }
    const revealed = revealedIndices.has(blankIndex);
    segments.push({ text: revealed ? match[1] : '______', isBlank: true, index: blankIndex, answer: match[1] });
    blankIndex++;
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isBlank: false, index: -1, answer: '' });
  }
  return { segments };
}

// Image Occlusion types
export interface OcclusionRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface CreateFlashcardRequest {
  studySetId: string;
  front: string;
  back: string;
  notes?: string;
  tags?: string[];
  type?: 'standard' | 'cloze' | 'image_occlusion';
}

export interface UpdateFlashcardRequest {
  front?: string;
  back?: string;
  notes?: string;
  tags?: string[];
  type?: 'standard' | 'cloze' | 'image_occlusion';
}

export interface ReviewFlashcardRequest {
  quality: 1 | 2 | 3 | 4 | 5;
}

// Flashcard status helpers
export const getFlashcardStatus = (flashcard: Flashcard): string => {
  if (flashcard.repetitions === 0) return 'New';
  if (flashcard.interval < 7) return 'Learning';
  if (flashcard.interval < 30) return 'Review';
  return 'Mastered';
};

export const isFlashcardDue = (flashcard: Flashcard): boolean => {
  if (!flashcard.nextReviewAt) return true;
  return new Date(flashcard.nextReviewAt) <= new Date();
};

// Knowledge Base types
export interface KnowledgeBase {
  id: string;
  userId: string;
  name: string;
  description?: string;
  documentCount: number;
  chunkCount: number;
  status: 'active' | 'processing' | 'error';
  createdAt: string;
  updatedAt: string;
}

// Chat types
export interface Conversation {
  id: string;
  userId: string;
  title: string;
  knowledgeBaseId?: string;
  studySetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  createdAt: string;
}

export interface Citation {
  chunkId: string;
  content: string;
  score: number;
  documentId?: string;
}

// Quiz types
export interface Quiz {
  id: string;
  studySetId: string;
  title: string;
  questionCount: number;
  timeLimit?: number;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface QuizAttemptAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpent: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  score: number;
  totalQuestions: number;
  timeSpent: number;
  completedAt?: string;
  createdAt: string;
}

export interface QuizAttemptDetail {
  attempt: QuizAttempt;
  answers: QuizAttemptAnswer[];
}

// Subscription types
export interface Subscription {
  id: string;
  userId: string;
  plan: 'free' | 'pro' | 'team';
  status: 'active' | 'canceled' | 'past_due';
  currentPeriodEnd: string;
  createdAt: string;
}

// Common API types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

// Gamification types
export interface GamificationStats {
  totalXp: number;
  level: number;
  streakDays: number;
  dailyXp: number;
  dailyGoal: number;
  nextLevelXp: number;
  currentLevelXp: number;
}

export type XPEventType = 'card_review' | 'quiz_complete' | 'perfect_quiz' | 'daily_streak' | 'daily_goal';

export interface XPEvent {
  type: XPEventType;
  xp: number;
  timestamp: string;
}

export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000];

export const LEVEL_NAMES = [
  { name: 'Beginner',    gradient: 'from-gray-400 to-gray-500',       shadow: 'shadow-gray-400/20',     text: 'text-gray-500' },
  { name: 'Bronze',      gradient: 'from-amber-600 to-amber-700',     shadow: 'shadow-amber-600/20',    text: 'text-amber-600' },
  { name: 'Silver',      gradient: 'from-slate-400 to-slate-500',     shadow: 'shadow-slate-400/20',    text: 'text-slate-500' },
  { name: 'Gold',        gradient: 'from-yellow-400 to-yellow-500',   shadow: 'shadow-yellow-400/20',   text: 'text-yellow-500' },
  { name: 'Platinum',    gradient: 'from-cyan-400 to-cyan-500',       shadow: 'shadow-cyan-400/20',     text: 'text-cyan-500' },
  { name: 'Diamond',     gradient: 'from-blue-400 to-blue-500',       shadow: 'shadow-blue-400/20',     text: 'text-blue-500' },
  { name: 'Master',      gradient: 'from-purple-500 to-purple-600',   shadow: 'shadow-purple-500/20',   text: 'text-purple-500' },
  { name: 'Grandmaster', gradient: 'from-red-500 to-rose-600',        shadow: 'shadow-red-500/20',      text: 'text-red-500' },
  { name: 'Champion',    gradient: 'from-orange-500 to-red-500',      shadow: 'shadow-orange-500/20',   text: 'text-orange-500' },
  { name: 'Legend',      gradient: 'from-indigo-500 to-violet-600',   shadow: 'shadow-indigo-500/20',   text: 'text-indigo-500' },
  { name: 'Mythic',      gradient: 'from-fuchsia-500 to-pink-600',    shadow: 'shadow-fuchsia-500/20',  text: 'text-fuchsia-500' },
  { name: 'Immortal',    gradient: 'from-amber-400 via-red-500 to-purple-600', shadow: 'shadow-amber-400/20', text: 'text-amber-500' },
] as const;

export function getLevelInfo(level: number) {
  return LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length - 1)];
}

export function getLevelFromXP(xp: number): { level: number; currentLevelXp: number; nextLevelXp: number } {
  let level = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i;
      break;
    }
  }
  const currentLevelXp = LEVEL_THRESHOLDS[level] || 0;
  const nextLevelXp = LEVEL_THRESHOLDS[level + 1] || LEVEL_THRESHOLDS[level] + 2500;
  return { level, currentLevelXp, nextLevelXp };
}

// Study Schedule types
export interface StudySchedule {
  daysUntilExam: number;
  dailyCardTarget: number;
  recommendedMinutes: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  todayPlan: {
    newCards: number;
    reviewCards: number;
    estimatedMinutes: number;
  };
}

// Notification types
export type NotificationType = 'info' | 'success' | 'warning' | 'reminder';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  studyReminders: boolean;
  weeklyDigest: boolean;
  achievementAlerts: boolean;
}

export interface NotificationsResponse {
  data: Notification[];
  total: number;
  unreadCount: number;
}

// Note types
export type NoteSourceType = 'manual' | 'ai_generated' | 'pdf' | 'youtube' | 'audio' | 'website' | 'handwriting';

export interface Note {
  id: string;
  studySetId: string;
  title: string;
  content: string;
  contentJson?: Record<string, unknown>;
  summary?: string;
  sourceType: NoteSourceType;
  sourceUrl?: string;
  sourceMetadata?: Record<string, unknown>;
  tags: string[];
  isPinned: boolean;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  studySetId: string;
  title: string;
  content: string;
  contentJson?: Record<string, unknown>;
  summary?: string;
  sourceType?: NoteSourceType;
  sourceUrl?: string;
  sourceMetadata?: Record<string, unknown>;
  tags?: string[];
  isPinned?: boolean;
  color?: string;
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  contentJson?: Record<string, unknown>;
  summary?: string;
  tags?: string[];
  isPinned?: boolean;
  color?: string;
}

// ==================== RPG TYPES ====================

export type CardRarity = 'Common' | 'Super Rare' | 'Legendary' | 'Mythic';
export type CardType = 'Attack' | 'Defend' | 'Heal' | 'Buff';
export type CardElement = 'Fire' | 'Water' | 'Earth' | 'Wind' | 'Light' | 'Dark';

export interface RPGCard {
  id: string;
  name: string;
  description: string;
  rarity: CardRarity;
  type: CardType;
  element: CardElement;
  power: number;
  cost: number;
  abilities: string[];
  icon?: string;
  owned: boolean;
  quantity: number;
  price?: number;
  equipped: boolean;
}

export interface RPGUserCards {
  cards: RPGCard[];
  equipped: string[];
  maxEquipped: number;
}

export interface RPGWallet {
  balance: number;
  currency: string;
  recentTransactions: RPGTransaction[];
}

export interface RPGTransaction {
  id: string;
  amount: number;
  type: 'earn' | 'spend';
  source: string;
  description: string;
  createdAt: string;
}

export interface RPGMonster {
  id: string;
  name: string;
  description: string;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  attack: number;
  defense: number;
  speed: number;
  element: CardElement;
  weaknesses: CardElement[];
  resistances: CardElement[];
  rewards: {
    slc: number;
    xp: number;
    cards?: string[];
  };
  imageUrl?: string;
}

export interface RPGPlayer {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  attack: number;
  defense: number;
  speed: number;
  level: number;
  xp: number;
  nextLevelXp: number;
}

export interface RGBattleState {
  id: string;
  status: 'active' | 'victory' | 'defeat' | 'abandoned';
  player: RPGPlayer;
  monster: RPGMonster;
  turn: number;
  currentTurn: 'player' | 'monster';
  log: BattleLogEntry[];
  availableCards: RPGCard[];
  spRegenPerTurn: number;
}

export interface BattleLogEntry {
  id: string;
  turn: number;
  actor: 'player' | 'monster';
  action: string;
  damage?: number;
  heal?: number;
  buff?: string;
  description: string;
}

export interface RPGArea {
  id: string;
  worldId: string;
  name: string;
  description: string;
  requiredLevel: number;
  unlocked: boolean;
  progress: number;
  subsections: RPGSubsection[];
  monsterIds: string[];
  isMiniBoss: boolean;
  isFinalBoss: boolean;
  element?: string;
}

export interface RPGSubsection {
  id: string;
  areaId: string;
  name: string;
  description: string;
  completed: boolean;
  battleMonsterId: string;
  requiredWins: number;
  currentWins: number;
  rewards: {
    slc: number;
    xp: number;
  };
}

export interface RPGWorld {
  id: string;
  name: string;
  description: string;
  theme: string;
  areas: RPGArea[];
  requiredLevel: number;
  unlocked: boolean;
  order: number;
}

export interface RGBattlepassSeason {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  totalTiers: number;
  finalReward: {
    type: 'card';
    cardId: string;
    cardName: string;
    rarity: CardRarity;
  };
}

export interface RGBattlepassTier {
  id: string;
  tierNumber: number;
  xpRequired: number;
  rewards: BattlepassReward[];
  claimed: boolean;
  unlocked: boolean;
}

export interface BattlepassReward {
  id: string;
  type: 'card' | 'slc' | 'ability' | 'item' | 'cosmetic';
  name: string;
  description: string;
  rarity?: CardRarity;
  icon?: string;
}

export interface RGBattlepassProgress {
  season: RGBattlepassSeason;
  currentXp: number;
  currentTier: number;
  tiers: RGBattlepassTier[];
}

export interface RPGAbility {
  id: string;
  name: string;
  description: string;
  type: 'active' | 'passive';
  element: CardElement;
  price: number;
  effect: string;
  owned: boolean;
  icon?: string;
}

export interface RPGItem {
  id: string;
  name: string;
  description: string;
  type: 'consumable' | 'permanent';
  element: CardElement;
  price: number;
  effect: string;
  counters: string[];
  owned: boolean;
  quantity: number;
  icon?: string;
}

export interface RPGCosmetic {
  id: string;
  name: string;
  description: string;
  type: 'theme' | 'avatar' | 'card_back' | 'profile_border';
  price: number;
  previewUrl?: string;
  owned: boolean;
  equipped: boolean;
}

export interface RPGRevisionSession {
  id: string;
  topic: string;
  status: 'applied' | 'active' | 'completed' | 'expired';
  streak: number;
  fundBalance: number;
  questions: RevisionQuestion[];
  score?: number;
  passed?: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface RevisionQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface RPGProgramme {
  id: string;
  title: string;
  problemStatement: string;
  solutionApproach: string;
  status: 'pending' | 'approved' | 'rejected';
  authorId: string;
  authorName: string;
  slcFee: number;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface CreateProgrammeRequest {
  title: string;
  problemStatement: string;
  solutionApproach: string;
}

export interface RGPCBTExam {
  id: string;
  subject: string;
  title: string;
  description: string;
  date: string;
  time: string;
  duration: number;
  totalMarks: number;
  questions: CBTQuestion[];
  status: 'upcoming' | 'active' | 'completed';
  submitted: boolean;
  score?: number;
}

export interface CBTQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  marks: number;
  correctAnswer?: string;
  explanation?: string;
}

export interface CBTAnswer {
  questionId: string;
  answer: string;
}

export interface CBTResult {
  examId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  timeSpent: number;
  analysis: {
    strongAreas: string[];
    weakAreas: string[];
    recommendations: string[];
  };
}
