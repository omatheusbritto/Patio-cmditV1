import { UserAccount, AuthSession, UserRole } from '../types';

const STORAGE_KEYS = {
  USERS: 'cmdit_users_store',
  SESSION: 'cmdit_auth_session',
};

// 9 horas em milissegundos
export const SESSION_DURATION_MS = 9 * 60 * 60 * 1000;

// Usuário Master inicial configurado conforme solicitado
const DEFAULT_MASTER_USER: UserAccount = {
  id: 'master-001',
  username: 'mastercmdit',
  name: 'Administrador Master',
  role: 'master',
  password: 'Master@123',
  createdAt: new Date().toISOString(),
  isActive: true,
};

const DEFAULT_DEV_USER: UserAccount = {
  id: 'dev-001',
  username: 'desenvolvedor',
  name: 'Desenvolvedor CMDIT',
  role: 'master',
  password: 'DEV@cmdit',
  createdAt: new Date().toISOString(),
  isActive: true,
};

/**
 * Obtém todos os usuários do cache local de forma síncrona
 */
export function getAllUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      const initialList = [DEFAULT_MASTER_USER, DEFAULT_DEV_USER];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialList));
      // Tenta sincronizar em segundo plano com o servidor
      fetchServerUsers();
      return initialList;
    }
    const parsed: UserAccount[] = JSON.parse(raw);
    
    const masterIndex = parsed.findIndex(
      (u) => u.role === 'master' || u.username.toLowerCase() === 'mastercmdit'
    );
    if (masterIndex === -1) {
      parsed.unshift(DEFAULT_MASTER_USER);
    }
    const devIndex = parsed.findIndex(
      (u) => u.username.toLowerCase() === 'desenvolvedor'
    );
    if (devIndex === -1) {
      parsed.push(DEFAULT_DEV_USER);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(parsed));
    return parsed;
  } catch (e) {
    console.error('Erro ao ler usuários locais:', e);
    return [DEFAULT_MASTER_USER, DEFAULT_DEV_USER];
  }
}

/**
 * Mescla duas listas de usuários sem perder cadastros locais ou do servidor
 */
function mergeUsersList(localList: UserAccount[], serverList: UserAccount[]): UserAccount[] {
  const map = new Map<string, UserAccount>();

  // Primeiro adiciona os locais
  for (const u of localList) {
    if (u && u.username) {
      map.set(u.username.toLowerCase(), u);
    }
  }

  // Depois sobrepõe/adiciona os do servidor (que costumam ter IDs e status atualizados)
  for (const u of serverList) {
    if (u && u.username) {
      const existing = map.get(u.username.toLowerCase());
      map.set(u.username.toLowerCase(), { ...existing, ...u });
    }
  }

  // Garante usuário master
  if (!map.has('mastercmdit')) {
    map.set('mastercmdit', DEFAULT_MASTER_USER);
  }

  return Array.from(map.values());
}

/**
 * Busca a lista atualizada de usuários no servidor central (sincronização multi-dispositivo)
 */
export async function fetchServerUsers(): Promise<UserAccount[]> {
  const localUsers = getAllUsers();

  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        const merged = mergeUsersList(localUsers, data.users);
        saveUsersList(merged);

        // Se houver usuários locais que não estão no servidor, sincroniza-os em background
        const serverUsernames = new Set(data.users.map((u: any) => u.username.toLowerCase()));
        for (const localU of localUsers) {
          if (!serverUsernames.has(localU.username.toLowerCase()) && localU.username !== 'mastercmdit') {
            fetch('/api/users/sync-single', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user: localU }),
            }).catch(() => {});
          }
        }

        return merged;
      }
    }
  } catch (err) {
    console.warn('Não foi possível sincronizar usuários com o servidor:', err);
  }
  return localUsers;
}

/**
 * Restaura todos os usuários diretamente da aba USUARIOS_CMDIT do Google Sheets
 */
export async function restoreUsersFromSheetClient(
  webhookUrl?: string
): Promise<{ success: boolean; totalRestored?: number; users?: UserAccount[]; error?: string }> {
  try {
    const res = await fetch('/api/users/restore-from-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl }),
    });

    const data = await res.json();
    if (data.success && Array.isArray(data.users)) {
      const localUsers = getAllUsers();
      const merged = mergeUsersList(localUsers, data.users);
      saveUsersList(merged);
      return { success: true, totalRestored: data.totalRestored || data.users.length, users: merged };
    }
    return { success: false, error: data.error || 'Não foi possível restaurar usuários da planilha.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao conectar ao servidor para restaurar da planilha.' };
  }
}

/**
 * Salva a lista de usuários no storage local
 */
export function saveUsersList(users: UserAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  } catch (e) {
    console.error('Erro ao salvar usuários no storage local:', e);
  }
}

/**
 * Cria um novo usuário de forma centralizada no servidor (disponível para todos os celulares)
 */
