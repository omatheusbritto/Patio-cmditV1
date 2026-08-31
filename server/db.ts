import { Pool as PgPool } from 'pg';
import mysql, { Pool as MySqlPool } from 'mysql2/promise';

let pgPool: PgPool | null = null;
let mysqlPool: MySqlPool | null = null;
let activeDbType: 'postgres' | 'mysql' | 'json' = 'json';
let isDbAvailable: boolean = false;

/**
 * Returns PostgreSQL Pool if DATABASE_URL or PG environment variables are set.
 */
export function getPgPool(): PgPool | null {
  if (!pgPool) {
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URI;
    if (databaseUrl) {
      try {
        const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
        pgPool = new PgPool({
          connectionString: databaseUrl,
          ssl: isLocal ? false : { rejectUnauthorized: false },
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        });
        pgPool.on('error', (err) => {
          console.warn('PostgreSQL Client Error:', err.message);
        });
      } catch (err) {
        console.warn('PostgreSQL pool creation failed:', err);
      }
    } else if (process.env.PGHOST || process.env.POSTGRES_HOST) {
      try {
        pgPool = new PgPool({
          host: process.env.PGHOST || process.env.POSTGRES_HOST,
          user: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
          password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
          database: process.env.PGDATABASE || process.env.POSTGRES_DATABASE || 'postgres',
          port: Number(process.env.PGPORT || 5432),
          ssl: { rejectUnauthorized: false },
          max: 10,
        });
      } catch (err) {
        console.warn('PostgreSQL connection with env vars failed:', err);
      }
    }
  }
  return pgPool;
}

/**
 * Returns MySQL/MariaDB Pool if DB_HOST is set.
 */
export function getDbPool(): MySqlPool | null {
  if (!mysqlPool && (process.env.DB_HOST || process.env.DB_USER)) {
    try {
      mysqlPool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'patio_user',
        password: process.env.DB_PASSWORD || 'SenhaForte123@',
        database: process.env.DB_NAME || 'patio_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    } catch (err) {
      console.warn('MySQL pool initialization skipped:', err);
    }
  }
  return mysqlPool;
}

/**
 * Initializes the database connection and creates required tables.
 * Prioritizes PostgreSQL (Standard on Render / Supabase / Neon / Cloud SQL).
 */
export async function initDatabase(): Promise<{ active: boolean; type: 'postgres' | 'mysql' | 'json' }> {
  // 1. Try PostgreSQL first
  const pg = getPgPool();
  if (pg) {
    try {
      const client = await pg.connect();
      try {
        // Create users table
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(100) PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(150) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'operador',
            badge_id VARCHAR(50) NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Seed Master user
        await client.query(`
          INSERT INTO users (id, username, password_hash, full_name, role, is_active)
          VALUES ('master-001', 'mastercmdit', 'Master@123', 'Administrador Master', 'master', TRUE)
          ON CONFLICT (username) DO NOTHING;
        `);

        // Create vehicle_records table
        await client.query(`
          CREATE TABLE IF NOT EXISTS vehicle_records (
            id VARCHAR(100) PRIMARY KEY,
            plate VARCHAR(20) NOT NULL,
            plate_state VARCHAR(10) NULL,
            model VARCHAR(100) NULL,
            color VARCHAR(50) NULL,
            driver_name VARCHAR(150) NULL,
            driver_doc VARCHAR(50) NULL,
            company VARCHAR(150) NULL,
            entry_time VARCHAR(50) NULL,
            exit_time VARCHAR(50) NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'inside',
            seal_number VARCHAR(100) NULL,
            odometer INT NULL,
            notes TEXT NULL,
            operator_name VARCHAR(150) NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            raw_data JSONB NULL
          );
        `);

        // Create app_settings table for Google Sheets & global configs
        await client.query(`
          CREATE TABLE IF NOT EXISTS app_settings (
            key VARCHAR(50) PRIMARY KEY,
            value JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        activeDbType = 'postgres';
        isDbAvailable = true;
        console.log('✅ PostgreSQL Database connected & synchronized successfully (Render / Cloud)!');
        return { active: true, type: 'postgres' };
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('⚠️ PostgreSQL connection failed:', err.message);
    }
  }

  // 2. Try MySQL / MariaDB
  const my = getDbPool();
  if (my) {
    try {
      const conn = await my.getConnection();
      try {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(100) PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(150) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'operador',
            badge_id VARCHAR(50) NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);

        await conn.query(`
          INSERT INTO users (id, username, password_hash, full_name, role, is_active)
          VALUES ('master-001', 'mastercmdit', 'Master@123', 'Administrador Master', 'master', 1)
          ON DUPLICATE KEY UPDATE full_name='Administrador Master'
        `);

        await conn.query(`
          CREATE TABLE IF NOT EXISTS vehicle_records (
            id VARCHAR(100) PRIMARY KEY,
            plate VARCHAR(20) NOT NULL,
            plate_state VARCHAR(10) NULL,
            model VARCHAR(100) NULL,
            color VARCHAR(50) NULL,
            driver_name VARCHAR(150) NULL,
            driver_doc VARCHAR(50) NULL,
            company VARCHAR(150) NULL,
            entry_time VARCHAR(50) NULL,
            exit_time VARCHAR(50) NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'inside',
            seal_number VARCHAR(100) NULL,
            odometer INT NULL,
            notes TEXT NULL,
            operator_name VARCHAR(150) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            raw_data JSON NULL
          )
        `);

        activeDbType = 'mysql';
        isDbAvailable = true;
        console.log('✅ MariaDB Database connected & synchronized successfully!');
        return { active: true, type: 'mysql' };
      } finally {
        conn.release();
      }
    } catch (err: any) {
      console.warn('⚠️ MariaDB connection failed:', err.message);
    }
  }

  // 3. Fallback to Local JSON Storage
  activeDbType = 'json';
  isDbAvailable = true;
  console.log('ℹ️ Running with local JSON persistence.');
  return { active: true, type: 'json' };
}

// Aliases for compatibility
export const initMariaDbDatabase = initDatabase;
export const isMariaDbActive = () => isDbAvailable;
export const getActiveDbType = () => activeDbType;
