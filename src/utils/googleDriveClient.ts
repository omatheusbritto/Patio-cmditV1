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
  webhookUrl: string | null;
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

export const DEFAULT_SPREADSHEET_ID = '1c9pfD6quOeMQLdTZEmR-QcQu-cZzvi68SyT6jZJWgnI';
export const DEFAULT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1c9pfD6quOeMQLdTZEmR-QcQu-cZzvi68SyT6jZJWgnI/edit';

/**
 * Get stored Google Drive config (local cache)
 */
export function getStoredDriveConfig(): GoogleDriveConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        webhookUrl: parsed.webhookUrl || parsed.sheetsWebhookUrl || null,
        spreadsheetId: parsed.spreadsheetId || DEFAULT_SPREADSHEET_ID,
        spreadsheetUrl: parsed.spreadsheetUrl || DEFAULT_SPREADSHEET_URL,
        userEmail: parsed.userEmail || null,
        autoSync: parsed.autoSync !== false,
      };
    }
  } catch (err) {
    console.warn('Error reading drive config:', err);
  }
  return {
    webhookUrl: null,
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    spreadsheetUrl: DEFAULT_SPREADSHEET_URL,
    userEmail: null,
    autoSync: true,
  };
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
        const updated: GoogleDriveConfig = {
          ...current,
          webhookUrl: data.settings.sheetsWebhookUrl || current.webhookUrl || null,
          spreadsheetId: data.settings.spreadsheetId || current.spreadsheetId || DEFAULT_SPREADSHEET_ID,
          spreadsheetUrl: data.settings.spreadsheetUrl || current.spreadsheetUrl || DEFAULT_SPREADSHEET_URL,
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
  const updated: GoogleDriveConfig = { ...current, ...config };
  
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving drive config locally:', err);
  }

  // Push to server for global synchronization
  fetch('/api/settings/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sheetsWebhookUrl: updated.webhookUrl,
      spreadsheetId: updated.spreadsheetId,
      spreadsheetUrl: updated.spreadsheetUrl,
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
): Promise<{ success: boolean; message: string; tabName?: string }> {
  const res = await fetch('/api/sheets/test-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl, operationType }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Falha ao testar comunicação com a planilha.');
  }
  return {
    success: true,
    message: data.message || 'Webhook conectado com sucesso!',
    tabName: data.tabName,
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
): Promise<{ success: boolean; tabName: string; method?: string; message?: string }> {
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

  return {
    success: true,
    tabName: data.tabName || 'Planilha',
    method: data.method,
    message: data.message,
  };
}

