import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Swords,
  Play,
  Lock,
  ChevronRight,
  RotateCcw,
  ScrollText,
  ArrowLeft,
  Heart,
  Skull,
  Trophy,
  Zap,
  Map,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  startBattle,
  playCard as playCardApi,
  monsterTurn as monsterTurnApi,
} from '@/services/rpg';
import type { RGBattleState, BattleLogEntry, RPGCard, RPGArea } from '@/types';
import { cn } from '@/lib/utils';

const RARITY_COLORS: Record<string, string> = {
  Common: 'border-gray-400 bg-gray-400/10 text-gray-400',
  'Super Rare': 'border-blue-400 bg-blue-400/10 text-blue-400',
  Legendary: 'border-purple-400 bg-purple-400/10 text-purple-400',
  Mythic: 'border-yellow-400 bg-yellow-400/10 text-yellow-400',
};

const ELEMENT_ICONS: Record<string, typeof Map> = {
  fire: Zap,
  water: Map,
  earth: Skull,
  air: Trophy,
  neutral: Map,
};

const ELEMENT_COLORS: Record<string, string> = {
  fire: 'text-red-400 bg-red-400/10',
  water: 'text-blue-400 bg-blue-400/10',
  earth: 'text-green-400 bg-green-400/10',
  air: 'text-cyan-400 bg-cyan-400/10',
  neutral: 'text-gray-400 bg-gray-400/10',
};

type BattlePhase = 'area_select' | 'monster_encounter' | 'battle' | 'victory' | 'defeat';

