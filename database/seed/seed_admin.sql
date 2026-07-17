-- Seed admin account
-- Username: Nightmare
-- Password: N1GHTMAREISGoD@123
-- Role: admin
-- NOTE: Use backend/scripts/seed-admin.js for proper password hashing
-- This SQL is for reference only

INSERT INTO users (id, username, name, password, role, preferences, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'nightmare',
    'Joshua Martin',
    '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH',
    'admin',
    '{}',
    NOW(),
    NOW()
) ON CONFLICT (username) DO NOTHING;
