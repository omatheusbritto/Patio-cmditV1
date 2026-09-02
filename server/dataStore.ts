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
  whatsapp?: string;
  password?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const LOGS_FILE = path.join(DATA_DIR, 'access_logs.json');

export type LogEventType = 'LOGIN' | 'LOGOUT' | 'EXPIRADO';

export interface AccessLog {
  id: string;
  timestamp: string; // ISO string
  dateFormatted?: string; // dd/MM/yyyy HH:mm:ss
  event: LogEventType;
  username: string;
  name: string;
  role: UserRole;
  whatsapp?: string;
  ip?: string;
  userAgent?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet' | 'outro';
  details?: string;
}

export interface AppSettings {
  sheetsWebhookUrl?: string | null;
  spreadsheetId?: string | null;
  spreadsheetUrl?: string | null;
  spreadsheetTitle?: string | null;
  autoSync?: boolean;
  lastUpdated?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  sheetsWebhookUrl: null,
  spreadsheetId: null,
  spreadsheetUrl: null,
  spreadsheetTitle: 'Planilha Oficial CMDIT',
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
  // 1. Check Google Drive Spreadsheet directly as PRIMARY Source of Truth if webhook URL is configured
  try {
    const settings = await loadServerSettingsAsync();
    if (settings.sheetsWebhookUrl && settings.sheetsWebhookUrl.startsWith('http')) {
      const restored = await restoreUsersFromSpreadsheetAsync(settings.sheetsWebhookUrl);
      if (restored.success && Array.isArray(restored.users) && restored.users.length > 0) {
        return restored.users;
      }
    }
  } catch (sheetErr: any) {
    console.warn('Primary Google Sheets users fetch notice:', sheetErr.message);
  }

  // 2. Local database cache fallback (PostgreSQL / MySQL / JSON)
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
        saveServerUsers(users);
        return users;
      }
    } catch (err) {
      console.warn('PostgreSQL users load failed, falling back:', err);
    }
  }

  // 3. MySQL / MariaDB fallback
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

