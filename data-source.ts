import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || process.env.DB_HOST || process.env.POSTGRES_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || process.env.POSTGRES_PORT || process.env.PGPORT || '5432'),
  username: process.env.DATABASE_USER || process.env.DB_USER || process.env.POSTGRES_USER || process.env.PGUSER || 'postgres',
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '',
  database: process.env.DATABASE_NAME || process.env.DB_NAME || process.env.DB_DATABASE || process.env.POSTGRES_DB || process.env.PGDATABASE || 'study_rpg',
  synchronize: false,
  logging: false,
});
