import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Timer,
  Play,
  RotateCcw,
  Target,
  Trophy,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  applyRevisionCentre,
  takeQuiz,
  submitQuiz,
  getRevisionCentreFunds,
} from '@/services/rpg';
import type { RPGRevisionSession } from '@/types';
import { cn } from '@/lib/utils';

type RevisionPhase = 'apply' | 'quiz' | 'results';

export default function RevisionCentrePage() {
  const [phase, setPhase] = useState<RevisionPhase>('apply');
  const [session, setSession] = useState<RPGRevisionSession | null>(null);
  const [topic, setTopic] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funds, setFunds] = useState<{ balance: number; streak: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);

  const fetchFunds = async () => {
    try {
      const data = await getRevisionCentreFunds();
      setFunds(data);
    } catch {
      // ignore
    }
  };

  const handleSubmitRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (phase !== 'quiz') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const handleApply = async () => {
    if (!topic.trim()) return;
    try {
      setIsLoading(true);
      setError(null);
      const newSession = await applyRevisionCentre(topic);
      setSession(newSession);
      setPhase('quiz');
      setTimeLeft(300);
      setCurrentQuestionIndex(0);
      setAnswers({});
    } catch {
      setError('Failed to apply for revision');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakeQuiz = async () => {
    if (!session) return;
    try {
      setIsLoading(true);
      const updated = await takeQuiz(session.id);
      setSession(updated);
    } catch {
      setError('Failed to load quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    handleSubmitRef.current = null;
    if (!session) return;
    try {
      setIsLoading(true);
      const updated = await submitQuiz(session.id, answers);
      setSession(updated);
      setPhase('results');
      fetchFunds();
    } catch {
      setError('Failed to submit quiz');
    } finally {
      setIsLoading(false);
    }
  };

  handleSubmitRef.current = handleSubmit;

  const currentQuestion = session?.questions?.[currentQuestionIndex];
  const score = session?.score ?? 0;
  const totalQuestions = session?.questions?.length ?? 0;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const passed = percentage >= 30;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              Revision Centre
            </h1>
            <p className="text-muted-foreground mt-1">
              Fund Balance: <span className="font-bold text-green-500">{funds?.balance ?? 0} SLC</span>
              {funds?.streak ? ` | Streak: ${funds.streak}` : ''}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && !session ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* Apply Phase */}
            {phase === 'apply' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <Card className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-500" />
                    Apply for Revision
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select a topic to revise. You'll receive an AI-generated quiz to test your knowledge.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Topic</label>
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g., Photosynthesis, Quadratic Equations..."
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <Button
                      className="w-full bg-green-500 hover:bg-green-600"
                      onClick={handleApply}
                      disabled={!topic.trim()}
                    >
                      <Play className="w-4 h-4 mr-2" /> Apply & Start
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Quiz Phase */}
            {phase === 'quiz' && session && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {!session.questions || session.questions.length === 0 ? (
                  <Card className="p-6">
                    <div className="text-center py-8">
                      <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No questions loaded</h3>
                      <Button onClick={handleTakeQuiz} disabled={isLoading}>
                        {isLoading ? <Spinner size="sm" className="mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        Load Quiz
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <>
                    {/* Timer */}
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">
                        Question {currentQuestionIndex + 1} of {totalQuestions}
                      </Badge>
                      <div className={cn('flex items-center gap-2 text-sm', timeLeft < 60 ? 'text-red-500' : 'text-muted-foreground')}>
                        <Timer className="w-4 h-4" />
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                        animate={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                      />
                    </div>

                    {/* Question */}
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold mb-4">{currentQuestion?.question}</h3>
                      <div className="space-y-3">
                        {currentQuestion?.options?.map((option, idx) => (
                          <button
                            key={idx}
                            onClick={() => setAnswers({ ...answers, [currentQuestionIndex]: option })}
                            className={cn(
                              'w-full p-4 text-left rounded-lg border-2 transition-all',
                              answers[currentQuestionIndex] === option
                                ? 'border-green-500 bg-green-500/10'
                                : 'border-border hover:border-green-500/50'
                            )}
                          >
                            <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                            {option}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-6">
                        {currentQuestionIndex > 0 && (
                          <Button
                            variant="outline"
                            onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
                          >
                            Previous
                          </Button>
                        )}
                        {currentQuestionIndex < totalQuestions - 1 ? (
                          <Button
                            className="flex-1 bg-green-500 hover:bg-green-600"
                            onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                            disabled={!answers[currentQuestionIndex]}
                          >
                            Next
                          </Button>
                        ) : (
                          <Button
                            className="flex-1 bg-green-500 hover:bg-green-600"
                            onClick={handleSubmit}
                            disabled={isLoading}
                          >
                            {isLoading ? <Spinner size="sm" className="mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                            Submit
                          </Button>
                        )}
                      </div>
                    </Card>
                  </>
                )}
              </motion.div>
            )}

            {/* Results Phase */}
            {phase === 'results' && session && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                <Card className="p-8 text-center">
                  <div className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4',
                    passed ? 'bg-green-500/20' : 'bg-red-500/20'
                  )}>
                    {passed ? (
                      <Trophy className="w-10 h-10 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-10 h-10 text-red-500" />
                    )}
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{passed ? 'Passed!' : 'Not Passed'}</h2>
                  <p className="text-muted-foreground mb-6">
                    You scored {score} out of {totalQuestions} ({percentage}%)
                  </p>
                  {!passed && (
                    <Alert variant="destructive" className="mb-6 text-left">
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription>
                        You need at least 30% to pass. Review the material and try again!
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="flex gap-4 justify-center">
                    <Button variant="outline" onClick={() => setPhase('apply')}>
                      <RotateCcw className="w-4 h-4 mr-2" /> New Revision
                    </Button>
                    <Button className="bg-green-500 hover:bg-green-600" onClick={() => window.location.href = '/dashboard/battlepass'}>
                      View Battlepass
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