export async function restoreUsersFromSpreadsheetAsync(
  customWebhookUrl?: string
): Promise<{ success: boolean; totalRestored: number; users: UserAccount[]; error?: string }> {
  try {
    const settings = await loadServerSettingsAsync();
    const webhookUrl = customWebhookUrl || settings.sheetsWebhookUrl;

    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return {
        success: false,
        totalRestored: 0,
        users: loadServerUsers(),
        error: 'Nenhuma URL de Webhook da planilha configurada.',
      };
    }

    // Call doGet on the Google Apps Script Webhook
    const resp = await fetch(webhookUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'follow',
    });

    if (!resp.ok) {
      return {
        success: false,
        totalRestored: 0,
        users: loadServerUsers(),
        error: `Servidor da planilha respondeu com status HTTP ${resp.status}`,
      };
    }

    const data = await resp.json().catch(() => null);
    if (!data || !data.tabs) {
      return {
        success: false,
        totalRestored: 0,
        users: loadServerUsers(),
        error: 'Formato de resposta da planilha inválido ou sem abas.',
      };
    }

    // Find the Users tab (e.g. "👥 Usuários (CMDIT)", "USUARIOS_CMDIT", "USUARIOS", "OPERADORES", "USUÁRIOS", etc.)
    let userTab: any = null;
    for (const [tabKey, tabObj] of Object.entries<any>(data.tabs)) {
      const lower = tabKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (
        lower.includes('usuari') ||
        lower.includes('operador') ||
        lower.includes('cmdit') ||
        lower.includes('colaborador') ||
        lower.includes('funcionario') ||
        lower.includes('login') ||
        lower.includes('acesso')
      ) {
        userTab = tabObj;
        break;
      }
    }

    if (!userTab || !Array.isArray(userTab.rows) || userTab.rows.length === 0) {
      return {
        success: true,
        totalRestored: 0,
        users: loadServerUsers(),
        error: 'Nenhum operador encontrado na aba de usuários da planilha.',
      };
    }

    const currentUsers = loadServerUsers();
    const restoredUsers: UserAccount[] = [...currentUsers];
    let addedCount = 0;

    const parseRole = (rawRole: string): UserRole => {
      const r = (rawRole || '').toLowerCase();
      if (r.includes('master') || r.includes('admin')) return 'master';
      if (r.includes('51') || r.includes('qualidade')) return 'qualidade_51';
      if (r.includes('pdc') || r.includes('fila')) return 'pdc';
      if (r.includes('combust') || r.includes('abastec')) return 'combustivel';
      if (r.includes('entrada') || r.includes('saida') || r.includes('saída')) return 'entrada_saida';
      if (r.includes('vistoria')) return 'vistoriador';
      if (r.includes('motor')) return 'motorista';
      if (r.includes('patio') || r.includes('pátio')) return 'patio';
      return 'operador';
    };

    for (const row of userTab.rows) {
      // Look for columns: Username, Name, Role, Whatsapp, Password, Status
      const values = Object.values(row).map((v) => (v !== null && v !== undefined ? String(v).trim() : ''));
      // Typically: Col 1: Date, Col 2: Username, Col 3: Name, Col 4: Role, Col 5: Whatsapp/Contato, Col 6: Password, Col 7: Status
      let rowUsername = '';
      let rowName = '';
      let rowRole = 'operador';
      let rowWhatsapp = '';
      let rowPassword = '';
      let rowIsActive = true;

      // Extract by normalized keys
      for (const [k, v] of Object.entries<any>(row)) {
        if (v === null || v === undefined) continue;
        const keyLower = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const strVal = String(v).trim();
        if (!strVal) continue;

        if (
          keyLower.includes('matr') ||
          keyLower.includes('usuario') ||
          keyLower.includes('login') ||
          keyLower === 'col_2' ||
          keyLower === 'username' ||
          keyLower === 'user'
        ) {
          if (!rowUsername) rowUsername = strVal.toLowerCase();
        } else if (
          (keyLower.includes('nome') || keyLower === 'col_3' || keyLower === 'name' || keyLower === 'colaborador' || keyLower === 'funcionario') &&
          !keyLower.includes('usuario')
        ) {
          if (!rowName) rowName = strVal;
        } else if (
          keyLower.includes('funcao') ||
          keyLower.includes('cargo') ||
          keyLower.includes('role') ||
          keyLower === 'col_4' ||
          keyLower === 'perfil'
        ) {
          rowRole = strVal;
        } else if (
          keyLower.includes('whats') ||
          keyLower.includes('celular') ||
          keyLower.includes('telefone') ||
          keyLower.includes('contato') ||
          keyLower.includes('tel') ||
          keyLower.includes('fone')
        ) {
          if (strVal !== '-') rowWhatsapp = strVal;
        } else if (
          keyLower.includes('senha') ||
          keyLower.includes('password') ||
          keyLower.includes('pass') ||
          keyLower.includes('pin') ||
          keyLower === 'col_6'
        ) {
          if (!rowPassword) rowPassword = strVal;
        } else if (keyLower.includes('status') || keyLower.includes('situacao') || keyLower.includes('ativo')) {
          const up = strVal.toUpperCase();
          if (up === 'BLOQUEADO' || up === 'INATIVO' || up === 'FALSE' || up === '0' || up === 'DESATIVADO') {
            rowIsActive = false;
          }
        }
      }

      // Fallback by positional columns if header keys were generic or not matched
      if (!rowUsername && values.length >= 2) {
        // Find first column that looks like a username/matricula
        for (let i = 0; i < values.length; i++) {
          const val = values[i];
          if (!val || val === '_rowIndex' || val.includes('/') && val.includes(':')) continue;
          if (!rowUsername && val.length >= 2 && !val.includes('@') && isNaN(Date.parse(val))) {
            rowUsername = val.toLowerCase();
            rowName = values[i + 1] || rowUsername;
            rowRole = values[i + 2] || 'operador';
            break;
          }
        }
      }

      // If password was still not found by named header, examine row values by index
      if (!rowPassword && values.length >= 4) {
        // If 8 columns: [0:date, 1:user, 2:name, 3:role, 4:whats, 5:pass, 6:status, 7:lastAccess]
        if (values.length >= 7) {
          if (values[5] && values[5] !== '-' && !/^\+?55/.test(values[5])) {
            rowPassword = values[5];
          } else if (values[4] && !values[4].includes('(') && !/^\+?55/.test(values[4])) {
            // maybe 7 cols without whatsapp: [0:date, 1:user, 2:name, 3:role, 4:pass, 5:status]
            rowPassword = values[4];
          }
        } else if (values.length >= 5) {
          rowPassword = values[4] || values[3] || '';
        }
      }

      // Smart Phone / Password safeguard:
      // If rowPassword looks like a Brazilian phone number and rowWhatsapp is empty, swap them
      if (rowPassword && /^(\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}$/.test(rowPassword) && !rowWhatsapp) {
        rowWhatsapp = rowPassword;
        rowPassword = '';
      }

      if (rowUsername && rowUsername !== 'mastercmdit' && rowUsername.length >= 1) {
        const cleanUser = rowUsername.toLowerCase().trim();
        const existingIdx = restoredUsers.findIndex((u) => u.username.toLowerCase() === cleanUser);
        const resolvedPassword = rowPassword ? rowPassword.trim() : (existingIdx !== -1 ? restoredUsers[existingIdx].password || '123456' : '123456');

        const parsedAccount: UserAccount = {
          id: existingIdx !== -1 ? restoredUsers[existingIdx].id : `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          username: cleanUser,
          name: rowName || cleanUser.toUpperCase(),
          role: parseRole(rowRole),
          whatsapp: rowWhatsapp || (existingIdx !== -1 ? restoredUsers[existingIdx].whatsapp : undefined),
          password: resolvedPassword,
          createdAt: new Date().toISOString(),
          isActive: rowIsActive,
        };

        if (existingIdx !== -1) {
          restoredUsers[existingIdx] = { ...restoredUsers[existingIdx], ...parsedAccount };
        } else {
          restoredUsers.push(parsedAccount);
          addedCount++;
        }

        // Also persist to PostgreSQL / MariaDB if active
        const pg = getPgPool();
        if (pg) {
          pg.query(
            `INSERT INTO users (id, username, password_hash, full_name, role, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (username) DO UPDATE SET
               password_hash = EXCLUDED.password_hash,
               full_name = EXCLUDED.full_name,
               role = EXCLUDED.role,
               is_active = EXCLUDED.is_active`,
            [parsedAccount.id, parsedAccount.username, parsedAccount.password, parsedAccount.name, parsedAccount.role, parsedAccount.isActive]
          ).catch(() => {});
        }
      }
    }

    saveServerUsers(restoredUsers);
    return {
      success: true,
      totalRestored: restoredUsers.length,
      users: restoredUsers,
    };
  } catch (err: any) {
    console.warn('Error in restoreUsersFromSpreadsheetAsync:', err.message);
    return {
      success: false,
      totalRestored: 0,
      users: loadServerUsers(),
      error: err.message,
    };
  }
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
  role: UserRole = 'operador',
  whatsapp?: string
): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return { success: false, error: 'Usuário / Matrícula é obrigatório.' };
  if (!name.trim()) return { success: false, error: 'Nome do colaborador é obrigatório.' };
  if (!password.trim()) return { success: false, error: 'Senha é obrigatória.' };

  const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanWhatsapp = whatsapp ? whatsapp.trim() : undefined;
  const newUser: UserAccount = {
    id: userId,
    username: cleanUsername,
    name: name.trim(),
    role,
    whatsapp: cleanWhatsapp || undefined,
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
  const existingIdx = users.findIndex((u) => u.username.toLowerCase() === cleanUsername);
  if (existingIdx !== -1) {
    users[existingIdx] = { ...users[existingIdx], ...newUser };
  } else {
    users.push(newUser);
  }
  saveServerUsers(users);

  return { success: true, user: newUser };
}

export function createServerUser(
  username: string,
  name: string,
  password: string,
  role: UserRole = 'operador',
  whatsapp?: string
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

  const cleanWhatsapp = whatsapp ? whatsapp.trim() : undefined;
  const newUser: UserAccount = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    name: name.trim(),
    role,
    whatsapp: cleanWhatsapp || undefined,
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

export async function updateServerUserAsync(
  userId: string,
  updatedData: Partial<UserAccount>
): Promise<{ success: boolean; error?: string; user?: UserAccount; users?: UserAccount[] }> {
  const users = await loadServerUsersAsync();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  const current = users[index];
  const cleanUsername = updatedData.username ? updatedData.username.trim().toLowerCase() : current.username;
  
  // Check duplicate username if changed
  if (cleanUsername !== current.username) {
    const exists = users.some((u) => u.id !== userId && u.username.toLowerCase() === cleanUsername);
    if (exists) {
      return { success: false, error: `O nome de usuário "${cleanUsername}" já pertence a outro colaborador.` };
    }
  }

  const updatedUser: UserAccount = {
    ...current,
    username: cleanUsername,
    name: updatedData.name !== undefined ? updatedData.name.trim() : current.name,
    role: updatedData.role !== undefined ? updatedData.role : current.role,
    whatsapp: updatedData.whatsapp !== undefined ? (updatedData.whatsapp.trim() || undefined) : current.whatsapp,
    password: updatedData.password !== undefined && updatedData.password.trim() ? updatedData.password.trim() : current.password,
    isActive: updatedData.isActive !== undefined ? Boolean(updatedData.isActive) : current.isActive,
  };

  users[index] = updatedUser;
  saveServerUsers(users);

  // Sync to PostgreSQL if configured
  const pg = getPgPool();
  if (pg) {
    try {
      await pg.query(
        `UPDATE users 
         SET username = $1, full_name = $2, role = $3, password_hash = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [updatedUser.username, updatedUser.name, updatedUser.role, updatedUser.password || '', updatedUser.isActive, userId]
      );
    } catch (err: any) {
      console.warn('Postgres user update error:', err.message);
    }
  }

  // Sync to MariaDB if configured
  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      await mysqlPool.query(
        `UPDATE users 
         SET username = ?, full_name = ?, role = ?, password_hash = ?, is_active = ?
         WHERE id = ?`,
        [updatedUser.username, updatedUser.name, updatedUser.role, updatedUser.password || '', updatedUser.isActive ? 1 : 0, userId]
      );
    } catch (err: any) {
      console.warn('MariaDB user update error:', err.message);
    }
  }

  return { success: true, user: updatedUser, users };
}

