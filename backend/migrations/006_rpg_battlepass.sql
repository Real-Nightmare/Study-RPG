-- 006_rpg_battlepass.sql - Battlepass Seasons, Tiers, User Progress, Event Missions

CREATE TABLE IF NOT EXISTS battlepass_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  final_reward_card_id UUID REFERENCES cards(id),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS battlepass_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES battlepass_seasons(id) ON DELETE CASCADE,
  tier_number INTEGER NOT NULL,
  exp_required INTEGER NOT NULL,
  rewards JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(season_id, tier_number)
);

CREATE TABLE IF NOT EXISTS user_battlepass (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES battlepass_seasons(id) ON DELETE CASCADE,
  current_tier INTEGER DEFAULT 1,
  total_exp INTEGER DEFAULT 0,
  claimed_rewards JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, season_id)
);

CREATE TABLE IF NOT EXISTS event_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES battlepass_seasons(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  exp_reward INTEGER DEFAULT 0,
  slc_reward NUMERIC(12, 2) DEFAULT 0,
  difficulty VARCHAR(20) DEFAULT 'medium',
  is_active BOOLEAN DEFAULT TRUE,
  generated_by_ai BOOLEAN DEFAULT FALSE,
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_event_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_mission_id UUID NOT NULL REFERENCES event_missions(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  progress INTEGER DEFAULT 0,
  claimed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, event_mission_id)
);

CREATE INDEX IF NOT EXISTS idx_battlepass_tiers_season_id ON battlepass_tiers(season_id);
CREATE INDEX IF NOT EXISTS idx_user_battlepass_user_id ON user_battlepass(user_id);
CREATE INDEX IF NOT EXISTS idx_event_missions_season_id ON event_missions(season_id);
