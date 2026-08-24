import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export interface GoogleDriveConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  userEmail: string | null;
  autoSync: boolean;
}

const STORAGE_KEYS = {
  TOKEN: 'cmdit_google_access_token',
  TOKEN_EXPIRES: 'cmdit_google_token_expires',
  CONFIG: 'cmdit_google_drive_config',
};

// Initialize Firebase App
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory token cache
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Fallback to local token if available
        const local = getCachedGoogleToken();
        if (local) {
          cachedAccessToken = local;
          if (onAuthSuccess) onAuthSuccess(user, local);
        } else if (onAuthFailure) {
          onAuthFailure();
        }
      }
    } else {
      cachedAccessToken = null;
      clearGoogleToken();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Get cached access token if valid
 */
export function getCachedGoogleToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES) || '0');
    if (token && expiresAt > Date.now() + 60000) {
      cachedAccessToken = token;
      return token;
    }
  } catch (err) {
    console.warn('Error reading token:', err);
  }
  return null;
}

/**
 * Save access token locally
 */
export function saveGoogleToken(token: string, expiresInSeconds: number = 3500) {
  cachedAccessToken = token;
  try {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(
      STORAGE_KEYS.TOKEN_EXPIRES,
      String(Date.now() + expiresInSeconds * 1000)
    );
  } catch (err) {
    console.warn('Error saving token:', err);
  }
}

/**
 * Clear stored token
 */
export function clearGoogleToken() {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES);
  } catch (err) {
    console.warn('Error clearing token:', err);
  }
}

export const DEFAULT_SPREADSHEET_ID = '1c9pfD6quOeMQLdTZEmR-QcQu-cZzvi68SyT6jZJWgnI';
export const DEFAULT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1c9pfD6quOeMQLdTZEmR-QcQu-cZzvi68SyT6jZJWgnI/edit';

/**
 * Get stored Google Drive config
 */
export function getStoredDriveConfig(): GoogleDriveConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.spreadsheetId) return parsed;
    }
  } catch (err) {
    console.warn('Error reading drive config:', err);
  }
  return {
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    spreadsheetUrl: DEFAULT_SPREADSHEET_URL,
    userEmail: null,
    autoSync: true,
  };
}

/**
 * Save Google Drive config
 */
export function saveDriveConfig(config: Partial<GoogleDriveConfig>) {
  try {
    const current = getStoredDriveConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Error saving drive config:', err);
    return getStoredDriveConfig();
  }
}

/**
 * Request Google OAuth token via Firebase Popup
 */
export async function requestGoogleAccessToken(): Promise<string> {
  const existing = getCachedGoogleToken();
  if (existing) return existing;

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Google.');
    }

    const token = credential.accessToken;
    saveGoogleToken(token, 3600);

    if (result.user.email) {
      saveDriveConfig({ userEmail: result.user.email });
    }

    return token;
  } catch (err: any) {
    console.error('Sign in error:', err);
    if (err.code === 'auth/popup-closed-by-user') {
      throw new Error('Login cancelado. A janela de autorização do Google foi fechada.');
    }
    if (err.code === 'auth/cancelled-popup-request') {
      throw new Error('Solicitação de autorização cancelada.');
    }
    throw new Error(err.message || 'Erro ao autenticar com conta Google.');
  } finally {
    isSigningIn = false;
  }
}

export async function logoutGoogleAuth(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Signout error:', e);
  }
  clearGoogleToken();
}

/**
 * Create new 5-tab fleet spreadsheet in user's Drive
 */
export async function createDriveSpreadsheet(accessToken: string): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
}> {
  const resp = await fetch('/api/sheets/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(data.error || 'Falha ao criar planilha.');
  }

  saveDriveConfig({
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
  });

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
  };
}

/**
 * Send vehicle record to Google Sheets
 */
export async function appendRecordToGoogleSheets(
  spreadsheetId: string,
  record: any,
  accessToken: string
): Promise<{ success: boolean; tabName: string }> {
  const resp = await fetch('/api/sheets/append', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      spreadsheetId,
      record,
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(data.error || 'Falha ao gravar na planilha.');
  }

  return {
    success: true,
    tabName: data.tabName,
  };
}

/**
 * Initialize all 4 official tabs in the linked Google Sheet
 */
export async function initSpreadsheetTabs(
  spreadsheetId: string,
  accessToken: string
): Promise<{ success: boolean; tabs: string[] }> {
  const resp = await fetch('/api/sheets/init-tabs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      spreadsheetId,
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(data.error || 'Falha ao estruturar abas da planilha.');
  }

  return {
    success: true,
    tabs: data.tabs,
  };
}