export function updateServerUser(
  userId: string,
  updatedData: Partial<UserAccount>
): { success: boolean; error?: string; user?: UserAccount; users?: UserAccount[] } {
  const users = loadServerUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  const current = users[index];
  const updatedUser: UserAccount = {
    ...current,
    ...updatedData,
    username: updatedData.username ? updatedData.username.trim().toLowerCase() : current.username,
    name: updatedData.name ? updatedData.name.trim() : current.name,
    password: updatedData.password && updatedData.password.trim() ? updatedData.password.trim() : current.password,
  };

  users[index] = updatedUser;
  saveServerUsers(users);
  return { success: true, user: updatedUser, users };
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

  const localAuth = authenticateServerUser(username, password);
  if (localAuth.success) {
    return localAuth;
  }

  // If local auth failed, try restoring users from linked Google Spreadsheet if configured
  try {
    const settings = await loadServerSettingsAsync();
    if (settings.sheetsWebhookUrl && settings.sheetsWebhookUrl.startsWith('http')) {
      const restored = await restoreUsersFromSpreadsheetAsync(settings.sheetsWebhookUrl);
      if (restored.success) {
        return authenticateServerUser(username, password);
      }
    }
  } catch (err: any) {
    console.warn('Auto-restore from spreadsheet on login attempt failed:', err.message);
  }

  return localAuth;
}

