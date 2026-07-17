import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Lightbulb,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Coins,
  FileText,
  Send,
  Eye,
} from 'lucide-react';
import { createProgramme, listProgrammes, approveProgramme, rejectProgramme } from '@/services/rpg';
import type { RPGProgramme, CreateProgrammeRequest } from '@/types';
import { cn } from '@/lib/utils';

type Tab = 'browse' | 'create' | 'mine';

export default function ProgrammesPage() {
  const [tab, setTab] = useState<Tab>('browse');
  const [programmes, setProgrammes] = useState<RPGProgramme[]>([]);
  const [myProgrammes, setMyProgrammes] = useState<RPGProgramme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateProgrammeRequest>({
    title: '',
    problemStatement: '',
    solutionApproach: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await listProgrammes();
      setProgrammes(data);
      setMyProgrammes(data.filter(p => p.status === 'pending'));
    } catch {
      setError('Failed to load programmes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.problemStatement.trim()) return;
    try {
      setIsSubmitting(true);
      await createProgramme(formData);
      setFormData({ title: '', problemStatement: '', solutionApproach: '' });
      setTab('mine');
      await fetchData();
    } catch {
      setError('Failed to create programme');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveProgramme(id);
      await fetchData();
    } catch {
      setError('Failed to approve programme');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectProgramme(id);
      await fetchData();
    } catch {
      setError('Failed to reject programme');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-white" />
              </div>
              Programmes
            </h1>
            <p className="text-muted-foreground mt-1">Submit and manage innovative programmes</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Custom Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          {[
            { key: 'browse', label: 'Browse', icon: Eye },
            { key: 'create', label: 'Create', icon: Plus },
            { key: 'mine', label: 'My Programmes', icon: FileText },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                tab === key
                  ? 'border-green-500 text-green-600 dark:text-green-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* Browse */}
            {tab === 'browse' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {programmes.filter(p => p.status === 'approved').length === 0 ? (
                  <Card className="p-12 text-center">
                    <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No approved programmes yet</h3>
                    <p className="text-muted-foreground">Check back later for community programmes!</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {programmes.filter(p => p.status === 'approved').map((programme) => (
                      <Card key={programme.id} className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold mb-1">{programme.title}</h3>
                            <p className="text-sm text-muted-foreground">by {programme.authorName}</p>
                          </div>
                          <Badge variant="secondary" className={cn('border', getStatusColor(programme.status))}>
                            {programme.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{programme.problemStatement}</p>
                        <p className="text-sm mb-4 line-clamp-2">{programme.solutionApproach}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(programme.createdAt).toLocaleDateString()}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Create */}
            {tab === 'create' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-green-500" />
                    Create Programme
                  </h3>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Programme title"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="problem">Problem Statement</Label>
                      <textarea
                        id="problem"
                        value={formData.problemStatement}
                        onChange={(e) => setFormData({ ...formData, problemStatement: e.target.value })}
                        placeholder="Describe the problem your programme solves"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[100px]"
                      />
                    </div>
                    <div>
                      <Label htmlFor="solution">Solution Approach</Label>
                      <textarea
                        id="solution"
                        value={formData.solutionApproach}
                        onChange={(e) => setFormData({ ...formData, solutionApproach: e.target.value })}
                        placeholder="Describe your solution approach"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[100px]"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Coins className="w-4 h-4" />
                      Submission fee: 50 SLC
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-green-500 hover:bg-green-600"
                      disabled={isSubmitting || !formData.title.trim() || !formData.problemStatement.trim()}
                    >
                      {isSubmitting ? <Spinner size="sm" className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      Submit Programme
                    </Button>
                  </form>
                </Card>
              </motion.div>
            )}

            {/* My Programmes */}
            {tab === 'mine' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {myProgrammes.length === 0 ? (
                  <Card className="p-12 text-center">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No programmes yet</h3>
                    <p className="text-muted-foreground mb-4">Create your first programme to see it here!</p>
                    <Button onClick={() => setTab('create')}>Create Programme</Button>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {myProgrammes.map((programme) => (
                      <Card key={programme.id} className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold mb-1">{programme.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">{programme.problemStatement}</p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="secondary" className={cn('border', getStatusColor(programme.status))}>
                              {programme.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {new Date(programme.createdAt).toLocaleDateString()}
                          </span>
                          <div className="flex gap-2">
                            {programme.status === 'pending' && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleReject(programme.id)}>
                                  <XCircle className="w-3 h-3 mr-1" /> Reject
                                </Button>
                                <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => handleApprove(programme.id)}>
                                  <CheckCircle className="w-3 h-3 mr-1" /> Approve
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
