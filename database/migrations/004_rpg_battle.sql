-- 004_rpg_battle.sql - Worlds, Areas, Monsters, User Progress

CREATE TABLE IF NOT EXISTS worlds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  unlock_condition JSONB DEFAULT '{}',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  required_level INTEGER DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_unlocked BOOLEAN DEFAULT FALSE,
  theme VARCHAR(50) DEFAULT 'standard',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subsections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  xp_reward INTEGER DEFAULT 50,
  slc_reward NUMERIC(12, 2) DEFAULT 0,
  is_unlocked BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS monsters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  hp INTEGER NOT NULL,
  max_hp INTEGER NOT NULL,
  sp INTEGER NOT NULL,
  attack INTEGER NOT NULL,
  defense INTEGER NOT NULL,
  attack_pattern JSONB DEFAULT '[]',
  weakness VARCHAR(50),
  drops JSONB DEFAULT '{}',
  theme VARCHAR(50),
  order_index INTEGER NOT NULL DEFAULT 0,
  is_boss BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  subsection_id UUID REFERENCES subsections(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'locked' CHECK (status IN ('locked', 'active', 'completed')),
  score INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, area_id, subsection_id)
);

CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  monster_id UUID NOT NULL REFERENCES monsters(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'fled')),
  player_hp INTEGER NOT NULL,
  player_max_hp INTEGER NOT NULL,
  player_sp INTEGER NOT NULL,
  player_max_sp INTEGER NOT NULL,
  monster_hp INTEGER NOT NULL,
  turn_count INTEGER DEFAULT 0,
  log JSONB DEFAULT '[]',
  reward_slc NUMERIC(12, 2) DEFAULT 0,
  reward_xp INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_areas_world_id ON areas(world_id);
CREATE INDEX IF NOT EXISTS idx_monsters_area_id ON monsters(area_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_battles_user_id ON battles(user_id);