export function authenticateServerUser(
  username: string,
  password: string
): { success: boolean; error?: string; user?: Omit<UserAccount, 'password'> } {
  const users = loadServerUsers();
  const cleanUsername = username.trim().toLowerCase();
  const rawPass = password || '';
  const cleanPass = rawPass.trim();

  // 1. First try exact match or trimmed match
  let user = users.find(
    (u) =>
      u.username.toLowerCase() === cleanUsername &&
      (u.password === rawPass || u.password?.trim() === cleanPass)
  );

  // 2. If not found, try case-insensitive match (in case spreadsheet had uppercase password or user typed lowercase)
  if (!user) {
    user = users.find(
      (u) =>
        u.username.toLowerCase() === cleanUsername &&
        u.password?.trim().toLowerCase() === cleanPass.toLowerCase()
    );
  }

  // 3. If still not found, check matching by Name if user typed their full name instead of username
  if (!user) {
    user = users.find(
      (u) =>
        u.name.toLowerCase().trim() === cleanUsername &&
        (u.password === rawPass || u.password?.trim() === cleanPass || u.password?.trim().toLowerCase() === cleanPass.toLowerCase())
    );
  }

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
  // 1. If Google Drive Spreadsheet Webhook is configured, read latest records directly from the spreadsheet tabs
  try {
    const settings = await loadServerSettingsAsync();
    if (settings.sheetsWebhookUrl && settings.sheetsWebhookUrl.startsWith('http')) {
      const resp = await fetch(settings.sheetsWebhookUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
      });
      if (resp.ok) {
        const sheetData = await resp.json().catch(() => null);
        if (sheetData && sheetData.tabs) {
          const sheetRecords: any[] = [];
          for (const [tabKey, tabObj] of Object.entries<any>(sheetData.tabs)) {
            const lower = tabKey.toLowerCase();
            // Skip users tab
            if (lower.includes('usuari') || lower.includes('operador') || lower.includes('cmdit')) {
              continue;
            }
            if (Array.isArray(tabObj.rows)) {
              for (const row of tabObj.rows) {
                const values = Object.values(row).map((v) => String(v || '').trim());
                // Look for plate, date, operator
                let rPlate = '';
                let rDate = '';
                let rTime = '';
                let rCondutor = '';
                let rKm = '';
                let rFuel = '';
                let rDestino = '';
                let rOperator = '';
                let rObs = '';

                for (const [k, v] of Object.entries<any>(row)) {
                  const kLow = k.toLowerCase();
                  const str = String(v || '').trim();
                  if (kLow.includes('plac') || kLow.includes('veic')) rPlate = str;
                  else if (kLow.includes('data') || kLow === 'dt') rDate = str;
                  else if (kLow.includes('hora') || kLow === 'hr') rTime = str;
                  else if (kLow.includes('condut') || kLow.includes('motor')) rCondutor = str;
                  else if (kLow.includes('km') || kLow.includes('odomet')) rKm = str;
                  else if (kLow.includes('combust') || kLow.includes('nivel') || kLow.includes('nível')) rFuel = str;
                  else if (kLow.includes('dest')) rDestino = str;
                  else if (kLow.includes('operad')) rOperator = str;
                  else if (kLow.includes('obs')) rObs = str;
                }

                if (!rPlate && values[2] && values[2] !== '_rowIndex') {
                  rDate = values[0] || '';
                  rTime = values[1] || '';
                  rPlate = values[2] || '';
                }

                if (rPlate) {
                  let opType = 'entrada';
                  if (lower.includes('said') || lower.includes('saíd')) opType = 'saida';
                  else if (lower.includes('combust') || lower.includes('abastec')) opType = 'abastecimento';
                  else if (lower.includes('51') || lower.includes('qualidade')) opType = 'qualidade_51';
                  else if (lower.includes('pdc') || lower.includes('fila')) opType = 'pdc';

                  sheetRecords.push({
                    id: `sheet-${rPlate}-${rDate}-${rTime}-${Math.random().toString(36).substring(2, 5)}`,
                    plate: rPlate.toUpperCase(),
                    operationType: opType,
                    entryTime: rDate && rTime ? `${rDate} ${rTime}` : rDate || new Date().toISOString(),
                    driverName: rCondutor || '-',
                    odometer: rKm || '-',
                    fuelLevel: rFuel || '-',
                    destination: rDestino || '-',
                    operatorName: rOperator || 'OPERADOR',
                    notes: rObs || '',
                    status: opType === 'saida' ? 'outside' : 'inside',
                  });
                }
              }
            }
          }
          if (sheetRecords.length > 0) {
            // Sort by most recent
            sheetRecords.reverse();
            saveServerRecords(sheetRecords);
            return sheetRecords;
          }
        }
      }
    }
  } catch (sheetErr: any) {
    console.warn('Google Sheets records load notice:', sheetErr.message);
  }

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

