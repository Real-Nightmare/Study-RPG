-- 009_rpg_seed_data.sql - Initial game content seed

-- Worlds
INSERT INTO worlds (id, name, description, unlock_condition, order_index, is_active, created_at) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Overworld', 'The main world of study challenges', '{}', 1, TRUE, NOW()),
  ('b2c3d4e5-f6a7-8901-bcde-fa2345678901', 'Otherworld', 'A glitched, harder version of the Overworld', '{"requires_world":"overworld","min_level":5}', 2, TRUE, NOW()),
  ('c3d4e5f6-a7b8-9012-cdef-b23456789012', 'The End', 'The final challenge awaits here', '{"requires_world":"otherworld","min_level":10}', 3, TRUE, NOW()),
  ('d4e5f6a7-b8c9-0123-defg-c34567890123', 'The Limbo', 'Endgame content for true scholars', '{"requires_world":"the_end","min_level":15}', 4, TRUE, NOW())
ON CONFLICT DO NOTHING;

-- Areas for Overworld
INSERT INTO areas (id, world_id, name, description, required_level, order_index, is_unlocked, theme, created_at) VALUES
  ('e5f6a7b8-c9d0-1234-efgh-d45678901234', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Foundations', 'Basic study concepts and fundamentals', 1, 1, TRUE, 'standard', NOW()),
  ('f6a7b8c9-d0e1-2345-fghi-e56789012345', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Applications', 'Applying knowledge to real problems', 3, 2, TRUE, 'standard', NOW()),
  ('a7b8c9d0-e1f2-3456-ghij-f67890123456', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Mastery', 'Advanced mastery and expertise', 6, 3, TRUE, 'standard', NOW())
ON CONFLICT DO NOTHING;

-- Subsection seeds
INSERT INTO subsections (id, area_id, name, description, order_index, xp_reward, slc_reward, is_unlocked) VALUES
  ('b8c9d0e1-f2a3-4567-hijk-g78901234567', 'e5f6a7b8-c9d0-1234-efgh-d45678901234', 'Basic Concepts', 'Learn the fundamentals', 1, 50, 10, TRUE),
  ('c9d0e1f2-a3b4-5678-ijkl-h89012345678', 'e5f6a7b8-c9d0-1234-efgh-d45678901234', 'Core Principles', 'Understand core principles', 2, 75, 15, TRUE),
  ('d0e1f2a3-b4c5-6789-jklm-i90123456789', 'f6a7b8c9-d0e1-2345-fghi-e56789012345', 'Problem Solving', 'Apply concepts to solve problems', 1, 100, 20, TRUE),
  ('e1f2a3b4-c5d6-7890-klmn-j01234567890', 'a7b8c9d0-e1f2-3456-ghij-f67890123456', 'Expert Challenge', 'Prove your mastery', 1, 150, 30, TRUE)
ON CONFLICT DO NOTHING;

-- Monsters
INSERT INTO monsters (id, area_id, name, hp, max_hp, sp, attack, defense, attack_pattern, weakness, drops, theme, order_index, is_boss, created_at) VALUES
  ('f2a3b4c5-d6e7-8901-lmno-k12345678901', 'e5f6a7b8-c9d0-1234-efgh-d45678901234', 'Confusion Beast', 40, 40, 8, 6, 2, '[{"type":"attack","damage":5},{"type":"confuse","damage":3}]', 'logic', '{"slc":15,"xp":20}', 'confusion', 1, FALSE, NOW()),
  ('a3b4c5d6-e7f8-9012-mnop-l23456789012', 'e5f6a7b8-c9d0-1234-efgh-d45678901234', 'Time Wraith', 50, 50, 10, 8, 3, '[{"type":"attack","damage":7},{"type":"drain","damage":4}]', 'punctuality', '{"slc":20,"xp":25}', 'time', 2, FALSE, NOW()),
  ('b4c5d6e7-f8a9-0123-nopq-m34567890123', 'f6a7b8c9-d0e1-2345-fghi-e56789012345', 'Memory Phantom', 60, 60, 12, 10, 4, '[{"type":"attack","damage":8},{"type":"forget","damage":5}]', 'repetition', '{"slc":30,"xp":35}', 'memory', 1, FALSE, NOW()),
  ('c5d6e7f8-a9b0-1234-opqr-n45678901234', 'f6a7b8c9-d0e1-2345-fghi-e56789012345', 'Doubt Golem', 80, 80, 14, 12, 6, '[{"type":"attack","damage":10},{"type":"block","damage":0}]', 'confidence', '{"slc":40,"xp":45}', 'doubt', 2, FALSE, NOW()),
  ('d6e7f8a9-b0c1-2345-pqrs-o56789012345', 'a7b8c9d0-e1f2-3456-ghij-f67890123456', 'Error Spirit', 100, 100, 16, 15, 5, '[{"type":"attack","damage":12},{"type":"corrupt","damage":8}]', 'precision', '{"slc":50,"xp":60}', 'error', 1, FALSE, NOW())
ON CONFLICT DO NOTHING;

-- Cards
INSERT INTO cards (id, name, rarity, sp_cost, abilities, effect_description, image_url, is_battlepass_exclusive, max_quantity, created_at) VALUES
  ('e7f8a9b0-c1d2-3456-qrst-p67890123456', 'Quick Recall', 'common', 1, '[{"name":"Quick Attack","type":"damage","value":10}]', 'A quick strike from memory', NULL, FALSE, 99, NOW()),
  ('f8a9b0c1-d2e3-4567-stuv-q78901234567', 'Focus Shield', 'common', 1, '[{"name":"Block","type":"defense","value":5}]', 'Shield your mind from confusion', NULL, FALSE, 99, NOW()),
  ('a9b0c1d2-e3f4-5677-tuvw-r89012345678', 'Study Heal', 'common', 2, '[{"name":"Restore","type":"heal","value":15}]', 'Restore focus and energy', NULL, FALSE, 99, NOW()),
  ('b0c1d2e3-f4a5-6788-uvwx-s90123456789', 'Concept Strike', 'common', 1, '[{"name":"Learn","type":"damage","value":8}]', 'Strike with a core concept', NULL, FALSE, 99, NOW()),
  ('c1d2e3f4-a5b6-7899-vwxy-t01234567890', 'Deep Focus', 'super_rare', 2, '[{"name":"Concentrate","type":"buff","value":5},{"name":"Focus Blast","type":"damage","value":15}]', 'Deep concentration unleashes power', NULL, FALSE, 99, NOW()),
  ('d2e3f4a5-b6c7-8900-wxyz-u12345678901', 'Knowledge Barrier', 'super_rare', 2, '[{"name":"Iron Will","type":"defense","value":12},{"name":"Reflect","type":"counter","value":5}]', 'An unbreakable barrier of knowledge', NULL, FALSE, 99, NOW()),
  ('e3f4a5b6-c7d8-9011-xyza-v23456789012', 'Exam Crush', 'super_rare', 3, '[{"name":"Critical Hit","type":"damage","value":25},{"name":"Pressure","type":"debuff","value":3}]', 'Crush exams with overwhelming force', NULL, FALSE, 99, NOW()),
  ('f4a5b6c7-d8e9-0122-yzab-w34567890123', 'Wisdom Flow', 'super_rare', 2, '[{"name":"Insight","type":"buff","value":8},{"name":"Heal","type":"heal","value":10}]', 'Let wisdom flow through you', NULL, FALSE, 99, NOW()),
  ('a5b6c7d8-e9f0-1233-zabc-x45678901234', 'Genius Burst', 'legendary', 3, '[{"name":"Overclock","type":"damage","value":35},{"name":"Haste","type":"buff","value":10},{"name":"Heal","type":"heal","value":10}]', 'Unleash genius-level power', NULL, FALSE, 99, NOW()),
  ('b6c7d8e9-f0a1-2344-abcd-y56789012345', 'Mind Fortress', 'legendary', 2, '[{"name":"Fortify","type":"defense","value":20},{"name":"Counter","type":"counter","value":10},{"name":"Regenerate","type":"heal","value":5}]', 'A fortress impenetrable by doubt', NULL, TRUE, 99, NOW()),
  ('c7d8e9f0-a1b2-3455-bcde-z67890123456', 'Eureka Moment', 'mythic', 4, '[{"name":"Inspire","type":"damage","value":45},{"name":"Bless","type":"buff","value":15},{"name":"Heal","type":"heal","value":15},{"name":"Cleanse","type":"purge","value":5}]', 'The flash of brilliance that changes everything', NULL, TRUE, 99, NOW()),
  ('d8e9f0a1-b2c3-4566-cdef-a78901234567', 'Omniscience', 'mythic', 4, '[{"name":"All-Seeing","type":"damage","value":50},{"name":"God Mode","type":"buff","value":20},{"name":"Heal","type":"heal","value":20},{"name":"Revive","type":"revive","value":1}]', 'See all answers, know all truths', NULL, FALSE, 99, NOW())
ON CONFLICT DO NOTHING;

-- Card marketplace entries
INSERT INTO card_marketplace (id, card_id, price_slc, is_available, stock, created_at, updated_at) VALUES
  ('e9f0a1b2-c3d4-5677-defg-b89012345678', 'e7f8a9b0-c1d2-3456-qrst-p67890123456', 50, TRUE, -1, NOW(), NOW()),
  ('f0a1b2c3-d4e5-6788-efgh-c90123456789', 'b0c1d2e3-f4a5-6788-uvwx-s90123456789', 50, TRUE, -1, NOW(), NOW()),
  ('a1b2c3d4-e5f6-7899-fghi-d01234567890', 'c1d2e3f4-a5b6-7899-vwxy-t01234567890', 150, TRUE, -1, NOW(), NOW()),
  ('b2c3d4e5-f6a7-8900-ghij-e12345678901', 'd2e3f4a5-b6c7-8900-wxyz-u12345678901', 150, TRUE, -1, NOW(), NOW()),
  ('c3d4e5f6-a7b8-9011-hijk-f23456789012', 'a5b6c7d8-e9f0-1233-zabc-x45678901234', 500, TRUE, -1, NOW(), NOW()),
  ('d4e5f6a7-b8c9-0122-ijkl-g34567890123', 'b6c7d8e9-f0a1-2344-abcd-y56789012345', 500, TRUE, -1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Abilities
INSERT INTO abilities (id, name, description, sp_cost, effect_type, effect_value, price_slc, target, created_at) VALUES
  ('e5f6a7b8-c9d0-1234-efgh-d45678901234', 'Quick Mind', 'Reduces card SP cost by 1', 1, 'sp_reduce', 1, 100, 'self', NOW()),
  ('f6a7b8c9-d0e1-2345-fghi-e56789012345', 'Critical Thinker', 'Increases damage by 20%', 2, 'damage_boost', 0.2, 200, 'self', NOW()),
  ('a7b8c9d0-e1f2-3456-ghij-f67890123456', 'Iron Will', 'Reduces incoming damage by 25%', 1, 'defense_boost', 0.25, 150, 'self', NOW()),
  ('b8c9d0e1-f2a3-4567-hijk-g78901234567', 'Confusion Ray', 'Confuses enemy, reducing accuracy', 2, 'debuff', 0.3, 250, 'enemy', NOW()),
  ('c9d0e1f2-a3b4-5678-ijkl-h89012345678', 'Memory Boost', 'Heals 20 HP over time', 1, 'heal_over_time', 20, 180, 'self', NOW())
ON CONFLICT DO NOTHING;

-- Items
INSERT INTO items (id, name, description, item_type, effect_type, effect_value, price_slc, counters_monster_type, max_stack, created_at) VALUES
  ('d0e1f2a3-b4c5-6789-jklm-i90123456789', 'Antidote', 'Cures confusion status', 'consumable', 'cure_confusion', 1, 30, 'confusion', 5, NOW()),
  ('e1f2a3b4-c5d6-7890-klmn-j01234567890', 'Focus Potion', 'Restores 30 SP', 'consumable', 'restore_sp', 30, 50, NULL, 10, NOW()),
  ('f2a3b4c5-d6e7-8901-lmno-k12345678901', 'Healing Potion', 'Restores 50 HP', 'consumable', 'restore_hp', 50, 40, NULL, 10, NOW()),
  ('a3b4c5d6-e7f8-9012-mnop-l23456789012', 'Bomb', 'Deals 30 damage to any monster', 'consumable', 'damage', 30, 80, NULL, 5, NOW()),
  ('b4c5d6e7-f8a9-0123-nopq-m34567890123', 'Shield Scroll', 'Blocks next attack completely', 'consumable', 'block', 1, 60, NULL, 5, NOW())
ON CONFLICT DO NOTHING;

-- Cosmetics
INSERT INTO cosmetics (id, name, type, price_slc, image_url, rarity, created_at) VALUES
  ('c5d6e7f8-a9b0-1234-opqr-n45678901234', 'Scholar Crown', 'skin', 200, NULL, 'legendary', NOW()),
  ('d6e7f8a9-b0c1-2345-pqrs-o56789012345', 'Wise Owl Title', 'title', 100, NULL, 'super_rare', NOW()),
  ('e7f8a9b0-c1d2-3456-qrst-p67890123456', 'Midnight Theme', 'theme', 150, NULL, 'super_rare', NOW()),
  ('f8a9b0c1-d2e3-4567-stuv-q78901234567', 'Golden Card Back', 'card_back', 300, NULL, 'legendary', NOW()),
  ('a9b0c1d2-e3f4-5677-tuvw-r89012345678', 'Novice Badge', 'title', 50, NULL, 'common', NOW())
ON CONFLICT DO NOTHING;

-- Battlepass Season 1
INSERT INTO battlepass_seasons (id, name, start_date, end_date, is_active, final_reward_card_id, description, created_at) VALUES
  ('b0c1d2e3-f4a5-6788-uvwx-s90123456789', 'Season 1: Scholar Ascension', NOW(), NOW() + INTERVAL '30 days', TRUE, 'b6c7d8e9-f0a1-2344-abcd-y56789012345', 'Rise through the ranks and claim legendary rewards', NOW())
ON CONFLICT DO NOTHING;

-- Battlepass tiers
INSERT INTO battlepass_tiers (id, season_id, tier_number, exp_required, rewards, created_at) VALUES
  ('c1d2e3f4-a5b6-7899-vwxy-t01234567890', 'b0c1d2e3-f4a5-6788-uvwx-s90123456789', 1, 50, '[{"type":"slc","amount":50}]', NOW()),
  ('d2e3f4a5-b6c7-8900-wxyz-u12345678901', 'b0c1d2e3-f4a5-6788-uvwx-s90123456789', 2, 150, '[{"type":"slc","amount":100}]', NOW()),
  ('e3f4a5b6-c7d8-9011-xyza-v23456789012', 'b0c1d2e3-f4a5-6788-uvwx-s90123456789', 3, 300, '[{"type":"slc","amount":150},{"type":"card","cardId":"c1d2e3f4-a5b6-7899-vwxy-t01234567890"}]', NOW()),
  ('f4a5b6c7-d8e9-0122-yzab-w34567890123', 'b0c1d2e3-f4a5-6788-uvwx-s90123456789', 4, 500, '[{"type":"slc","amount":200}]', NOW()),
  ('a5b6c7d8-e9f0-1233-zabc-x45678901234', 'b0c1d2e3-f4a5-6788-uvwx-s90123456789', 5, 750, '[{"type":"slc","amount":300},{"type":"card","cardId":"a5b6c7d8-e9f0-1233-zabc-x45678901234"}]', NOW())
ON CONFLICT DO NOTHING;

-- Event missions for Season 1
INSERT INTO event_missions (id, season_id, title, description, exp_reward, slc_reward, difficulty, is_active, generated_by_ai, created_at) VALUES
  ('b5c6d7e8-f9a0-2345-ijkl-m67890123456', 'b0c1d2e3-f4a5-6788-uvwx-s90123456789', 'Flashcard Marathon', 'Review 50 flashcards this week', 100, 50, 'easy', TRUE, TRUE, NOW()),
  ('c6d7e8f9-a0b1-3456-jklm-n78901234567', 'b0c1d2e3-f4a5-6788-uvwx-s90123456789', 'Quiz Master', 'Score 80%+ on 3 quizzes', 150, 75, 'medium', TRUE, TRUE, NOW()),
  ('d7e8f9a0-b1c2-4567-klmn-o89012345678', 'b0c1d2e3-f4a5-6788-uvwx-s90123456789', 'Battle Champion', 'Win 5 battles in the Overworld', 200, 100, 'hard', TRUE, TRUE, NOW())
ON CONFLICT DO NOTHING;
