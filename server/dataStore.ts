import fs from 'fs';
import path from 'path';
import { getPgPool, getDbPool } from './db';

export type UserRole =
  | 'master'
  | 'patio'
  | 'qualidade_51'
  | 'pdc'
  | 'combustivel'
  | 'entrada_saida'
  | 'operador'
  | 'vistoriador'
  | 'motorista';

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  password?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export interface AppSettings {
  sheetsWebhookUrl?: string | null;
  spreadsheetId?: string | null;
  spreadsheetUrl?: string | null;
  autoSync?: boolean;
  lastUpdated?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  sheetsWebhookUrl: null,
  spreadsheetId: '1c9pfD6quOeMQLdTZEmR-QcQu-cZzvi68SyT6jZJWgnI',
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1c9pfD6quOeMQLdTZEmR-QcQu-cZzvi68SyT6jZJWgnI/edit',
  autoSync: true,
};

const DEFAULT_MASTER_USER: UserAccount = {
  id: 'master-001',
  username: 'mastercmdit',
  name: 'Administrador Master',
  role: 'master',
  password: 'Master@123',
  createdAt: '2025-01-01T00:00:00.000Z',
  isActive: true,
};

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ----------------------------------------------------
// USERS STORE (POSTGRESQL -> MYSQL -> JSON)
// ----------------------------------------------------
export async function loadServerUsersAsync(): Promise<UserAccount[]> {
  // 1. Try PostgreSQL
  const pg = getPgPool();
  if (pg) {
    try {
      const res = await pg.query(
        'SELECT id, username, full_name, role, password_hash, is_active, created_at FROM users ORDER BY created_at ASC'
      );
      if (res && res.rows.length > 0) {
        const users: UserAccount[] = res.rows.map((r: any) => ({
          id: String(r.id),
          username: String(r.username),
          name: String(r.full_name || r.username),
          role: (r.role as UserRole) || 'operador',
          password: String(r.password_hash || ''),
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          isActive: Boolean(r.is_active === true || r.is_active === 1),
        }));
        saveServerUsers(users); // Keep local cache
        return users;
      }
    } catch (err) {
      console.warn('PostgreSQL users load failed, falling back:', err);
    }
  }

  // 2. Try MySQL / MariaDB
  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      const [rows]: any = await mysqlPool.query(
        'SELECT id, username, full_name, role, password_hash, is_active, created_at FROM users ORDER BY created_at ASC'
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const users: UserAccount[] = rows.map((r: any) => ({
          id: String(r.id),
          username: String(r.username),
          name: String(r.full_name || r.username),
          role: (r.role as UserRole) || 'operador',
          password: String(r.password_hash || ''),
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          isActive: Boolean(r.is_active === 1 || r.is_active === true),
        }));
        saveServerUsers(users);
        return users;
      }
    } catch (err) {
      console.warn('MariaDB users load failed, falling back to JSON:', err);
    }
  }

  return loadServerUsers();
}

export function loadServerUsers(): UserAccount[] {
  try {
    ensureDataDirectory();
    if (!fs.existsSync(USERS_FILE)) {
      const initialUsers = [DEFAULT_MASTER_USER];
      fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
      return initialUsers;
    }
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed: UserAccount[] = JSON.parse(raw);

    const hasMaster = parsed.some(
      (u) => u.role === 'master' || u.username.toLowerCase() === 'mastercmdit'
    );
    if (!hasMaster) {
      parsed.unshift(DEFAULT_MASTER_USER);
      fs.writeFileSync(USERS_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch (err) {
    console.error('Error loading users file:', err);
    return [DEFAULT_MASTER_USER];
  }
}

export function saveServerUsers(users: UserAccount[]): void {
  try {
    ensureDataDirectory();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving users file:', err);
  }
}

export async function createServerUserAsync(
  username: string,
  name: string,
  password: string,
  role: UserRole = 'operador'
): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return { success: false, error: 'Usuário / Matrícula é obrigatório.' };
  if (!name.trim()) return { success: false, error: 'Nome do colaborador é obrigatório.' };
  if (!password.trim()) return { success: false, error: 'Senha é obrigatória.' };

  const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newUser: UserAccount = {
    id: userId,
    username: cleanUsername,
    name: name.trim(),
    role,
    password: password.trim(),
    createdAt: new Date().toISOString(),
    isActive: true,
  };

  // 1. PostgreSQL insert
  const pg = getPgPool();
  if (pg) {
    try {
      await pg.query(
        `INSERT INTO users (id, username, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         ON CONFLICT (username) DO NOTHING`,
        [userId, cleanUsername, password.trim(), name.trim(), role]
      );
    } catch (err: any) {
      if (err.code === '23505') {
        return { success: false, error: `O usuário / matrícula "${username}" já existe no banco de dados.` };
      }
      console.warn('Failed to insert user into PostgreSQL:', err.message);
    }
  }

  // 2. MariaDB insert
  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      await mysqlPool.query(
        'INSERT INTO users (id, username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [userId, cleanUsername, password.trim(), name.trim(), role]
      );
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        return { success: false, error: `O usuário / matrícula "${username}" já existe no banco de dados.` };
      }
      console.warn('Failed to insert user into MariaDB:', err.message);
    }
  }

  // Also update local storage
  const users = loadServerUsers();
  if (!users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    users.push(newUser);
    saveServerUsers(users);
  }

  return { success: true, user: newUser };
}