// ----------------------------------------------------
// ACCESS & AUDIT LOGS STORE (LOGIN / LOGOUT / TRACKING)
// ----------------------------------------------------

export function formatBrazilianDate(isoOrDate: string | Date = new Date()): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const min = pad(d.getMinutes());
  const sec = pad(d.getSeconds());
  return `${day}/${month}/${year} ${hours}:${min}:${sec}`;
}

export function loadServerLogs(): AccessLog[] {
  try {
    ensureDataDirectory();
    if (!fs.existsSync(LOGS_FILE)) {
      fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
    const parsed: AccessLog[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error loading access logs file:', err);
    return [];
  }
}

export function saveServerLogs(logs: AccessLog[]): void {
  try {
    ensureDataDirectory();
    // Keep max 2000 recent logs in local storage
    const trimmed = logs.slice(0, 2000);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving access logs file:', err);
  }
}

export async function loadServerLogsAsync(): Promise<AccessLog[]> {
  const pg = getPgPool();
  if (pg) {
    try {
      const res = await pg.query(
        'SELECT id, timestamp, date_formatted, event, username, full_name, role, whatsapp, ip, user_agent, device_type, details FROM access_logs ORDER BY created_at DESC LIMIT 1000'
      );
      if (res && Array.isArray(res.rows) && res.rows.length > 0) {
        const mapped: AccessLog[] = res.rows.map((r) => ({
          id: String(r.id),
          timestamp: String(r.timestamp),
          dateFormatted: r.date_formatted || formatBrazilianDate(r.timestamp),
          event: (r.event as LogEventType) || 'LOGIN',
          username: String(r.username),
          name: String(r.full_name || r.username),
          role: (r.role as UserRole) || 'operador',
          whatsapp: r.whatsapp ? String(r.whatsapp) : undefined,
          ip: r.ip ? String(r.ip) : undefined,
          userAgent: r.user_agent ? String(r.user_agent) : undefined,
          deviceType: r.device_type as any,
          details: r.details ? String(r.details) : undefined,
        }));
        saveServerLogs(mapped);
        return mapped;
      }
    } catch (err: any) {
      console.warn('PostgreSQL logs load failed, falling back to JSON:', err.message);
    }
  }

  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      const [rows]: any = await mysqlPool.query(
        'SELECT id, timestamp, date_formatted, event, username, full_name, role, whatsapp, ip, user_agent, device_type, details FROM access_logs ORDER BY created_at DESC LIMIT 1000'
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const mapped: AccessLog[] = rows.map((r: any) => ({
          id: String(r.id),
          timestamp: String(r.timestamp),
          dateFormatted: r.date_formatted || formatBrazilianDate(r.timestamp),
          event: (r.event as LogEventType) || 'LOGIN',
          username: String(r.username),
          name: String(r.full_name || r.username),
          role: (r.role as UserRole) || 'operador',
          whatsapp: r.whatsapp ? String(r.whatsapp) : undefined,
          ip: r.ip ? String(r.ip) : undefined,
          userAgent: r.user_agent ? String(r.user_agent) : undefined,
          deviceType: r.device_type as any,
          details: r.details ? String(r.details) : undefined,
        }));
        saveServerLogs(mapped);
        return mapped;
      }
    } catch (err: any) {
      console.warn('MariaDB logs load failed, falling back to JSON:', err.message);
    }
  }

  return loadServerLogs();
}

