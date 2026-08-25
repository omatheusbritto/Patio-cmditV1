import fs from 'fs';
import path from 'path';

export type UserRole = 'master' | 'operador' | 'vistoriador' | 'motorista';

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
// USERS STORE
// ----------------------------------------------------
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

export function createServerUser(
  username: string,
  name: string,
  password: string,
  role: UserRole = 'operador'
): { success: boolean; error?: string; user?: UserAccount } {
  const users = loadServerUsers();
  const cleanUsername = username.trim().toLowerCase();

  if (!cleanUsername) {
    return { success: false, error: 'Usuário / Matrícula é obrigatório.' };
  }
  if (!name.trim()) {
    return { success: false, error: 'Nome do colaborador é obrigatório.' };
  }
  if (!password.trim()) {
    return { success: false, error: 'Senha é obrigatória.' };
  }

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

  return { success: true, user: newUser };
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
  return { success: true };
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
  return { success: true, isActive: user.isActive };
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
  return { success: true };
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

export function appendOrUpdateServerRecord(record: any): any[] {
  const records = loadServerRecords();
  const existingIdx = records.findIndex((r) => r.id === record.id);
  if (existingIdx >= 0) {
    records[existingIdx] = record;
  } else {
    records.unshift(record);
  }
  // Keep last 1000 records for fast memory / disk performance
  if (records.length > 1000) {
    records.splice(1000);
  }
  saveServerRecords(records);
  return records;
}

export function deleteServerRecord(id: string): any[] {
  const records = loadServerRecords().filter((r) => r.id !== id);
  saveServerRecords(records);
  return records;
}

export function clearServerRecords(): void {
  saveServerRecords([]);
}

// ----------------------------------------------------
// GLOBAL SETTINGS STORE (SHEETS WEBHOOK & INTEGRATION)
// ----------------------------------------------------
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

