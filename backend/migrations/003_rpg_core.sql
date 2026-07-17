-- 003_rpg_core.sql - Core RPG tables: SLC wallet, XP, levels

CREATE TABLE IF NOT EXISTS slc_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(12, 2) DEFAULT 500.00,
  total_earned NUMERIC(12, 2) DEFAULT 500.00,
  total_spent NUMERIC(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS slc_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
  source VARCHAR(50) NOT NULL,
  reference_id UUID,
  description TEXT,
  balance_after NUMERIC(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xp_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL CHECK (source IN ('mission', 'revision_centre', 'cbt', 'battle', 'event_mission', 'study_session')),
  amount INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS levels (
  level_number INTEGER PRIMARY KEY,
  xp_required INTEGER NOT NULL,
  title VARCHAR(100) NOT NULL,
  reward_slc NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_slc_wallets_user_id ON slc_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_slc_transactions_user_id ON slc_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_records_user_id ON xp_records(user_id);
CREATE INDEX IF NOT EXISTS idx_user_levels_user_id ON user_levels(user_id);

INSERT INTO levels (level_number, xp_required, title, reward_slc) VALUES
  (1, 0, 'Novice Scholar', 0),
  (2, 100, 'Apprentice Learner', 50),
  (3, 250, 'Dedicated Student', 100),
  (4, 500, 'Knowledge Seeker', 150),
  (5, 800, 'Skilled Researcher', 200),
  (6, 1200, 'Expert Analyst', 300),
  (7, 1700, 'Master Mind', 400),
  (8, 2300, 'Grand Scholar', 500),
  (9, 3000, 'Academic Legend', 600),
  (10, 4000, 'Eternal Sage', 800);