export default function BattlePage() {
  const [phase, setPhase] = useState<BattlePhase>('area_select');
  const [areas, setAreas] = useState<RPGArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<RPGArea | null>(null);
  const [battleState, setBattleState] = useState<RGBattleState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rewards, setRewards] = useState<{ slc: number; xp: number } | null>(null);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [actionLog, setActionLog] = useState<BattleLogEntry[]>([]);

  const fetchAreas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const areasData = await import('@/services/rpg').then(m => m.getAreas());
      setAreas(areasData);
    } catch {
      setError('Failed to load areas');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const handleSelectArea = (area: RPGArea) => {
    if (!area.unlocked) return;
    setSelectedArea(area);
    setPhase('monster_encounter');
  };

  const handleStartBattle = async (monsterId?: string) => {
    if (!selectedArea) return;
    try {
      setIsLoading(true);
      setError(null);
      const state = await startBattle(selectedArea.id, monsterId);
      setBattleState(state);
      setActionLog(state.log);
      setPhase('battle');
    } catch {
      setError('Failed to start battle');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayCard = async (card: RPGCard) => {
    if (!battleState || !isPlayerTurn) return;
    if (battleState.player.sp < card.cost) return;

    try {
      setIsLoading(true);
      const newState = await playCardApi(battleState.id, card.id);
      setBattleState(newState);
      setActionLog(newState.log);
      setIsPlayerTurn(false);

      if (newState.status === 'victory') {
        setRewards({ slc: newState.monster.rewards.slc, xp: newState.monster.rewards.xp });
        setPhase('victory');
      } else if (newState.status === 'defeat') {
        setPhase('defeat');
      } else {
        setTimeout(async () => {
          try {
            const monsterTurnState = await monsterTurnApi(newState.id);
            setBattleState(monsterTurnState);
            setActionLog(monsterTurnState.log);
            setIsPlayerTurn(true);
            if (monsterTurnState.status === 'victory') {
              setRewards({ slc: monsterTurnState.monster.rewards.slc, xp: monsterTurnState.monster.rewards.xp });
              setPhase('victory');
            } else if (monsterTurnState.status === 'defeat') {
              setPhase('defeat');
            }
          } catch {
            setError('Monster turn failed');
          } finally {
            setIsLoading(false);
          }
        }, 1000);
      }
    } catch {
      setError('Failed to play card');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToAreas = () => {
    setPhase('area_select');
    setSelectedArea(null);
    setBattleState(null);
    setRewards(null);
    fetchAreas();
  };

  const playerHpPercent = battleState ? (battleState.player.hp / battleState.player.maxHp) * 100 : 0;
  const playerSpPercent = battleState ? (battleState.player.sp / battleState.player.maxSp) * 100 : 0;
  const monsterHpPercent = battleState ? (battleState.monster.hp / battleState.monster.maxHp) * 100 : 0;

  const canPlayCard = (card: RPGCard) => {
    return battleState && isPlayerTurn && battleState.player.sp >= card.cost && battleState.status === 'active';
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          {phase !== 'area_select' && (
            <button
              onClick={handleBackToAreas}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <Swords className="w-5 h-5 text-white" />
              </div>
              Battle Arena
            </h1>
            <p className="text-muted-foreground mt-1">Choose an area and face monsters</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AnimatePresence mode="wait">
          {/* Area Selection */}
          {phase === 'area_select' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Spinner size="lg" />
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {areas.map((area) => {
                    const ElementIcon = area.element ? ELEMENT_ICONS[area.element] : Map;
                    const elementColor = area.element ? ELEMENT_COLORS[area.element] : 'text-gray-400 bg-gray-400/10';
                    return (
                      <motion.div
                        key={area.id}
                        whileHover={area.unlocked ? { scale: 1.02 } : {}}
                        className={cn(
                          'relative rounded-xl border p-5 transition-all',
                          area.unlocked
                            ? 'bg-card border-border hover:border-green-500/50 cursor-pointer'
                            : 'bg-muted/50 border-border opacity-60 cursor-not-allowed'
                        )}
                        onClick={() => handleSelectArea(area)}
                      >
                        {area.isFinalBoss && (
                          <div className="absolute top-3 right-3">
                            <Trophy className="w-5 h-5 text-yellow-500" />
                          </div>
                        )}
                        {area.isMiniBoss && (
                          <div className="absolute top-3 right-3">
                            <Skull className="w-5 h-5 text-red-500" />
                          </div>
                        )}
                        {!area.unlocked && (
                          <div className="absolute top-3 right-3">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', elementColor)}>
                          <ElementIcon className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold mb-1">{area.name}</h3>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{area.description}</p>
                        <div className="flex items-center justify-between text-xs">
                          <span className={cn(
                            'px-2 py-1 rounded-full',
                            area.unlocked ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                          )}>
                            {area.unlocked ? 'Unlocked' : `Level ${area.requiredLevel}`}
                          </span>
                          {area.progress > 0 && (
                            <span className="text-muted-foreground">{area.progress}% complete</span>
                          )}
                        </div>
                        {area.unlocked && (
                          <Button size="sm" className="w-full mt-3" variant="outline">
                            Enter <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Monster Encounter */}
          {phase === 'monster_encounter' && selectedArea && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <div className="text-center mb-8">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border-2 border-red-500/30 flex items-center justify-center mx-auto mb-4">
                  <Skull className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">{selectedArea.name}</h2>
                <p className="text-muted-foreground max-w-md">{selectedArea.description}</p>
              </div>
              <div className="flex gap-4">
                <Button onClick={() => handleStartBattle()} className="bg-red-500 hover:bg-red-600">
                  <Play className="w-4 h-4 mr-2" /> Start Battle
                </Button>
                <Button variant="outline" onClick={() => setPhase('area_select')}>
                  Back
                </Button>
              </div>
            </motion.div>
          )}

          {/* Battle Phase */}
          {phase === 'battle' && battleState && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Battle Arena */}
              <div className="bg-card border border-border rounded-xl p-6">
                {/* Monster */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border-2 border-red-500/30 flex items-center justify-center">
                    <Skull className="w-8 h-8 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold">{battleState.monster.name}</h3>
                      <span className="text-sm text-muted-foreground">
                        {battleState.monster.hp}/{battleState.monster.maxHp} HP
                      </span>
                    </div>
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                        animate={{ width: `${monsterHpPercent}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Player */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/30 flex items-center justify-center">
                    <Heart className="w-8 h-8 text-green-500" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">You</h3>
                      <span className="text-sm text-muted-foreground">
                        {battleState.player.hp}/{battleState.player.maxHp} HP
                      </span>
                    </div>
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                        animate={{ width: `${playerHpPercent}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">SP</span>
                      <span className="text-sm text-muted-foreground">
                        {battleState.player.sp}/{battleState.player.maxSp}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                        animate={{ width: `${playerSpPercent}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Hand */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Your Cards
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {battleState.availableCards.map((card) => {
                    const ElementIcon = ELEMENT_ICONS[card.element];
                    const canPlay = canPlayCard(card);
                    return (
                      <motion.button
                        key={card.id}
                        whileHover={canPlay ? { scale: 1.05 } : {}}
                        whileTap={canPlay ? { scale: 0.95 } : {}}
                        onClick={() => handlePlayCard(card)}
                        disabled={!canPlay}
                        className={cn(
                          'relative p-4 rounded-xl border-2 text-left transition-all',
                          RARITY_COLORS[card.rarity],
                          canPlay ? 'cursor-pointer hover:shadow-lg' : 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <ElementIcon className="w-4 h-4" />
                          <span className="text-xs font-medium uppercase">{card.type}</span>
                        </div>
                        <h4 className="font-semibold text-sm mb-1">{card.name}</h4>
                        <p className="text-xs opacity-80 mb-2 line-clamp-2">{card.description}</p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-black/20">
                            PWR: {card.power}
                          </span>
                          <span className={cn(
                            'px-1.5 py-0.5 rounded font-bold',
                            canPlay ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
                          )}>
                            SP: {card.cost}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                {!isPlayerTurn && (
                  <div className="mt-4 text-center">
                    <Spinner size="sm" className="inline mr-2" />
                    <span className="text-sm text-muted-foreground">Monster is thinking...</span>
                  </div>
                )}
              </div>

              {/* Battle Log */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-blue-500" />
                  Battle Log
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {actionLog.slice().reverse().map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        'text-sm p-2 rounded-lg',
                        entry.actor === 'player' ? 'bg-green-500/5 text-green-600 dark:text-green-400' : 'bg-red-500/5 text-red-600 dark:text-red-400'
                      )}
                    >
                      <span className="font-medium">Turn {entry.turn}:</span> {entry.description}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Victory */}
          {phase === 'victory' && rewards && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-500/20 to-green-500/20 border-2 border-yellow-500/30 flex items-center justify-center mb-6"
              >
                <Trophy className="w-12 h-12 text-yellow-500" />
              </motion.div>
              <h2 className="text-3xl font-bold mb-2">Victory!</h2>
              <p className="text-muted-foreground mb-6">You defeated the monster!</p>
              <div className="flex gap-6 mb-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">+{rewards.slc}</p>
                  <p className="text-sm text-muted-foreground">SLC</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500">+{rewards.xp}</p>
                  <p className="text-sm text-muted-foreground">XP</p>
                </div>
              </div>
              <Button onClick={handleBackToAreas} className="bg-green-500 hover:bg-green-600">
                Continue
              </Button>
            </motion.div>
          )}

          {/* Defeat */}
          {phase === 'defeat' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500/20 to-gray-500/20 border-2 border-red-500/30 flex items-center justify-center mb-6">
                <Skull className="w-12 h-12 text-red-500" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Defeat</h2>
              <p className="text-muted-foreground mb-6">Better luck next time!</p>
              <Button onClick={handleBackToAreas} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" /> Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
