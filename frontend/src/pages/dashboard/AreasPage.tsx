import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import {
  Map,
  Globe,
  Lock,
  Play,
  ChevronRight,
  Crown,
  Skull,
  CheckCircle,
} from 'lucide-react';
import { getWorlds, getAreas, unlockArea, startBattle } from '@/services/rpg';
import type { RPGWorld, RPGArea } from '@/types';
import { cn } from '@/lib/utils';

type View = 'worlds' | 'areas' | 'battle';

export default function AreasPage() {
  const [worlds, setWorlds] = useState<RPGWorld[]>([]);
  const [areas, setAreas] = useState<RPGArea[]>([]);
  const [selectedWorld, setSelectedWorld] = useState<RPGWorld | null>(null);
  const [selectedArea, setSelectedArea] = useState<RPGArea | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('worlds');

  const fetchWorlds = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getWorlds();
      setWorlds(data);
    } catch {
      setError('Failed to load worlds');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAreas = useCallback(async (worldId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAreas(worldId);
      setAreas(data);
    } catch {
      setError('Failed to load areas');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorlds();
  }, [fetchWorlds]);

  const handleSelectWorld = (world: RPGWorld) => {
    setSelectedWorld(world);
    fetchAreas(world.id);
    setView('areas');
  };

  const handleSelectArea = (area: RPGArea) => {
    setSelectedArea(area);
    setView('battle');
  };

  const handleUnlockArea = async (area: RPGArea) => {
    try {
      setIsLoading(true);
      await unlockArea(area.id);
      if (selectedWorld) {
        fetchAreas(selectedWorld.id);
      }
    } catch {
      setError('Failed to unlock area');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartBattle = async (subsectionId?: string) => {
    if (!selectedArea) return;
    try {
      setIsLoading(true);
      await startBattle(selectedArea.id, subsectionId);
      window.location.href = '/dashboard/battle';
    } catch {
      setError('Failed to start battle');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          {view !== 'worlds' && (
            <button
              onClick={() => {
                if (view === 'battle') setView('areas');
                else if (view === 'areas') setView('worlds');
              }}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Map className="w-5 h-5 text-white" />
              </div>
              {view === 'worlds' && 'Worlds'}
              {view === 'areas' && selectedWorld?.name}
              {view === 'battle' && selectedArea?.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              {view === 'worlds' && 'Choose a world to explore'}
              {view === 'areas' && selectedWorld?.description}
              {view === 'battle' && selectedArea?.description}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && view === 'worlds' ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* Worlds View */}
            {view === 'worlds' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {worlds.map((world) => {
                  const unlocked = world.unlocked;
                  return (
                    <motion.div
                      key={world.id}
                      whileHover={unlocked ? { scale: 1.02 } : {}}
                      onClick={() => unlocked && handleSelectWorld(world)}
                      className={cn(
                        'relative p-6 rounded-xl border transition-all',
                        unlocked ? 'bg-card border-border hover:border-blue-500/50 cursor-pointer' : 'bg-muted/50 border-border opacity-60 cursor-not-allowed'
                      )}
                    >
                      {!unlocked && (
                        <div className="absolute top-4 right-4">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex items-center gap-3 mb-3">
                        <Globe className={cn('w-8 h-8', unlocked ? 'text-blue-500' : 'text-muted-foreground')} />
                        <div>
                          <h3 className="font-semibold">{world.name}</h3>
                          <p className="text-xs text-muted-foreground">Level {world.requiredLevel}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{world.description}</p>
                      <div className="flex items-center justify-between">
                        <span className={cn('text-xs px-2 py-1 rounded-full', unlocked ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                          {world.areas.length} Areas
                        </span>
                        {unlocked && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Areas View */}
            {view === 'areas' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {areas.map((area) => {
                  const totalSubsections = area.subsections.length;
                  const completedSubsections = area.subsections.filter(s => s.completed).length;
                  const progressPercent = totalSubsections > 0 ? (completedSubsections / totalSubsections) * 100 : 0;
                  return (
                    <motion.div
                      key={area.id}
                      whileHover={area.unlocked ? { scale: 1.01 } : {}}
                      onClick={() => area.unlocked && handleSelectArea(area)}
                      className={cn(
                        'p-5 rounded-xl border transition-all',
                        area.unlocked ? 'bg-card border-border hover:border-blue-500/50 cursor-pointer' : 'bg-muted/50 border-border opacity-60 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {area.isFinalBoss && <Crown className="w-4 h-4 text-yellow-500" />}
                            {area.isMiniBoss && <Skull className="w-4 h-4 text-red-500" />}
                            <h3 className="font-semibold">{area.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">{area.description}</p>
                        </div>
                        {!area.unlocked && <Lock className="w-4 h-4 text-muted-foreground ml-4" />}
                      </div>
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="text-muted-foreground">{completedSubsections}/{totalSubsections}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                            animate={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={cn('text-xs px-2 py-1 rounded-full', area.unlocked ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                          {area.unlocked ? 'Unlocked' : `Level ${area.requiredLevel}`}
                        </span>
                        {area.unlocked && (
                          <Button size="sm" variant="outline">
                            Enter <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                        {!area.unlocked && (
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleUnlockArea(area); }}>
                            Unlock
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Battle View */}
            {view === 'battle' && selectedArea && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {selectedArea.subsections.map((subsection) => (
                  <Card key={subsection.id} className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {subsection.completed ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Play className="w-4 h-4 text-blue-500" />
                          )}
                          <h3 className="font-semibold">{subsection.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{subsection.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Wins: {subsection.currentWins}/{subsection.requiredWins}</span>
                          <span>+{subsection.rewards.slc} SLC</span>
                          <span>+{subsection.rewards.xp} XP</span>
                        </div>
                      </div>
                      {!subsection.completed && (
                        <Button size="sm" onClick={() => handleStartBattle(subsection.id)}>
                          Battle
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
