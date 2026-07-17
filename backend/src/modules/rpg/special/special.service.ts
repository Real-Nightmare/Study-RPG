import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { SlcService } from '../slc/slc.service';
import { LlmService } from '../../llm/llm.service';
import { QuizGeneratorService, GeneratedQuestion } from '../../quiz/quiz-generator.service';

export interface RevisionCentreFunds {
  id: string;
  userId: string;
  balance: number;
  streak: number;
  lastPassedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevisionSession {
  id: string;
  userId: string;
  topic: string;
  quizId?: string;
  score?: number;
  passed: boolean;
  rewardSlc: number;
  slcAwarded: boolean;
  createdAt: Date;
}

export interface Programme {
  id: string;
  creatorId: string;
  title: string;
  description?: string;
  problemStatement?: string;
  solutionApproach?: string;
  status: string;
  aiFeedback: Record<string, unknown>;
  adminFeedback?: string;
  approvedBy?: string;
  submissionFee: number;
  feePaid: boolean;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CbtSession {
  id: string;
  userId: string;
  subject: string;
  score: number;
  totalMarks: number;
  answers: GeneratedQuestion[];
  completed: boolean;
  weekStart: Date;
  createdAt: Date;
  completedAt?: Date;
}

export interface CbtVote {
  id: string;
  weekStart: Date;
  subject: string;
  votes: number;
  isSelected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SpecialService {
  private readonly logger = new Logger(SpecialService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly slcService: SlcService,
    private readonly llmService: LlmService,
    private readonly quizGenerator: QuizGeneratorService,
  ) {}

  async getRevisionCentre(userId: string): Promise<RevisionCentreFunds> {
    return this.slcService.getRevisionCentreFunds(userId);
  }

  async applyRevisionCentre(userId: string, topic: string): Promise<RevisionSession> {
    const sessionId = uuidv4();
    const now = new Date();

    let quizId: string | undefined;
    try {
      const questions = await this.quizGenerator.generateQuestions({
        content: `Topic: ${topic}. Generate revision questions.`,
        questionCount: 10,
        questionTypes: ['multiple_choice'],
        difficulty: 'medium',
      });

      quizId = uuidv4();
      await this.db.query(
        `INSERT INTO quizzes (id, user_id, title, description, question_count, time_limit, is_public, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8)`,
        [
          quizId,
          userId,
          `Revision: ${topic}`,
          `Auto-generated revision quiz for ${topic}`,
          questions.length,
          600,
          now,
          now,
        ],
      );

      for (let i = 0; i < questions.length; i++) {
        await this.db.query(
          `INSERT INTO quiz_questions (id, quiz_id, type, question, options, correct_answer, explanation, difficulty, "order")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            uuidv4(),
            quizId,
            'multiple_choice',
            questions[i].question,
            JSON.stringify(questions[i].options || []),
            questions[i].correctAnswer,
            questions[i].explanation || null,
            'medium',
            i,
          ],
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to generate quiz for topic ${topic}: ${error.message}`);
      quizId = undefined;
    }

    const result = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO revision_centre_sessions (id, user_id, topic, quiz_id, score, passed, reward_slc, slc_awarded, created_at)
       VALUES ($1, $2, $3, $4, NULL, FALSE, 0, FALSE, $5) RETURNING *`,
      [sessionId, userId, topic, quizId || null, now],
    );

    return this.mapRevisionSession(result!);
  }

  async submitRevisionQuiz(
    userId: string,
    sessionId: string,
    answers: unknown[],
  ): Promise<{ passed: boolean; score: number; reward: number; funds: RevisionCentreFunds }> {
    const session = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM revision_centre_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId],
    );

    if (!session) {
      throw new NotFoundException('Revision session not found');
    }

    let score = 0;
    let questions: Record<string, unknown>[] = [];

    if (session.quiz_id) {
      questions = await this.db.queryMany<Record<string, unknown>>(
        'SELECT * FROM quiz_questions WHERE quiz_id = $1',
        [session.quiz_id],
      );

      let correctCount = 0;
      const userAnswers = answers as Array<{ questionId: string; answer: string }>;
      for (const qa of userAnswers) {
        const question = questions.find((q) => q.id === qa.questionId);
        if (question) {
          const normalize = (s: string) => s.toLowerCase().trim();
          if (normalize(question.correct_answer as string) === normalize(qa.answer)) {
            correctCount++;
          }
        }
      }

      score = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
    }

    const passed = score >= 30;
    const reward = passed ? Math.round((score / 100) * 100 * 100) / 100 : 0;

    await this.db.query(
      `UPDATE revision_centre_sessions SET score = $1, passed = $2, reward_slc = $3, slc_awarded = $4 WHERE id = $5`,
      [score, passed, reward, passed, sessionId],
    );

    let funds = await this.slcService.getRevisionCentreFunds(userId);

    if (passed) {
      funds = await this.slcService.updateRevisionCentreFunds(
        userId,
        score,
        questions.length || 10,
      );
    }

    return { passed, score, reward, funds };
  }

  async createProgramme(userId: string, body: Record<string, unknown>): Promise<Programme> {
    const id = uuidv4();
    const now = new Date();

    let aiFeedback: Record<string, unknown> = {};
    try {
      aiFeedback = await this.evaluateProgrammeWithAI(
        body.title as string,
        body.description as string,
        body.problemStatement as string,
        body.solutionApproach as string,
      );
    } catch (error) {
      this.logger.warn(`AI evaluation failed: ${error.message}`);
      aiFeedback = { score: 0, feedback: 'AI evaluation unavailable', approved: false };
    }

    const result = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO programmes (id, creator_id, title, description, problem_statement, solution_approach, status, ai_feedback, submission_fee, fee_paid, is_public, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 50, FALSE, FALSE, $8, $9) RETURNING *`,
      [
        id,
        userId,
        body.title,
        body.description || null,
        body.problemStatement || null,
        body.solutionApproach || null,
        JSON.stringify(aiFeedback),
        now,
        now,
      ],
    );

    return this.mapProgramme(result!);
  }

  async getUserProgrammes(userId: string, status?: string): Promise<Programme[]> {
    let query = 'SELECT * FROM programmes WHERE creator_id = $1';
    const params: unknown[] = [userId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const rows = await this.db.queryMany<Record<string, unknown>>(query, params);
    return rows.map((r) => this.mapProgramme(r));
  }

  async submitProgramme(userId: string, programmeId: string): Promise<Programme> {
    const programme = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM programmes WHERE id = $1 AND creator_id = $2',
      [programmeId, userId],
    );

    if (!programme) {
      throw new NotFoundException('Programme not found');
    }

    if (programme.status !== 'pending') {
      throw new BadRequestException('Programme already submitted');
    }

    await this.slcService.deductSLC(userId, {
      amount: 50,
      reason: 'programme_submission_fee',
      description: `Programme submission fee`,
    });

    const result = await this.db.queryOne<Record<string, unknown>>(
      `UPDATE programmes SET status = 'pending', fee_paid = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [programmeId],
    );

    return this.mapProgramme(result!);
  }

  async startCbt(userId: string, subject: string): Promise<CbtSession> {
    const weekStart = this.getWeekStart(new Date());
    const sessionId = uuidv4();
    const now = new Date();

    const questions = await this.generateCbtQuestions(subject);

    const result = await this.db.queryOne<Record<string, unknown>>(
      `INSERT INTO cbt_sessions (id, user_id, subject, score, total_marks, answers, completed, week_start, created_at)
       VALUES ($1, $2, $3, 0, 30, $4, FALSE, $5, $6) RETURNING *`,
      [sessionId, userId, subject, JSON.stringify(questions), weekStart, now],
    );

    return this.mapCbtSession(result!, questions);
  }

  async submitCbt(userId: string, sessionId: string, answers: unknown[]): Promise<CbtSession> {
    const session = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM cbt_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId],
    );

    if (!session) throw new NotFoundException('CBT session not found');
    if (session.completed) throw new BadRequestException('CBT already submitted');

    const questions =
      typeof session.answers === 'string' ? JSON.parse(session.answers) : session.answers || [];
    let correctCount = 0;

    const userAnswers = answers as Array<{ questionId: string; answer: string }>;
    for (const qa of userAnswers) {
      const question = questions.find((q: Record<string, unknown>) => q.id === qa.questionId);
      if (question) {
        const normalize = (s: string) => s.toLowerCase().trim();
        if (normalize(question.correctAnswer as string) === normalize(qa.answer)) {
          correctCount++;
        }
      }
    }

    const score = correctCount;
    const now = new Date();

    await this.db.query(
      `UPDATE cbt_sessions SET score = $1, completed = TRUE, completed_at = $2 WHERE id = $3`,
      [score, now, sessionId],
    );

    await this.slcService.addSLC(userId, {
      amount: Math.round((score / 30) * 100 * 100) / 100,
      source: 'cbt',
      description: `CBT session reward (${score}/30)`,
    });

    await this.db.query(
      `INSERT INTO xp_records (id, user_id, source, amount, description, created_at) VALUES ($1, $2, 'cbt', $3, $4, NOW())`,
      [uuidv4(), userId, score * 3, `CBT completed: ${session.subject}`],
    );

    await this.db.query(
      `INSERT INTO cbt_leaderboard (id, user_id, subject, score, total_marks, week_start, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [uuidv4(), userId, session.subject, score, 30, session.week_start],
    );

    const result = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM cbt_sessions WHERE id = $1',
      [sessionId],
    );
    return this.mapCbtSession(result!, questions);
  }

  async voteCbtSubject(userId: string, subject: string): Promise<CbtVote> {
    const weekStart = this.getWeekStart(new Date());

    await this.db.query(
      `INSERT INTO cbt_votes (week_start, subject, votes, is_selected, created_at, updated_at)
       VALUES ($1, $2, 0, FALSE, NOW(), NOW())
       ON CONFLICT (week_start, subject) DO UPDATE SET votes = cbt_votes.votes + 1, updated_at = NOW()`,
      [weekStart, subject],
    );

    const result = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM cbt_votes WHERE week_start = $1 AND subject = $2',
      [weekStart, subject],
    );

    return this.mapCbtVote(result!);
  }