export function createServerUser(
  username: string,
  name: string,
  password: string,
  role: UserRole = 'operador'
): { success: boolean; error?: string; user?: UserAccount } {
  const cleanUsername = username.trim().toLowerCase();
  const users = loadServerUsers();

  if (!cleanUsername) return { success: false, error: 'Usuário / Matrícula é obrigatório.' };
  if (!name.trim()) return { success: false, error: 'Nome do colaborador é obrigatório.' };
  if (!password.trim()) return { success: false, error: 'Senha é obrigatória.' };

  const exists = users.some((u) => u.username.toLowerCase() === cleanUsername);
  if (exists) {
    return { success: false, error: `O usuário / matrícula "${username}" já existe.` };
  }

  const newUser: UserAccount = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    name: name.trim(),
    role,
    password: password.trim(),
    createdAt: new Date().toISOString(),
    isActive: true,
  };

  users.push(newUser);
  saveServerUsers(users);

  // Sync with Postgres/MariaDB asynchronously
  const pg = getPgPool();
  if (pg) {
    pg.query(
      `INSERT INTO users (id, username, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (username) DO UPDATE SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [newUser.id, newUser.username, newUser.password, newUser.name, newUser.role]
    ).catch((e) => console.warn('Async Postgres insert error:', e.message));
  }

  return { success: true, user: newUser };
}

export async function resetServerUserPasswordAsync(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword.trim()) return { success: false, error: 'Nova senha não pode estar em branco.' };

  const pg = getPgPool();
  if (pg) {
    try {
      await pg.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
        newPassword.trim(),
        userId,
      ]);
    } catch (err: any) {
      console.warn('Postgres password reset error:', err.message);
    }
  }

  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      await mysqlPool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newPassword.trim(), userId]);
    } catch (err: any) {
      console.warn('MariaDB password reset error:', err.message);
    }
  }

  return resetServerUserPassword(userId, newPassword);
}

export function resetServerUserPassword(
  userId: string,
  newPassword: string
): { success: boolean; error?: string } {
  if (!newPassword.trim()) {
    return { success: false, error: 'Nova senha não pode estar em branco.' };
  }

  const users = loadServerUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  users[index].password = newPassword.trim();
  saveServerUsers(users);

  const pg = getPgPool();
  if (pg) {
    pg.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      newPassword.trim(),
      userId,
    ]).catch((e) => console.warn('Postgres async password reset error:', e.message));
  }

  return { success: true };
}

export async function toggleServerUserStatusAsync(
  userId: string
): Promise<{ success: boolean; isActive?: boolean; error?: string }> {
  const users = await loadServerUsersAsync();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'Usuário não encontrado.' };
  if (user.role === 'master' || user.username.toLowerCase() === 'mastercmdit') {
    return { success: false, error: 'Não é possível bloquear o usuário Master.' };
  }

  const newStatus = !user.isActive;

  const pg = getPgPool();
  if (pg) {
    try {
      await pg.query('UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
        newStatus,
        userId,
      ]);
    } catch (err: any) {
      console.warn('Postgres toggle error:', err.message);
    }
  }

  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      await mysqlPool.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus ? 1 : 0, userId]);
    } catch (err: any) {
      console.warn('MariaDB toggle error:', err.message);
    }
  }

  return toggleServerUserStatus(userId);
}

export function toggleServerUserStatus(
  userId: string
): { success: boolean; isActive?: boolean; error?: string } {
  const users = loadServerUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'Usuário não encontrado.' };
  if (user.role === 'master' || user.username.toLowerCase() === 'mastercmdit') {
    return { success: false, error: 'Não é possível bloquear o usuário Master.' };
  }

  user.isActive = !user.isActive;
  saveServerUsers(users);

  const pg = getPgPool();
  if (pg) {
    pg.query('UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      user.isActive,
      userId,
    ]).catch((e) => console.warn('Postgres async status toggle error:', e.message));
  }

  return { success: true, isActive: user.isActive };
}

export async function deleteServerUserAsync(userId: string): Promise<{ success: boolean; error?: string }> {
  const users = await loadServerUsersAsync();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'Usuário não encontrado.' };
  if (user.role === 'master' || user.username.toLowerCase() === 'mastercmdit') {
    return { success: false, error: 'O usuário Master principal não pode ser excluído.' };
  }

  const pg = getPgPool();
  if (pg) {
    try {
      await pg.query('DELETE FROM users WHERE id = $1', [userId]);
    } catch (err: any) {
      console.warn('Postgres delete error:', err.message);
    }
  }

  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      await mysqlPool.query('DELETE FROM users WHERE id = ?', [userId]);
    } catch (err: any) {
      console.warn('MariaDB delete error:', err.message);
    }
  }

  return deleteServerUser(userId);
}

export function deleteServerUser(userId: string): { success: boolean; error?: string } {
  const users = loadServerUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false, error: 'Usuário não encontrado.' };
  if (user.role === 'master' || user.username.toLowerCase() === 'mastercmdit') {
    return { success: false, error: 'O usuário Master principal não pode ser excluído.' };
  }

  const updated = users.filter((u) => u.id !== userId);
  saveServerUsers(updated);

  const pg = getPgPool();
  if (pg) {
    pg.query('DELETE FROM users WHERE id = $1', [userId]).catch((e) =>
      console.warn('Postgres async delete error:', e.message)
    );
  }

  return { success: true };
}

export async function authenticateServerUserAsync(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: Omit<UserAccount, 'password'> }> {
  const cleanUsername = username.trim().toLowerCase();
  const cleanPass = password.trim();

  // 1. PostgreSQL Auth
  const pg = getPgPool();
  if (pg) {
    try {
      const res = await pg.query(
        'SELECT id, username, full_name, role, password_hash, is_active FROM users WHERE LOWER(username) = $1 LIMIT 1',
        [cleanUsername]
      );
      if (res && res.rows.length > 0) {
        const u = res.rows[0];
        if (u.password_hash !== cleanPass) {
          return { success: false, error: 'Usuário / Matrícula ou senha incorretos.' };
        }
        if (u.is_active === false || u.is_active === 0) {
          return { success: false, error: 'Este usuário está bloqueado. Contate o Administrador Master.' };
        }
        return {
          success: true,
          user: {
            id: String(u.id),
            username: String(u.username),
            name: String(u.full_name || u.username),
            role: (u.role as UserRole) || 'operador',
            createdAt: new Date().toISOString(),
            isActive: true,
          },
        };
      }
    } catch (err) {
      console.warn('PostgreSQL auth error, trying fallback:', err);
    }
  }

  // 2. MySQL Auth
  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      const [rows]: any = await mysqlPool.query(
        'SELECT id, username, full_name, role, password_hash, is_active FROM users WHERE LOWER(username) = ? LIMIT 1',
        [cleanUsername]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const u = rows[0];
        if (u.password_hash !== cleanPass) {
          return { success: false, error: 'Usuário / Matrícula ou senha incorretos.' };
        }
        if (u.is_active === 0 || u.is_active === false) {
          return { success: false, error: 'Este usuário está bloqueado. Contate o Administrador Master.' };
        }
        return {
          success: true,
          user: {
            id: String(u.id),
            username: String(u.username),
            name: String(u.full_name || u.username),
            role: (u.role as UserRole) || 'operador',
            createdAt: new Date().toISOString(),
            isActive: true,
          },
        };
      }
    } catch (err) {
      console.warn('MariaDB auth error, trying fallback:', err);
    }
  }

  return authenticateServerUser(username, password);
}

export function authenticateServerUser(
  username: string,
  password: string
): { success: boolean; error?: string; user?: Omit<UserAccount, 'password'> } {
  const users = loadServerUsers();
  const cleanUsername = username.trim().toLowerCase();

  const user = users.find(
    (u) => u.username.toLowerCase() === cleanUsername && u.password === password.trim()
  );

  if (!user) {
    return { success: false, error: 'Usuário / Matrícula ou senha incorretos.' };
  }

  if (user.isActive === false) {
    return {
      success: false,
      error: 'Este usuário está bloqueado. Contate o Administrador Master.',
    };
  }

  user.lastLogin = new Date().toISOString();
  saveServerUsers(users);

  const { password: _, ...userSafe } = user;
  return { success: true, user: userSafe };
}

// ----------------------------------------------------
// RECORDS STORE (SHARED FLEET HISTORY ACROSS DEVICES)
// ----------------------------------------------------
export async function loadServerRecordsAsync(): Promise<any[]> {
  const pg = getPgPool();
  if (pg) {
    try {
      const res = await pg.query(
        'SELECT * FROM vehicle_records ORDER BY created_at DESC LIMIT 500'
      );
      if (res && res.rows.length > 0) {
        return res.rows.map((r: any) => {
          let extra: any = {};
          if (r.raw_data) {
            try {
              extra = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data;
            } catch (e) {}
          }
          return {
            ...extra,
            id: r.id,
            plate: r.plate,
            plateState: r.plate_state,
            model: r.model,
            color: r.color,
            driverName: r.driver_name,
            driverDoc: r.driver_doc,
            company: r.company,
            entryTime: r.entry_time,
            exitTime: r.exit_time,
            status: r.status,
            sealNumber: r.seal_number,
            odometer: r.odometer,
            notes: r.notes,
            operatorName: r.operator_name,
          };
        });
      }
    } catch (err) {
      console.warn('Postgres records load error, fallback to JSON:', err);
    }
  }

  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      const [rows]: any = await mysqlPool.query(
        'SELECT * FROM vehicle_records ORDER BY created_at DESC LIMIT 500'
      );
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map((r: any) => {
          let extra: any = {};
          if (r.raw_data) {
            try {
              extra = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data;
            } catch (e) {}
          }
          return {
            ...extra,
            id: r.id,
            plate: r.plate,
            plateState: r.plate_state,
            model: r.model,
            color: r.color,
            driverName: r.driver_name,
            driverDoc: r.driver_doc,
            company: r.company,
            entryTime: r.entry_time,
            exitTime: r.exit_time,
            status: r.status,
            sealNumber: r.seal_number,
            odometer: r.odometer,
            notes: r.notes,
            operatorName: r.operator_name,
          };
        });
      }
    } catch (err) {
      console.warn('MariaDB records load error, fallback to JSON:', err);
    }
  }
  return loadServerRecords();
}

export function loadServerRecords(): any[] {
  try {
    ensureDataDirectory();
    if (!fs.existsSync(RECORDS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(RECORDS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading records file:', err);
    return [];
  }
}

export function saveServerRecords(records: any[]): void {
  try {
    ensureDataDirectory();
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving records file:', err);
  }
}

export async function appendOrUpdateServerRecordAsync(record: any): Promise<any[]> {
  const pg = getPgPool();
  if (pg) {
    try {
      const rawJson = JSON.stringify(record);
      await pg.query(
        `INSERT INTO vehicle_records 
          (id, plate, plate_state, model, color, driver_name, driver_doc, company, entry_time, exit_time, status, seal_number, odometer, notes, operator_name, raw_data, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
          plate = EXCLUDED.plate, plate_state = EXCLUDED.plate_state, model = EXCLUDED.model, color = EXCLUDED.color,
          driver_name = EXCLUDED.driver_name, driver_doc = EXCLUDED.driver_doc, company = EXCLUDED.company,
          entry_time = EXCLUDED.entry_time, exit_time = EXCLUDED.exit_time, status = EXCLUDED.status,
          seal_number = EXCLUDED.seal_number, odometer = EXCLUDED.odometer, notes = EXCLUDED.notes,
          operator_name = EXCLUDED.operator_name, raw_data = EXCLUDED.raw_data, updated_at = CURRENT_TIMESTAMP`,
        [
          record.id || `rec-${Date.now()}`,
          record.plate || '',
          record.plateState || null,
          record.model || null,
          record.color || null,
          record.driverName || null,
          record.driverDoc || null,
          record.company || null,
          record.entryTime || null,
          record.exitTime || null,
          record.status || 'inside',
          record.sealNumber || null,
          record.odometer ? Number(record.odometer) : null,
          record.notes || null,
          record.operatorName || null,
          rawJson,
        ]
      );
    } catch (err: any) {
      console.warn('PostgreSQL record upsert error:', err.message);
    }
  }

  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      const rawJson = JSON.stringify(record);
      await mysqlPool.query(
        `INSERT INTO vehicle_records 
          (id, plate, plate_state, model, color, driver_name, driver_doc, company, entry_time, exit_time, status, seal_number, odometer, notes, operator_name, raw_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          plate=VALUES(plate), plate_state=VALUES(plate_state), model=VALUES(model), color=VALUES(color),
          driver_name=VALUES(driver_name), driver_doc=VALUES(driver_doc), company=VALUES(company),
          entry_time=VALUES(entry_time), exit_time=VALUES(exit_time), status=VALUES(status),
          seal_number=VALUES(seal_number), odometer=VALUES(odometer), notes=VALUES(notes),
          operator_name=VALUES(operator_name), raw_data=VALUES(raw_data)`,
        [
          record.id || `rec-${Date.now()}`,
          record.plate || '',
          record.plateState || null,
          record.model || null,
          record.color || null,
          record.driverName || null,
          record.driverDoc || null,
          record.company || null,
          record.entryTime || null,
          record.exitTime || null,
          record.status || 'inside',
          record.sealNumber || null,
          record.odometer ? Number(record.odometer) : null,
          record.notes || null,
          record.operatorName || null,
          rawJson,
        ]
      );
    } catch (err: any) {
      console.warn('MariaDB record upsert error:', err.message);
    }
  }

  return appendOrUpdateServerRecord(record);
}

export function appendOrUpdateServerRecord(record: any): any[] {
  const records = loadServerRecords();
  const existingIdx = records.findIndex((r) => r.id === record.id);
  if (existingIdx >= 0) {
    records[existingIdx] = record;
  } else {
    records.unshift(record);
  }
  if (records.length > 1000) {
    records.splice(1000);
  }
  saveServerRecords(records);
  return records;
}

export async function deleteServerRecordAsync(id: string): Promise<any[]> {
  const pg = getPgPool();
  if (pg) {
    try {
      await pg.query('DELETE FROM vehicle_records WHERE id = $1', [id]);
    } catch (err: any) {
      console.warn('Postgres delete record error:', err.message);
    }
  }

  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      await mysqlPool.query('DELETE FROM vehicle_records WHERE id = ?', [id]);
    } catch (err: any) {
      console.warn('MariaDB delete record error:', err.message);
    }
  }
  return deleteServerRecord(id);
}

export function deleteServerRecord(id: string): any[] {
  const records = loadServerRecords().filter((r) => r.id !== id);
  saveServerRecords(records);
  return records;
}

export function clearServerRecords(): void {
  saveServerRecords([]);
  const pg = getPgPool();
  if (pg) {
    pg.query('TRUNCATE TABLE vehicle_records').catch((e) => console.warn(e.message));
  }
  const mysqlPool = getDbPool();
  if (mysqlPool) {
    mysqlPool.query('TRUNCATE TABLE vehicle_records').catch((e) => console.warn(e.message));
  }
}

// ----------------------------------------------------
// GLOBAL SETTINGS STORE (SHEETS WEBHOOK & INTEGRATION)
// ----------------------------------------------------
export async function loadServerSettingsAsync(): Promise<AppSettings> {
  const pg = getPgPool();
  if (pg) {
    try {
      const res = await pg.query("SELECT value FROM app_settings WHERE key = 'global_settings' LIMIT 1");
      if (res && res.rows.length > 0 && res.rows[0].value) {
        const val = typeof res.rows[0].value === 'string' ? JSON.parse(res.rows[0].value) : res.rows[0].value;
        const combined = { ...DEFAULT_SETTINGS, ...val };
        saveServerSettings(combined);
        return combined;
      }
    } catch (err) {
      console.warn('PostgreSQL settings load error, falling back:', err);
    }
  }
  return loadServerSettings();
}

export function loadServerSettings(): AppSettings {
  try {
    ensureDataDirectory();
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
      return DEFAULT_SETTINGS;
    }
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed: AppSettings = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.error('Error loading settings file:', err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveServerSettingsAsync(newSettings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadServerSettingsAsync();
  const updated: AppSettings = {
    ...current,
    ...newSettings,
    lastUpdated: new Date().toISOString(),
  };

  const pg = getPgPool();
  if (pg) {
    try {
      await pg.query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ('global_settings', $1, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(updated)]
      );
    } catch (err: any) {
      console.warn('PostgreSQL settings save error:', err.message);
    }
  }

  saveServerSettings(updated);
  return updated;
}

export function saveServerSettings(newSettings: Partial<AppSettings>): AppSettings {
  try {
    ensureDataDirectory();
    const current = loadServerSettings();
    const updated: AppSettings = {
      ...current,
      ...newSettings,
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (err) {
    console.error('Error saving settings file:', err);
    return loadServerSettings();
  }
}