/**
 * Template de Script do Google Apps Script para copiar e colar na planilha
 * Estrutura personalizada por aba (sem informações desnecessárias):
 * - Entrada (12 colunas): Data, Hora, Placa, Condutor, KM odômetro, Nível Combustível, Origem, Destino, Chave reserva, Tipo veículo, Observação, Operador
 * - Saída (10 colunas): Data, Hora, Placa, Condutor, KM odômetro, Nível Combustível, Destino, Chave reserva, Observação, Operador
 * - 51 Qualidade (8 colunas): Data, Hora, Placa, Condutor, KM odômetro, Nível Combustível, Destino, Operador
 * - Combustível (8 colunas): Data, Hora, Placa, KM odômetro, Nível Combustível, Condutor, Destino, Operador
 * - Fila PDC (6 colunas): Data, Hora, Placa, Nível Combustível, Observação, Operador
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// ============================================================================
// SCRIPT DE GRAVAÇÃO AUTOMÁTICA PERSONALIZADA POR ABA - CMDIT CONTROLE DE PÁTIO
// ============================================================================
// 1. Abra sua Planilha Google > Menu superior "Extensões" > "Apps Script"
// 2. Apague tudo o que estiver lá, cole este código completo e salve (Ctrl+S)
// 3. Clique em "Implantar" > "Nova implantação" (ou "Gerenciar implantações" > Editar > "Nova versão")
// 4. Tipo: "Aplicativo da Web"
// 5. Executar como: "Eu" | Quem pode acessar: "Qualquer pessoa"
// 6. Clique em "Implantar", copie a URL gerada e cole no Painel Master do app
// ============================================================================

var TAB_CONFIGS = {
  entrada: {
    tabName: "📥 Entrada",
    headers: [
      "DATA",
      "HORA",
      "PLACA",
      "CONDUTOR",
      "KM (ODÔMETRO)",
      "NÍVEL DO COMBUSTÍVEL",
      "ORIGEM",
      "DESTINO",
      "CHAVE RESERVA",
      "TIPO DE VEÍCULO",
      "OBSERVAÇÃO",
      "OPERADOR DO REGISTRO"
    ]
  },
  saida: {
    tabName: "📤 Saída",
    headers: [
      "DATA",
      "HORA",
      "PLACA",
      "CONDUTOR",
      "KM (ODÔMETRO)",
      "NÍVEL DO COMBUSTÍVEL",
      "DESTINO",
      "CHAVE RESERVA",
      "OBSERVAÇÃO",
      "OPERADOR DO REGISTRO"
    ]
  },
  qualidade: {
    tabName: "🔍 Qualidade 51",
    headers: [
      "DATA",
      "HORA",
      "PLACA",
      "CONDUTOR",
      "CARACTERÍSTICA DO VEÍCULO",
      "NÍVEL DO COMBUSTÍVEL",
      "DESTINO",
      "OPERADOR DO REGISTRO"
    ]
  },
  combustivel: {
    tabName: "⛽ Combustível",
    headers: [
      "DATA",
      "HORA",
      "PLACA",
      "KM (ODÔMETRO)",
      "NÍVEL DO COMBUSTÍVEL",
      "CONDUTOR",
      "DESTINO",
      "OPERADOR DO REGISTRO"
    ]
  },
  pdc: {
    tabName: "📋 Fila PDC",
    headers: [
      "DATA",
      "HORA",
      "PLACA",
      "NÍVEL DO COMBUSTÍVEL",
      "OBSERVAÇÃO",
      "OPERADOR DO REGISTRO"
    ]
  }
};

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var op = String(data.operationType || data.operationCategory || '').toLowerCase().trim();
    
    // Identificar a aba correta e sua configuração de colunas
    var tabCategory = "entrada";
    if (op === "saida" || op === "saída" || op.indexOf("said") !== -1) {
      tabCategory = "saida";
    } else if (op === "abastecimento" || op === "combustivel" || op === "combustível" || op.indexOf("abastec") !== -1 || op.indexOf("combust") !== -1) {
      tabCategory = "combustivel";
    } else if (op === "qualidade_51" || op === "qualidade51" || op === "qualidade" || op.indexOf("51") !== -1 || op.indexOf("qualidade") !== -1) {
      tabCategory = "qualidade";
    } else if (op === "pdc" || op.indexOf("pdc") !== -1 || op.indexOf("fila") !== -1) {
      tabCategory = "pdc";
    }

    var activeConfig = TAB_CONFIGS[tabCategory] || TAB_CONFIGS.entrada;
    var tabName = activeConfig.tabName;
    var expectedHeaders = activeConfig.headers;

    // Busca inteligente da aba
    var sheet = null;
    var allSheets = ss.getSheets();
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
      } else if (tabCategory === "entrada" && (sName.indexOf("entrada") !== -1 || sName.indexOf("chegada") !== -1)) {
        sheet = allSheets[i];
        tabName = allSheets[i].getName();
        break;
      }
    }
    
    // Se a aba não existir, cria a aba com os cabeçalhos específicos desta operação
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
    
    // Função para formatar o nível do combustível de 1/8 até 8/8
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

    // Extração do Nome do Operador (apenas o nome, sem login)
    var extractCleanOperatorName = function(rawOp, rawLogin) {
      var opStr = String(rawOp || rawLogin || "OPERADOR").trim();
      opStr = opStr.replace(/\\(.*?\\)/g, '').replace(/\\[.*?\\]/g, '').trim();
      if (opStr.indexOf("@") !== -1) {
        opStr = opStr.split("@")[0].replace(/[._-]/g, ' ');
      }
      return opStr ? opStr.toUpperCase() : "OPERADOR";
    };

    // Extração dos campos normalizados
    var operador = extractCleanOperatorName(data.operatorName || data.operador, data.username);
    var condutor = String(data.driverName || data.condutor || data.motorista || "-").toUpperCase().trim();
    var placa = String(data.plate || data.placa || "").toUpperCase().trim();
    var origem = String(data.origin || data.origem || (tabCategory === "entrada" ? "PÁTIO PRINCIPAL" : "-")).toUpperCase().trim();
    var destino = String(data.destination || data.destino || (tabCategory === "pdc" ? "FILA PDC (LAVAGEM/OFICINA)" : (tabCategory === "qualidade" ? (data.location ? ("PÁTIO " + data.location) : "P1") : "-"))).toUpperCase().trim();
    var km = data.km ? (String(data.km).replace(/\\s*km/i, '').toUpperCase().trim() + " KM") : (data.odometro ? (String(data.odometro).replace(/\\s*km/i, '').toUpperCase().trim() + " KM") : "-");
    var nivelCombustivel = formatFuelLevel(data.nivelCombustivel || data.fuel || data.combustivel);
    
    // Chave Reserva
    var chaveReserva = "-";
    if (data.hasSpareKey === true || String(data.hasSpareKey).toLowerCase() === "true" || String(data.chaveReserva).toUpperCase() === "SIM") {
      chaveReserva = "SIM";
    } else if (data.hasSpareKey === false || String(data.hasSpareKey).toLowerCase() === "false" || String(data.chaveReserva).toUpperCase() === "NÃO") {
      chaveReserva = "NÃO";
    }

    // Tipo de Veículo (GF, RAC, OUTROS)
    var tipoVeiculo = String(data.fleetType || data.tipoVeiculo || data.tipo || "GF").toUpperCase().trim();

    // Característica do Veículo com Emojis (🟣 DT, 🟠 REVENDA, 🟢 CONSUMIDOR, ⚪ OUTROS)
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

    // Observações (incluindo status da foto do documento do veículo quando presente)
    var observacoes = data.notes || data.observacao || data.observacoes || data.description || "";
    observacoes = String(observacoes).replace(/\\r?\\n/g, ' - ').trim();

    var hasDoc = data.hasDocumentPhoto === true || String(data.hasDocumentPhoto).toLowerCase() === "true" || !!data.documentPhotoUrl;
    if (hasDoc) {
      if (observacoes && observacoes !== "-") {
        observacoes = observacoes + " [DOC VEÍCULO: FOTO REGISTRADA]";
      } else {
        observacoes = "[DOC VEÍCULO: FOTO REGISTRADA]";
      }
    }
    if (!observacoes) {
      observacoes = "-";
    }
    observacoes = observacoes.toUpperCase().trim();

    // Montagem exata da linha conforme a aba solicitada pelo usuário
    var customRow = [];
    if (tabCategory === "entrada") {
      // 12 Colunas: Data, Hora, Placa, Condutor, KM odômetro, Nivel do Combustivel, Origem, Destino, Chave reserva, Tipo de veiculo, Observação, Operador
      customRow = [
        dateStr,          // Col A: Data
        timeStr,          // Col B: Hora
        placa,            // Col C: Placa
        condutor,         // Col D: Condutor
        km,               // Col E: KM odômetro
        nivelCombustivel, // Col F: Nivel do Combustivel
        origem,           // Col G: Origem
        destino,          // Col H: Destino
        chaveReserva,     // Col I: Chave reserva
        tipoVeiculo,      // Col J: Tipo de veiculo (REC, GF, LQV, outros)
        observacoes,      // Col K: Observação
        operador          // Col L: Operador do registro
      ];
    } else if (tabCategory === "saida") {
      // 10 Colunas: Data, Hora, Placa, Condutor, KM odômetro, Nivel do Combustivel, Destino, Chave reserva, Observação, Operador
      customRow = [
        dateStr,          // Col A: Data
        timeStr,          // Col B: Hora
        placa,            // Col C: Placa
        condutor,         // Col D: Condutor
        km,               // Col E: KM odômetro
        nivelCombustivel, // Col F: Nivel do Combustivel
        destino,          // Col G: Destino
        chaveReserva,     // Col H: Chave reserva
        observacoes,      // Col I: Observação
        operador          // Col J: Operador do registro
      ];
    } else if (tabCategory === "qualidade") {
      // 8 Colunas: Data, Hora, Placa, Condutor, Característica do Veículo, Nivel do Combustivel, Destino, Operador
      customRow = [
        dateStr,          // Col A: Data
        timeStr,          // Col B: Hora
        placa,            // Col C: Placa
        condutor,         // Col D: Condutor
        caracteristica,   // Col E: Característica do Veículo (CONSUMIDOR, REVENDA, DT, OUTROS)
        nivelCombustivel, // Col F: Nivel do Combustivel
        destino,          // Col G: Destino (P1, P2, P3, ADM, R1, outros)
        operador          // Col H: Operador do registro
      ];
    } else if (tabCategory === "combustivel") {
      // 8 Colunas: Data, Hora, Placa, KM odômetro, Nivel do Combustivel, Condutor, Destino, Operador
      customRow = [
        dateStr,          // Col A: Data
        timeStr,          // Col B: Hora
        placa,            // Col C: Placa
        km,               // Col D: KM odômetro
        nivelCombustivel, // Col E: Nivel do Combustivel
        condutor,         // Col F: Condutor
        destino,          // Col G: Destino
        operador          // Col H: Operador do registro
      ];
    } else if (tabCategory === "pdc") {
      // 6 Colunas: Data, Hora, Placa, Nivel do combustivel, Observação, Operador
      customRow = [
        dateStr,          // Col A: Data
        timeStr,          // Col B: Hora
        placa,            // Col C: Placa
        nivelCombustivel, // Col D: Nivel do combustivel
        observacoes,      // Col E: Observação
        operador          // Col F: Operador do registro
      ];
    }

    // Inserção no topo (Linha 2, logo abaixo do cabeçalho na Linha 1 - Pilha / LIFO)
    sheet.insertRowAfter(1);
    var targetRange = sheet.getRange(2, 1, 1, customRow.length);
    targetRange.setValues([customRow]);
    targetRange.setFontWeight("normal");
    targetRange.setBackground(null);
    targetRange.setFontColor("#000000");

    // Formatar cabeçalho se necessário
    var headerCheck = sheet.getRange(1, 1, 1, expectedHeaders.length);
    if (headerCheck.getValues()[0][0] !== expectedHeaders[0]) {
      headerCheck.setValues([expectedHeaders]);
      headerCheck.setFontWeight("bold");
      headerCheck.setBackground("#0f172a");
      headerCheck.setFontColor("#ffffff");
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
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


