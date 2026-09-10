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
import { getAuthHeaders, getCurrentSession } from './authService';

export interface GoogleDriveConfig {
  webhookUrl: string | null;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  spreadsheetTitle?: string | null;
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

// Helper to extract Google Spreadsheet ID from any URL or raw ID
export function extractSpreadsheetId(input: string | null | undefined): string | null {
  if (!input) return null;
  const str = input.trim();
  if (!str) return null;

  // Match /spreadsheets/d/{ID}/ or /file/d/{ID}/ or ?id={ID}
  const match = str.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/i) ||
                str.match(/\/file\/d\/([a-zA-Z0-9-_]{20,})/i) ||
                str.match(/[?&]id=([a-zA-Z0-9-_]{20,})/i) ||
                str.match(/\/open\?id=([a-zA-Z0-9-_]{20,})/i);
  if (match && match[1]) {
    return match[1];
  }

  // If it is a raw ID string without slashes
  if (/^[a-zA-Z0-9-_]{25,60}$/.test(str)) {
    return str;
  }

  return null;
}

// Helper to normalize any spreadsheet input into a full valid URL
export function normalizeSpreadsheetUrl(urlOrId: string | null | undefined): string | null {
  if (!urlOrId) return null;
  const id = extractSpreadsheetId(urlOrId);
  if (id) {
    return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  }
  if (urlOrId.startsWith('http://') || urlOrId.startsWith('https://')) {
    return urlOrId.trim();
  }
  return null;
}

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Sync global server drive configuration on startup
  fetchServerDriveConfig();

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

export const DEFAULT_SPREADSHEET_ID = '';
export const DEFAULT_SPREADSHEET_URL = '';

/**
 * Get stored Google Drive config (local cache)
 */
export function getStoredDriveConfig(): GoogleDriveConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      const sId = parsed.spreadsheetId || extractSpreadsheetId(parsed.spreadsheetUrl);
      const sUrl = parsed.spreadsheetUrl || (sId ? `https://docs.google.com/spreadsheets/d/${sId}/edit` : null);
      return {
        webhookUrl: parsed.webhookUrl || parsed.sheetsWebhookUrl || null,
        spreadsheetId: sId || null,
        spreadsheetUrl: sUrl || null,
        spreadsheetTitle: parsed.spreadsheetTitle || 'Planilha Oficial CMDIT',
        userEmail: parsed.userEmail || null,
        autoSync: parsed.autoSync !== false,
      };
    }
  } catch (err) {
    console.warn('Error reading drive config:', err);
  }
  return {
    webhookUrl: null,
    spreadsheetId: null,
    spreadsheetUrl: null,
    spreadsheetTitle: 'Planilha Oficial CMDIT',
    userEmail: null,
    autoSync: true,
  };
}

/**
 * Get the exact official Google Spreadsheet URL to open
 */
export function getOfficialSpreadsheetUrl(): string | null {
  const config = getStoredDriveConfig();
  if (config.spreadsheetUrl) return config.spreadsheetUrl;
  if (config.spreadsheetId) return `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`;
  return null;
}

/**
 * Fetch centralized Sheets configuration from Server (Shared across all phones)
 */
export async function fetchServerDriveConfig(): Promise<GoogleDriveConfig> {
  try {
    const res = await fetch('/api/settings/sheets');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.settings) {
        const current = getStoredDriveConfig();
        const serverUrl = data.settings.spreadsheetUrl || (data.settings.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${data.settings.spreadsheetId}/edit` : null);
        const serverId = data.settings.spreadsheetId || extractSpreadsheetId(serverUrl);
        const updated: GoogleDriveConfig = {
          ...current,
          webhookUrl: data.settings.sheetsWebhookUrl || current.webhookUrl || null,
          spreadsheetId: serverId || current.spreadsheetId || null,
          spreadsheetUrl: serverUrl || current.spreadsheetUrl || null,
          spreadsheetTitle: data.settings.spreadsheetTitle || current.spreadsheetTitle || 'Planilha Oficial CMDIT',
          autoSync: data.settings.autoSync !== undefined ? data.settings.autoSync : current.autoSync,
        };
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
        return updated;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch server drive settings:', err);
  }
  return getStoredDriveConfig();
}

/**
 * Save Google Drive config locally and sync with Central Server
 */
export function saveDriveConfig(config: Partial<GoogleDriveConfig>): GoogleDriveConfig {
  const current = getStoredDriveConfig();
  
  // Normalize spreadsheetId and spreadsheetUrl
  let sUrl = config.spreadsheetUrl !== undefined ? config.spreadsheetUrl : current.spreadsheetUrl;
  let sId = config.spreadsheetId !== undefined ? config.spreadsheetId : current.spreadsheetId;

  if (sUrl) {
    const extractedId = extractSpreadsheetId(sUrl);
    if (extractedId) {
      sId = extractedId;
      sUrl = `https://docs.google.com/spreadsheets/d/${extractedId}/edit`;
    }
  } else if (sId) {
    sUrl = `https://docs.google.com/spreadsheets/d/${sId}/edit`;
  }

  const updated: GoogleDriveConfig = {
    ...current,
    ...config,
    spreadsheetId: sId || null,
    spreadsheetUrl: sUrl || null,
  };
  
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving drive config locally:', err);
  }

  // Push to server for global synchronization across all devices
  fetch('/api/settings/sheets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      sheetsWebhookUrl: updated.webhookUrl,
      spreadsheetId: updated.spreadsheetId,
      spreadsheetUrl: updated.spreadsheetUrl,
      spreadsheetTitle: updated.spreadsheetTitle,
      autoSync: updated.autoSync,
    }),
  }).catch((err) => console.warn('Could not sync settings to server:', err));

  return updated;
}

/**
 * Test Google Apps Script Webhook
 */
export async function testWebhookUrl(
  webhookUrl: string,
  operationType: string = 'entrada'
): Promise<{ success: boolean; message: string; tabName?: string; spreadsheetUrl?: string; spreadsheetId?: string; spreadsheetTitle?: string }> {
  const res = await fetch('/api/sheets/test-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl, operationType }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Falha ao testar comunicação com a planilha.');
  }

  if (data.spreadsheetUrl || data.spreadsheetId) {
    saveDriveConfig({
      spreadsheetUrl: data.spreadsheetUrl,
      spreadsheetId: data.spreadsheetId,
      spreadsheetTitle: data.spreadsheetTitle,
      webhookUrl,
    });
  }

  return {
    success: true,
    message: data.message || 'Webhook conectado com sucesso!',
    tabName: data.tabName,
    spreadsheetUrl: data.spreadsheetUrl,
    spreadsheetId: data.spreadsheetId,
    spreadsheetTitle: data.spreadsheetTitle,
  };
}

/**
 * Request Google OAuth token via Firebase Popup (Apenas Master se desejar)
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
 * Create new 5-tab fleet spreadsheet in user's Drive (Master only)
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
 * Send vehicle record to Google Sheets (UNIVERSAL: No user login needed on operator phones!)
 */
export async function appendRecordToGoogleSheets(
  spreadsheetIdOrRecord: string | any,
  recordPayload?: any,
  accessToken?: string
): Promise<{ success: boolean; tabName: string; method?: string; message?: string; spreadsheetUrl?: string; spreadsheetId?: string }> {
  let record = recordPayload;
  let spreadsheetId: string | undefined = undefined;

  if (typeof spreadsheetIdOrRecord === 'string') {
    spreadsheetId = spreadsheetIdOrRecord;
  } else if (spreadsheetIdOrRecord && typeof spreadsheetIdOrRecord === 'object') {
    record = spreadsheetIdOrRecord;
  }

  const driveConfig = getStoredDriveConfig();
  const activeSpreadsheetId = spreadsheetId || driveConfig.spreadsheetId;

  const resp = await fetch('/api/sheets/append-record', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      record,
      spreadsheetId: activeSpreadsheetId,
      webhookUrl: driveConfig.webhookUrl,
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(data.error || 'Falha ao gravar na planilha.');
  }

  if (data.spreadsheetUrl || data.spreadsheetId) {
    saveDriveConfig({
      spreadsheetUrl: data.spreadsheetUrl,
      spreadsheetId: data.spreadsheetId,
      spreadsheetTitle: data.spreadsheetTitle,
    });
  }

  return {
    success: true,
    tabName: data.tabName || 'Planilha',
    method: data.method,
    message: data.message,
    spreadsheetUrl: data.spreadsheetUrl,
    spreadsheetId: data.spreadsheetId,
  };
}

