const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables only in non-Docker environments
if (process.env.NODE_ENV !== 'production') {
  try {
    const dotenv = require('dotenv');
    const envPath = fs.existsSync(path.join(__dirname, '..', '.env.local'))
      ? path.join(__dirname, '..', '.env.local')
      : fs.existsSync(path.join(__dirname, '..', '.env.production'))
      ? path.join(__dirname, '..', '.env.production')
      : path.join(__dirname, '..', '.env');

    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  } catch (err) {
    console.log('Using environment variables from system');
  }
}

function getDatabaseUrl() {
  // Check common env var names used by OpsCtrl and other platforms
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_CONNECTION_STRING,
    process.env.DB_URL,
    process.env.DATABASE_CONNECTION_STRING,
  ].filter(Boolean);

  if (candidates.length > 0) {
    return candidates[0];
  }

  // Fallback: construct from individual variables
  const host = process.env.DATABASE_HOST || process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.DATABASE_PORT || process.env.POSTGRES_PORT || '5432';
  const user = process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres';
  const password = process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || '';
  const database = process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'study_rpg';

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

function createPool(connectionString) {
  const sslEnabled = process.env.DATABASE_SSL === 'true' || /[?&]sslmode=require/.test(connectionString);
  
  return new Pool({
    connectionString,
    ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
    min: 1,
    max: 5,
    keepAlive: true,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 30000,
  });
}

async function waitForDatabase(connectionString, maxRetries = 30, delayMs = 2000) {
  console.log(`Waiting for database at ${connectionString.replace(/\/\/.*@/, '//***@')}...`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const pool = createPool(connectionString);
      const client = await pool.connect();
      client.release();
      await pool.end();
      console.log('Database is ready!');
      return;
    } catch (err) {
      if (i === maxRetries - 1) {
        throw new Error(`Database not ready after ${maxRetries} attempts: ${err.message}`);
      }
      console.log(`Database not ready yet (attempt ${i + 1}/${maxRetries}), retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

async function migrate() {
  const connectionString = getDatabaseUrl();
  console.log(`Using database: ${connectionString.replace(/\/\/.*@/, '//***@')}`);

  await waitForDatabase(connectionString);

  const pool = createPool(connectionString);
  const client = await pool.connect();

  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Get executed migrations
    const { rows: executed } = await client.query('SELECT name FROM migrations');
    const executedNames = new Set(executed.map(r => r.name));

    // Get migration files
    const backendDir = path.join(__dirname, '..');
    const candidates = [
      path.join(backendDir, '..', 'database', 'migrations'),
      path.join(backendDir, 'migrations'),
    ];
    const migrationsDir = candidates.find(c => fs.existsSync(c)) || candidates[0];
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (executedNames.has(file)) {
        console.log(`Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✓ Migration ${file} completed`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`✗ Migration ${file} failed:`, error.message);
        throw error;
      }
    }

    console.log('\nAll migrations completed successfully!');
    await seedAdmin(pool);
  } finally {
    client.release();
    await pool.end();
  }
}

async function seedAdmin(pool) {
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
  if (!adminPassword) {
    console.log('ADMIN_DEFAULT_PASSWORD not set — skipping admin seed.');
    return;
  }

  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [(process.env.ADMIN_USERNAME || 'Nightmare').toLowerCase()],
    );
    if (existing.length > 0) {
      console.log(`Admin account already exists - skipping seed`);
      return;
    }

    const bcrypt = require('bcrypt');
    const { v4: uuidv4 } = require('uuid');
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    await pool.query(
      `INSERT INTO users (id, username, name, password, role, preferences, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'admin', $5, NOW(), NOW())`,
      [
        uuidv4(),
        (process.env.ADMIN_USERNAME || 'Nightmare').toLowerCase(),
        process.env.ADMIN_NAME || 'Joshua Martin',
        hashedPassword,
        JSON.stringify({}),
      ],
    );
    console.log(`Seeded admin account: ${process.env.ADMIN_USERNAME || 'Nightmare'}`);
  } catch (err) {
    console.error('Admin seed failed:', err.message);
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