export async function createNewUser(
  username: string,
  name: string,
  password: string,
  role: UserRole = 'operador',
  whatsapp?: string
): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
  const cleanUsername = username.trim().toLowerCase();
  const cleanWhatsapp = whatsapp ? whatsapp.trim() : undefined;

  if (!cleanUsername) {
    return { success: false, error: 'Usuário / Matrícula é obrigatório.' };
  }
  if (!name.trim()) {
    return { success: false, error: 'Nome do colaborador é obrigatório.' };
  }
  if (!password.trim()) {
    return { success: false, error: 'Senha é obrigatória.' };
  }

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        username: cleanUsername,
        name: name.trim(),
        password: password.trim(),
        role,
        whatsapp: cleanWhatsapp,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (Array.isArray(data.users)) {
        saveUsersList(data.users);
      }
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error || 'Erro ao cadastrar usuário no servidor.' };
    }
  } catch (err: any) {
    console.warn('Falha na requisição ao servidor para criar usuário, aplicando offline:', err);
    // Fallback offline
    const users = getAllUsers();
    const exists = users.some((u) => u.username.toLowerCase() === cleanUsername);
    if (exists) {
      return { success: false, error: `O usuário "${username}" já existe.` };
    }

    const newUser: UserAccount = {
      id: `user-${Date.now()}`,
      username: cleanUsername,
      name: name.trim(),
      role,
      whatsapp: cleanWhatsapp,
      password: password.trim(),
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    users.push(newUser);
    saveUsersList(users);
    return { success: true, user: newUser };
  }
}

/**
 * Reseta a senha de um usuário no servidor central
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword.trim()) {
    return { success: false, error: 'Nova senha não pode estar em branco.' };
  }

  try {
    const res = await fetch('/api/users/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ userId, newPassword: newPassword.trim() }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (Array.isArray(data.users)) {
        saveUsersList(data.users);
      }
      return { success: true };
    } else {
      return { success: false, error: data.error || 'Falha ao redefinir senha no servidor.' };
    }
  } catch (err) {
    const users = getAllUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      return { success: false, error: 'Usuário não encontrado.' };
    }
    users[index].password = newPassword.trim();
    saveUsersList(users);
    return { success: true };
  }
}

/**
 * Alterna status ativo/bloqueado no servidor central
 */
export async function toggleUserStatus(
  userId: string
): Promise<{ success: boolean; isActive?: boolean }> {
  try {
    const res = await fetch('/api/users/toggle-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (Array.isArray(data.users)) {
        saveUsersList(data.users);
      }
      return { success: true, isActive: data.isActive };
    }
  } catch (err) {
    console.warn('Erro ao alternar status no servidor:', err);
  }

  const users = getAllUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false };
  if (user.role === 'master') return { success: false };

  user.isActive = !user.isActive;
  saveUsersList(users);
  return { success: true, isActive: user.isActive };
}

/**
 * Atualiza os dados completos de um usuário no servidor central e localmente
 */
export async function updateUserAccount(
  userId: string,
  updatedData: Partial<UserAccount>
): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(updatedData),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (Array.isArray(data.users)) {
        saveUsersList(data.users);
      }
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error || 'Falha ao atualizar usuário no servidor.' };
    }
  } catch (err) {
    console.warn('Fallback offline para atualizar usuário:', err);
    const users = getAllUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) return { success: false, error: 'Usuário não encontrado.' };

    const cleanUsername = updatedData.username ? updatedData.username.trim().toLowerCase() : users[index].username;
    if (cleanUsername !== users[index].username) {
      const exists = users.some((u) => u.id !== userId && u.username.toLowerCase() === cleanUsername);
      if (exists) {
        return { success: false, error: `O nome de usuário "${cleanUsername}" já pertence a outro operador.` };
      }
    }

    users[index] = {
      ...users[index],
      ...updatedData,
      username: cleanUsername,
      name: updatedData.name ? updatedData.name.trim() : users[index].name,
      password: updatedData.password ? updatedData.password.trim() : users[index].password,
    };
    saveUsersList(users);
    return { success: true, user: users[index] };
  }
}

/**
 * Exclui um usuário no servidor central
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (Array.isArray(data.users)) {
        saveUsersList(data.users);
      }
      return { success: true };
    } else {
      return { success: false, error: data.error || 'Erro ao excluir usuário no servidor.' };
    }
  } catch (err) {
    const users = getAllUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'Usuário não encontrado.' };
    if (user.role === 'master') {
      return { success: false, error: 'O usuário Master principal não pode ser excluído.' };
    }
    const updated = users.filter((u) => u.id !== userId);
    saveUsersList(updated);
    return { success: true };
  }
}

/**
 * Realiza login e gera sessão de 9 horas (validando com o servidor central para múltiplos celulares)
 */
