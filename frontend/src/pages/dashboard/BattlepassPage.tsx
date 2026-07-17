import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Trophy,
  Star,
  Gift,
  Lock,
  Unlock,
  Flame,
  Zap,
  Crown,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from 'lucide-react';
import { getCurrentSeason, getUserProgress, claimReward } from '@/services/rpg';
import type { RGBattlepassSeason, RGBattlepassProgress, RGBattlepassTier, BattlepassReward } from '@/types';
import { cn } from '@/lib/utils';

export default function BattlepassPage() {
  const [season, setSeason] = useState<RGBattlepassSeason | null>(null);
  const [progress, setProgress] = useState<RGBattlepassProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingTier, setClaimingTier] = useState<string | null>(null);
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [seasonData, progressData] = await Promise.all([
        getCurrentSeason(),
        getUserProgress(),
      ]);
      setSeason(seasonData);
      setProgress(progressData);
    } catch {
      setError('Failed to load battlepass data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClaimReward = async (tier: RGBattlepassTier) => {
    if (tier.claimed || !tier.unlocked) return;
    try {
      setClaimingTier(tier.id);
      await claimReward(tier.id);
      await fetchData();
    } catch {
      setError('Failed to claim reward');
    } finally {
      setClaimingTier(null);
    }
  };

  const getTimeRemaining = (): string => {
    if (!season) return '';
    const end = new Date(season.endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return 'Season ending soon!';
  };

  const currentTier = progress?.currentTier || 0;
  const currentXp = progress?.currentXp || 0;
  const totalTiers = season?.totalTiers || 50;
  const progressPercent = Math.min((currentTier / totalTiers) * 100, 100);

  const getRewardIcon = (reward: BattlepassReward) => {
    switch (reward.type) {
      case 'card': return Star;
      case 'slc': return Zap;
      case 'ability': return Flame;
      case 'item': return Gift;
      case 'cosmetic': return Crown;
      default: return Gift;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              Battlepass
            </h1>
            <p className="text-muted-foreground mt-1">Complete Event Missions and study to earn rewards</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {season && (
          <>
            {/* Season Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-red-500/10 border border-yellow-500/20 rounded-xl p-6 mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{season.name}</h2>
                  <p className="text-sm text-muted-foreground">{season.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">{getTimeRemaining()}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(season.startDate).toLocaleDateString()} - {new Date(season.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>XP Progress</span>
                <span className="text-muted-foreground">{currentXp} XP</span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Tier {currentTier} of {totalTiers}</span>
                <span>{totalTiers - currentTier} tiers remaining</span>
              </div>
            </motion.div>

            {/* Final Reward Highlight */}
            {season.finalReward && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-5 mb-8"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Star className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Final Reward</p>
                    <p className="font-semibold">{season.finalReward.cardName} ({season.finalReward.rarity})</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tier List */}
            <div className="space-y-3">
              {progress?.tiers?.sort((a, b) => b.tierNumber - a.tierNumber).map((tier) => {
                const RewardIcon = tier.rewards[0] ? getRewardIcon(tier.rewards[0]) : Gift;
                const isExpanded = expandedTier === tier.id;
                return (
                  <motion.div
                    key={tier.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      'rounded-xl border transition-all',
                      tier.claimed ? 'bg-green-500/5 border-green-500/20' : tier.unlocked ? 'bg-card border-yellow-500/30' : 'bg-card border-border opacity-60'
                    )}
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedTier(isExpanded ? null : tier.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            tier.claimed ? 'bg-green-500/20 text-green-500' : tier.unlocked ? 'bg-yellow-500/20 text-yellow-500' : 'bg-muted text-muted-foreground'
                          )}>
                            {tier.claimed ? <CheckCircle className="w-5 h-5" /> : tier.unlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-semibold">Tier {tier.tierNumber}</p>
                            <p className="text-xs text-muted-foreground">{tier.xpRequired} XP required</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {tier.rewards.slice(0, 2).map((reward) => (
                            <div key={reward.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                              <RewardIcon className="w-3 h-3" />
                              {reward.name}
                            </div>
                          ))}
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="px-4 pb-4"
                      >
                        <Separator className="mb-4" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {tier.rewards.map((reward) => (
                            <div key={reward.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <RewardIcon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{reward.name}</p>
                                <p className="text-xs text-muted-foreground">{reward.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {tier.unlocked && !tier.claimed && (
                          <Button
                            className="w-full mt-4 bg-yellow-500 hover:bg-yellow-600"
                            onClick={() => handleClaimReward(tier)}
                            disabled={claimingTier === tier.id}
                          >
                            {claimingTier === tier.id ? <Spinner size="sm" className="mr-2" /> : <Gift className="w-4 h-4 mr-2" />}
                            Claim Reward
                          </Button>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
