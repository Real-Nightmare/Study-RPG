-- 012_legacy_feature_tables.sql
-- Adds feature tables that are referenced by the current backend source code
-- but were not present in the core 001-011 migrations. These were previously
-- maintained in a separate (now-removed) backend/migrations set.
-- All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) so
-- this migration is safe to run multiple times.
--
-- NOTE: The Stripe-based `subscriptions` table from the old backend/migrations
-- set has been intentionally dropped as part of removing the deprecated billing
-- feature. Do NOT re-add it.

-- Notes (AI-generated and manual notes within study sets)
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_json JSONB,
    summary TEXT,
    source_type VARCHAR(30) DEFAULT 'manual',
    source_url TEXT,
    source_metadata JSONB,
    tags JSONB DEFAULT '[]',
    is_pinned BOOLEAN DEFAULT FALSE,
    color VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_study_set_id ON notes(study_set_id);
CREATE INDEX IF NOT EXISTS idx_notes_source_type ON notes(source_type);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(study_set_id, is_pinned);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

DROP TRIGGER IF EXISTS trigger_notes_updated_at ON notes;
CREATE TRIGGER trigger_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Mind Maps
CREATE TABLE IF NOT EXISTS mind_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    study_set_id UUID REFERENCES study_sets(id) ON DELETE CASCADE,
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content_snapshot TEXT,
    mind_map_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mind_maps_user_id ON mind_maps(user_id);
CREATE INDEX IF NOT EXISTS idx_mind_maps_study_set_id ON mind_maps(study_set_id);
CREATE INDEX IF NOT EXISTS idx_mind_maps_note_id ON mind_maps(note_id);

-- Live Quiz history
CREATE TABLE IF NOT EXISTS live_quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(6) NOT NULL,
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    study_set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
    total_questions INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_quiz_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES live_quiz_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player_name VARCHAR(100) NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    total_answers INTEGER NOT NULL DEFAULT 0,
    rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