export async function loginUser(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; session?: AuthSession }> {
  const cleanUsername = username.trim().toLowerCase();
  const cleanPassword = password.trim();

  // 1. Tenta autenticação direta com o backend
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data?.success && data.session) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(data.session));
      if (Array.isArray(data.users)) {
        const merged = mergeUsersList(getAllUsers(), data.users);
        saveUsersList(merged);
      }
      return { success: true, session: data.session };
    }

    // Se o servidor retornou erro 401 ou usuário não encontrado, verifica se temos o usuário no localStorage
    const localUsers = getAllUsers();
    const localUser = localUsers.find(
      (u) =>
        (u.username.toLowerCase() === cleanUsername || u.name.toLowerCase().trim() === cleanUsername) &&
        (u.password === password || u.password?.trim() === cleanPassword || u.password?.trim().toLowerCase() === cleanPassword.toLowerCase())
    );

    if (localUser) {
      if (localUser.isActive === false) {
        return {
          success: false,
          error: 'Este usuário está bloqueado. Contate o Administrador Master.',
        };
      }

      // Sincroniza esse usuário com o servidor para que o servidor aprenda o cadastro
      try {
        await fetch('/api/users/sync-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: localUser }),
        });
      } catch {}

      const now = Date.now();
      const session: AuthSession = {
        user: {
          id: localUser.id,
          username: localUser.username,
          name: localUser.name,
          role: localUser.role,
        },
        loginTimestamp: now,
        expiresAt: now + SESSION_DURATION_MS,
      };
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
      localUser.lastLogin = new Date().toISOString();
      saveUsersList(localUsers);
      return { success: true, session };
    }

    if (data && data.error) {
      return { success: false, error: data.error };
    }
  } catch (netErr) {
    console.warn('Servidor offline ou inacessível no momento, tentando autenticação local:', netErr);
  }

  // Fallback offline local
  const users = getAllUsers();
  const user = users.find(
    (u) =>
      (u.username.toLowerCase() === cleanUsername || u.name.toLowerCase().trim() === cleanUsername) &&
      (u.password === password || u.password?.trim() === cleanPassword || u.password?.trim().toLowerCase() === cleanPassword.toLowerCase())
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

  const now = Date.now();
  const session: AuthSession = {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    },
    loginTimestamp: now,
    expiresAt: now + SESSION_DURATION_MS,
  };

  try {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    user.lastLogin = new Date().toISOString();
    saveUsersList(users);
  } catch (e) {
    console.error('Erro ao salvar sessão:', e);
  }

  return { success: true, session };
}

/**
 * Obtém a sessão ativa ou retorna null se expirada (>9h)
 */
export function getCurrentSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);

    const now = Date.now();
    if (now >= session.expiresAt) {
      logoutUser();
      return null;
    }
    return session;
  } catch (e) {
    logoutUser();
    return null;
  }
}

/**
 * Retorna os headers de autenticação para requisições seguras ao servidor (RBAC)
 */
export function getAuthHeaders(): Record<string, string> {
  try {
    const session = getCurrentSession();
    if (session && session.user) {
      return {
        'x-user-role': session.user.role || 'operador',
        'x-user-username': session.user.username || '',
        'x-user-id': session.user.id || '',
      };
    }
  } catch {}
  return {};
}

/**
 * Encerra a sessão e registra o evento de LOGOUT
 */
export function logoutUser(reason: string = 'Logout manual'): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (raw) {
      const session: AuthSession = JSON.parse(raw);
      if (session && session.user) {
        // Envia requisição assíncrona para registrar o LOGOUT no servidor e na planilha
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: session.user.username,
            name: session.user.name,
            role: session.user.role,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            reason,
          }),
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('Erro ao registrar log de logout:', e);
  }

  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  } catch (e) {
    console.error('Erro ao encerrar sessão:', e);
  }
}

/**
 * Formata o tempo restante de sessão (ex: 7h 45m)
 */
export function formatRemainingSessionTime(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expirado';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

export interface DatabaseDiagnosticResult {
  success: boolean;
  status: 'connected' | 'disconnected' | 'fallback_local';
  type: 'postgres' | 'mysql' | 'json';
  provider: string;
  isRenderPostgres: boolean;
  latencyMs: number;
  tables?: {
    users: boolean;
    vehicle_records: boolean;
    access_logs: boolean;
    app_settings: boolean;
  };
  userCount: number;
  connectionUrlMasked: string;
  message: string;
  timestamp: string;
  activeUsers?: Array<{
    id: string;
    username: string;
    name: string;
    role: string;
    isActive: boolean;
    hasPassword: boolean;
  }>;
}

/**
 * Executa teste em tempo real de conectividade com o Banco de Dados PostgreSQL (Render) ou Fallback
 */
export async function checkDatabaseHealth(): Promise<DatabaseDiagnosticResult> {
  try {
    const res = await fetch('/api/db/diagnostic', {
      headers: {
        ...getAuthHeaders(),
      },
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      status: 'disconnected',
      type: 'json',
      provider: 'Servidor Offline / Inacessível',
      isRenderPostgres: false,
      latencyMs: 0,
      userCount: getAllUsers().length,
      connectionUrlMasked: 'Offline',
      message: `Falha na requisição ao servidor: ${err.message}`,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Permite configurar/alterar a URL do banco PostgreSQL em tempo de execução
 */
export async function configureDatabaseUrl(databaseUrl: string): Promise<{ success: boolean; message: string; diagnostic?: any }> {
  try {
    const res = await fetch('/api/db/configure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ databaseUrl }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao enviar URL para o servidor: ${err.message}`,
    };
  }
}

