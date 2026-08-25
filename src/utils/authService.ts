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

/**
 * Obtém todos os usuários do cache local de forma síncrona
 */
export function getAllUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      const initialList = [DEFAULT_MASTER_USER];
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
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    console.error('Erro ao ler usuários locais:', e);
    return [DEFAULT_MASTER_USER];
  }
}

/**
 * Busca a lista atualizada de usuários no servidor central (sincronização multi-dispositivo)
 */
export async function fetchServerUsers(): Promise<UserAccount[]> {
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        saveUsersList(data.users);
        return data.users;
      }
    }
  } catch (err) {
    console.warn('Não foi possível sincronizar usuários com o servidor:', err);
  }
  return getAllUsers();
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
  role: UserRole = 'operador'
): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
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

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUsername,
        name: name.trim(),
        password: password.trim(),
        role,
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
 * Exclui um usuário no servidor central
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
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

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, password: password.trim() }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.session) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(data.session));
      if (Array.isArray(data.users)) {
        saveUsersList(data.users);
      }
      return { success: true, session: data.session };
    } else if (res.status === 401 || (data && data.error)) {
      return { success: false, error: data.error || 'Usuário / Matrícula ou senha incorretos.' };
    }
  } catch (netErr) {
    console.warn('Servidor offline ou inacessível no momento, tentando autenticação local:', netErr);
  }

  // Fallback offline local
  const users = getAllUsers();
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
 * Encerra a sessão
 */
export function logoutUser(): void {
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