/**
 * Fetch spreadsheet directly via backend proxy / view-raw
 */
export async function fetchSpreadsheetDirectly(webhookUrl?: string): Promise<{
  success: boolean;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
  tabs?: Record<string, { name: string; headers: string[]; rows: any[] }>;
  error?: string;
}> {
  try {
    const config = getStoredDriveConfig();
    const targetUrl = webhookUrl || config.webhookUrl || config.spreadsheetUrl;
    const resp = await fetch('/api/sheets/view-raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: targetUrl }),
    });
    const text = await resp.text();
    try {
      const data = JSON.parse(text);
      return data;
    } catch {
      return {
        success: false,
        error: 'O servidor retornou uma resposta não-JSON. Certifique-se de configurar o Webhook do Google Apps Script.',
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao consultar planilha.' };
  }
}

/**
 * Fetch comprehensive diagnostic directly from server
 */
export async function fetchSheetDiagnostic(webhookUrl?: string): Promise<{
  success: boolean;
  diagnostic?: {
    testedAt: string;
    webhookConfigured: boolean;
    webhookUrl?: string;
    spreadsheetUrl?: string;
    appUsersCount: number;
    sheetUsersCount: number;
    webhookOk: boolean;
    hasUserTab: boolean;
    userTabHeaders: string[];
    colWhatsappName: string;
    colPasswordName: string;
    status: 'perfect' | 'needs_sync' | 'unreachable';
    details: string;
  };
  error?: string;
}> {
  try {
    const config = getStoredDriveConfig();
    const targetUrl = webhookUrl || config.webhookUrl || config.spreadsheetUrl;
    const resp = await fetch('/api/sheets/diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: targetUrl }),
    });
    const text = await resp.text();
    try {
      const data = JSON.parse(text);
      return data;
    } catch {
      return {
        success: false,
        error: 'O servidor retornou uma resposta não-JSON.',
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao consultar diagnóstico.' };
  }
}

export function getAppsScriptTemplateCode(): string {
  return GOOGLE_APPS_SCRIPT_TEMPLATE;
}

/**
 * Template de Script do Google Apps Script para copiar e colar na planilha
 * Consolidação completa: Todas as abas na MESMA planilha oficial única:
 * - 📋 INVENTÁRIO (6 colunas): A: Data, B: Hora, C: Placa, D: Local, E: Observação (contendo o Local obrigatório e detalhes adicionais de Combustível/KM), F: Operador
 * - 🔍 Qualidade 51 (8 colunas): A: Data, B: Hora, C: Placa, D: Condutor, E: Característica do Veículo, F: Nível Combustível, G: Destino/Local (P1, P2, P3, R1, ADM), H: Operador do Registro
 * - 🔄 Movimentação (9 colunas): A: Data, B: Hora, C: Placa, D: Origem, E: Destino, F: Observação, G: Combustível, H: KM Odômetro, I: Operador
 * - 📥 Entrada (13 colunas): Data, Hora, Placa, Condutor, KM odômetro, Nível Combustível, Origem, Destino, Chave reserva, Tipo veículo, Foto Doc, Observação, Operador
 * - 📤 Saída (12 colunas): Data, Hora, Placa, Condutor, KM odômetro, Nível Combustível, Destino, Chave reserva, Foto Doc, Tipo veículo, Observação, Operador
 * - ⛽ Combustível (11 colunas): Data, Hora, Placa, KM odômetro, Nível Combustível, Condutor, Destino, Observação, Tipo Combustível, Litros, Operador
 * - 📋 Fila PDC (6 colunas): Data, Hora, Placa, Nível Combustível, Observação, Condutor/Operador
 * - 👥 USUARIOS_CMDIT (7 colunas): Data e Hora, Matrícula, Nome, Senha, WhatsApp, Status, Último Acesso
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// ============================================================================
// SCRIPT DE GRAVAÇÃO AUTOMÁTICA OFICIAL UNIFICADA - CMDIT CONTROLE DE PÁTIO
// ============================================================================
// 1. Abra sua Planilha Google Oficial > Menu superior "Extensões" > "Apps Script"
// 2. Apague tudo o que estiver lá, cole este código completo e salve (Ctrl+S)
// 3. Clique em "Implantar" > "Nova implantação" (ou "Gerenciar implantações" > Editar > "Nova versão")
// 4. Tipo: "Aplicativo da Web"
// 5. Executar como: "Eu" | Quem pode acessar: "Qualquer pessoa"
// 6. Clique em "Implantar", copie a URL gerada e cole no Painel Master do app
// ============================================================================

var TAB_CONFIGS = {
  movimentacao: {
    tabName: "MOVIMENTAÇÃO",
    headers: [
      "DATA",
      "HORA",
      "PLACA",
      "ORIGEM",
      "DESTINO",
      "OBSERVAÇÃO",
      "COMBUSTIVEL",
      "KM ODOMETRO",
      "OPERADOR"
    ]
  },
  entrada: {
    tabName: "ENTRADAS",
    headers: [
      "DATA",
      "HORA",
      "PLACA",
      "CONDUTOR",
      "KM(ODOMETRO)",
      "NIVEL DO COMBUSTIVEL",
      "ORIGEM",
      "DESTINO",
      "CHAVE RESERVA",
      "TIPO DE VEICULO(RAC, GF, LQV, OUTROS)",
      "FOTO DO DOCUMENTO",
      "OBSERVAÇÕES",
      "OPERADOR DO REGISTRO"
    ]
  },
  saida: {
    tabName: "SAIDA",
    headers: [
      "DATA",
      "HORA",
      "PLACA",
      "CONDUTOR",
      "KM(ODOMETRO)",
      "NIVEL DO COMBUSTIVEL",
      "DESTINO",
      "CHAVE RESERVA",
      "FOTO DO DOCUMENTO",
      "TIPO DE VEICULO(RAC, GF, LQV, OUTROS)",
      "OBSERVAÇÕES",
      "OPERADOR DO REGISTRO"
    ]
  },
  qualidade: {
    tabName: "QUALIDADE 51",
    headers: [
      "DATA",
      "HORA",
      "PLACA",
      "CONDUTOR",
      "CARACTERISTICAS DO VEICULO",
      "NIVEL DO COMBUSTIVEL",
      "DESTINO(P1, P2, P3, R1, ADM)",
      "OPERADOR DO REGISTRO"
    ]
  },
  combustivel: {
    tabName: "COMBUSTIVEL",
    headers: [
      "DATA",
      "HORA",
      "PLACA",
      "KM ODOMETRO",
      "NIVEL DO COMBUSTIVEL",
      "CONDUTOR",
      "DESTINO",
      "OBSERVAÇÕES",
      "TIPO DE COMBUSTIVEL",
      "LITROS ABASTECIDOS",
      "OPERADOR DO REGISTRO"
    ]
  },
  pdc: {
    tabName: "Fila PDC",
    headers: [
      "DATA",
      "HORA",
      "PLACA",
      "NIVEL DO COMBUSTIVEL",
      "OBSERVAÇÕES",
      "CONDUTOR(OPERADOR DO REGISTRO)"
    ]
  },
  inventario: {
    tabName: "INVENTÁRIO",
    headers: [
      "DATA",
      "HORA",
      "PLACA",
      "LOCAL",
      "OBSERVAÇÃO",
      "COMBUSTIVEL",
      "KM ODOMETRO",
      "OPERADOR"
    ]
  }
};

// 7 Colunas Oficiais da Aba de Usuários:
// Coluna A: HORA E DATA DE CRIAÇÃO DO USUARIO
// Coluna B: MATRICULA/USUARIO
// Coluna C: NOME DO USUARIO
// Coluna D: SENHA
// Coluna E: WHATSAPP
// Coluna F: STATUS
// Coluna G: ULTIMO ACESSO
var TAB_USUARIOS = {
  tabName: "USUARIOS_CMDIT",
  headers: [
    "HORA E DATA DE CRIAÇÃO DO USUARIO",
    "MATRICULA/USUARIO",
    "NOME DO USUARIO",
    "SENHA",
    "WHATSAPP",
    "STATUS",
    "ULTIMO ACESSO"
  ]
};

var TAB_LOGS = {
  tabName: "LOGS_ACESSO",
  headers: [
    "DATA / HORA",
    "EVENTO",
    "MATRÍCULA / USUÁRIO",
    "NOME COMPLETO",
    "FUNÇÃO / CARGO",
    "WHATSAPP / CONTATO",
    "DISPOSITIVO / NAVEGADOR",
    "OBSERVAÇÕES / DETALHES"
  ]
};

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sUrl = ss.getUrl();
    var sId = ss.getId();
    var sTitle = ss.getName();

    // ------------------------------------------------------------------------
    // 0. AÇÃO: TESTE / INICIALIZAR TODAS AS 6 ABAS OFICIAIS NA MESMA PLANILHA
    // ------------------------------------------------------------------------
    if (data.action === 'init_all_tabs' || data.action === 'test') {
      var tabKeys = Object.keys(TAB_CONFIGS);
      for (var t = 0; t < tabKeys.length; t++) {
        var cfg = TAB_CONFIGS[tabKeys[t]];
        var existing = null;
        for (var s = 0; s < ss.getSheets().length; s++) {
          var curName = ss.getSheets()[s].getName().toLowerCase();
          if (curName.indexOf(tabKeys[t]) !== -1 || curName === cfg.tabName.toLowerCase()) {
            existing = ss.getSheets()[s];
            break;
          }
        }
        if (!existing) {
          existing = ss.insertSheet(cfg.tabName);
          existing.appendRow(cfg.headers);
          var hRange = existing.getRange(1, 1, 1, cfg.headers.length);
          hRange.setFontWeight("bold");
          hRange.setBackground("#0f172a");
          hRange.setFontColor("#ffffff");
        }
      }

      // Garante a aba de Usuários com as 7 colunas oficiais
      var uSheetFound = null;
      for (var u = 0; u < ss.getSheets().length; u++) {
        if (ss.getSheets()[u].getName().toUpperCase().indexOf("USUARIOS") !== -1) {
          uSheetFound = ss.getSheets()[u];
          break;
        }
      }
      if (!uSheetFound) {
        var uNew = ss.insertSheet(TAB_USUARIOS.tabName);
        uNew.appendRow(TAB_USUARIOS.headers);
        var uHRange = uNew.getRange(1, 1, 1, TAB_USUARIOS.headers.length);
        uHRange.setFontWeight("bold");
        uHRange.setBackground("#0f172a");
        uHRange.setFontColor("#ffffff");
      } else {
        var uHRangeFix = uSheetFound.getRange(1, 1, 1, TAB_USUARIOS.headers.length);
        uHRangeFix.setValues([TAB_USUARIOS.headers]);
        uHRangeFix.setFontWeight("bold");
        uHRangeFix.setBackground("#0f172a");
        uHRangeFix.setFontColor("#ffffff");
      }

      // Garante a aba de Logs de Acesso
      var lSheetFound = null;
      for (var l = 0; l < ss.getSheets().length; l++) {
        var sheetLName = ss.getSheets()[l].getName().toUpperCase();
        if (sheetLName.indexOf("LOG") !== -1 || sheetLName.indexOf("ACESSO") !== -1) {
          lSheetFound = ss.getSheets()[l];
          break;
        }
      }
      if (!lSheetFound) {
        var lNew = ss.insertSheet(TAB_LOGS.tabName);
        lNew.appendRow(TAB_LOGS.headers);
        var lHRange = lNew.getRange(1, 1, 1, TAB_LOGS.headers.length);
        lHRange.setFontWeight("bold");
        lHRange.setBackground("#0f172a");
        lHRange.setFontColor("#ffffff");
      } else {
        var lHRangeFix = lSheetFound.getRange(1, 1, 1, TAB_LOGS.headers.length);
        lHRangeFix.setValues([TAB_LOGS.headers]);
        lHRangeFix.setFontWeight("bold");
        lHRangeFix.setBackground("#0f172a");
        lHRangeFix.setFontColor("#ffffff");
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        spreadsheetUrl: sUrl,
        spreadsheetId: sId,
        spreadsheetTitle: sTitle,
        message: "Conexão oficial estabelecida com sucesso! Planilha: " + sTitle
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ------------------------------------------------------------------------
    // 1. GESTÃO E SINCRONIZAÇÃO DE USUÁRIOS (Aba USUARIOS_CMDIT - 7 Colunas)
    // ------------------------------------------------------------------------
    var isUserAction = data.action === 'save_user' || data.action === 'sync_user' ||
                       data.action === 'delete_user' || data.action === 'sync_all_users' ||
                       data.action === 'get_users' || data.type === 'user';

    if (isUserAction) {
      var uSheet = null;
      var allSheets = ss.getSheets();
      for (var s = 0; s < allSheets.length; s++) {
        var sheetNameUpper = allSheets[s].getName().toUpperCase();
        if (sheetNameUpper.indexOf("USUARIOS") !== -1 || sheetNameUpper.indexOf("USUÁRIOS") !== -1) {
          uSheet = allSheets[s];
          break;
        }
      }

      if (!uSheet) {
        uSheet = ss.insertSheet(TAB_USUARIOS.tabName);
        uSheet.appendRow(TAB_USUARIOS.headers);
        var uHeaderRange = uSheet.getRange(1, 1, 1, TAB_USUARIOS.headers.length);
        uHeaderRange.setFontWeight("bold");
        uHeaderRange.setBackground("#0f172a");
        uHeaderRange.setFontColor("#ffffff");
      } else {
        // AUTO-CORREÇÃO DE CABEÇALHOS:
        // Garante que a linha 1 contenha exatamente as 7 colunas oficiais:
        // 1: Data e Hora da criação do usuario | 2: Matricula/Usuario | 3: Nome do usuario | 4: Senha | 5: Whatsapp | 6: Status | 7: ultimo acesso
        var currentCols = Math.max(uSheet.getLastColumn(), TAB_USUARIOS.headers.length);
        var currentHeaders = uSheet.getRange(1, 1, 1, currentCols).getValues()[0];
        var col4Name = String(currentHeaders[3] || "").toUpperCase();
        var col5Name = String(currentHeaders[4] || "").toUpperCase();
        
        if (col4Name.indexOf("SENHA") === -1 || col5Name.indexOf("WHATS") === -1 || currentHeaders.length !== TAB_USUARIOS.headers.length) {
          var fixHRange = uSheet.getRange(1, 1, 1, TAB_USUARIOS.headers.length);
          fixHRange.setValues([TAB_USUARIOS.headers]);
          fixHRange.setFontWeight("bold");
          fixHRange.setBackground("#0f172a");
          fixHRange.setFontColor("#ffffff");
        }
      }

      var nowU = new Date();
      var dateU = Utilities.formatDate(nowU, "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");

      // A. Ação: Salvar / Atualizar Usuário Individual
      if (data.action === 'save_user' || data.action === 'sync_user' || data.user) {
        var targetUser = data.user || data;
        var uUsername = String(targetUser.username || "").toLowerCase().trim();
        var uName = String(targetUser.name || "").trim();
        var uPassword = String(targetUser.password || "").trim();
        var uWhatsapp = String(targetUser.whatsapp || targetUser.whats || targetUser.celular || targetUser.telefone || targetUser.contato || "").trim() || "-";
        var uStatus = targetUser.isActive === false || String(targetUser.isActive).toLowerCase() === "false" ? "BLOQUEADO" : "ATIVO";
        var uLastAccess = targetUser.lastLogin ? Utilities.formatDate(new Date(targetUser.lastLogin), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss") : "-";

        var uData = uSheet.getDataRange().getValues();
        var userRowIndex = -1;
        for (var r = 1; r < uData.length; r++) {
          if (String(uData[r][1]).toLowerCase().trim() === uUsername) {
            userRowIndex = r + 1;
            break;
          }
        }

        var uCreated = targetUser.createdAt ? Utilities.formatDate(new Date(targetUser.createdAt), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss") : dateU;
        // 7 Colunas Oficiais Solicitadas:
        // Col A (idx 0): HORA E DATA DE CRIAÇÃO DO USUARIO
        // Col B (idx 1): MATRICULA/USUARIO
        // Col C (idx 2): NOME DO USUARIO
        // Col D (idx 3): SENHA
        // Col E (idx 4): WHATSAPP
        // Col F (idx 5): STATUS
        // Col G (idx 6): ULTIMO ACESSO
        var rowValues = [
          uCreated,
          uUsername,
          uName,
          uPassword,
          uWhatsapp,
          uStatus,
          uLastAccess
        ];

        // Garante cabeçalhos da linha 1
        var hCheck = uSheet.getRange(1, 1, 1, TAB_USUARIOS.headers.length);
        hCheck.setValues([TAB_USUARIOS.headers]);
        hCheck.setFontWeight("bold");
        hCheck.setBackground("#0f172a");
        hCheck.setFontColor("#ffffff");

        if (userRowIndex !== -1) {
          uSheet.getRange(userRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
        } else {
          uSheet.appendRow(rowValues);
        }

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          spreadsheetUrl: sUrl,
          spreadsheetId: sId,
          spreadsheetTitle: sTitle,
          action: "save_user",
          username: uUsername,
          tabName: uSheet.getName(),
          whatsapp: uWhatsapp,
          hasPassword: !!uPassword,
          columnsCount: rowValues.length,
          message: "Usuário " + uName + " (" + uUsername + ") gravado na aba " + uSheet.getName() + " com 7 colunas oficiais (Senha na Coluna D)."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // B. Ação: Excluir Usuário
      if (data.action === 'delete_user') {
        var delUsername = String(data.username || "").toLowerCase().trim();
        var uDataDel = uSheet.getDataRange().getValues();
        var foundRow = -1;
        for (var d = 1; d < uDataDel.length; d++) {
          if (String(uDataDel[d][1]).toLowerCase().trim() === delUsername) {
            foundRow = d + 1;
            break;
          }
        }
        if (foundRow !== -1) {
          uSheet.deleteRow(foundRow);
        }
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          spreadsheetUrl: sUrl,
          spreadsheetId: sId,
          spreadsheetTitle: sTitle,
          action: "delete_user",
          username: delUsername,
          message: "Usuário excluído da aba " + uSheet.getName() + "."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // C. Ação: Sincronizar Todos os Usuários de uma vez
      if (data.action === 'sync_all_users' && Array.isArray(data.users)) {
        var usersList = data.users;

        // Atualiza a Linha 1 de cabeçalhos oficiais
        var hRangeAll = uSheet.getRange(1, 1, 1, TAB_USUARIOS.headers.length);
        hRangeAll.setValues([TAB_USUARIOS.headers]);
        hRangeAll.setFontWeight("bold");
        hRangeAll.setBackground("#0f172a");
        hRangeAll.setFontColor("#ffffff");

        // Limpa registros anteriores para reescrever limpo com 7 colunas
        var lastRow = uSheet.getLastRow();
        if (lastRow > 1) {
          uSheet.deleteRows(2, lastRow - 1);
        }

        var newRows = [];
        for (var uIdx = 0; uIdx < usersList.length; uIdx++) {
          var u = usersList[uIdx];
          var status = u.isActive === false ? "BLOQUEADO" : "ATIVO";
          var uWhats = String(u.whatsapp || u.whats || u.celular || u.telefone || u.contato || "").trim() || "-";
          var uPass = String(u.password || "").trim();
          var uCreated = u.createdAt ? Utilities.formatDate(new Date(u.createdAt), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss") : dateU;
          var uLastAcc = u.lastLogin ? Utilities.formatDate(new Date(u.lastLogin), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss") : "-";

          // 7 Colunas Oficiais Exatas:
          // Col A: Data e Hora da criação do usuario
          // Col B: Matricula/Usuario
          // Col C: Nome do usuario
          // Col D: Senha
          // Col E: Whatsapp
          // Col F: Status
          // Col G: ultimo acesso
          newRows.push([
            uCreated,
            String(u.username || "").toLowerCase().trim(),
            String(u.name || "").trim(),
            uPass,
            uWhats,
            status,
            uLastAcc
          ]);
        }

        if (newRows.length > 0) {
          uSheet.getRange(2, 1, newRows.length, TAB_USUARIOS.headers.length).setValues(newRows);
        }

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          spreadsheetUrl: sUrl,
          spreadsheetId: sId,
          spreadsheetTitle: sTitle,
          action: "sync_all_users",
          totalUsers: newRows.length,
          tabName: uSheet.getName(),
          columnsCount: TAB_USUARIOS.headers.length,
          message: "Todos os " + newRows.length + " usuários foram sincronizados com sucesso na aba " + uSheet.getName() + " com a estrutura oficial de 7 colunas (Senha na Coluna D e WhatsApp na Coluna E)!"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ------------------------------------------------------------------------
    // 1.1 AUDITORIA E LOGS DE ACESSO (Aba LOGS_ACESSO na mesma planilha)
    // ------------------------------------------------------------------------
    var isLogAction = data.action === 'log_access' || data.action === 'log_event' ||
                      data.action === 'append_log' || data.type === 'log';

    if (isLogAction) {
      var lSheet = null;
      var allSheetsLogs = ss.getSheets();
      for (var sl = 0; sl < allSheetsLogs.length; sl++) {
        var sNameLog = allSheetsLogs[sl].getName().toUpperCase();
        if (sNameLog.indexOf("LOG") !== -1 || sNameLog.indexOf("ACESSO") !== -1) {
          lSheet = allSheetsLogs[sl];
          break;
        }
      }

      if (!lSheet) {
        lSheet = ss.insertSheet(TAB_LOGS.tabName);
        lSheet.appendRow(TAB_LOGS.headers);
        var lHRange = lSheet.getRange(1, 1, 1, TAB_LOGS.headers.length);
        lHRange.setFontWeight("bold");
        lHRange.setBackground("#0f172a");
        lHRange.setFontColor("#ffffff");
      }

      var targetLog = data.log || data;
      var nowL = new Date();
      var dateL = targetLog.dateFormatted || Utilities.formatDate(nowL, "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
      var lEvent = String(targetLog.event || "LOGIN").toUpperCase();
      var lUsername = String(targetLog.username || "").toLowerCase().trim();
      var lName = String(targetLog.name || targetLog.username || "").trim();
      var lRole = String(targetLog.role || "operador").trim();
      var lWhatsapp = String(targetLog.whatsapp || targetLog.whats || targetLog.celular || "-").trim() || "-";
      var lDevice = String(targetLog.userAgent || targetLog.deviceType || targetLog.ip || "Navegador Web").trim();
      var lDetails = String(targetLog.details || "-").trim();

      var roleLabelsLog = {
        master: "👑 Administrador Master",
        patio: "📋 Operador do Pátio",
        qualidade_51: "🔍 Operador 51 Qualidade",
        pdc: "📋 Operador Fila PDC",
        combustivel: "⛽ Operador Combustível",
        entrada_saida: "🚪 Operador Entrada/Saída",
        vistoriador: "🔍 Vistoriador",
        motorista: "🚗 Motorista"
      };
      var lRoleLabel = roleLabelsLog[lRole] || lRole.toUpperCase();

      var logRow = [
        dateL,
        lEvent,
        lUsername,
        lName,
        lRoleLabel,
        lWhatsapp,
        lDevice,
        lDetails
      ];

      // Inserção no topo (Linha 2, logo abaixo do cabeçalho)
      lSheet.insertRowAfter(1);
      var logTargetRange = lSheet.getRange(2, 1, 1, logRow.length);
      logTargetRange.setValues([logRow]);
      logTargetRange.setFontWeight("normal");
      logTargetRange.setBackground(null);
      logTargetRange.setFontColor("#000000");

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        spreadsheetUrl: sUrl,
        spreadsheetId: sId,
        spreadsheetTitle: sTitle,
        action: "log_access",
        event: lEvent,
        username: lUsername,
        tabName: lSheet.getName(),
        message: "Log de acesso registrado na aba " + lSheet.getName() + "!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ------------------------------------------------------------------------
    // 1.2 EXCLUSÃO DE QUALQUER GRAVAÇÃO (Planilha: Inventário, Movimentação, Registros Pátio)
    // ------------------------------------------------------------------------
    var isDeleteAction = data.action === 'delete_row' || data.action === 'delete_record' ||
                         data.action === 'delete_movement' || data.action === 'delete_inventory';

    if (isDeleteAction) {
      var targetPlate = String(data.plate || data.placa || '').toUpperCase().trim();
      var targetDate = String(data.dateFormatted || data.data || '').trim();
      var targetTime = String(data.timeFormatted || data.hora || '').trim();
      var targetCategory = String(data.operationType || data.operation || data.tab || data.category || '').toLowerCase().trim();
      var specificTabName = data.targetTabName ? String(data.targetTabName).toUpperCase().trim() : '';

      var sheetsToSearch = [];
      var allSheetsDel = ss.getSheets();

      if (specificTabName) {
        for (var sIdx = 0; sIdx < allSheetsDel.length; sIdx++) {
          if (allSheetsDel[sIdx].getName().toUpperCase().trim() === specificTabName) {
            sheetsToSearch.push(allSheetsDel[sIdx]);
            break;
          }
        }
      }

      if (sheetsToSearch.length === 0 && targetCategory) {
        var mappedConfig = TAB_CONFIGS[targetCategory];
        var mappedName = mappedConfig ? mappedConfig.tabName.toUpperCase() : '';
        for (var sIdx2 = 0; sIdx2 < allSheetsDel.length; sIdx2++) {
          var curSName = allSheetsDel[sIdx2].getName().toUpperCase();
          if (mappedName && curSName.indexOf(mappedName) !== -1) {
            sheetsToSearch.push(allSheetsDel[sIdx2]);
            break;
          }
        }
      }

      if (sheetsToSearch.length === 0) {
        sheetsToSearch = allSheetsDel;
      }

      var deletedCount = 0;
      var deletedFromTab = '';
      var deletedRowIndex = -1;

      for (var sh = 0; sh < sheetsToSearch.length; sh++) {
        var curSheet = sheetsToSearch[sh];
        var sheetName = curSheet.getName();
        if (sheetName.indexOf('Visão Geral') !== -1 || sheetName.indexOf('LOG') !== -1) continue;

        var dataValues = curSheet.getDataRange().getValues();
        if (dataValues.length <= 1) continue;

        var headersRow = dataValues[0];
        var plateColIdx = -1;
        var dateColIdx = -1;
        var timeColIdx = -1;

        for (var h = 0; h < headersRow.length; h++) {
          var hName = String(headersRow[h] || '').toUpperCase();
          if (hName.indexOf('PLACA') !== -1 || hName.indexOf('VEICULO') !== -1) {
            plateColIdx = h;
          } else if (hName.indexOf('DATA') !== -1) {
            dateColIdx = h;
          } else if (hName.indexOf('HORA') !== -1) {
            timeColIdx = h;
          }
        }
        if (plateColIdx === -1) plateColIdx = 2;

        var cleanTargetPlate = targetPlate.replace(/[^A-Z0-9]/g, '');

        for (var r = 1; r < dataValues.length; r++) {
          var rowPlate = String(dataValues[r][plateColIdx] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

          if (cleanTargetPlate && rowPlate === cleanTargetPlate) {
            var matchDate = true;
            var matchTime = true;

            if (targetDate && dateColIdx !== -1) {
              var rowDate = String(dataValues[r][dateColIdx] || '').trim();
              if (rowDate && rowDate !== targetDate) matchDate = false;
            }
            if (targetTime && timeColIdx !== -1) {
              var rowTime = String(dataValues[r][timeColIdx] || '').trim();
              if (rowTime && rowTime.substring(0, 5) !== targetTime.substring(0, 5)) matchTime = false;
            }

            if (matchDate && matchTime) {
              curSheet.deleteRow(r + 1);
              deletedCount++;
              deletedFromTab = sheetName;
              deletedRowIndex = r + 1;
              break;
            }
          }
        }

        if (deletedCount > 0) break;
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        action: data.action,
        deleted: deletedCount > 0,
        plate: targetPlate,
        tabName: deletedFromTab,
        rowIndex: deletedRowIndex,
        message: deletedCount > 0 
          ? ("Gravação da placa " + targetPlate + " excluída com sucesso da aba " + deletedFromTab + "!")
          : ("Registro da placa " + targetPlate + " processado.")
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ------------------------------------------------------------------------
    // 1.3 ALTERAÇÃO DE QUALQUER GRAVAÇÃO (Planilha: Inventário, Movimentação, Registros Pátio)
    // ------------------------------------------------------------------------
    var isUpdateAction = data.action === 'update_row' || data.action === 'update_record' ||
                         data.action === 'update_movement' || data.action === 'update_inventory';

    if (isUpdateAction) {
      var oldPlate = String(data.oldPlate || data.plate || data.placa || '').toUpperCase().trim();
      var newPlate = String(data.plate || data.placa || oldPlate).toUpperCase().trim();
      var specificTabNameU = data.targetTabName ? String(data.targetTabName).toUpperCase().trim() : '';
      var targetCategoryU = String(data.operationType || data.operation || data.tab || data.category || '').toLowerCase().trim();

      var sheetsToSearchU = [];
      var allSheetsUpd = ss.getSheets();

      if (specificTabNameU) {
        for (var su = 0; su < allSheetsUpd.length; su++) {
          if (allSheetsUpd[su].getName().toUpperCase().trim() === specificTabNameU) {
            sheetsToSearchU.push(allSheetsUpd[su]);
            break;
          }
        }
      }

      if (sheetsToSearchU.length === 0 && targetCategoryU) {
        var mappedConfigU = TAB_CONFIGS[targetCategoryU];
        var mappedNameU = mappedConfigU ? mappedConfigU.tabName.toUpperCase() : '';
        for (var su2 = 0; su2 < allSheetsUpd.length; su2++) {
          var curUName = allSheetsUpd[su2].getName().toUpperCase();
          if (mappedNameU && curUName.indexOf(mappedNameU) !== -1) {
            sheetsToSearchU.push(allSheetsUpd[su2]);
            break;
          }
        }
      }

      if (sheetsToSearchU.length === 0) {
        sheetsToSearchU = allSheetsUpd;
      }

      var updatedCount = 0;
      var updatedTab = '';
      var updatedRowIndex = -1;

      for (var shu = 0; shu < sheetsToSearchU.length; shu++) {
        var uTargetSheet = sheetsToSearchU[shu];
        var uSheetName = uTargetSheet.getName();
        if (uSheetName.indexOf('Visão Geral') !== -1 || uSheetName.indexOf('LOG') !== -1) continue;

        var uDataValues = uTargetSheet.getDataRange().getValues();
        if (uDataValues.length <= 1) continue;

        var uHeaders = uDataValues[0];
        var uPlateCol = -1;
        for (var uh = 0; uh < uHeaders.length; uh++) {
          var uhText = String(uHeaders[uh] || '').toUpperCase();
          if (uhText.indexOf('PLACA') !== -1 || uhText.indexOf('VEICULO') !== -1) {
            uPlateCol = uh;
            break;
          }
        }
        if (uPlateCol === -1) uPlateCol = 2;

        var cleanOldPlate = oldPlate.replace(/[^A-Z0-9]/g, '');

        for (var ur = 1; ur < uDataValues.length; ur++) {
          var currPlate = String(uDataValues[ur][uPlateCol] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (cleanOldPlate && currPlate === cleanOldPlate) {
            var rowVals = uDataValues[ur];
            for (var c = 0; c < uHeaders.length; c++) {
              var colHeader = String(uHeaders[c] || '').toUpperCase();
              if (colHeader.indexOf('PLACA') !== -1 || colHeader.indexOf('VEICULO') !== -1) {
                rowVals[c] = newPlate;
              } else if (colHeader.indexOf('ORIGEM') !== -1 && (data.origin || data.origem)) {
                rowVals[c] = String(data.origin || data.origem).toUpperCase().trim();
              } else if ((colHeader.indexOf('DESTINO') !== -1 || colHeader.indexOf('LOCAL') !== -1) && (data.destination || data.destino || data.location || data.local)) {
                rowVals[c] = String(data.destination || data.destino || data.location || data.local).toUpperCase().trim();
              } else if ((colHeader.indexOf('OBS') !== -1 || colHeader.indexOf('NOTA') !== -1) && (data.observation || data.observacao || data.notes || data.description)) {
                rowVals[c] = String(data.observation || data.observacao || data.notes || data.description).trim();
              } else if ((colHeader.indexOf('KM') !== -1 || colHeader.indexOf('ODOMET') !== -1) && (data.km || data.odometer || data.odometro)) {
                rowVals[c] = String(data.km || data.odometer || data.odometro).replace(/\\s*km/i, '').trim() + " KM";
              } else if ((colHeader.indexOf('NIVEL') !== -1 || colHeader.indexOf('COMBUST') !== -1) && (data.fuelLevel || data.fuel || data.combustivel || data.nivelCombustivel)) {
                rowVals[c] = String(data.fuelLevel || data.fuel || data.combustivel || data.nivelCombustivel).toUpperCase().trim();
              } else if ((colHeader.indexOf('CONDUTOR') !== -1 || colHeader.indexOf('MOTORISTA') !== -1) && (data.driverName || data.condutor)) {
                rowVals[c] = String(data.driverName || data.condutor).toUpperCase().trim();
              } else if (colHeader.indexOf('OPERADOR') !== -1 && (data.operatorName || data.operador)) {
                rowVals[c] = String(data.operatorName || data.operador).toUpperCase().trim();
              }
            }

            uTargetSheet.getRange(ur + 1, 1, 1, rowVals.length).setValues([rowVals]);
            updatedCount++;
            updatedTab = uSheetName;
            updatedRowIndex = ur + 1;
            break;
          }
        }

        if (updatedCount > 0) break;
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        action: data.action,
        updated: updatedCount > 0,
        plate: newPlate,
        tabName: updatedTab,
        rowIndex: updatedRowIndex,
        message: updatedCount > 0 
          ? ("Gravação da placa " + newPlate + " alterada com sucesso na aba " + updatedTab + "!")
          : ("Registro da placa " + newPlate + " processado.")
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ------------------------------------------------------------------------
    // 2. GRAVAÇÃO DE REGISTRO VEICULAR NAS ABAS OFICIAIS
    // ------------------------------------------------------------------------
    var op = String(data.operationType || data.operationCategory || data.operation || data.tab || data.action || '').toLowerCase().trim();
    
    var tabCategory = "entrada";
    if (op === "saida" || op === "saída" || op.indexOf("said") !== -1) {
      tabCategory = "saida";
    } else if (op === "abastecimento" || op === "combustivel" || op === "combustível" || op.indexOf("abastec") !== -1 || op.indexOf("combust") !== -1) {
      tabCategory = "combustivel";
    } else if (op === "qualidade_51" || op === "qualidade51" || op === "qualidade" || op.indexOf("51") !== -1 || op.indexOf("qualidade") !== -1) {
      tabCategory = "qualidade";
    } else if (op === "pdc" || op.indexOf("pdc") !== -1 || op.indexOf("fila") !== -1) {
      tabCategory = "pdc";
    } else if (op === "movimentacao" || op === "movimentação" || op.indexOf("movimen") !== -1 || data.action === 'record_movement' || String(data.targetTabName || '').toUpperCase().indexOf("MOVIMEN") !== -1) {
      tabCategory = "movimentacao";
    } else if (op === "inventario" || op === "inventário" || op.indexOf("inventar") !== -1 || data.action === 'record_inventory' || String(data.targetTabName || '').toUpperCase().indexOf("INVENTAR") !== -1) {
      tabCategory = "inventario";
    }

    var activeConfig = TAB_CONFIGS[tabCategory] || TAB_CONFIGS.entrada;
    var tabName = activeConfig.tabName;
    var expectedHeaders = activeConfig.headers;

    // Busca inteligente da aba
    var sheet = null;
    var allSheets = ss.getSheets();

    // 1. Tenta pelo targetTabName exato primeiro se informado
    if (data.targetTabName) {
      var searchTarget = String(data.targetTabName).toUpperCase().trim();
      for (var i = 0; i < allSheets.length; i++) {
        if (allSheets[i].getName().toUpperCase().trim() === searchTarget) {
          sheet = allSheets[i];
          tabName = allSheets[i].getName();
          break;
        }
      }
    }

    // 2. Se não achou, busca pelas palavras-chave da categoria
    if (!sheet) {
      for (var i = 0; i < allSheets.length; i++) {
        var sName = allSheets[i].getName().toLowerCase();
        if (tabCategory === "saida" && (sName.indexOf("saida") !== -1 || sName.indexOf("saída") !== -1)) {
          sheet = allSheets[i];
          tabName = allSheets[i].getName();
          break;
        } else if (tabCategory === "combustivel" && (sName.indexOf("abastec") !== -1 || sName.indexOf("combust") !== -1 || sName.indexOf("posto") !== -1)) {
          sheet = allSheets[i];
          tabName = allSheets[i].getName();
          break;
        } else if (tabCategory === "qualidade" && (sName.indexOf("51") !== -1 || sName.indexOf("qualidade") !== -1)) {
          sheet = allSheets[i];
          tabName = allSheets[i].getName();
          break;
        } else if (tabCategory === "pdc" && (sName.indexOf("pdc") !== -1 || sName.indexOf("fila") !== -1)) {
          sheet = allSheets[i];
          tabName = allSheets[i].getName();
          break;
        } else if (tabCategory === "movimentacao" && (sName.indexOf("movimen") !== -1 || sName.indexOf("transfer") !== -1 || sName.indexOf("movimento") !== -1)) {
          sheet = allSheets[i];
          tabName = allSheets[i].getName();
          break;
        } else if (tabCategory === "inventario" && (sName.indexOf("inventar") !== -1 || sName.indexOf("confer") !== -1 || sName.indexOf("estoque") !== -1)) {
          sheet = allSheets[i];
          tabName = allSheets[i].getName();
          break;
        } else if (tabCategory === "entrada" && (sName.indexOf("entrada") !== -1 || sName.indexOf("chegada") !== -1)) {
          sheet = allSheets[i];
          tabName = allSheets[i].getName();
          break;
        }
      }
    }
    
    // Se a aba não existir, cria a aba com os cabeçalhos específicos
    if (!sheet) {
      if (allSheets.length === 1 && allSheets[0].getLastRow() === 0 && allSheets[0].getName().match(/^(Planilha1|Sheet1|Página1)$/i)) {
        sheet = allSheets[0];
        sheet.setName(tabName);
      } else {
        sheet = ss.insertSheet(tabName);
      }
      sheet.appendRow(expectedHeaders);
      var headerRange = sheet.getRange(1, 1, 1, expectedHeaders.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0f172a");
      headerRange.setFontColor("#ffffff");
    }
    
    // Data e Hora de São Paulo
    var now = new Date();
    var dateStr = Utilities.formatDate(now, "America/Sao_Paulo", "dd/MM/yyyy");
    var timeStr = Utilities.formatDate(now, "America/Sao_Paulo", "HH:mm:ss");
    
    // Função para formatar o nível do combustível
    var formatFuelLevel = function(f) {
      if (!f) return "-";
      var clean = String(f).trim();
      if (clean === "1/8" || clean === "1/8 (Reserva)") return "1/8 (RESERVA)";
      if (clean === "2/8" || clean === "2/8 (1/4)") return "2/8 (1/4)";
      if (clean === "3/8") return "3/8";
      if (clean === "4/8" || clean === "4/8 (1/2)") return "4/8 (1/2)";
      if (clean === "5/8") return "5/8";
      if (clean === "6/8" || clean === "6/8 (3/4)") return "6/8 (3/4)";
      if (clean === "7/8") return "7/8";
      if (clean === "8/8" || clean === "8/8 (Cheio)" || clean === "8/8 • Cheio" || clean === "Tanque Cheio") return "8/8 (CHEIO)";
      return String(clean).toUpperCase();
    };

    var extractCleanOperatorName = function(rawOp, rawLogin) {
      var opStr = String(rawOp || rawLogin || "OPERADOR").trim();
      opStr = opStr.replace(/\\(.*?\\)/g, '').replace(/\\[.*?\\]/g, '').trim();
      if (opStr.indexOf("@") !== -1) {
        opStr = opStr.split("@")[0].replace(/[._-]/g, ' ');
      }
      return opStr ? opStr.toUpperCase() : "OPERADOR";
    };

    var subObj = data.movement || data.inventory || data.record || {};
    var operador = extractCleanOperatorName(data.operatorName || data.operador || subObj.operatorName || subObj.operador, data.username);
    var condutor = String(data.driverName || data.condutor || data.motorista || subObj.driverName || subObj.condutor || "-").toUpperCase().trim();
    var placa = String(data.plate || data.placa || subObj.plate || subObj.placa || "").toUpperCase().trim();
    var origem = String(data.origin || data.origem || subObj.origin || subObj.origem || (tabCategory === "entrada" ? "PÁTIO PRINCIPAL" : "-")).toUpperCase().trim();

    var locInv = String(
      data.location || data.local || subObj.location || subObj.local || 
      data.destination || data.destino || subObj.destination || subObj.destino || ""
    ).toUpperCase().trim();

    // Local / Destino do veículo
    var locQualidade = String(
      (data.destination && data.destination !== "-") ? data.destination :
      (data.destino && data.destino !== "-") ? data.destino :
      (data.location && data.location !== "-") ? data.location :
      (data.local && data.local !== "-") ? data.local :
      "P1"
    ).toUpperCase().trim();

    var destino = String(
      tabCategory === "inventario" ? (locInv || "-") :
      tabCategory === "qualidade" ? locQualidade :
      (data.destination && data.destination !== "-") ? data.destination :
      (data.destino && data.destino !== "-") ? data.destino :
      (subObj.destination && subObj.destination !== "-") ? subObj.destination :
      (subObj.destino && subObj.destino !== "-") ? subObj.destino :
      (tabCategory === "pdc" ? "FILA PDC (LAVAGEM/OFICINA)" : (tabCategory === "entrada" ? "BOLSÃO 40" : "-"))
    ).toUpperCase().trim();

    var kmVal = data.km || data.odometro || data.odometer || subObj.km || subObj.odometro || subObj.odometer;
    var km = kmVal ? (String(kmVal).replace(/\\s*km/i, '').toUpperCase().trim() + " KM") : "-";
    var nivelCombustivel = formatFuelLevel(data.nivelCombustivel || data.fuel || data.combustivel || data.fuelLevel || subObj.fuelLevel || subObj.fuel || subObj.combustivel);
    
    var chaveReserva = "-";
    if (data.hasSpareKey === true || String(data.hasSpareKey).toLowerCase() === "true" || String(data.chaveReserva).toUpperCase() === "SIM") {
      chaveReserva = "SIM";
    } else if (data.hasSpareKey === false || String(data.hasSpareKey).toLowerCase() === "false" || String(data.chaveReserva).toUpperCase() === "NÃO") {
      chaveReserva = "NÃO";
    }

    var tipoVeiculo = String(data.fleetType || data.tipoVeiculo || data.tipo || subObj.fleetType || "GF").toUpperCase().trim();

    var rawChar = data.characteristic || data.caracteristica || data.tipoCaracteristica || "-";
    var caracteristica = String(rawChar).trim();
    if (caracteristica && caracteristica !== "-") {
      var charUpper = caracteristica.toUpperCase();
      if (charUpper.indexOf("DT") !== -1) caracteristica = "🟣 DT";
      else if (charUpper.indexOf("REVENDA") !== -1) caracteristica = "🟠 REVENDA";
      else if (charUpper.indexOf("CONSUMIDOR") !== -1) caracteristica = "🟢 CONSUMIDOR";
      else if (charUpper.indexOf("OUTROS") !== -1) caracteristica = "⚪ OUTROS";
    } else {
      caracteristica = "-";
    }

    var obsRaw = data.observation || data.observacao || data.observacoes || data.notes || data.description ||
                 subObj.observation || subObj.observacao || subObj.observacoes || subObj.notes || "";
    obsRaw = String(obsRaw).replace(/\\r?\\n/g, ' - ').trim();
    var observacoes = obsRaw || "-";

    var hasDoc = data.hasDocumentPhoto === true || String(data.hasDocumentPhoto).toLowerCase() === "true" || !!data.documentPhotoUrl;
    var fotoDoc = hasDoc ? "SIM (REGISTRADA)" : "NÃO";
    var tipoCombustivel = String(data.fuelType || data.tipoCombustivel || "DIESEL").toUpperCase().trim();
    var litrosAbastecidos = (data.liters !== undefined && data.liters !== null && String(data.liters).trim() !== "") ? (String(data.liters).replace(/\\s*l/i, '').toUpperCase().trim() + " L") : ((data.litros !== undefined && data.litros !== null && String(data.litros).trim() !== "") ? (String(data.litros).replace(/\\s*l/i, '').toUpperCase().trim() + " L") : "-");
    var condutorOuOperador = condutor && condutor !== "-" ? (condutor + " (" + operador + ")") : operador;

    var customRow = [];
    if (tabCategory === "entrada") {
      customRow = [
        dateStr,          // Col A: DATA
        timeStr,          // Col B: HORA
        placa,            // Col C: PLACA
        condutor,         // Col D: CONDUTOR
        km,               // Col E: KM(ODOMETRO)
        nivelCombustivel, // Col F: NIVEL DO COMBUSTIVEL
        origem,           // Col G: ORIGEM
        destino,          // Col H: DESTINO
        chaveReserva,     // Col I: CHAVE RESERVA
        tipoVeiculo,      // Col J: TIPO DE VEICULO(RAC, GF, LQV, OUTROS)
        fotoDoc,          // Col K: FOTO DO DOCUMENTO
        observacoes,      // Col L: OBSERVAÇÕES
        operador          // Col M: OPERADOR DO REGISTRO
      ];
    } else if (tabCategory === "saida") {
      customRow = [
        dateStr,          // Col A: DATA
        timeStr,          // Col B: HORA
        placa,            // Col C: PLACA
        condutor,         // Col D: CONDUTOR
        km,               // Col E: KM(ODOMETRO)
        nivelCombustivel, // Col F: NIVEL DO COMBUSTIVEL
        destino,          // Col G: DESTINO
        chaveReserva,     // Col H: CHAVE RESERVA
        fotoDoc,          // Col I: FOTO DO DOCUMENTO
        tipoVeiculo,      // Col J: TIPO DE VEICULO(RAC, GF, LQV, OUTROS)
        observacoes,      // Col K: OBSERVAÇÕES
        operador          // Col L: OPERADOR DO REGISTRO
      ];
    } else if (tabCategory === "qualidade") {
      customRow = [
        dateStr,          // Col A: DATA
        timeStr,          // Col B: HORA
        placa,            // Col C: PLACA
        condutor,         // Col D: CONDUTOR
        caracteristica,   // Col E: CARACTERISTICAS DO VEICULO
        nivelCombustivel, // Col F: NIVEL DO COMBUSTIVEL
        destino || locQualidade || "P1", // Col G: DESTINO (P1, P2, P3, R1, ADM, OUTROS)
        operador          // Col H: OPERADOR DO REGISTRO
      ];
    } else if (tabCategory === "combustivel") {
      customRow = [
        dateStr,          // Col A: DATA
        timeStr,          // Col B: HORA
        placa,            // Col C: PLACA
        km,               // Col D: KM ODOMETRO
        nivelCombustivel, // Col E: NIVEL DO COMBUSTIVEL
        condutor,         // Col F: CONDUTOR
        destino,          // Col G: DESTINO
        observacoes,      // Col H: OBSERVAÇÕES
        tipoCombustivel,  // Col I: TIPO DE COMBUSTIVEL
        litrosAbastecidos,// Col J: LITROS ABASTECIDOS
        operador          // Col K: OPERADOR DO REGISTRO
      ];
    } else if (tabCategory === "pdc") {
      customRow = [
        dateStr,          // Col A: DATA
        timeStr,          // Col B: HORA
        placa,            // Col C: PLACA
        nivelCombustivel, // Col D: NIVEL DO COMBUSTIVEL
        observacoes,      // Col E: OBSERVAÇÕES
        condutorOuOperador// Col F: CONDUTOR(OPERADOR DO REGISTRO)
      ];
    } else if (tabCategory === "movimentacao") {
      customRow = [
        dateStr,          // Col A: DATA
        timeStr,          // Col B: HORA
        placa,            // Col C: PLACA
        origem,           // Col D: ORIGEM
        destino,          // Col E: DESTINO
        observacoes,      // Col F: OBSERVAÇÃO
        nivelCombustivel, // Col G: COMBUSTIVEL
        km,               // Col H: KM ODOMETRO
        operador          // Col I: OPERADOR
      ];
    } else if (tabCategory === "inventario") {
      customRow = [
        dateStr,          // Col A: DATA
        timeStr,          // Col B: HORA
        placa,            // Col C: PLACA
        locInv || "-",    // Col D: LOCAL
        observacoes,      // Col E: OBSERVAÇÃO
        nivelCombustivel, // Col F: COMBUSTIVEL
        km,               // Col G: KM ODOMETRO
        operador          // Col H: OPERADOR
      ];
    }

    // Inserção no topo (Linha 2, logo abaixo do cabeçalho na Linha 1)
    var currentHeaderCols = sheet.getLastColumn() || 1;
    var finalRow = customRow;
    if (currentHeaderCols > 1) {
      try {
        var existingHeaders = sheet.getRange(1, 1, 1, currentHeaderCols).getValues()[0];
        if (existingHeaders && existingHeaders.length > 0 && String(existingHeaders[0]).trim()) {
          var mapped = [];
          for (var hIdx = 0; hIdx < existingHeaders.length; hIdx++) {
            var hText = String(existingHeaders[hIdx] || "").toLowerCase().trim();
            if (hText.indexOf("data") !== -1 || hText === "dt" || hText.indexOf("date") !== -1 || hText === "dia") {
              mapped.push(dateStr);
            } else if (hText.indexOf("hora") !== -1 || hText === "hr" || hText.indexOf("horario") !== -1 || hText.indexOf("time") !== -1) {
              mapped.push(timeStr);
            } else if (hText.indexOf("plac") !== -1 || hText.indexOf("veic") !== -1 || hText.indexOf("plate") !== -1) {
              mapped.push(placa);
            } else if (hText.indexOf("orig") !== -1 || hText.indexOf("proced") !== -1) {
              mapped.push(origem);
            } else if (tabCategory === "inventario" && (hText.indexOf("local") !== -1 || hText.indexOf("vaga") !== -1 || hText.indexOf("poste") !== -1 || hText.indexOf("setor") !== -1)) {
              mapped.push(locInv || "-");
            } else if (hText.indexOf("dest") !== -1 || hText.indexOf("local") !== -1 || hText.indexOf("vaga") !== -1 || hText.indexOf("poste") !== -1 || hText.indexOf("setor") !== -1 || hText.indexOf("para") !== -1) {
              mapped.push(destino);
            } else if (hText.indexOf("obs") !== -1 || hText.indexOf("nota") !== -1 || hText.indexOf("detalh") !== -1) {
              mapped.push(observacoes);
            } else if (hText.indexOf("condut") !== -1 || hText.indexOf("motor") !== -1 || hText.indexOf("driver") !== -1) {
              mapped.push(condutor);
            } else if (hText.indexOf("caracter") !== -1 || hText.indexOf("perfil") !== -1 || hText.indexOf("classif") !== -1) {
              mapped.push(caracteristica);
            } else if (hText.indexOf("nivel") !== -1 || hText.indexOf("marcad") !== -1 || hText.indexOf("tanque") !== -1 || (hText.indexOf("combust") !== -1 && hText.indexOf("tipo") === -1 && hText.indexOf("litr") === -1)) {
              mapped.push(nivelCombustivel);
            } else if (hText.indexOf("km") !== -1 || hText.indexOf("odomet") !== -1) {
              mapped.push(km);
            } else if (hText.indexOf("chave") !== -1) {
              mapped.push(chaveReserva);
            } else if (hText.indexOf("operad") !== -1 || hText.indexOf("audit") !== -1 || hText.indexOf("usuario") !== -1 || hText.indexOf("registro") !== -1) {
              mapped.push(operador);
            } else if (hText.indexOf("tipo") !== -1 || hText.indexOf("frota") !== -1) {
              mapped.push(tipoVeiculo);
            } else if (hText.indexOf("foto") !== -1 || hText.indexOf("doc") !== -1) {
              mapped.push(fotoDoc);
            } else if (hText.indexOf("litr") !== -1) {
              mapped.push(litrosAbastecidos);
            } else if (hIdx < customRow.length) {
              mapped.push(customRow[hIdx]);
            } else {
              mapped.push("-");
            }
          }
          if (mapped.length > 0) {
            finalRow = mapped;
          }
        }
      } catch (mapErr) {
        finalRow = customRow;
      }
    }

    sheet.insertRowAfter(1);
    var targetRange = sheet.getRange(2, 1, 1, finalRow.length);
    targetRange.setValues([finalRow]);
    targetRange.setFontWeight("normal");
    targetRange.setBackground(null);
    targetRange.setFontColor("#000000");

    // Formatar cabeçalho se necessário
    var currentHeaderCols = sheet.getLastColumn() || 1;
    var headerCheck = sheet.getRange(1, 1, 1, Math.max(currentHeaderCols, expectedHeaders.length));
    var firstCell = headerCheck.getValues()[0][0];
    var colD = headerCheck.getValues()[0][3];
    if (firstCell !== expectedHeaders[0] || (tabCategory === "inventario" && (!colD || String(colD).toUpperCase().indexOf("LOCAL") === -1))) {
      var headerRange = sheet.getRange(1, 1, 1, expectedHeaders.length);
      headerRange.setValues([expectedHeaders]);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0f172a");
      headerRange.setFontColor("#ffffff");
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      spreadsheetUrl: sUrl,
      spreadsheetId: sId,
      spreadsheetTitle: sTitle,
      tabName: tabName,
      tabCategory: tabCategory,
      plate: placa,
      columnsCount: customRow.length,
      message: "Registro gravado com sucesso na aba " + tabName + " (" + customRow.length + " colunas)."
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var allSheets = ss.getSheets();
    var result = {
      success: true,
      spreadsheetUrl: ss.getUrl(),
      spreadsheetId: ss.getId(),
      spreadsheetTitle: ss.getName(),
      updatedAt: Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss"),
      tabs: {}
    };
    
    for (var i = 0; i < allSheets.length; i++) {
      var sheet = allSheets[i];
      var name = sheet.getName();
      var data = sheet.getDataRange().getValues();
      var headers = data.length > 0 ? data[0] : [];
      var rows = [];
      
      for (var r = 1; r < data.length; r++) {
        var rowValues = data[r];
        var hasContent = false;
        for (var k = 0; k < rowValues.length; k++) {
          if (rowValues[k] !== "" && rowValues[k] !== null) {
            hasContent = true;
            break;
          }
        }
        if (!hasContent) continue;

        var rowObj = { _rowIndex: r + 1 };
        for (var c = 0; c < headers.length; c++) {
          var headerKey = String(headers[c] || ('COL_' + (c + 1))).trim();
          var cellVal = rowValues[c];
          if (cellVal instanceof Date) {
            cellVal = Utilities.formatDate(cellVal, "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
          }
          rowObj[headerKey] = cellVal !== undefined ? String(cellVal) : "";
        }
        rows.push(rowObj);
      }
      
      result.tabs[name] = {
        name: name,
        headers: headers.map(function(h, idx) { return String(h || ('COL_' + (idx + 1))).trim(); }),
        rows: rows,
        totalRows: rows.length
      };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;


/**
 * Initialize all 4 official tabs in the linked Google Sheet
 */
export async function syncAllUsersToSheet(
  users?: any[]
): Promise<{ success: boolean; message?: string; totalUsers?: number; error?: string }> {
  try {
    const config = getStoredDriveConfig();
    const webhookUrl = config.webhookUrl;
    const session = getCurrentSession();
    const authHeaders = getAuthHeaders();

    const resp = await fetch('/api/users/sync-sheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        webhookUrl: webhookUrl || undefined,
        users: users || undefined,
        userRole: session?.user?.role || 'master',
        requestUsername: session?.user?.username || 'mastercmdit',
      }),
    });

    const data = await resp.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao sincronizar usuários com a planilha.' };
  }
}

