-- Seed admin account
-- Username: Nightmare
-- Role: admin
--
-- IMPORTANT: This SQL is for reference only. The real admin account is created
-- with a properly bcrypt-hashed password by `backend/scripts/seed-admin.js`
-- (run automatically by `npm run migrate`, or manually via `npm run seed:admin`).
-- Do NOT use the placeholder hash below in production.
--
-- The script is idempotent: it skips insertion if the username already exists.

INSERT INTO users (id, username, name, password, role, preferences, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'nightmare',
    'Joshua Martin',
    '$2b$12$REPLACE_WITH_REAL_BCRYPT_HASH',
    'admin',
    '{}',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE username = 'nightmare'
);