CREATE TABLE IF NOT EXISTS live_quiz_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES live_quiz_sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES live_quiz_participants(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    answer_text TEXT,
    correct_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    points_earned INTEGER NOT NULL DEFAULT 0,
    time_taken_seconds NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_quiz_sessions_host ON live_quiz_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_live_quiz_sessions_study_set ON live_quiz_sessions(study_set_id);
CREATE INDEX IF NOT EXISTS idx_live_quiz_participants_session ON live_quiz_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_live_quiz_participants_user ON live_quiz_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_live_quiz_answers_session ON live_quiz_answers(session_id);

-- Exam gamification (badges + leaderboard support)
CREATE TABLE IF NOT EXISTS exam_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL,
    category VARCHAR(30),
    requirement_type VARCHAR(30) NOT NULL,
    requirement_value INTEGER NOT NULL,
    xp_reward INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_exam_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES exam_badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    exam_clone_id UUID REFERENCES exam_clones(id) ON DELETE SET NULL,
    UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_exam_badges_user ON user_exam_badges(user_id);

INSERT INTO exam_badges (id, slug, name, description, icon, color, category, requirement_type, requirement_value, xp_reward)
SELECT * FROM (VALUES
    (gen_random_uuid(), 'first_exam', 'First Steps', 'Complete your first practice exam', 'Trophy', 'amber', 'milestone', 'count', 1, 50),
    (gen_random_uuid(), 'ten_exams', 'Getting Serious', 'Complete 10 practice exams', 'Award', 'blue', 'milestone', 'count', 10, 100),
    (gen_random_uuid(), 'fifty_exams', 'Exam Warrior', 'Complete 50 practice exams', 'Medal', 'purple', 'milestone', 'count', 50, 250),
    (gen_random_uuid(), 'hundred_exams', 'Exam Master', 'Complete 100 practice exams', 'Crown', 'yellow', 'milestone', 'count', 100, 500),
    (gen_random_uuid(), 'perfect_score', 'Perfectionist', 'Score 100% on any exam', 'Star', 'yellow', 'accuracy', 'score', 100, 100),
    (gen_random_uuid(), 'high_scorer', 'High Achiever', 'Score 90%+ on 5 exams', 'TrendingUp', 'green', 'accuracy', 'score', 90, 150),
    (gen_random_uuid(), 'consistent', 'Consistent Performer', 'Score 80%+ on 10 consecutive exams', 'Target', 'blue', 'accuracy', 'score', 80, 200),
    (gen_random_uuid(), 'three_day_streak', 'Getting Started', 'Practice 3 days in a row', 'Flame', 'orange', 'consistency', 'streak', 3, 30),
    (gen_random_uuid(), 'seven_day_streak', 'Week Warrior', 'Practice 7 days in a row', 'Flame', 'orange', 'consistency', 'streak', 7, 75),
    (gen_random_uuid(), 'thirty_day_streak', 'Monthly Master', 'Practice 30 days in a row', 'Flame', 'red', 'consistency', 'streak', 30, 300),
    (gen_random_uuid(), 'speed_demon', 'Speed Demon', 'Complete an exam in under 5 minutes with 80%+ score', 'Zap', 'yellow', 'speed', 'time', 300, 100),
    (gen_random_uuid(), 'quick_learner', 'Quick Learner', 'Answer 10 questions correctly in under 1 minute each', 'Clock', 'cyan', 'speed', 'time', 60, 75),
    (gen_random_uuid(), 'review_starter', 'Review Rookie', 'Complete 10 review sessions', 'Brain', 'purple', 'milestone', 'count', 10, 50),
    (gen_random_uuid(), 'review_master', 'Memory Master', 'Complete 100 review sessions', 'Brain', 'indigo', 'milestone', 'count', 100, 200),
    (gen_random_uuid(), 'hundred_questions', 'Century', 'Answer 100 questions correctly', 'CheckCircle', 'green', 'milestone', 'count', 100, 100),
    (gen_random_uuid(), 'thousand_questions', 'Question Crusher', 'Answer 1000 questions correctly', 'Rocket', 'purple', 'milestone', 'count', 1000, 500)
) AS v(id, slug, name, description, icon, color, category, requirement_type, requirement_value, xp_reward)
WHERE NOT EXISTS (SELECT 1 FROM exam_badges WHERE exam_badges.slug = v.slug);

CREATE OR REPLACE VIEW exam_leaderboard AS
SELECT
    u.id AS user_id,
    u.name,
    u.avatar_url,
    COUNT(DISTINCT ea.id) AS total_exams,
    COALESCE(AVG(ea.score), 0)::INTEGER AS avg_score,
    COALESCE(SUM(ea.correct_count), 0)::INTEGER AS total_correct,
    COALESCE(MAX(ea.score), 0) AS best_score,
    COUNT(DISTINCT DATE(ea.created_at)) AS active_days,
    MAX(ea.created_at) AS last_active
FROM users u
LEFT JOIN exam_attempts ea ON u.id = ea.user_id
GROUP BY u.id, u.name, u.avatar_url
HAVING COUNT(ea.id) > 0
ORDER BY avg_score DESC, total_correct DESC;

-- Exam templates
CREATE TABLE IF NOT EXISTS exam_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50),
    question_types JSONB NOT NULL,
    difficulty_distribution JSONB NOT NULL,
    time_per_question INTEGER,
    total_questions INTEGER,
    format_patterns JSONB,
    subjects JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO exam_templates (id, name, slug, description, category, question_types, difficulty_distribution, time_per_question, total_questions, format_patterns, subjects) VALUES
    (gen_random_uuid(), 'SAT', 'sat', 'SAT standardized test format', 'standardized_test', '["multiple_choice", "grid_in"]'::jsonb, '{"easy": 25, "medium": 50, "hard": 25}'::jsonb, 75, 154, '["Passage-based questions", "Data analysis", "Problem solving"]'::jsonb, '["Math", "Reading", "Writing"]'::jsonb),
    (gen_random_uuid(), 'GRE', 'gre', 'GRE Graduate Record Examination format', 'standardized_test', '["multiple_choice", "numeric_entry", "text_completion"]'::jsonb, '{"easy": 20, "medium": 50, "hard": 30}'::jsonb, 90, 80, '["Analytical writing", "Quantitative reasoning", "Verbal reasoning"]'::jsonb, '["Verbal", "Quantitative", "Analytical Writing"]'::jsonb),
    (gen_random_uuid(), 'IELTS', 'ielts', 'IELTS English proficiency test format', 'standardized_test', '["multiple_choice", "matching", "fill_blank", "short_answer", "essay"]'::jsonb, '{"easy": 30, "medium": 50, "hard": 20}'::jsonb, 60, 40, '["Listening comprehension", "Reading passages", "Writing tasks"]'::jsonb, '["Listening", "Reading", "Writing", "Speaking"]'::jsonb),
    (gen_random_uuid(), 'TOEFL', 'toefl', 'TOEFL English proficiency test format', 'standardized_test', '["multiple_choice", "integrated_writing", "independent_writing"]'::jsonb, '{"easy": 25, "medium": 55, "hard": 20}'::jsonb, 90, 60, '["Academic reading", "Campus conversations", "Integrated tasks"]'::jsonb, '["Reading", "Listening", "Speaking", "Writing"]'::jsonb),
    (gen_random_uuid(), 'AP Exam', 'ap', 'Advanced Placement exam format', 'academic', '["multiple_choice", "free_response", "document_based"]'::jsonb, '{"easy": 20, "medium": 50, "hard": 30}'::jsonb, 120, 55, '["Stimulus-based MCQ", "Short answer", "Long essay"]'::jsonb, '["Biology", "Chemistry", "Physics", "History", "English", "Math", "Computer Science"]'::jsonb),
    (gen_random_uuid(), 'University Midterm', 'midterm', 'Standard university midterm format', 'academic', '["multiple_choice", "short_answer", "essay"]'::jsonb, '{"easy": 30, "medium": 50, "hard": 20}'::jsonb, 90, 30, '["Conceptual questions", "Problem solving", "Application"]'::jsonb, '["General"]'::jsonb),
    (gen_random_uuid(), 'SSC', 'ssc', 'Secondary School Certificate exam format', 'academic', '["multiple_choice", "short_answer", "essay"]'::jsonb, '{"easy": 40, "medium": 45, "hard": 15}'::jsonb, 120, 50, '["Objective questions", "Descriptive answers", "Comprehension"]'::jsonb, '["Bangla", "English", "Math", "Science", "Social Science"]'::jsonb),
    (gen_random_uuid(), 'HSC', 'hsc', 'Higher Secondary Certificate exam format', 'academic', '["multiple_choice", "short_answer", "essay", "problem_solving"]'::jsonb, '{"easy": 30, "medium": 50, "hard": 20}'::jsonb, 180, 60, '["MCQ section", "Written section", "Practical application"]'::jsonb, '["Bangla", "English", "Physics", "Chemistry", "Biology", "Math", "Accounting", "Economics"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Problem solver enhancements
CREATE TABLE IF NOT EXISTS problem_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES problem_solving_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'tutor')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_chat_messages_session ON problem_chat_messages(session_id);

