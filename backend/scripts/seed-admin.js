const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Load environment variables only in non-Docker environments
if (process.env.NODE_ENV !== 'production') {
  try {
    const dotenv = require('dotenv');
    const fs = require('fs');
    const path = require('path');
    const envPath = fs.existsSync(path.join(__dirname, '..', '.env.local'))
      ? path.join(__dirname, '..', '.env.local')
      : fs.existsSync(path.join(__dirname, '..', '.env.production'))
        ? path.join(__dirname, '..', '.env.production')
        : path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
  } catch {
    /* dotenv not available */
  }
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Nightmare';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Joshua Martin';
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'N1GHTMAREISGoD@123';

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER || 'studyield',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'studyield',
});

async function seedAdmin() {
  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [
    ADMIN_USERNAME.toLowerCase(),
  ]);
  if (existing.rows.length > 0) {
    console.log(`Admin account "${ADMIN_USERNAME}" already exists - skipping seed`);
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const id = require('uuid').v4();

  await pool.query(
    `INSERT INTO users (id, username, name, password, role, preferences, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'admin', $5, NOW(), NOW())`,
    [id, ADMIN_USERNAME.toLowerCase(), ADMIN_NAME, hashedPassword, JSON.stringify({})],
  );

  console.log(`Seeded admin account: ${ADMIN_USERNAME}`);
}

seedAdmin()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Admin seed failed:', err.message);
    pool.end();
    process.exit(1);
  });
