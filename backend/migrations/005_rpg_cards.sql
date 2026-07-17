-- 005_rpg_cards.sql - Cards, User Cards, Marketplace

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('common', 'super_rare', 'legendary', 'mythic')),
  sp_cost INTEGER NOT NULL DEFAULT 1,
  abilities JSONB NOT NULL DEFAULT '[]',
  effect_description TEXT,
  image_url TEXT,
  is_battlepass_exclusive BOOLEAN DEFAULT FALSE,
  max_quantity INTEGER DEFAULT 99,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

CREATE TABLE IF NOT EXISTS card_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  price_slc NUMERIC(12, 2) NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  stock INTEGER DEFAULT -1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_ids JSONB NOT NULL DEFAULT '[]',
  name VARCHAR(100) DEFAULT 'Default Deck',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_card_marketplace_card_id ON card_marketplace(card_id);
