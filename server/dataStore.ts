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
const MOVEMENTS_FILE = path.join(DATA_DIR, 'movements.json');

export interface VehicleMovementRecord {
  id: string;
  createdAt: number;
  dateFormatted: string; // A: data (DD/MM/YYYY)
  timeFormatted: string; // B: hora (HH:mm:ss)
  plate: string; // C: placa
  origin: string; // D: origem
  destination: string; // E: destino
  observation: string; // F: observação
  fuelLevel?: string; // G: combustível
  odometer?: number | string; // H: km odômetro
  operatorName: string; // J: operador
  photoUrl?: string;
  rawData?: any;
}

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
  // 1. PostgreSQL is PRIMARY Source of Truth (Render / Cloud / OnRender DB)
  const pg = getPgPool();
  if (pg) {
    try {
      const res = await pg.query(
        'SELECT id, username, full_name, role, password_hash, whatsapp, is_active, created_at FROM users ORDER BY created_at ASC'
      );
      if (res && res.rows.length > 0) {
        const users: UserAccount[] = res.rows.map((r: any) => ({
          id: String(r.id),
          username: String(r.username),
          name: String(r.full_name || r.username),
          role: (r.role as UserRole) || 'operador',
          password: String(r.password_hash || ''),
          whatsapp: r.whatsapp ? String(r.whatsapp) : undefined,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          isActive: Boolean(r.is_active === true || r.is_active === 1),
        }));
        saveServerUsers(users);
        return users;
      }
    } catch (err) {
      console.warn('PostgreSQL users load failed, falling back to local store:', err);
    }
  }

  // 2. MySQL / MariaDB fallback
  const mysqlPool = getDbPool();
  if (mysqlPool) {
    try {
      const [rows]: any = await mysqlPool.query(
        'SELECT id, username, full_name, role, password_hash, whatsapp, is_active, created_at FROM users ORDER BY created_at ASC'
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const users: UserAccount[] = rows.map((r: any) => ({
          id: String(r.id),
          username: String(r.username),
          name: String(r.full_name || r.username),
          role: (r.role as UserRole) || 'operador',
          password: String(r.password_hash || ''),
          whatsapp: r.whatsapp ? String(r.whatsapp) : undefined,
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
        users: await loadServerUsersAsync(),
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
        users: await loadServerUsersAsync(),
        error: `Servidor da planilha respondeu com status HTTP ${resp.status}`,
      };
    }

    const data = await resp.json().catch(() => null);
    if (!data || !data.tabs) {
      return {
        success: false,
        totalRestored: 0,
        users: await loadServerUsersAsync(),
        error: 'Formato de resposta da planilha inválido ou sem abas.',
      };
    }

    // Find the Users tab (e.g. "USUARIOS_CMDIT", "USUARIOS", "OPERADORES", "USUÁRIOS", "USUARIO", etc.)
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
        users: await loadServerUsersAsync(),
        error: 'Nenhum operador encontrado na aba de usuários da planilha.',
      };
    }

    const currentUsers = loadServerUsers();
    const restoredUsers: UserAccount[] = [...currentUsers];
    let addedCount = 0;

    const parseRole = (rawRole: string, username: string, name: string): UserRole => {
      const r = (rawRole || '').toLowerCase();
      const u = (username || '').toLowerCase();
      const n = (name || '').toLowerCase();
      if (r.includes('master') || r.includes('admin') || u === 'mastercmdit' || n.includes('administrador master') || u === 'desenvolvedor') return 'master';
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
      // Extract raw column entries excluding internal index property
      const rawEntries = Object.entries<any>(row).filter(([k]) => k !== '_rowIndex');
      const colValues = rawEntries.map(([, v]) => (v !== null && v !== undefined ? String(v).trim() : ''));

      // 7 Colunas Oficiais Solicitadas:
      // Col A (idx 0): Data e Hora da criação do usuario
      // Col B (idx 1): Matricula/Usuario
      // Col C (idx 2): Nome do usuario
      // Col D (idx 3): Senha
      // Col E (idx 4): Whatsapp
      // Col F (idx 5): Status
      // Col G (idx 6): Ultimo Acesso
      let rowCreated = '';
      let rowUsername = '';
      let rowName = '';
      let rowPassword = '';
      let rowWhatsapp = '';
      let rowRole: string = 'operador';
      let rowIsActive = true;
      let rowLastAccess = '';

      // 1. Extração inteligente por cabeçalho nomeado
      for (const [k, v] of rawEntries) {
        if (v === null || v === undefined) continue;
        const keyLower = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const strVal = String(v).trim();
        if (!strVal) continue;

        // Col A: Data de criação
        if (
          keyLower.includes('criacao') ||
          (keyLower.includes('data') && !keyLower.includes('ultimo') && !keyLower.includes('acesso')) ||
          keyLower === 'col_1' ||
          keyLower === 'coluna a'
        ) {
          if (!rowCreated) rowCreated = strVal;
        }
        // Col B: Matrícula / Usuário
        else if (
          keyLower.includes('matr') ||
          keyLower.includes('usuario') ||
          keyLower.includes('login') ||
          keyLower === 'col_2' ||
          keyLower === 'coluna b' ||
          keyLower === 'username' ||
          keyLower === 'user'
        ) {
          if (!rowUsername) rowUsername = strVal.toLowerCase();
        }
        // Col C: Nome do usuário
        else if (
          keyLower.includes('nome') ||
          keyLower.includes('colaborador') ||
          keyLower.includes('funcionario') ||
          keyLower === 'col_3' ||
          keyLower === 'coluna c' ||
          keyLower === 'name'
        ) {
          if (!rowName) rowName = strVal;
        }
        // Col D: Senha (CRÍTICO: Coluna 4 / D)
        else if (
          keyLower.includes('senha') ||
          keyLower.includes('password') ||
          keyLower.includes('pass') ||
          keyLower.includes('pin') ||
          keyLower === 'col_4' ||
          keyLower === 'coluna d'
        ) {
          if (!rowPassword) rowPassword = strVal;
        }
        // Col E: WhatsApp (Coluna 5 / E)
        else if (
          keyLower.includes('whats') ||
          keyLower.includes('celular') ||
          keyLower.includes('telefone') ||
          keyLower.includes('contato') ||
          keyLower.includes('tel') ||
          keyLower.includes('fone') ||
          keyLower === 'col_5' ||
          keyLower === 'coluna e'
        ) {
          if (strVal !== '-') rowWhatsapp = strVal;
        }
        // Col F: Status (Coluna 6 / F)
        else if (
          keyLower.includes('status') ||
          keyLower.includes('situacao') ||
          keyLower.includes('ativo') ||
          keyLower === 'col_6' ||
          keyLower === 'coluna f'
        ) {
          const up = strVal.toUpperCase();
          if (up === 'BLOQUEADO' || up === 'INATIVO' || up === 'FALSE' || up === '0' || up === 'DESATIVADO') {
            rowIsActive = false;
          }
        }
        // Col G: Último Acesso (Coluna 7 / G)
        else if (
          keyLower.includes('ultimo') ||
          keyLower.includes('acesso') ||
          keyLower.includes('last_login') ||
          keyLower === 'col_7' ||
          keyLower === 'coluna g'
        ) {
          if (strVal !== '-') rowLastAccess = strVal;
        }
        // Cargo / Função (se existir em cabeçalhos antigos)
        else if (keyLower.includes('cargo') || keyLower.includes('funcao') || keyLower.includes('role')) {
          rowRole = strVal;
        }
      }

      // 2. Fallback posicional exato para a estrutura oficial de 7 colunas
      // [0: Data, 1: Matrícula/Usuário, 2: Nome, 3: Senha, 4: WhatsApp, 5: Status, 6: Último Acesso]
      if (colValues.length >= 2) {
        if (!rowUsername && colValues[1]) {
          rowUsername = colValues[1].toLowerCase();
        }
        if (!rowName && colValues[2]) {
          rowName = colValues[2];
        }

        const val3 = colValues[3] ? colValues[3].trim() : '';
        const val4 = colValues[4] ? colValues[4].trim() : '';
        const val5 = colValues[5] ? colValues[5].trim() : '';

        // Detecção de inversão (quando Col D tem 'ATIVO' e Col E tem a Senha real como 'DEV@cmdit' ou 'user123')
        const isVal3Status = ['ativo', 'bloqueado', 'inativo', 'desativado', '-'].includes(val3.toLowerCase());
        const isVal4PasswordLike = val4.includes('@') || val4.length >= 4 || !/^(\+?55)?\d{8,11}$/.test(val4.replace(/\D/g, ''));

        if (isVal3Status && val4 && isVal4PasswordLike) {
          rowPassword = val4;
          if (val3.toLowerCase() === 'bloqueado' || val3.toLowerCase() === 'inativo') {
            rowIsActive = false;
          }
        } else if (val3 && !isVal3Status) {
          rowPassword = val3;
        }

        if (!rowWhatsapp && val4 && !isVal4PasswordLike) {
          rowWhatsapp = val4;
        }

        // Se status não foi pego
        if (colValues.length >= 6 && colValues[5]) {
          const up = colValues[5].toUpperCase();
          if (up === 'BLOQUEADO' || up === 'INATIVO' || up === 'FALSE' || up === '0') {
            rowIsActive = false;
          }
        }

        // Se último acesso não foi pego
        if (!rowLastAccess && colValues.length >= 7 && colValues[6] && colValues[6] !== '-') {
          rowLastAccess = colValues[6];
        }
      }

      // 3. Fallback de busca inteligente se rowUsername ainda estiver vazio
      if (!rowUsername && colValues.length > 0) {
        for (let i = 0; i < colValues.length; i++) {
          const val = colValues[i];
          if (!val || val === '_rowIndex' || (val.includes('/') && val.includes(':'))) continue;
          if (val.length >= 2 && !val.includes('@') && isNaN(Date.parse(val))) {
            rowUsername = val.toLowerCase();
            if (!rowName) rowName = colValues[i + 1] || rowUsername;
            if (!rowPassword && colValues[i + 2]) rowPassword = colValues[i + 2];
            break;
          }
        }
      }

      if (rowUsername && rowUsername !== 'mastercmdit' && rowUsername.length >= 1) {
        const cleanUser = rowUsername.toLowerCase().trim();
        const existingIdx = restoredUsers.findIndex((u) => u.username.toLowerCase() === cleanUser);
        
        let resolvedPassword = 'user123';
        if (cleanUser === 'desenvolvedor') resolvedPassword = 'DEV@cmdit';
        else if (cleanUser === 'mastercmdit') resolvedPassword = 'Master@123';
        
        if (rowPassword && rowPassword.trim() && rowPassword.toUpperCase() !== 'ATIVO') {
          resolvedPassword = rowPassword.trim();
        } else if (rowWhatsapp && rowWhatsapp.includes('@')) {
          resolvedPassword = rowWhatsapp.trim();
        } else if (existingIdx !== -1 && restoredUsers[existingIdx].password) {
          resolvedPassword = restoredUsers[existingIdx].password!;
        }

        const parsedAccount: UserAccount = {
          id: existingIdx !== -1 ? restoredUsers[existingIdx].id : `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          username: cleanUser,
          name: rowName || cleanUser.toUpperCase(),
          role: parseRole(rowRole, cleanUser, rowName),
          whatsapp: rowWhatsapp && !rowWhatsapp.includes('@') ? rowWhatsapp : (existingIdx !== -1 ? restoredUsers[existingIdx].whatsapp : undefined),
          password: resolvedPassword,
          createdAt: rowCreated || (existingIdx !== -1 && restoredUsers[existingIdx].createdAt ? restoredUsers[existingIdx].createdAt : new Date().toISOString()),
          lastLogin: rowLastAccess || (existingIdx !== -1 ? restoredUsers[existingIdx].lastLogin : undefined),
          isActive: rowIsActive,
        };

        if (existingIdx !== -1) {
          restoredUsers[existingIdx] = { ...restoredUsers[existingIdx], ...parsedAccount };
        } else {
          restoredUsers.push(parsedAccount);
          addedCount++;
        }

        // Sincroniza diretamente com a tabela PostgreSQL
        const pg = getPgPool();
        if (pg) {
          pg.query(
            `INSERT INTO users (id, username, password_hash, full_name, role, is_active, whatsapp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (username) DO UPDATE SET
               password_hash = EXCLUDED.password_hash,
               full_name = EXCLUDED.full_name,
               role = EXCLUDED.role,
               is_active = EXCLUDED.is_active,
               whatsapp = EXCLUDED.whatsapp`,
            [parsedAccount.id, parsedAccount.username, parsedAccount.password, parsedAccount.name, parsedAccount.role, parsedAccount.isActive, parsedAccount.whatsapp || '-']
          ).catch((e) => console.warn('Postgres user sync notice:', e.message));
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
  const alphanumericUsername = cleanUsername.replace(/[^a-z0-9]/g, '');
  const rawPass = String(password || '');
  const cleanPass = rawPass.trim();
  const cleanPassLower = cleanPass.toLowerCase();

  const isPasswordMatch = (storedPass?: string, alternatePass?: string): boolean => {
    if (storedPass) {
      const s = String(storedPass).trim();
      if (s === rawPass || s === cleanPass || s.toLowerCase() === cleanPassLower) return true;
    }
    if (alternatePass) {
      const a = String(alternatePass).trim();
      if (a === rawPass || a === cleanPass || a.toLowerCase() === cleanPassLower) return true;
    }
    // Hardcoded built-in credential overrides
    if (cleanUsername === 'mastercmdit' && (rawPass === 'Master@123' || cleanPass === 'Master@123')) return true;
    if (cleanUsername === 'desenvolvedor' && (rawPass === 'DEV@cmdit' || cleanPass === 'DEV@cmdit')) return true;
    return false;
  };

  // 1. PostgreSQL Auth (Primary database on Render)
  const pg = getPgPool();
  if (pg) {
    try {
      const res = await pg.query(
        `SELECT id, username, full_name, role, password_hash, whatsapp, is_active 
         FROM users 
         WHERE LOWER(username) = $1 
            OR LOWER(full_name) = $1 
            OR regexp_replace(LOWER(username), '[^a-z0-9]', '', 'g') = $2
         LIMIT 1`,
        [cleanUsername, alphanumericUsername]
      );
      if (res && res.rows.length > 0) {
        const u = res.rows[0];
        const dbPass = String(u.password_hash || '').trim();
        const dbWhatsapp = String(u.whatsapp || '').trim();
        const passMatches = isPasswordMatch(dbPass, dbWhatsapp);
        
        if (!passMatches) {
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
        'SELECT id, username, full_name, role, password_hash, whatsapp, is_active FROM users WHERE LOWER(username) = ? OR LOWER(full_name) = ? LIMIT 1',
        [cleanUsername, cleanUsername]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const u = rows[0];
        const dbPass = String(u.password_hash || '').trim();
        const dbWhatsapp = String(u.whatsapp || '').trim();
        const passMatches = isPasswordMatch(dbPass, dbWhatsapp);

        if (!passMatches) {
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
  return localAuth;
}

export function authenticateServerUser(
  username: string,
  password: string
): { success: boolean; error?: string; user?: Omit<UserAccount, 'password'> } {
  const users = loadServerUsers();
  const cleanUsername = username.trim().toLowerCase();
  const alphanumericUsername = cleanUsername.replace(/[^a-z0-9]/g, '');
  const rawPass = String(password || '');
  const cleanPass = rawPass.trim();
  const cleanPassLower = cleanPass.toLowerCase();

  const isPasswordMatch = (storedPass?: string, alternatePass?: string): boolean => {
    if (storedPass) {
      const s = String(storedPass).trim();
      if (s === rawPass || s === cleanPass || s.toLowerCase() === cleanPassLower) return true;
    }
    if (alternatePass) {
      const a = String(alternatePass).trim();
      if (a === rawPass || a === cleanPass || a.toLowerCase() === cleanPassLower) return true;
    }
    if (cleanUsername === 'mastercmdit' && (rawPass === 'Master@123' || cleanPass === 'Master@123')) return true;
    if (cleanUsername === 'desenvolvedor' && (rawPass === 'DEV@cmdit' || cleanPass === 'DEV@cmdit')) return true;
    return false;
  };

  // 1. First try exact username match
  let user = users.find(
    (u) => u.username.toLowerCase() === cleanUsername && isPasswordMatch(u.password, u.whatsapp)
  );

  // 2. Try match without punctuation / formatted matricula (e.g. "012.345" vs "012345")
  if (!user && alphanumericUsername.length >= 2) {
    user = users.find(
      (u) =>
        u.username.toLowerCase().replace(/[^a-z0-9]/g, '') === alphanumericUsername &&
        isPasswordMatch(u.password, u.whatsapp)
    );
  }

  // 3. Try matching by Full Name or partial Name
  if (!user) {
    user = users.find(
      (u) =>
        (u.name.toLowerCase().trim() === cleanUsername ||
          u.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === alphanumericUsername) &&
        isPasswordMatch(u.password, u.whatsapp)
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

// --------------------------------------------------------------------------
// MOVIMENTAÇÕES DE VEÍCULOS (ORIGEM -> DESTINO)
// --------------------------------------------------------------------------

export function loadLocalMovements(): VehicleMovementRecord[] {
  try {
    if (fs.existsSync(MOVEMENTS_FILE)) {
      const content = fs.readFileSync(MOVEMENTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read movements.json:', err);
  }
  return [];
}

export function saveLocalMovements(movements: VehicleMovementRecord[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(MOVEMENTS_FILE, JSON.stringify(movements, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write movements.json:', err);
  }
}

export async function loadMovementsAsync(): Promise<VehicleMovementRecord[]> {
  const pgPool = getPgPool();
  if (pgPool) {
    try {
      const res = await pgPool.query(`
        SELECT 
          id, 
          date_formatted, 
          time_formatted, 
          plate, 
          origin, 
          destination, 
          observation, 
          fuel_level, 
          odometer, 
          operator_name, 
          photo_url, 
          raw_data,
          created_at
        FROM vehicle_movements
        ORDER BY created_at DESC
        LIMIT 500;
      `);
      if (res.rows && res.rows.length > 0) {
        return res.rows.map((r) => ({
          id: r.id,
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
          dateFormatted: r.date_formatted,
          timeFormatted: r.time_formatted,
          plate: (r.plate || '').toUpperCase(),
          origin: r.origin,
          destination: r.destination,
          observation: r.observation,
          fuelLevel: r.fuel_level || undefined,
          odometer: r.odometer ?? undefined,
          operatorName: r.operator_name,
          photoUrl: r.photo_url || undefined,
          rawData: r.raw_data || undefined,
        }));
      }
    } catch (err: any) {
      console.warn('PostgreSQL loadMovements error, falling back to local file:', err.message);
    }
  }

  return loadLocalMovements();
}

export async function saveMovementAsync(movement: VehicleMovementRecord): Promise<VehicleMovementRecord> {
  const normMovement: VehicleMovementRecord = {
    ...movement,
    id: movement.id || `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: movement.createdAt || Date.now(),
    plate: (movement.plate || '').toUpperCase().trim(),
    origin: (movement.origin || '').trim(),
    destination: (movement.destination || '').trim(),
    observation: (movement.observation || '').trim(),
    operatorName: (movement.operatorName || 'Operador').trim(),
  };

  // 1. Save to PostgreSQL
  const pgPool = getPgPool();
  if (pgPool) {
    try {
      await pgPool.query(
        `INSERT INTO vehicle_movements 
          (id, date_formatted, time_formatted, plate, origin, destination, observation, fuel_level, odometer, operator_name, photo_url, raw_data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
          date_formatted = EXCLUDED.date_formatted,
          time_formatted = EXCLUDED.time_formatted,
          plate = EXCLUDED.plate,
          origin = EXCLUDED.origin,
          destination = EXCLUDED.destination,
          observation = EXCLUDED.observation,
          fuel_level = EXCLUDED.fuel_level,
          odometer = EXCLUDED.odometer,
          operator_name = EXCLUDED.operator_name,
          photo_url = EXCLUDED.photo_url,
          raw_data = EXCLUDED.raw_data;`,
        [
          normMovement.id,
          normMovement.dateFormatted,
          normMovement.timeFormatted,
          normMovement.plate,
          normMovement.origin,
          normMovement.destination,
          normMovement.observation,
          normMovement.fuelLevel || null,
          normMovement.odometer ? Number(normMovement.odometer) : null,
          normMovement.operatorName,
          normMovement.photoUrl || null,
          JSON.stringify(normMovement),
        ]
      );

      // Update vehicle record location in PostgreSQL
      await pgPool.query(
        `UPDATE vehicle_records 
         SET notes = CASE 
               WHEN notes IS NULL OR notes = '' THEN 'Origem: ' || $1 || ' -> Destino: ' || $2
               ELSE notes || ' | ' || 'Origem: ' || $1 || ' -> Destino: ' || $2
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE UPPER(plate) = UPPER($3);`,
        [normMovement.origin, normMovement.destination, normMovement.plate]
      ).catch(() => {});
    } catch (err: any) {
      console.warn('PostgreSQL saveMovement error:', err.message);
    }
  }

  // 2. Save to local movements.json
  const localList = loadLocalMovements();
  const existingIdx = localList.findIndex((m) => m.id === normMovement.id);
  if (existingIdx >= 0) {
    localList[existingIdx] = normMovement;
  } else {
    localList.unshift(normMovement);
  }
  saveLocalMovements(localList);

  // 3. Update vehicle position in local records store
  try {
    const records = loadServerRecords();
    const vIdx = records.findIndex(
      (r) => r.plate && r.plate.toUpperCase().trim() === normMovement.plate
    );
    if (vIdx >= 0) {
      records[vIdx] = {
        ...records[vIdx],
        location: normMovement.destination,
        destination: normMovement.destination,
        status: 'parked',
        notes: (records[vIdx].notes ? records[vIdx].notes + ' | ' : '') + `Mov: ${normMovement.origin} -> ${normMovement.destination}`,
        fuel: normMovement.fuelLevel || records[vIdx].fuel,
        km: normMovement.odometer || records[vIdx].km,
      };
      saveServerRecords(records);
    }
  } catch (err) {
    console.warn('Notice updating local records for movement:', err);
  }

  return normMovement;
}

export async function deleteMovementAsync(id: string): Promise<boolean> {
  const pgPool = getPgPool();
  if (pgPool) {
    try {
      await pgPool.query('DELETE FROM vehicle_movements WHERE id = $1', [id]);
    } catch (err: any) {
      console.warn('PostgreSQL deleteMovement error:', err.message);
    }
  }

  const localList = loadLocalMovements();
  const filtered = localList.filter((m) => m.id !== id);
  saveLocalMovements(filtered);
  return true;
}

// --------------------------------------------------------------------------
// BACKUP E RESTAURAÇÃO TOTAL DO BANCO DE DADOS (POSTGRESQL / RENDER)
// --------------------------------------------------------------------------

export interface DatabaseBackupPayload {
  version: string;
  exportedAt: string;
  database: string;
  provider: string;
  counts: {
    users: number;
    vehicle_records: number;
    vehicle_movements: number;
    access_logs: number;
    app_settings: number;
  };
  tables: {
    users: any[];
    vehicle_records: any[];
    vehicle_movements: any[];
    access_logs: any[];
    app_settings: any[];
  };
}

export async function exportDatabaseBackupAsync(): Promise<DatabaseBackupPayload> {
  const pgPool = getPgPool();

  let users: any[] = [];
  let vehicleRecords: any[] = [];
  let vehicleMovements: any[] = [];
  let accessLogs: any[] = [];
  let appSettings: any[] = [];

  if (pgPool) {
    try {
      const uRes = await pgPool.query('SELECT * FROM users ORDER BY created_at ASC;');
      users = uRes.rows;
    } catch (e: any) {
      console.warn('Backup error loading users from PG:', e.message);
      users = loadServerUsers();
    }

    try {
      const rRes = await pgPool.query('SELECT * FROM vehicle_records ORDER BY created_at DESC;');
      vehicleRecords = rRes.rows;
    } catch (e: any) {
      console.warn('Backup error loading vehicle_records from PG:', e.message);
      vehicleRecords = loadServerRecords();
    }

    try {
      const mRes = await pgPool.query('SELECT * FROM vehicle_movements ORDER BY created_at DESC;');
      vehicleMovements = mRes.rows;
    } catch (e: any) {
      console.warn('Backup error loading vehicle_movements from PG:', e.message);
      vehicleMovements = loadLocalMovements();
    }

    try {
      const lRes = await pgPool.query('SELECT * FROM access_logs ORDER BY created_at DESC;');
      accessLogs = lRes.rows;
    } catch (e: any) {
      console.warn('Backup error loading access_logs from PG:', e.message);
      accessLogs = loadServerLogs();
    }

    try {
      const sRes = await pgPool.query('SELECT * FROM app_settings;');
      appSettings = sRes.rows;
    } catch (e: any) {
      console.warn('Backup error loading app_settings from PG:', e.message);
      appSettings = [{ key: 'general', value: loadServerSettings() }];
    }
  } else {
    users = loadServerUsers();
    vehicleRecords = loadServerRecords();
    vehicleMovements = loadLocalMovements();
    accessLogs = loadServerLogs();
    appSettings = [{ key: 'general', value: loadServerSettings() }];
  }

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    database: 'patiocmdit_db',
    provider: 'PostgreSQL (Render)',
    counts: {
      users: users.length,
      vehicle_records: vehicleRecords.length,
      vehicle_movements: vehicleMovements.length,
      access_logs: accessLogs.length,
      app_settings: appSettings.length,
    },
    tables: {
      users,
      vehicle_records: vehicleRecords,
      vehicle_movements: vehicleMovements,
      access_logs: accessLogs,
      app_settings: appSettings,
    },
  };
}

export async function restoreDatabaseBackupAsync(
  payload: DatabaseBackupPayload
): Promise<{
  success: boolean;
  message: string;
  restoredCounts: {
    users: number;
    vehicle_records: number;
    vehicle_movements: number;
    access_logs: number;
    app_settings: number;
  };
  errors?: string[];
}> {
  if (!payload || !payload.tables) {
    throw new Error('Formato de backup inválido: "tables" não encontrado.');
  }

  const errors: string[] = [];
  const counts = {
    users: 0,
    vehicle_records: 0,
    vehicle_movements: 0,
    access_logs: 0,
    app_settings: 0,
  };

  const pgPool = getPgPool();

  // 1. Restaurar Usuários
  if (Array.isArray(payload.tables.users)) {
    const rawUsers = payload.tables.users;
    for (const u of rawUsers) {
      try {
        const userId = u.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const username = (u.username || '').toLowerCase().trim();
        const passwordHash = u.password_hash || u.password || '123456';
        const fullName = u.full_name || u.name || username;
        const role = u.role || 'operador';
        const whatsapp = u.whatsapp || null;
        const isActive = u.is_active !== undefined ? Boolean(u.is_active) : (u.isActive !== undefined ? Boolean(u.isActive) : true);

        if (pgPool && username) {
          await pgPool.query(
            `INSERT INTO users (id, username, password_hash, full_name, role, whatsapp, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
             ON CONFLICT (username) DO UPDATE SET
               password_hash = EXCLUDED.password_hash,
               full_name = EXCLUDED.full_name,
               role = EXCLUDED.role,
               whatsapp = EXCLUDED.whatsapp,
               is_active = EXCLUDED.is_active,
               updated_at = CURRENT_TIMESTAMP;`,
            [userId, username, passwordHash, fullName, role, whatsapp, isActive]
          );
        }
        counts.users++;
      } catch (err: any) {
        errors.push(`Usuário (${u.username}): ${err.message}`);
      }
    }
  }

  // 2. Restaurar Registros de Veículos
  if (Array.isArray(payload.tables.vehicle_records)) {
    const rawRecs = payload.tables.vehicle_records;
    for (const r of rawRecs) {
      try {
        const id = r.id || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const plate = (r.plate || '').toUpperCase().trim();
        if (!plate) continue;

        if (pgPool) {
          await pgPool.query(
            `INSERT INTO vehicle_records 
              (id, plate, plate_state, model, color, driver_name, driver_doc, company, entry_time, exit_time, status, seal_number, odometer, notes, operator_name, raw_data, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               plate = EXCLUDED.plate,
               plate_state = EXCLUDED.plate_state,
               model = EXCLUDED.model,
               color = EXCLUDED.color,
               driver_name = EXCLUDED.driver_name,
               driver_doc = EXCLUDED.driver_doc,
               company = EXCLUDED.company,
               entry_time = EXCLUDED.entry_time,
               exit_time = EXCLUDED.exit_time,
               status = EXCLUDED.status,
               seal_number = EXCLUDED.seal_number,
               odometer = EXCLUDED.odometer,
               notes = EXCLUDED.notes,
               operator_name = EXCLUDED.operator_name,
               raw_data = EXCLUDED.raw_data,
               updated_at = CURRENT_TIMESTAMP;`,
            [
              id,
              plate,
              r.plate_state || r.plateState || null,
              r.model || null,
              r.color || null,
              r.driver_name || r.driverName || null,
              r.driver_doc || r.driverDoc || null,
              r.company || null,
              r.entry_time || r.entryTime || null,
              r.exit_time || r.exitTime || null,
              r.status || 'inside',
              r.seal_number || r.sealNumber || null,
              r.odometer ? Number(r.odometer) : null,
              r.notes || null,
              r.operator_name || r.operatorName || null,
              r.raw_data ? (typeof r.raw_data === 'string' ? r.raw_data : JSON.stringify(r.raw_data)) : JSON.stringify(r),
            ]
          );
        }
        counts.vehicle_records++;
      } catch (err: any) {
        errors.push(`Registro (${r.plate}): ${err.message}`);
      }
    }
  }

  // 3. Restaurar Movimentações
  if (Array.isArray(payload.tables.vehicle_movements)) {
    const rawMovs = payload.tables.vehicle_movements;
    for (const m of rawMovs) {
      try {
        const id = m.id || `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const plate = (m.plate || '').toUpperCase().trim();
        const origin = m.origin || '';
        const destination = m.destination || '';
        const observation = m.observation || '';
        const dateFormatted = m.date_formatted || m.dateFormatted || '';
        const timeFormatted = m.time_formatted || m.timeFormatted || '';
        const operatorName = m.operator_name || m.operatorName || 'Operador';
        const fuelLevel = m.fuel_level || m.fuelLevel || null;
        const odometer = m.odometer ? Number(m.odometer) : null;
        const photoUrl = m.photo_url || m.photoUrl || null;

        if (pgPool && plate) {
          await pgPool.query(
            `INSERT INTO vehicle_movements 
              (id, date_formatted, time_formatted, plate, origin, destination, observation, fuel_level, odometer, operator_name, photo_url, raw_data, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               date_formatted = EXCLUDED.date_formatted,
               time_formatted = EXCLUDED.time_formatted,
               plate = EXCLUDED.plate,
               origin = EXCLUDED.origin,
               destination = EXCLUDED.destination,
               observation = EXCLUDED.observation,
               fuel_level = EXCLUDED.fuel_level,
               odometer = EXCLUDED.odometer,
               operator_name = EXCLUDED.operator_name,
               photo_url = EXCLUDED.photo_url,
               raw_data = EXCLUDED.raw_data;`,
            [
              id,
              dateFormatted,
              timeFormatted,
              plate,
              origin,
              destination,
              observation,
              fuelLevel,
              odometer,
              operatorName,
              photoUrl,
              m.raw_data ? (typeof m.raw_data === 'string' ? m.raw_data : JSON.stringify(m.raw_data)) : JSON.stringify(m),
            ]
          );
        }
        counts.vehicle_movements++;
      } catch (err: any) {
        errors.push(`Movimentação (${m.plate}): ${err.message}`);
      }
    }
  }

  // 4. Restaurar Logs de Acesso
  if (Array.isArray(payload.tables.access_logs)) {
    const rawLogs = payload.tables.access_logs;
    for (const l of rawLogs) {
      try {
        const id = l.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        if (pgPool && l.username) {
          await pgPool.query(
            `INSERT INTO access_logs 
              (id, timestamp, date_formatted, event, username, full_name, role, whatsapp, ip, user_agent, device_type, details, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO NOTHING;`,
            [
              id,
              l.timestamp || new Date().toISOString(),
              l.date_formatted || l.dateFormatted || '',
              l.event || 'LOGIN',
              l.username,
              l.full_name || l.name || l.username,
              l.role || 'operador',
              l.whatsapp || null,
              l.ip || null,
              l.user_agent || l.userAgent || null,
              l.device_type || l.deviceType || null,
              l.details || null,
            ]
          );
        }
        counts.access_logs++;
      } catch (err: any) {
        errors.push(`Log (${l.username}): ${err.message}`);
      }
    }
  }

  // 5. Restaurar Configurações
  if (Array.isArray(payload.tables.app_settings)) {
    const rawSettings = payload.tables.app_settings;
    for (const s of rawSettings) {
      try {
        const key = s.key || 'general';
        const val = s.value || s;
        if (pgPool) {
          await pgPool.query(
            `INSERT INTO app_settings (key, value, updated_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET
               value = EXCLUDED.value,
               updated_at = CURRENT_TIMESTAMP;`,
            [key, typeof val === 'string' ? val : JSON.stringify(val)]
          );
        }
        counts.app_settings++;
      } catch (err: any) {
        errors.push(`Config (${s.key}): ${err.message}`);
      }
    }
  }

  return {
    success: true,
    message: 'Restauração do banco de dados concluída com sucesso!',
    restoredCounts: counts,
    errors: errors.length > 0 ? errors : undefined,
  };
}