export async function appendServerLogAsync(logInput: {
  event: LogEventType;
  username: string;
  name?: string;
  role?: UserRole;
  whatsapp?: string;
  ip?: string;
  userAgent?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet' | 'outro';
  details?: string;
}): Promise<AccessLog> {
  const nowIso = new Date().toISOString();
  const dateFormatted = formatBrazilianDate(nowIso);
  const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Determine user details if not provided
  let fullName = logInput.name;
  let userRole: UserRole = logInput.role || 'operador';
  let userWhatsapp = logInput.whatsapp;

  if (!fullName) {
    const users = loadServerUsers();
    const foundUser = users.find((u) => u.username.toLowerCase() === logInput.username.toLowerCase());
    if (foundUser) {
      fullName = foundUser.name;
      userRole = foundUser.role;
      userWhatsapp = userWhatsapp || foundUser.whatsapp;
    } else {
      fullName = logInput.username;
    }
  }

  const accessLog: AccessLog = {
    id: logId,
    timestamp: nowIso,
    dateFormatted,
    event: logInput.event,
    username: logInput.username.toLowerCase().trim(),
    name: fullName || logInput.username,
    role: userRole,
    whatsapp: userWhatsapp && userWhatsapp !== '-' ? userWhatsapp : undefined,
    ip: logInput.ip,
    userAgent: logInput.userAgent,
    deviceType: logInput.deviceType,
    details: logInput.details,
  };

  // 1. PostgreSQL Save
  const pg = getPgPool();
  if (pg) {
    try {
      await pg.query(
        `INSERT INTO access_logs (id, timestamp, date_formatted, event, username, full_name, role, whatsapp, ip, user_agent, device_type, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          accessLog.id,
          accessLog.timestamp,
          accessLog.dateFormatted,
          accessLog.event,
          accessLog.username,
          accessLog.name,
          accessLog.role,
          accessLog.whatsapp || null,
          accessLog.ip || null,
          accessLog.userAgent || null,
          accessLog.deviceType || null,
          accessLog.details || null,
        ]
      );
    } catch (err: any) {
      console.warn('PostgreSQL log insert error:', err.message);
    }
  }

  // 2. MySQL / MariaDB Save
  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      await mysqlPool.query(
        `INSERT INTO access_logs (id, timestamp, date_formatted, event, username, full_name, role, whatsapp, ip, user_agent, device_type, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          accessLog.id,
          accessLog.timestamp,
          accessLog.dateFormatted,
          accessLog.event,
          accessLog.username,
          accessLog.name,
          accessLog.role,
          accessLog.whatsapp || null,
          accessLog.ip || null,
          accessLog.userAgent || null,
          accessLog.deviceType || null,
          accessLog.details || null,
        ]
      );
    } catch (err: any) {
      console.warn('MariaDB log insert error:', err.message);
    }
  }

  // 3. Local JSON Cache (Unshift to top)
  const currentLogs = loadServerLogs();
  currentLogs.unshift(accessLog);
  saveServerLogs(currentLogs);

  return accessLog;
}