CREATE TABLE IF NOT EXISTS solution_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES problem_solving_sessions(id) ON DELETE CASCADE,
    tags JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_solution_bookmarks_user ON solution_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_solution_bookmarks_session ON solution_bookmarks(session_id);

CREATE TABLE IF NOT EXISTS practice_quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES problem_solving_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL DEFAULT 'mcq',
    options JSONB DEFAULT '[]'::jsonb,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(10) DEFAULT 'medium',
    user_answer TEXT,
    is_correct BOOLEAN,
    answered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_quiz_session ON practice_quiz_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_practice_quiz_user ON practice_quiz_questions(user_id);

CREATE TABLE IF NOT EXISTS solution_alternative_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES problem_solving_sessions(id) ON DELETE CASCADE,
    method_name TEXT NOT NULL,
    method_description TEXT,
    solution_steps JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alt_methods_session ON solution_alternative_methods(session_id);

ALTER TABLE problem_solving_sessions
    ADD COLUMN IF NOT EXISTS hint_steps JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS complexity_level VARCHAR(20) DEFAULT 'intermediate',
    ADD COLUMN IF NOT EXISTS graph_data JSONB;

-- User XP events
CREATE TABLE IF NOT EXISTS user_xp_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_xp_events_user_id ON user_xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_events_created_at ON user_xp_events(created_at);

-- User FCM tokens (push notifications)
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_id ON user_fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_fcm_token ON user_fcm_tokens(fcm_token);
