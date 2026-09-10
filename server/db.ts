import { Pool as PgPool } from 'pg';
import mysql, { Pool as MySqlPool } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

let pgPool: PgPool | null = null;
let mysqlPool: MySqlPool | null = null;
let activeDbType: 'postgres' | 'mysql' | 'json' = 'json';
let isDbAvailable: boolean = false;
let configuredDatabaseUrl: string | null = null;

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_CONFIG_FILE = path.join(DATA_DIR, 'db-config.json');

/**
 * Loads persisted database URL from data/db-config.json if available
 */
export function loadSavedDbUrl(): string | null {
  try {
    if (fs.existsSync(DB_CONFIG_FILE)) {
      const content = fs.readFileSync(DB_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (
        parsed &&
        typeof parsed.databaseUrl === 'string' &&
        parsed.databaseUrl.trim() &&
        (parsed.databaseUrl.startsWith('postgres://') || parsed.databaseUrl.startsWith('postgresql://'))
      ) {
        return parsed.databaseUrl.trim();
      }
    }
  } catch (err) {
    console.warn('Notice: db-config.json could not be read:', err);
  }
  // Auto-persist default Render database URL
  try {
    saveDatabaseUrl(DEFAULT_RENDER_DATABASE_URL);
  } catch {}
  return DEFAULT_RENDER_DATABASE_URL;
}

/**
 * Saves database URL to data/db-config.json for automatic reconnects across server restarts
 */
export function saveDatabaseUrl(url: string | null): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      DB_CONFIG_FILE,
      JSON.stringify(
        {
          databaseUrl: url ? url.trim() : null,
          savedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (err) {
    console.warn('Notice: db-config.json could not be written:', err);
  }
}

export const DEFAULT_RENDER_DATABASE_URL =
  'postgresql://adm_patiocmdit:BXrnPw0WxeLXMGcqgxgb2v6z4yUWv8JC@dpg-daan43hsrm7s73fe0920-a.oregon-postgres.render.com/patiocmdit_db';

export interface DatabaseDiagnostic {
  status: 'connected' | 'disconnected' | 'fallback_local';
  type: 'postgres' | 'mysql' | 'json';
  provider: string;
  isRenderPostgres: boolean;
  latencyMs: number;
  tables: {
    users: boolean;
    vehicle_records?: boolean;
    vehicle_movements?: boolean;
    vehicle_inventories?: boolean;
    access_logs: boolean;
    app_settings: boolean;
  };
  userCount: number;
  users: Array<{
    id: string;
    username: string;
    name: string;
    role: string;
    isActive: boolean;
    hasPassword: boolean;
  }>;
  connectionDetails: {
    host: string;
    database: string;
    port: number;
    ssl: boolean;
  };
  serverTime: string;
  configuredUrlMasked?: string;
}

/**
 * Returns PostgreSQL Pool if DATABASE_URL or PG environment variables are set.
 */
export function getPgPool(customUrl?: string): PgPool | null {
  const databaseUrl =
    customUrl ||
    configuredDatabaseUrl ||
    loadSavedDbUrl() ||
    process.env.INTERNAL_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.AUTH_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.RENDER_DATABASE_URL ||
    process.env.RENDER_DB_URL ||
    process.env.POSTGRESQL_URL ||
    process.env.DATABASE_URI ||
    DEFAULT_RENDER_DATABASE_URL;

  if (databaseUrl) {
    if (customUrl || !pgPool) {
      try {
        const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
        const pool = new PgPool({
          connectionString: databaseUrl,
          ssl: isLocal ? false : { rejectUnauthorized: false },
          max: 20,
          idleTimeoutMillis: 300000, // 5 minutos antes de fechar conexões ociosas
          connectionTimeoutMillis: 15000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000, // Envia pacotes TCP keepalive a cada 10s para provedores cloud (Render/Supabase/Neon)
        });
        pool.on('error', (err: any) => {
          console.warn('⚠️ [PostgreSQL Pool Event]:', err.message);
          const msg = (err?.message || '').toLowerCase();
          if (
            msg.includes('closed') ||
            msg.includes('terminated') ||
            msg.includes('reset') ||
            msg.includes('econnreset') ||
            msg.includes('timeout')
          ) {
            console.log('🔄 Conexão com o banco caiu. Acionando auto-reconexão imediata...');
            triggerBackgroundReconnect().catch(() => {});
          }
        });
        if (!customUrl) {
          pgPool = pool;
        }
        return pool;
      } catch (err) {
        console.warn('PostgreSQL pool creation failed:', err);
      }
    }
    return pgPool;
  } else if (process.env.PGHOST || process.env.POSTGRES_HOST) {
    if (!pgPool) {
      try {
        pgPool = new PgPool({
          host: process.env.PGHOST || process.env.POSTGRES_HOST,
          user: process.env.PGUSER || process.env.POSTGRES_USER || 'postgres',
          password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
          database: process.env.PGDATABASE || process.env.POSTGRES_DATABASE || 'postgres',
          port: Number(process.env.PGPORT || 5432),
          ssl: { rejectUnauthorized: false },
          max: 20,
          idleTimeoutMillis: 300000,
          connectionTimeoutMillis: 15000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        });
        pgPool.on('error', (err: any) => {
          console.warn('⚠️ [PostgreSQL Pool Event]:', err.message);
          triggerBackgroundReconnect().catch(() => {});
        });
      } catch (err) {
        console.warn('PostgreSQL connection with env vars failed:', err);
      }
    }
    return pgPool;
  }
  return null;
}

/**
 * Sets a runtime-configured database URL (such as from Render PostgreSQL) and reconnects
 */
export async function setRuntimeDatabaseUrl(url: string): Promise<{ success: boolean; error?: string; diagnostic?: DatabaseDiagnostic }> {
  if (pgPool) {
    try {
      await pgPool.end();
    } catch {}
    pgPool = null;
  }
  const cleanUrl = url.trim() || null;
  configuredDatabaseUrl = cleanUrl;
  saveDatabaseUrl(cleanUrl);
  await initDatabase();
  const diag = await getDatabaseDiagnosticAsync();
  return {
    success: diag.status === 'connected',
    error: diag.status !== 'connected' ? 'Não foi possível conectar ao banco de dados com a URL informada.' : undefined,
    diagnostic: diag,
  };
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
            whatsapp VARCHAR(50) NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Add whatsapp column if not exists in older schemas
        await client.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='whatsapp') THEN
              ALTER TABLE users ADD COLUMN whatsapp VARCHAR(50) NULL;
            END IF;
          END $$;
        `).catch(() => {});

        // Seed Essential Core Users if table is empty or missing master/dev
        await client.query(`
          INSERT INTO users (id, username, password_hash, full_name, role, is_active, whatsapp)
          VALUES 
            ('master-001', 'mastercmdit', 'Master@123', 'Administrador Master', 'master', TRUE, '-'),
            ('dev-001', 'desenvolvedor', 'DEV@cmdit', 'DESENVOLVEDOR', 'master', TRUE, 'DEV@cmdit'),
            ('user-002', 'matheusbritto', 'user123', 'Matheus Britto', 'operador', TRUE, 'user123')
          ON CONFLICT (username) DO NOTHING;
        `);

        // Create access_logs table for access tracking (Login / Logout / Expirado)
        await client.query(`
          CREATE TABLE IF NOT EXISTS access_logs (
            id VARCHAR(100) PRIMARY KEY,
            timestamp VARCHAR(50) NOT NULL,
            date_formatted VARCHAR(50) NULL,
            event VARCHAR(20) NOT NULL,
            username VARCHAR(100) NOT NULL,
            full_name VARCHAR(150) NOT NULL,
            role VARCHAR(50) NOT NULL,
            whatsapp VARCHAR(50) NULL,
            ip VARCHAR(50) NULL,
            user_agent TEXT NULL,
            device_type VARCHAR(50) NULL,
            details TEXT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
        console.log('✅ PostgreSQL Database connected & synchronized successfully (usuários, senhas e logs)!');
        startDatabaseHeartbeat();
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
            whatsapp VARCHAR(50) NULL,
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
          CREATE TABLE IF NOT EXISTS access_logs (
            id VARCHAR(100) PRIMARY KEY,
            timestamp VARCHAR(50) NOT NULL,
            date_formatted VARCHAR(50) NULL,
            event VARCHAR(20) NOT NULL,
            username VARCHAR(100) NOT NULL,
            full_name VARCHAR(150) NOT NULL,
            role VARCHAR(50) NOT NULL,
            whatsapp VARCHAR(50) NULL,
            ip VARCHAR(50) NULL,
            user_agent TEXT NULL,
            device_type VARCHAR(50) NULL,
            details TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

/**
 * Diagnostic function to test live database connection, measure ping, and list users
 */
export async function getDatabaseDiagnosticAsync(customUrl?: string): Promise<DatabaseDiagnostic> {
  const startTime = Date.now();
  const rawUrl =
    customUrl ||
    configuredDatabaseUrl ||
    process.env.AUTH_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.RENDER_DATABASE_URL ||
    '';

  const isRender = rawUrl.includes('render.com') || rawUrl.includes('dpg-');
  let maskedUrl = '';
  if (rawUrl) {
    try {
      const u = new URL(rawUrl.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
      maskedUrl = `postgres://${u.username}:••••@${u.host}${u.pathname}`;
    } catch {
      maskedUrl = rawUrl.substring(0, 15) + '••••' + rawUrl.substring(rawUrl.length - 8);
    }
  }

  const pg = getPgPool(customUrl);
  if (pg) {
    try {
      const client = await pg.connect();
      const latencyMs = Date.now() - startTime;
      try {
        // Query users
        const usersRes = await client.query(`
          SELECT id, username, full_name, role, is_active, 
                 (password_hash IS NOT NULL AND LENGTH(password_hash) > 0) as has_pass
          FROM users
          ORDER BY role DESC, username ASC
        `);

        // Check tables
        const tablesRes = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
        const foundTables = new Set(tablesRes.rows.map((r) => r.table_name));

        return {
          status: 'connected',
          type: 'postgres',
          provider: isRender ? 'OnRender PostgreSQL (Nuvem)' : 'PostgreSQL Database',
          isRenderPostgres: isRender,
          latencyMs,
          tables: {
            users: foundTables.has('users'),
            access_logs: foundTables.has('access_logs'),
            app_settings: foundTables.has('app_settings'),
          },
          userCount: usersRes.rows.length,
          users: usersRes.rows.map((r) => ({
            id: r.id,
            username: r.username,
            name: r.full_name,
            role: r.role,
            isActive: Boolean(r.is_active),
            hasPassword: Boolean(r.has_pass),
          })),
          connectionDetails: {
            host: isRender ? 'Render Cloud (dpg-*.render.com)' : (process.env.PGHOST || 'Render / PostgreSQL Host'),
            database: process.env.PGDATABASE || 'PostgreSQL DB',
            port: Number(process.env.PGPORT || 5432),
            ssl: true,
          },
          serverTime: new Date().toISOString(),
          configuredUrlMasked: maskedUrl,
        };
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('Database diagnostic test error:', err.message);
      return {
        status: 'disconnected',
        type: 'postgres',
        provider: isRender ? 'OnRender PostgreSQL (Falha de Conexão)' : 'PostgreSQL (Falha de Conexão)',
        isRenderPostgres: isRender,
        latencyMs: Date.now() - startTime,
        tables: { users: false, access_logs: false, app_settings: false },
        userCount: 0,
        users: [],
        connectionDetails: {
          host: 'Erro: ' + (err.message || 'Não conectado'),
          database: '-',
          port: 5432,
          ssl: false,
        },
        serverTime: new Date().toISOString(),
        configuredUrlMasked: maskedUrl,
      };
    }
  }

  // Fallback to local
  return {
    status: 'fallback_local',
    type: 'json',
    provider: 'Banco Local & Cache Seguro em Memória',
    isRenderPostgres: false,
    latencyMs: 1,
    tables: { users: true, access_logs: true, app_settings: true },
    userCount: 3,
    users: [
      { id: 'master-001', username: 'mastercmdit', name: 'Administrador Master', role: 'master', isActive: true, hasPassword: true },
      { id: 'dev-001', username: 'desenvolvedor', name: 'DESENVOLVEDOR', role: 'master', isActive: true, hasPassword: true },
      { id: 'user-002', username: 'matheusbritto', name: 'Matheus Britto', role: 'operador', isActive: true, hasPassword: true },
    ],
    connectionDetails: {
      host: 'Servidor Local AI Studio / Cloud Run',
      database: 'patio_local_db',
      port: 3000,
      ssl: false,
    },
    serverTime: new Date().toISOString(),
  };
}

// --------------------------------------------------------------------------
// PERSISTENT CONNECTION HEARTBEAT & AUTO-RECONNECT ENGINE
// --------------------------------------------------------------------------
let heartbeatTimer: NodeJS.Timeout | null = null;
let isReconnecting = false;
let reconnectAttempts = 0;

export async function triggerBackgroundReconnect(): Promise<boolean> {
  if (isReconnecting) return false;
  isReconnecting = true;
  reconnectAttempts++;
  console.log(`🔄 [DB Auto-Reconnect] Iniciando reconexão automática com PostgreSQL (tentativa #${reconnectAttempts})...`);

  try {
    if (pgPool) {
      try {
        await pgPool.end();
      } catch {}
      pgPool = null;
    }
    const res = await initDatabase();
    if (res.active && res.type === 'postgres') {
      console.log('✅ [DB Auto-Reconnect] Conexão com o banco de dados restabelecida e 100% online!');
      reconnectAttempts = 0;
      isDbAvailable = true;
      return true;
    } else {
      console.warn('⚠️ [DB Auto-Reconnect] Falha ao reconectar. Nova tentativa ocorrerá no próximo ciclo.');
      return false;
    }
  } catch (e: any) {
    console.warn('⚠️ [DB Auto-Reconnect Error]:', e.message);
    return false;
  } finally {
    isReconnecting = false;
  }
}

export function startDatabaseHeartbeat(): void {
  if (heartbeatTimer) return;
  console.log('💓 [DB Heartbeat] Monitor de conexão ativa e auto-reconexão iniciado (intervalo: 15s).');
  // Mantém a conexão sempre aberta e testa a cada 15 segundos
  heartbeatTimer = setInterval(async () => {
    const pool = getPgPool();
    if (!pool) {
      await triggerBackgroundReconnect();
      return;
    }

    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1;');
        isDbAvailable = true;
        activeDbType = 'postgres';
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('⚠️ [DB Heartbeat Ping Falhou]: Conexão caiu. Reconectando automaticamente agora...', err.message);
      isDbAvailable = false;
      await triggerBackgroundReconnect();
    }
  }, 15000);
}

// Aliases for compatibility
export const initMariaDbDatabase = initDatabase;
export const isMariaDbActive = () => isDbAvailable;
export const getActiveDbType = () => activeDbType;
export const reconnectDatabaseNow = triggerBackgroundReconnect;

