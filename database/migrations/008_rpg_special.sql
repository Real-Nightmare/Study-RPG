-- 008_rpg_special.sql - Revision Centre, Programmes, CBT

CREATE TABLE IF NOT EXISTS revision_centre_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(12, 2) DEFAULT 0.00,
  streak INTEGER DEFAULT 0,
  last_passed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS revision_centre_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic VARCHAR(200) NOT NULL,
  quiz_id UUID,
  score NUMERIC(5, 2),
  passed BOOLEAN DEFAULT FALSE,
  reward_slc NUMERIC(12, 2) DEFAULT 0,
  slc_awarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  problem_statement TEXT,
  solution_approach TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ai_feedback JSONB DEFAULT '{}',
  admin_feedback TEXT,
  approved_by UUID REFERENCES users(id),
  submission_fee NUMERIC(12, 2) DEFAULT 50,
  fee_paid BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cbt_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  score INTEGER DEFAULT 0,
  total_marks INTEGER DEFAULT 30,
  answers JSONB DEFAULT '[]',
  completed BOOLEAN DEFAULT FALSE,
  week_start DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS cbt_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  subject VARCHAR(100) NOT NULL,
  votes INTEGER DEFAULT 0,
  is_selected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cbt_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  score INTEGER NOT NULL,
  total_marks INTEGER NOT NULL,
  week_start DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revision_centre_user_id ON revision_centre_funds(user_id);
CREATE INDEX IF NOT EXISTS idx_programmes_creator_id ON programmes(creator_id);
CREATE INDEX IF NOT EXISTS idx_cbt_sessions_user_id ON cbt_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cbt_votes_week ON cbt_votes(week_start);