export async function clearServerLogsAsync(): Promise<void> {
  saveServerLogs([]);
  const pg = getPgPool();
  if (pg) {
    pg.query('TRUNCATE TABLE access_logs').catch((e) => console.warn(e.message));
  }
  const mysqlPool = getDbPool();
  if (mysqlPool) {
    mysqlPool.query('TRUNCATE TABLE access_logs').catch((e) => console.warn(e.message));
  }
}

export async function restoreLogsFromSpreadsheetAsync(
  customWebhookUrl?: string
): Promise<{ success: boolean; totalRestored: number; logs: AccessLog[]; error?: string }> {
  try {
    const settings = await loadServerSettingsAsync();
    const webhookUrl = customWebhookUrl || settings.sheetsWebhookUrl;

    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return {
        success: false,
        totalRestored: 0,
        logs: loadServerLogs(),
        error: 'Nenhuma URL de Webhook da planilha configurada.',
      };
    }

    const resp = await fetch(webhookUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'follow',
    });

    if (!resp.ok) {
      return {
        success: false,
        totalRestored: 0,
        logs: loadServerLogs(),
        error: `Servidor da planilha respondeu com status HTTP ${resp.status}`,
      };
    }

    const data = await resp.json().catch(() => null);
    if (!data || !data.tabs) {
      return {
        success: false,
        totalRestored: 0,
        logs: loadServerLogs(),
        error: 'Formato de resposta da planilha inválido ou sem abas.',
      };
    }

    // Find the Logs tab (e.g. "LOGS_ACESSO", "LOGS_AUDITORIA", or containing "log")
    let logTab: any = null;
    for (const [tabKey, tabObj] of Object.entries<any>(data.tabs)) {
      const nameUpper = String(tabKey || '').toUpperCase();
      if (nameUpper.includes('LOG') || nameUpper.includes('ACESSO') || nameUpper.includes('AUDIT')) {
        logTab = tabObj;
        break;
      }
    }

    if (!logTab || !Array.isArray(logTab.rows) || logTab.rows.length === 0) {
      return {
        success: true,
        totalRestored: 0,
        logs: loadServerLogs(),
        error: 'Nenhum registro de log encontrado na planilha.',
      };
    }

    const restoredLogs: AccessLog[] = [];
    for (const row of logTab.rows) {
      // Columns: DATA/HORA, EVENTO, MATRÍCULA / USUÁRIO, NOME COMPLETO, FUNÇÃO / CARGO, WHATSAPP, DISPOSITIVO / NAVEGADOR, OBSERVAÇÕES / DETALHES
      let rowDate = '';
      let rowEvent: LogEventType = 'LOGIN';
      let rowUsername = '';
      let rowName = '';
      let rowRole: UserRole = 'operador';
      let rowWhatsapp = '';
      let rowDevice = '';
      let rowDetails = '';

      for (const [key, val] of Object.entries(row)) {
        if (key.startsWith('_')) continue;
        const normKey = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const strVal = String(val || '').trim();

        if (normKey.includes('data') || normKey.includes('hora') || normKey.includes('timestamp')) {
          rowDate = strVal;
        } else if (normKey.includes('evento') || normKey.includes('tipo') || normKey.includes('acao')) {
          const up = strVal.toUpperCase();
          if (up.includes('LOGOUT') || up.includes('SAIDA') || up.includes('SAIR')) rowEvent = 'LOGOUT';
          else if (up.includes('EXPIR')) rowEvent = 'EXPIRADO';
          else rowEvent = 'LOGIN';
        } else if (normKey.includes('matricula') || normKey.includes('usuario') || normKey.includes('user') || normKey.includes('login')) {
          rowUsername = strVal.toLowerCase();
        } else if (normKey.includes('nome')) {
          rowName = strVal;
        } else if (normKey.includes('funcao') || normKey.includes('cargo') || normKey.includes('perfil') || normKey.includes('role')) {
          const rLower = strVal.toLowerCase();
          if (rLower.includes('master')) rowRole = 'master';
          else if (rLower.includes('51') || rLower.includes('qualidade')) rowRole = 'qualidade_51';
          else if (rLower.includes('pdc')) rowRole = 'pdc';
          else if (rLower.includes('combustivel') || rLower.includes('abastec')) rowRole = 'combustivel';
          else if (rLower.includes('entrada') || rLower.includes('saida')) rowRole = 'entrada_saida';
          else if (rLower.includes('patio')) rowRole = 'patio';
          else if (rLower.includes('vistoria')) rowRole = 'vistoriador';
          else if (rLower.includes('motor')) rowRole = 'motorista';
          else rowRole = 'operador';
        } else if (normKey.includes('whats') || normKey.includes('celular') || normKey.includes('telefone') || normKey.includes('contato')) {
          rowWhatsapp = strVal !== '-' ? strVal : '';
        } else if (normKey.includes('dispositivo') || normKey.includes('navegador') || normKey.includes('agent') || normKey.includes('ip')) {
          rowDevice = strVal;
        } else if (normKey.includes('obs') || normKey.includes('detalh') || normKey.includes('motivo')) {
          rowDetails = strVal;
        }
      }

      if (rowUsername) {
        restoredLogs.push({
          id: `sheet-log-${Date.now()}-${restoredLogs.length}`,
          timestamp: new Date().toISOString(),
          dateFormatted: rowDate || formatBrazilianDate(new Date()),
          event: rowEvent,
          username: rowUsername,
          name: rowName || rowUsername,
          role: rowRole,
          whatsapp: rowWhatsapp || undefined,
          userAgent: rowDevice || undefined,
          details: rowDetails || undefined,
        });
      }
    }

    if (restoredLogs.length > 0) {
      saveServerLogs(restoredLogs);
    }

    return {
      success: true,
      totalRestored: restoredLogs.length,
      logs: restoredLogs,
    };
  } catch (err: any) {
    console.warn('Error in restoreLogsFromSpreadsheetAsync:', err.message);
    return {
      success: false,
      totalRestored: 0,
      logs: loadServerLogs(),
      error: err.message,
    };
  }
}