  async getCbtVotes(): Promise<CbtVote[]> {
    const weekStart = this.getWeekStart(new Date());
    const rows = await this.db.queryMany<Record<string, unknown>>(
      'SELECT * FROM cbt_votes WHERE week_start = $1 ORDER BY votes DESC',
      [weekStart],
    );
    return rows.map((r) => this.mapCbtVote(r));
  }

  async getCbtLeaderboard(subject?: string): Promise<Record<string, unknown>[]> {
    let query = `SELECT cl.*, u.username, u.name FROM cbt_leaderboard cl JOIN users u ON cl.user_id = u.id`;
    const params: unknown[] = [];

    if (subject) {
      query += ' WHERE cl.subject = $1';
      params.push(subject);
    }

    query += ' ORDER BY cl.score DESC, cl.created_at ASC LIMIT 50';

    return this.db.queryMany<Record<string, unknown>>(query, params);
  }

  async adminGetRevisionCentre(): Promise<
    { userId: string; username: string; name: string; balance: number; streak: number }[]
  > {
    const rows = await this.db.queryMany<Record<string, unknown>>(
      `SELECT rcf.*, u.username, u.name FROM revision_centre_funds rcf JOIN users u ON rcf.user_id = u.id ORDER BY rcf.balance DESC`,
    );

    return rows.map((r) => ({
      userId: r.user_id as string,
      username: r.username as string,
      name: r.name as string,
      balance: parseFloat(String(r.balance)),
      streak: parseInt(String(r.streak || 0), 10),
    }));
  }