export async function syncSingleUserToSheet(
  user: any
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const config = getStoredDriveConfig();
    const webhookUrl = config.webhookUrl;
    const session = getCurrentSession();
    const authHeaders = getAuthHeaders();

    const resp = await fetch('/api/users/sync-single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        webhookUrl: webhookUrl || undefined,
        user,
        userRole: session?.user?.role || 'master',
        requestUsername: session?.user?.username || 'mastercmdit',
      }),
    });

    const data = await resp.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao sincronizar usuário com a planilha.' };
  }
}

/**
 * Access Logs (Login / Logout / Audit) Client Helpers
 */
export async function fetchServerLogs(): Promise<{ success: boolean; logs: any[]; error?: string }> {
  try {
    const resp = await fetch('/api/logs', {
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!resp.ok) {
      throw new Error(`Status ${resp.status}`);
    }
    const data = await resp.json();
    return { success: true, logs: data.logs || [] };
  } catch (err: any) {
    return { success: false, logs: [], error: err.message || 'Falha ao carregar logs do servidor.' };
  }
}

export async function recordAccessLog(
  event: 'LOGIN' | 'LOGOUT' | 'EXPIRADO',
  user: { username: string; name?: string; role?: string; whatsapp?: string },
  details?: string
): Promise<{ success: boolean; log?: any; error?: string }> {
  try {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
    const resp = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        username: user.username,
        name: user.name,
        role: user.role,
        whatsapp: user.whatsapp,
        userAgent,
        details,
      }),
    });
    const data = await resp.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao registrar log de acesso.' };
  }
}

export async function restoreLogsFromSheet(
  customWebhookUrl?: string
): Promise<{ success: boolean; totalRestored: number; logs: any[]; error?: string }> {
  try {
    const config = getStoredDriveConfig();
    const webhookUrl = customWebhookUrl || config.webhookUrl;

    const resp = await fetch('/api/logs/restore-from-sheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ webhookUrl }),
    });

    const responseText = await resp.text();
    let data: any = null;
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        totalRestored: 0,
        logs: [],
        error: 'O servidor retornou uma resposta não-JSON ao restaurar histórico.',
      };
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      totalRestored: 0,
      logs: [],
      error: err.message || 'Falha ao restaurar logs da planilha.',
    };
  }
}

export async function clearServerLogs(): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch('/api/logs', {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });
    const data = await resp.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao limpar logs.' };
  }
}



