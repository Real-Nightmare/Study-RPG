import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardCheck,
  Clock,
  Play,
  Send,
  RotateCcw,
  Trophy,
  XCircle,
  Timer,
  Calendar,
  Target,
} from 'lucide-react';
import { getUpcomingCBT, joinCBT, submitCBT, getCBTResults } from '@/services/rpg';
import type { RGPCBTExam, CBTAnswer, CBTResult } from '@/types';
import { cn } from '@/lib/utils';

type CBTPhase = 'list' | 'exam' | 'results';

export default function CBTPage() {
  const [phase, setPhase] = useState<CBTPhase>('list');
  const [exams, setExams] = useState<RGPCBTExam[]>([]);
  const [activeExam, setActiveExam] = useState<RGPCBTExam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [results, setResults] = useState<CBTResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const handleSubmitRef = useRef<(() => void) | null>(null);

  const fetchExams = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getUpcomingCBT();
      setExams(data);
    } catch {
      setError('Failed to load exams');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  useEffect(() => {
    if (phase !== 'exam' || !activeExam || timeLeft <= 0) return;
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
  }, [phase, activeExam, timeLeft]);

  const handleJoin = async (examId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const exam = await joinCBT(examId);
      setActiveExam(exam);
      setPhase('exam');
      setTimeLeft(exam.duration * 60);
      setCurrentQuestionIndex(0);
      setAnswers({});
    } catch {
      setError('Failed to join exam');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    handleSubmitRef.current = null;
    if (!activeExam) return;
    try {
      setIsLoading(true);
      const answerList: CBTAnswer[] = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
      }));
      const result = await submitCBT(activeExam.id, answerList);
      setResults(result);
      setPhase('results');
    } catch {
      setError('Failed to submit exam');
    } finally {
      setIsLoading(false);
    }
  };

  handleSubmitRef.current = handleSubmit;

  const handleViewResults = async (examId: string) => {
    try {
      setIsLoading(true);
      const result = await getCBTResults(examId);
      setResults(result);
      setPhase('results');
    } catch {
      setError('Failed to load results');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = activeExam?.questions?.[currentQuestionIndex];
  const totalQuestions = activeExam?.questions?.length ?? 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-white" />
              </div>
              CBT Exams
            </h1>
            <p className="text-muted-foreground mt-1">Computer Based Tests for exam preparation</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && phase === 'list' ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* Exam List */}
            {phase === 'list' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {exams.length === 0 ? (
                  <Card className="p-12 text-center">
                    <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No upcoming exams</h3>
                    <p className="text-muted-foreground">Check back later for new CBT exams!</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {exams.map((exam) => (
                      <Card key={exam.id} className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{exam.title}</h3>
                              <Badge variant="secondary">{exam.subject}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{exam.description}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(exam.date).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {exam.time}
                              </span>
                              <span className="flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                {exam.duration} min
                              </span>
                              <span className="flex items-center gap-1">
                                <Target className="w-3 h-3" />
                                {exam.totalMarks} marks
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            {exam.status === 'completed' && exam.score !== undefined ? (
                              <Button size="sm" variant="outline" onClick={() => handleViewResults(exam.id)}>
                                <Trophy className="w-4 h-4 mr-1" /> View Results
                              </Button>
                            ) : exam.status === 'active' ? (
                              <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => handleJoin(exam.id)}>
                                <Play className="w-4 h-4 mr-1" /> Resume
                              </Button>
                            ) : (
                              <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => handleJoin(exam.id)}>
                                <Play className="w-4 h-4 mr-1" /> Start
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Exam Phase */}
            {phase === 'exam' && activeExam && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">
                    Question {currentQuestionIndex + 1} of {totalQuestions}
                  </Badge>
                  <div className={cn('flex items-center gap-2 text-sm font-mono', timeLeft < 60 ? 'text-red-500' : 'text-muted-foreground')}>
                    <Timer className="w-4 h-4" />
                    {formatTime(timeLeft)}
                  </div>
                </div>

                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    animate={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                  />
                </div>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">{currentQuestion?.question}</h3>
                  {currentQuestion?.options && (
                    <div className="space-y-3">
                      {currentQuestion.options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => setAnswers({ ...answers, [currentQuestion.id]: option })}
                          className={cn(
                            'w-full p-4 text-left rounded-lg border-2 transition-all',
                            answers[currentQuestion.id] === option
                              ? 'border-green-500 bg-green-500/10'
                              : 'border-border hover:border-green-500/50'
                          )}
                        >
                          <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                  {currentQuestion?.type === 'short_answer' && (
                    <textarea
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                      placeholder="Type your answer here..."
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[100px]"
                    />
                  )}
                  <div className="flex gap-3 mt-6">
                    {currentQuestionIndex > 0 && (
                      <Button variant="outline" onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}>
                        Previous
                      </Button>
                    )}
                    {currentQuestionIndex < totalQuestions - 1 ? (
                      <Button className="flex-1 bg-green-500 hover:bg-green-600" onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}>
                        Next
                      </Button>
                    ) : (
                      <Button className="flex-1 bg-green-500 hover:bg-green-600" onClick={handleSubmit}>
                        <Send className="w-4 h-4 mr-2" /> Submit Exam
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Results */}
            {phase === 'results' && results && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                <Card className="p-8 text-center">
                  <div className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4',
                    results.passed ? 'bg-green-500/20' : 'bg-red-500/20'
                  )}>
                    {results.passed ? (
                      <Trophy className="w-10 h-10 text-green-500" />
                    ) : (
                      <XCircle className="w-10 h-10 text-red-500" />
                    )}
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{results.passed ? 'Passed!' : 'Not Passed'}</h2>
                  <p className="text-muted-foreground mb-2">
                    Score: {results.score} / {results.totalMarks} ({results.percentage}%)
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Time spent: {Math.floor(results.timeSpent / 60)} min {results.timeSpent % 60} sec
                  </p>

                  <Separator className="mb-6" />

                  <div className="grid grid-cols-2 gap-4 text-left mb-6">
                    <div>
                      <h4 className="font-semibold text-sm text-green-500 mb-2">Strong Areas</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {results.analysis.strongAreas.map((area, i) => (
                          <li key={i}>+ {area}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-red-500 mb-2">Weak Areas</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {results.analysis.weakAreas.map((area, i) => (
                          <li key={i}>- {area}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="text-left mb-6">
                    <h4 className="font-semibold text-sm mb-2">Recommendations</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {results.analysis.recommendations.map((rec, i) => (
                        <li key={i}>* {rec}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={fetchExams}>
                      <RotateCcw className="w-4 h-4 mr-2" /> Back to Exams
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