  async adminGetProgrammes(status?: string): Promise<Programme[]> {
    let query = 'SELECT * FROM programmes';
    const params: unknown[] = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const rows = await this.db.queryMany<Record<string, unknown>>(query, params);
    return rows.map((r) => this.mapProgramme(r));
  }

  async approveProgramme(
    adminId: string,
    programmeId: string,
    feedback?: string,
  ): Promise<Programme> {
    const programme = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM programmes WHERE id = $1',
      [programmeId],
    );
    if (!programme) throw new NotFoundException('Programme not found');

    const result = await this.db.queryOne<Record<string, unknown>>(
      `UPDATE programmes SET status = 'approved', approved_by = $1, admin_feedback = COALESCE($2, admin_feedback), updated_at = NOW() WHERE id = $3 RETURNING *`,
      [adminId, feedback || null, programmeId],
    );

    return this.mapProgramme(result!);
  }

  async rejectProgramme(
    adminId: string,
    programmeId: string,
    feedback: string,
  ): Promise<Programme> {
    const programme = await this.db.queryOne<Record<string, unknown>>(
      'SELECT * FROM programmes WHERE id = $1',
      [programmeId],
    );
    if (!programme) throw new NotFoundException('Programme not found');

    const result = await this.db.queryOne<Record<string, unknown>>(
      `UPDATE programmes SET status = 'rejected', approved_by = $1, admin_feedback = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [adminId, feedback, programmeId],
    );

    return this.mapProgramme(result!);
  }

  private async evaluateProgrammeWithAI(
    title: string,
    description: string,
    problem: string,
    solution: string,
  ): Promise<Record<string, unknown>> {
    try {
      const prompt = `Evaluate this study programme proposal. Return JSON with: score (0-100), feedback (string), approved (boolean), suggestions (array of strings). Title: ${title}. Description: ${description}. Problem: ${problem}. Solution: ${solution}`;

      const response = await this.llmService.callWithFallback(prompt, {
        temperature: 0.3,
        maxTokens: 500,
        responseFormat: { type: 'json_object' },
      });

      return JSON.parse(response);
    } catch (error) {
      this.logger.error(`AI evaluation failed: ${error.message}`);
      return { score: 0, feedback: 'Evaluation unavailable', approved: false };
    }
  }

  private async generateCbtQuestions(subject: string): Promise<GeneratedQuestion[]> {
    try {
      const questions = await this.quizGenerator.generateQuestions({
        content: `Subject: ${subject}. Generate CBSE-style multiple choice questions.`,
        questionCount: 30,
        questionTypes: ['multiple_choice'],
        difficulty: 'mixed',
      });

      return questions;
    } catch (error) {
      this.logger.error(`CBT question generation failed: ${error.message}`);
      return this.generateDefaultCbtQuestions(subject);
    }
  }

  private generateDefaultCbtQuestions(subject: string): GeneratedQuestion[] {
    const questions: GeneratedQuestion[] = [];
    for (let i = 0; i < 30; i++) {
      questions.push({
        type: 'multiple_choice',
        question: `Sample question ${i + 1} for ${subject}`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        explanation: 'This is a sample question',
        difficulty: 'medium',
      });
    }
    return questions;
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private mapRevisionSession(row: Record<string, unknown>): RevisionSession {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      topic: row.topic as string,
      quizId: row.quiz_id as string | undefined,
      score: row.score ? parseFloat(String(row.score)) : undefined,
      passed: row.passed as boolean,
      rewardSlc: parseFloat(String(row.reward_slc || 0)),
      slcAwarded: row.slc_awarded as boolean,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapProgramme(row: Record<string, unknown>): Programme {
    return {
      id: row.id as string,
      creatorId: row.creator_id as string,
      title: row.title as string,
      description: row.description as string | undefined,
      problemStatement: row.problem_statement as string | undefined,
      solutionApproach: row.solution_approach as string | undefined,
      status: row.status as string,
      aiFeedback:
        typeof row.ai_feedback === 'string' ? JSON.parse(row.ai_feedback) : row.ai_feedback || {},
      adminFeedback: row.admin_feedback as string | undefined,
      approvedBy: row.approved_by as string | undefined,
      submissionFee: parseFloat(String(row.submission_fee || 50)),
      feePaid: row.fee_paid as boolean,
      isPublic: row.is_public as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapCbtSession(
    row: Record<string, unknown>,
    questions: GeneratedQuestion[] = [],
  ): CbtSession {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      subject: row.subject as string,
      score: parseInt(String(row.score || 0), 10),
      totalMarks: parseInt(String(row.total_marks || 30), 10),
      answers: questions,
      completed: row.completed as boolean,
      weekStart: new Date(row.week_start as string),
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    };
  }

  private mapCbtVote(row: Record<string, unknown>): CbtVote {
    return {
      id: row.id as string,
      weekStart: new Date(row.week_start as string),
      subject: row.subject as string,
      votes: parseInt(String(row.votes || 0), 10),
      isSelected: row.is_selected as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
