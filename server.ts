import express, { Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import {
  createStandardFleetSpreadsheet,
  appendVehicleRecordToSheet,
  initializeAllSpreadsheetTabs,
} from './server/googleSheetsService';
import { initDatabase, getActiveDbType } from './server/db';
import {
  loadServerUsersAsync,
  loadServerUsers,
  createServerUserAsync,
  createServerUser,
  resetServerUserPasswordAsync,
  resetServerUserPassword,
  toggleServerUserStatusAsync,
  toggleServerUserStatus,
  deleteServerUserAsync,
  deleteServerUser,
  authenticateServerUserAsync,
  authenticateServerUser,
  loadServerRecordsAsync,
  loadServerRecords,
  appendOrUpdateServerRecordAsync,
  appendOrUpdateServerRecord,
  deleteServerRecordAsync,
  deleteServerRecord,
  clearServerRecords,
  loadServerSettingsAsync,
  loadServerSettings,
  saveServerSettingsAsync,
  saveServerSettings,
  restoreUsersFromSpreadsheetAsync,
  loadServerLogsAsync,
  loadServerLogs,
  appendServerLogAsync,
  clearServerLogsAsync,
  restoreLogsFromSpreadsheetAsync,
} from './server/dataStore';

dotenv.config();

const rootDir = process.cwd();

// Priority order for ultra-fast, high-accuracy recognition
const FAST_VISION_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
];

/**
 * High-Speed Python License Plate Engine (via stdin/stdout)
 */
function executePythonEngine(photoDataUrl: string, apiKey: string): Promise<any> {
  return new Promise((resolve) => {
    try {
      const pythonProcess = spawn('python3', [
        path.join(rootDir, 'python_engine', 'plate_reader.py'),
      ]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim());
            resolve(parsed);
            return;
          } catch (e) {
            console.warn('Failed to parse Python engine output:', stdout);
          }
        }
        resolve({
          success: false,
          error: stderr || `Python process exited with code ${code}`,
        });
      });

      const inputPayload = JSON.stringify({ photoDataUrl, apiKey });
      pythonProcess.stdin.write(inputPayload);
      pythonProcess.stdin.end();
    } catch (err: any) {
      resolve({ success: false, error: err.message });
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize PostgreSQL / MySQL / JSON Database
  await initDatabase().catch((err) =>
    console.warn('Database initialization note:', err.message)
  );

  // Support large base64 image uploads from camera
  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ extended: true, limit: '35mb' }));

  // API Route: Health Check & Engine Status
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      database: getActiveDbType(),
      engine: 'High-Speed Python 3.10 & Gemini 3.5 Flash Vision Engine',
      latencyTarget: '<500ms',
      serverTime: new Date().toISOString(),
    });
  });

  // Helper to sync user modifications to the Google Spreadsheet USUARIOS_CMDIT tab in real-time
  async function syncUserToGoogleSheetWebhook(
    action: 'save_user' | 'delete_user' | 'sync_all_users',
    payload: any,
    customWebhookUrl?: string
  ) {
    try {
      const settings = await loadServerSettingsAsync();
      const webhookUrl = customWebhookUrl || settings.sheetsWebhookUrl;
      if (!webhookUrl || !webhookUrl.startsWith('http')) {
        return { success: false, reason: 'No webhook configured' };
      }

      const bodyData = {
        action,
        ...payload,
        timestamp: new Date().toISOString(),
      };

      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
        redirect: 'follow',
      });

      if (resp.ok) {
        const data = await resp.json().catch(() => ({ success: true }));
        return { success: true, data };
      }
      return { success: false, status: resp.status };
    } catch (err: any) {
      console.warn('syncUserToGoogleSheetWebhook error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // Helper to sync access log events (Login / Logout) to Google Spreadsheet LOGS_ACESSO tab in real-time
  async function syncLogToGoogleSheetWebhook(logEntry: any, customWebhookUrl?: string) {
    try {
      const settings = await loadServerSettingsAsync();
      const webhookUrl = customWebhookUrl || settings.sheetsWebhookUrl;
      if (!webhookUrl || !webhookUrl.startsWith('http')) {
        return { success: false, reason: 'No webhook configured' };
      }

      const bodyData = {
        action: 'log_access',
        log: logEntry,
        timestamp: new Date().toISOString(),
      };

      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
        redirect: 'follow',
      });

      if (resp.ok) {
        const data = await resp.json().catch(() => ({ success: true }));
        return { success: true, data };
      }
      return { success: false, status: resp.status };
    } catch (err: any) {
      console.warn('syncLogToGoogleSheetWebhook error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // --------------------------------------------------------------------------
  // USER MANAGEMENT & MULTI-DEVICE AUTHENTICATION (Centralized Store + Google Sheet Sync)
  // --------------------------------------------------------------------------
  app.get('/api/users', async (req: Request, res: Response) => {
    try {
      const users = await loadServerUsersAsync();
      res.json({ success: true, users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/users', async (req: Request, res: Response) => {
    try {
      const { username, name, password, role, whatsapp } = req.body;
      const result = await createServerUserAsync(username, name, password, role, whatsapp);
      if (result.success && result.user) {
        const users = await loadServerUsersAsync();
        // Sincroniza em segundo plano diretamente com a planilha na aba USUARIOS_CMDIT
        syncUserToGoogleSheetWebhook('save_user', { user: result.user }).catch(() => {});
        res.json({ success: true, user: result.user, users });
      } else {
        res.status(400).json(result);
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/users/reset-password', async (req: Request, res: Response) => {
    try {
      const { userId, newPassword } = req.body;
      const result = await resetServerUserPasswordAsync(userId, newPassword);
      if (result.success) {
        const users = await loadServerUsersAsync();
        const updatedUser = users.find((u) => u.id === userId);
        if (updatedUser) {
          syncUserToGoogleSheetWebhook('save_user', { user: updatedUser }).catch(() => {});
        }
        res.json({ success: true, users });
      } else {
        res.status(400).json(result);
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/users/toggle-status', async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      const result = await toggleServerUserStatusAsync(userId);
      if (result.success) {
        const users = await loadServerUsersAsync();
        const updatedUser = users.find((u) => u.id === userId);
        if (updatedUser) {
          syncUserToGoogleSheetWebhook('save_user', { user: updatedUser }).catch(() => {});
        }
        res.json({ success: true, isActive: result.isActive, users });
      } else {
        res.status(400).json(result);
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const allUsersBefore = await loadServerUsersAsync();
      const userToDelete = allUsersBefore.find((u) => u.id === id);

      const result = await deleteServerUserAsync(id);
      if (result.success) {
        const users = await loadServerUsersAsync();
        if (userToDelete) {
          syncUserToGoogleSheetWebhook('delete_user', { username: userToDelete.username }).catch(() => {});
        }
        res.json({ success: true, users });
      } else {
        res.status(400).json(result);
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Sincronizar todos os usuários com a planilha (Aba USUARIOS_CMDIT)
  app.post('/api/users/sync-sheet', async (req: Request, res: Response) => {
    try {
      const { webhookUrl, users: requestedUsers } = req.body;
      const usersToSync = Array.isArray(requestedUsers) && requestedUsers.length > 0
        ? requestedUsers
        : await loadServerUsersAsync();

      const syncResult = await syncUserToGoogleSheetWebhook('sync_all_users', { users: usersToSync }, webhookUrl);
      res.json({
        success: syncResult.success,
        totalUsers: usersToSync.length,
        result: syncResult,
        message: syncResult.success
          ? `${usersToSync.length} usuários sincronizados na aba USUARIOS_CMDIT da planilha!`
          : 'Planilha atualizada localmente. Para gravar no Google Sheets, certifique-se de salvar a URL do Webhook.',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Sincronizar um único usuário com a planilha
  app.post('/api/users/sync-single', async (req: Request, res: Response) => {
    try {
      const { webhookUrl, user } = req.body;
      if (!user || !user.username) {
        res.status(400).json({ success: false, error: 'Dados do usuário ausentes.' });
        return;
      }
      // If user provided, ensure it's also saved in server's local store & DB
      if (user.username && user.name) {
        await createServerUserAsync(user.username, user.name, user.password || '123456', user.role || 'operador', user.whatsapp).catch(() => {});
      }
      const syncResult = await syncUserToGoogleSheetWebhook('save_user', { user }, webhookUrl);
      res.json(syncResult);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Restaurar operadores diretamente da aba USUARIOS_CMDIT do Google Sheets
  app.all('/api/users/restore-from-sheet', async (req: Request, res: Response) => {
    try {
      const webhookUrl = req.body?.webhookUrl || (req.query?.webhookUrl as string) || undefined;
      const result = await restoreUsersFromSpreadsheetAsync(webhookUrl);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password, userAgent, ip } = req.body;
      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'Usuário e senha são obrigatórios.',
        });
        return;
      }

      const result = await authenticateServerUserAsync(username, password);
      if (!result.success || !result.user) {
        res.status(401).json({
          success: false,
          error: result.error || 'Credenciais inválidas.',
        });
        return;
      }

      const now = Date.now();
      const SESSION_DURATION_MS = 9 * 60 * 60 * 1000; // 9 hours
      const session = {
        user: {
          id: result.user.id,
          username: result.user.username,
          name: result.user.name,
          role: result.user.role,
        },
        loginTimestamp: now,
        expiresAt: now + SESSION_DURATION_MS,
      };

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || ip || 'Local';
      const clientAgent = userAgent || (req.headers['user-agent'] as string) || 'Navegador Web';
      const isMobile = /mobile|android|iphone|ipad|ipod/i.test(clientAgent);

      // Automatically register access log
      appendServerLogAsync({
        event: 'LOGIN',
        username: result.user.username,
        name: result.user.name,
        role: result.user.role,
        whatsapp: result.user.whatsapp,
        ip: clientIp,
        userAgent: clientAgent,
        deviceType: isMobile ? 'mobile' : 'desktop',
        details: 'Login efetuado com sucesso (Sessão 9h iniciada)',
      }).then((createdLog) => {
        syncLogToGoogleSheetWebhook(createdLog).catch(() => {});
      }).catch((err) => console.warn('Error recording login log:', err.message));

      const users = await loadServerUsersAsync();
      res.json({
        success: true,
        session,
        users,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      const { username, name, role, whatsapp, userAgent, ip, reason } = req.body;
      if (username) {
        const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || ip || 'Local';
        const clientAgent = userAgent || (req.headers['user-agent'] as string) || 'Navegador Web';
        const isMobile = /mobile|android|iphone|ipad|ipod/i.test(clientAgent);

        const createdLog = await appendServerLogAsync({
          event: 'LOGOUT',
          username,
          name,
          role,
          whatsapp,
          ip: clientIp,
          userAgent: clientAgent,
          deviceType: isMobile ? 'mobile' : 'desktop',
          details: reason || 'Sessão finalizada pelo operador (Logout manual)',
        });
        syncLogToGoogleSheetWebhook(createdLog).catch(() => {});
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // ACCESS & AUDIT LOGS API (RASTREAMENTO DE LOGIN / LOGOUT / PLANILHA)
  // --------------------------------------------------------------------------
  app.get('/api/logs', async (req: Request, res: Response) => {
    try {
      const logs = await loadServerLogsAsync();
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/logs', async (req: Request, res: Response) => {
    try {
      const { event, username, name, role, whatsapp, userAgent, ip, details } = req.body;
      if (!username) {
        res.status(400).json({ success: false, error: 'Matrícula/Usuário é obrigatório para o log.' });
        return;
      }

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || ip || 'Local';
      const clientAgent = userAgent || (req.headers['user-agent'] as string) || 'Navegador Web';
      const isMobile = /mobile|android|iphone|ipad|ipod/i.test(clientAgent);

      const createdLog = await appendServerLogAsync({
        event: event || 'LOGIN',
        username,
        name,
        role,
        whatsapp,
        ip: clientIp,
        userAgent: clientAgent,
        deviceType: isMobile ? 'mobile' : 'desktop',
        details,
      });

      // Synchronize with Google Spreadsheet tab LOGS_ACESSO
      syncLogToGoogleSheetWebhook(createdLog).catch(() => {});

      res.json({ success: true, log: createdLog });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/logs/restore-from-sheet', async (req: Request, res: Response) => {
    try {
      const webhookUrl = req.body?.webhookUrl || (req.query?.webhookUrl as string) || undefined;
      const result = await restoreLogsFromSpreadsheetAsync(webhookUrl);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/logs', async (req: Request, res: Response) => {
    try {
      await clearServerLogsAsync();
      res.json({ success: true, message: 'Histórico de logs limpo com sucesso.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // SHARED VEHICLE RECORDS API (MULTI-DEVICE PATIO SYNC)
  // --------------------------------------------------------------------------
  app.get('/api/records', async (req: Request, res: Response) => {
    try {
      const records = await loadServerRecordsAsync();
      res.json({ success: true, records });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/records', async (req: Request, res: Response) => {
    try {
      const record = req.body;
      if (!record || !record.id) {
        res.status(400).json({ success: false, error: 'Registro inválido.' });
        return;
      }
      const updatedList = await appendOrUpdateServerRecordAsync(record);
      res.json({ success: true, records: updatedList });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/records/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updatedList = await deleteServerRecordAsync(id);
      res.json({ success: true, records: updatedList });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/records/clear', (req: Request, res: Response) => {
    try {
      clearServerRecords();
      res.json({ success: true, records: [] });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // GLOBAL SHEETS CONFIGURATION & SETTINGS (Shared across all phones/devices)
  // --------------------------------------------------------------------------
  app.get('/api/settings/sheets', async (req: Request, res: Response) => {
    try {
      const settings = await loadServerSettingsAsync();
      res.json({ success: true, settings });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/settings/sheets', async (req: Request, res: Response) => {
    try {
      const { sheetsWebhookUrl, spreadsheetId, spreadsheetUrl, autoSync } = req.body;
      const updated = await saveServerSettingsAsync({
        sheetsWebhookUrl: sheetsWebhookUrl !== undefined ? sheetsWebhookUrl : undefined,
        spreadsheetId: spreadsheetId !== undefined ? spreadsheetId : undefined,
        spreadsheetUrl: spreadsheetUrl !== undefined ? spreadsheetUrl : undefined,
        autoSync: autoSync !== undefined ? autoSync : undefined,
      });
      res.json({ success: true, settings: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Universal Record Append Endpoint (Supports Google Apps Script Webhook & Direct Sheets API)
  // ZERO Google login required on worker phones!
  app.post('/api/sheets/append-record', async (req: Request, res: Response): Promise<void> => {
    try {
      const { record, spreadsheetId, webhookUrl } = req.body;
      if (!record || !record.plate) {
        res.status(400).json({ success: false, error: 'Dados do veículo inválidos.' });
        return;
      }

      const settings = await loadServerSettingsAsync();
      const targetWebhookUrl = webhookUrl || settings.sheetsWebhookUrl;

      // Normalize operationType and category for webhook
      const rawOp = String(record.operationType || '').toLowerCase().trim();
      let normalizedCategory = 'entrada';
      let expectedTabName = '📥 Entrada';

      if (rawOp === 'saida' || rawOp === 'saída' || rawOp.includes('said')) {
        normalizedCategory = 'saida';
        expectedTabName = '📤 Saída';
      } else if (rawOp === 'abastecimento' || rawOp === 'combustivel' || rawOp.includes('abastec') || rawOp.includes('combust')) {
        normalizedCategory = 'abastecimento';
        expectedTabName = '⛽ Combustível';
      } else if (rawOp === 'qualidade_51' || rawOp === 'qualidade51' || rawOp === 'qualidade' || rawOp.includes('51') || rawOp.includes('qualidade')) {
        normalizedCategory = 'qualidade';
        expectedTabName = '🔍 Qualidade 51';
      } else if (rawOp === 'pdc' || rawOp.includes('pdc') || rawOp.includes('fila')) {
        normalizedCategory = 'pdc';
        expectedTabName = '📋 Fila PDC';
      }

      // Helper for clean fuel level formatting (prevents Excel from auto-converting fractions like 4/8 into dates)
      const formatFuel = (f?: string | null): string => {
        if (!f) return '-';
        const clean = String(f).trim();
        switch (clean) {
          case '1/8':
            return '1/8 (Reserva)';
          case '2/8':
            return '2/8 (1/4)';
          case '3/8':
            return '3/8';
          case '4/8':
            return '4/8 (1/2)';
          case '5/8':
            return '5/8';
          case '6/8':
            return '6/8 (3/4)';
          case '7/8':
            return '7/8';
          case '8/8':
            return '8/8 (Cheio)';
          default:
            if (clean === '8/8 • Cheio' || clean === 'Tanque Cheio') return '8/8 (Cheio)';
            if (clean === '4/8 • 1/2' || clean === 'Meio Tanque (1/2)') return '4/8 (1/2)';
            return clean;
        }
      };

      // Clean operator extraction (name only, no login)
      const extractCleanOperator = (rawName?: string, rawUser?: string) => {
        let op = String(rawName || rawUser || 'Operador').trim();
        op = op.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
        if (op.includes('@')) {
          op = op.split('@')[0].replace(/[._-]/g, ' ');
        }
        return op || 'Operador';
      };

      const cleanOperator = extractCleanOperator(record.operatorName, record.username);
      const condutor = record.driverName || record.condutor || '-';
      const placa = (record.plate || record.placa || '').toUpperCase().trim();
      const origem = record.origin || record.origem || (normalizedCategory === 'entrada' ? 'Pátio Principal' : '-');
      const destino = record.destination || record.destino || (normalizedCategory === 'pdc' ? 'Fila PDC (Lavagem/Oficina)' : (normalizedCategory === 'entrada' ? 'Bolsão 40' : '-'));
      const km = record.km ? `${String(record.km).replace(/\s*km/i, '')} km` : (record.odometro || '-');
      const nivelCombustivel = formatFuel(record.fuel || record.nivelCombustivel || record.combustivel);
      const tipoVeiculo = String(record.fleetType || record.tipoVeiculo || record.tipo || 'GF').toUpperCase().trim();
      const chaveReserva = record.hasSpareKey === true ? 'SIM' : (record.hasSpareKey === false ? 'NÃO' : '-');
      let observacoes = record.notes || record.description || record.observacao || record.observacoes || '';
      observacoes = String(observacoes).replace(/\r?\n/g, ' - ').trim();

      const hasDoc = record.hasDocumentPhoto === true || String(record.hasDocumentPhoto).toLowerCase() === 'true' || !!record.documentPhotoUrl;
      if (hasDoc) {
        if (observacoes && observacoes !== '-') {
          observacoes = `${observacoes} [DOC VEÍCULO: FOTO REGISTRADA]`;
        } else {
          observacoes = '[DOC VEÍCULO: FOTO REGISTRADA]';
        }
      }
      if (!observacoes) {
        observacoes = '-';
      }
      observacoes = observacoes.toUpperCase().trim();

      const rawChar = record.characteristic || record.caracteristica || record.tipoCaracteristica || '-';
      let caracteristica = String(rawChar).trim();
      if (caracteristica && caracteristica !== '-') {
        const charUpper = caracteristica.toUpperCase();
        if (charUpper.includes('DT')) caracteristica = '🟣 DT';
        else if (charUpper.includes('REVENDA')) caracteristica = '🟠 REVENDA';
        else if (charUpper.includes('CONSUMIDOR')) caracteristica = '🟢 CONSUMIDOR';
        else if (charUpper.includes('OUTROS')) caracteristica = '⚪ OUTROS';
      } else {
        caracteristica = '-';
      }

      const enrichedRecord = {
        ...record,
        operationCategory: normalizedCategory,
        targetTabName: expectedTabName,
        operador: cleanOperator,
        operatorName: cleanOperator,
        condutor,
        caracteristica,
        characteristic: caracteristica,
        placa,
        origem,
        destino,
        destination: destino,
        km,
        odometro: km,
        nivelCombustivel,
        fuel: nivelCombustivel,
        tipoVeiculo,
        fleetType: tipoVeiculo,
        chaveReserva,
        hasSpareKey: record.hasSpareKey,
        observacao: observacoes,
        observacoes,
        notes: observacoes,
      };

      // Method 1: Google Apps Script Webhook (Instant, 100% Free, NO GOOGLE LOGIN on any phone)
      if (targetWebhookUrl && targetWebhookUrl.startsWith('http')) {
        try {
          const webhookResp = await fetch(targetWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(enrichedRecord),
            redirect: 'follow',
          });

          let webhookData: any = {};
          try {
            webhookData = await webhookResp.json();
          } catch {
            // Some Apps Script webhooks return text or redirect HTML
            webhookData = { success: webhookResp.ok };
          }

          if (webhookData.spreadsheetUrl || webhookData.spreadsheetId) {
            saveServerSettingsAsync({
              spreadsheetUrl: webhookData.spreadsheetUrl || undefined,
              spreadsheetId: webhookData.spreadsheetId || undefined,
              spreadsheetTitle: webhookData.spreadsheetTitle || undefined,
            }).catch(() => {});
          }

          res.json({
            success: true,
            method: 'webhook',
            tabName: webhookData.tabName || expectedTabName,
            spreadsheetUrl: webhookData.spreadsheetUrl,
            spreadsheetId: webhookData.spreadsheetId,
            spreadsheetTitle: webhookData.spreadsheetTitle,
            message: 'Registro gravado com sucesso na planilha via Webhook.',
          });
          return;
        } catch (webhookErr: any) {
          console.error('Webhook execution failed:', webhookErr);
          // Fall through if OAuth token is available as backup
        }
      }

      // Method 2: Direct Google Sheets API with Access Token (if supplied)
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : req.body.accessToken;

      const targetSpreadsheetId = spreadsheetId || settings.spreadsheetId;

      if (accessToken && targetSpreadsheetId) {
        const result = await appendVehicleRecordToSheet(targetSpreadsheetId, record, accessToken);
        res.json({
          success: true,
          method: 'sheets_api',
          tabName: result.tabName,
          updatedRange: result.updatedRange,
        });
        return;
      }

      // If no webhook is configured yet, save to internal records store and guide configuration
      res.json({
        success: true,
        method: 'local_store',
        tabName: 'Salvo Localmente',
        message: targetWebhookUrl
          ? 'Salvo no banco de dados. Verifique a URL do Webhook nas configurações do Master.'
          : 'Salvo no banco de dados. Configure a URL do Webhook na aba Master para gravar diretamente no Google Sheets.',
      });
    } catch (err: any) {
      console.error('Universal Append Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Falha ao registrar dados na planilha.',
      });
    }
  });

  // Test Webhook URL Endpoint
  app.post('/api/sheets/test-webhook', async (req: Request, res: Response): Promise<void> => {
    try {
      const { webhookUrl, operationType } = req.body;
      const targetUrl = webhookUrl || loadServerSettings().sheetsWebhookUrl;

      if (!targetUrl || !targetUrl.startsWith('http')) {
        res.status(400).json({
          success: false,
          error: 'URL do Webhook inválida ou não configurada.',
        });
        return;
      }

      const op = operationType || 'entrada';
      let opCategory = 'entrada';
      let targetTabName = '📥 Entrada';
      
      const formatFuel = (f?: string | null): string => {
        if (!f) return '-';
        const clean = String(f).trim();
        switch (clean) {
          case '1/8': return '1/8 (Reserva)';
          case '2/8': return '2/8 (1/4)';
          case '3/8': return '3/8';
          case '4/8': return '4/8 (1/2)';
          case '5/8': return '5/8';
          case '6/8': return '6/8 (3/4)';
          case '7/8': return '7/8';
          case '8/8': return '8/8 (Cheio)';
          default:
            if (clean === '8/8 • Cheio' || clean === 'Tanque Cheio') return '8/8 (Cheio)';
            if (clean === '4/8 • 1/2' || clean === 'Meio Tanque (1/2)') return '4/8 (1/2)';
            return clean;
        }
      };

      let samplePayload: any = {
        plate: 'ABC-1234',
        placa: 'ABC-1234',
        operationType: op,
        fuel: '8/8 (Cheio)',
        nivelCombustivel: '8/8 (CHEIO)',
        operatorName: 'Carlos Silva',
        operador: 'Carlos Silva',
        origin: 'Pátio Principal',
        origem: 'Pátio Principal',
        driverName: 'João Condutor',
        condutor: 'João Condutor',
        hasSpareKey: true,
        chaveReserva: 'SIM',
        fleetType: 'GF',
        tipoVeiculo: 'GF',
        notes: 'Registro de teste de integração',
        observacao: 'Registro de teste de integração',
        observacoes: 'Registro de teste de integração',
        km: '89400 km',
        odometro: '89400 km',
        destination: 'Bolsão 40',
        destino: 'Bolsão 40',
      };

      if (op === 'saida' || op === 'saída') {
        opCategory = 'saida';
        targetTabName = '📤 Saída';
        samplePayload.destination = 'Operação Externa';
        samplePayload.destino = 'Operação Externa';
        samplePayload.km = '45210 km';
        samplePayload.odometro = '45210 km';
        samplePayload.fuel = '7/8';
        samplePayload.nivelCombustivel = '7/8';
        samplePayload.hasSpareKey = false;
        samplePayload.chaveReserva = 'NÃO';
        samplePayload.observacoes = 'Saída autorizada';
      } else if (op === 'abastecimento' || op === 'combustivel') {
        opCategory = 'combustivel';
        targetTabName = '⛽ Combustível';
        samplePayload.destination = 'Posto Interno';
        samplePayload.destino = 'Posto Interno';
        samplePayload.fuel = '8/8 (Cheio)';
        samplePayload.nivelCombustivel = '8/8 (CHEIO)';
        samplePayload.km = '89400 km';
        samplePayload.odometro = '89400 km';
        samplePayload.condutor = 'João Condutor';
      } else if (op === 'qualidade_51' || op === 'qualidade') {
        opCategory = 'qualidade';
        targetTabName = '🔍 Qualidade 51';
        samplePayload.destination = 'P2';
        samplePayload.destino = 'P2';
        samplePayload.location = 'P2';
        samplePayload.characteristic = '🟢 CONSUMIDOR';
        samplePayload.caracteristica = 'CONSUMIDOR';
        samplePayload.fuel = '6/8 (3/4)';
        samplePayload.nivelCombustivel = '6/8 (3/4)';
        samplePayload.km = '-';
        samplePayload.odometro = '-';
        samplePayload.condutor = 'Marcos Vistoriador';
      } else if (op === 'pdc') {
        opCategory = 'pdc';
        targetTabName = '📋 Fila PDC';
        samplePayload.destination = 'Fila PDC (Lavagem/Oficina)';
        samplePayload.destino = 'Fila PDC (Lavagem/Oficina)';
        samplePayload.fuel = '4/8 (1/2)';
        samplePayload.nivelCombustivel = '4/8 (1/2)';
        samplePayload.observacoes = 'Aguardando lavagem geral';
      }

      samplePayload.operationCategory = opCategory;
      samplePayload.targetTabName = targetTabName;

      const testResp = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload),
        redirect: 'follow',
      });

      if (testResp.status === 401 || testResp.status === 403) {
        res.status(400).json({
          success: false,
          status: testResp.status,
          error: 'Permissão negada no Google Apps Script (Erro ' + testResp.status + '). No Apps Script, clique em "Implantar" ➔ "Gerenciar implantações" ➔ Editar ➔ altere "Quem pode acessar" para "Qualquer pessoa" (Anyone) e selecione "Nova versão".',
        });
        return;
      }

      let resData: any = {};
      try {
        resData = await testResp.json();
      } catch {
        resData = { success: testResp.ok };
      }

      if (!testResp.ok || resData.success === false) {
        res.status(400).json({
          success: false,
          status: testResp.status,
          error: resData.error || `O Google Apps Script retornou código de erro HTTP ${testResp.status}.`,
        });
        return;
      }

      if (resData.spreadsheetUrl || resData.spreadsheetId) {
        saveServerSettingsAsync({
          spreadsheetUrl: resData.spreadsheetUrl || undefined,
          spreadsheetId: resData.spreadsheetId || undefined,
          spreadsheetTitle: resData.spreadsheetTitle || undefined,
        }).catch(() => {});
      }

      res.json({
        success: true,
        status: testResp.status,
        data: resData,
        tabName: resData.tabName || targetTabName,
        spreadsheetUrl: resData.spreadsheetUrl,
        spreadsheetId: resData.spreadsheetId,
        spreadsheetTitle: resData.spreadsheetTitle,
        message: `Linha de teste gravada com sucesso na aba ${resData.tabName || targetTabName}!`,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Falha ao testar webhook.',
      });
    }
  });

  // API Route: Visualização Bruta e Diagnóstico da Planilha
  app.all('/api/sheets/view-raw', async (req: Request, res: Response): Promise<void> => {
    try {
      const settings = await loadServerSettingsAsync();
      const bodyUrl = req.body?.webhookUrl || (req.query?.webhookUrl as string);
      const targetUrl = bodyUrl || settings.sheetsWebhookUrl || settings.spreadsheetUrl;

      if (!targetUrl || !targetUrl.startsWith('http')) {
        res.json({
          success: false,
          error: 'URL da Planilha ou do Webhook não configurada. Configure o Webhook do Google Apps Script na aba Master.',
        });
        return;
      }

      // If it's an Apps Script Webhook URL
      if (targetUrl.includes('script.google.com')) {
        try {
          const fetchResp = await fetch(targetUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            redirect: 'follow',
          });

          const rawText = await fetchResp.text();

          // Safeguard: Check if response is HTML instead of JSON
          if (rawText.trim().startsWith('<') || rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
            if (rawText.includes('ServiceLogin') || rawText.includes('accounts.google.com')) {
              res.json({
                success: false,
                isHtml: true,
                error: 'Permissão necessária: O Google Apps Script exige login. No Apps Script, clique em "Implantar" ➔ "Gerenciar implantações" ➔ Editar ➔ configure "Quem pode acessar" como "Qualquer pessoa" (Anyone) e salve como "Nova versão".',
              });
              return;
            }
            res.json({
              success: false,
              isHtml: true,
              error: 'O Webhook retornou uma página HTML em vez de JSON. Verifique se o script do Google Apps Script foi implantado como Aplicativo da Web.',
            });
            return;
          }

          try {
            const data = JSON.parse(rawText);
            res.json({
              success: true,
              source: 'apps_script',
              ...data,
            });
            return;
          } catch (jsonErr: any) {
            res.json({
              success: false,
              error: `Resposta não é um JSON válido: ${rawText.substring(0, 150)}`,
            });
            return;
          }
        } catch (fetchErr: any) {
          res.json({
            success: false,
            error: `Falha ao conectar no Webhook: ${fetchErr.message}`,
          });
          return;
        }
      }

      // If it's a direct Google Sheets document URL
      let sheetId = settings.spreadsheetId || '';
      const match = targetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        sheetId = match[1];
      }

      if (sheetId) {
        res.json({
          success: true,
          source: 'google_sheets_url',
          spreadsheetId: sheetId,
          spreadsheetUrl: targetUrl,
          message: 'URL da Planilha Google configurada.',
        });
        return;
      }

      res.json({
        success: false,
        error: 'URL não reconhecida.',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Erro ao processar consulta da planilha.',
      });
    }
  });

  // API Route: Diagnóstico Abrangente da Sincronização
  app.all('/api/sheets/diagnostic', async (req: Request, res: Response): Promise<void> => {
    try {
      const settings = await loadServerSettingsAsync();
      const bodyUrl = req.body?.webhookUrl || (req.query?.webhookUrl as string);
      const webhookUrl = bodyUrl || settings.sheetsWebhookUrl;
      const spreadsheetUrl = settings.spreadsheetUrl || 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit';
      const localUsers = await loadServerUsersAsync();

      const diag: any = {
        testedAt: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        webhookConfigured: !!(webhookUrl && webhookUrl.startsWith('http')),
        webhookUrl: webhookUrl || null,
        spreadsheetUrl: spreadsheetUrl || null,
        appUsersCount: localUsers.length,
        sheetUsersCount: 0,
        webhookOk: false,
        hasUserTab: false,
        userTabHeaders: [] as string[],
        colWhatsappName: 'Não detectada',
        colPasswordName: 'Não detectada',
        status: 'unreachable',
        details: '',
      };

      if (!webhookUrl || !webhookUrl.startsWith('http')) {
        diag.status = 'unreachable';
        diag.details = 'A URL do Webhook do Google Apps Script ainda não foi configurada. Acesse o Painel do Master ➔ Configurar Planilha ➔ Cole a URL do Webhook (/exec) da sua implantação do Google Apps Script.';
        res.json({ success: true, diagnostic: diag });
        return;
      }

      try {
        const resp = await fetch(webhookUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          redirect: 'follow',
        });

        const rawText = await resp.text();

        // Check if returned HTML login/redirect page
        if (rawText.trim().startsWith('<') || rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
          diag.webhookOk = false;
          diag.status = 'unreachable';
          diag.details = 'O Google Apps Script retornou uma página de autenticação (HTML) em vez de dados JSON. Como resolver: No Apps Script, clique em "Implantar" ➔ "Gerenciar implantações" ➔ Editar (ícone de lápis) ➔ em "Quem pode acessar", selecione "Qualquer pessoa" (Anyone) e clique em "Implantar" com uma Nova Versão.';
          res.json({ success: true, diagnostic: diag });
          return;
        }

        let data: any = null;
        try {
          data = JSON.parse(rawText);
        } catch {
          diag.webhookOk = false;
          diag.status = 'unreachable';
          diag.details = `O Webhook respondeu, mas não retornou um formato JSON válido. Conteúdo retornado: ${rawText.substring(0, 100)}`;
          res.json({ success: true, diagnostic: diag });
          return;
        }

        diag.webhookOk = true;
        diag.spreadsheetTitle = data.spreadsheetTitle || 'Planilha CMDIT';

        if (data.tabs && typeof data.tabs === 'object') {
          // Find users tab
          const userTab = Object.values(data.tabs).find((t: any) => {
            const name = String(t.name || '').toUpperCase();
            return name.includes('USUARIO') || name.includes('USUÁRIO') || name.includes('OPERADOR');
          }) as any;

          if (userTab) {
            diag.hasUserTab = true;
            diag.userTabHeaders = userTab.headers || [];
            diag.sheetUsersCount = Array.isArray(userTab.rows) ? userTab.rows.length : 0;
            diag.colWhatsappName = userTab.headers?.[4] || 'Não configurada (Coluna 5)';
            diag.colPasswordName = userTab.headers?.[5] || 'Não configurada (Coluna 6)';

            const col5Upper = String(diag.colWhatsappName).toUpperCase();
            const isHeadersCorrect = col5Upper.includes('WHATS') || col5Upper.includes('CELULAR') || col5Upper.includes('CONTATO');

            if (isHeadersCorrect) {
              diag.status = 'perfect';
              diag.details = `A sincronização está 100% operacional! A aba ${userTab.name} está ativa na planilha com as 8 colunas oficiais: WhatsApp na Coluna 5 (E) e Senha na Coluna 6 (F).`;
            } else {
              diag.status = 'needs_sync';
              diag.details = `A aba de usuários foi encontrada (${userTab.name}), mas os cabeçalhos atuais precisam de atualização. Clique no botão "Forçar Sincronização e Corrigir Aba Agora" para regravar a estrutura correta.`;
            }
          } else {
            diag.hasUserTab = false;
            diag.status = 'needs_sync';
            diag.details = 'O Webhook está conectado com sucesso! A aba USUARIOS_CMDIT será criada automaticamente na sua planilha assim que você clicar em "Forçar Sincronização".';
          }
        } else {
          diag.status = 'needs_sync';
          diag.details = 'Webhook conectado com sucesso! Clique em "Forçar Sincronização" para gravar todos os operadores na planilha.';
        }

        res.json({ success: true, diagnostic: diag });
      } catch (connErr: any) {
        diag.webhookOk = false;
        diag.status = 'unreachable';
        diag.details = `Falha ao tentar conectar ao Webhook: ${connErr.message}`;
        res.json({ success: true, diagnostic: diag });
      }
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Erro no diagnóstico.',
      });
    }
  });

  // API Route: Obter dados em tempo real da Planilha Online (Google Sheets API, doGet Apps Script, Drive/Excel XLSX Parser, GViz e Servidor)
  app.get('/api/sheets/online-data', async (req: Request, res: Response): Promise<void> => {
    try {
      const settings = loadServerSettings();
      let webhookUrl = (req.query.webhookUrl as string) || settings.sheetsWebhookUrl;
      let spreadsheetId = (req.query.spreadsheetId as string) || settings.spreadsheetId || '';
      const spreadsheetUrl = (req.query.spreadsheetUrl as string) || settings.spreadsheetUrl || '';
      const authHeader = req.headers.authorization;
      const accessToken = (req.query.accessToken as string) || (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '');

      if (!spreadsheetId && spreadsheetUrl) {
        const match = spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) ||
                      spreadsheetUrl.match(/\/file\/d\/([a-zA-Z0-9-_]+)/) ||
                      spreadsheetUrl.match(/id=([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          spreadsheetId = match[1];
        }
      }

      // 1. Strategy 1: Google Sheets API v4 with OAuth accessToken
      if (spreadsheetId && accessToken) {
        try {
          const metaResp = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
              },
            }
          );

          if (metaResp.ok) {
            const sheetDoc: any = await metaResp.json();
            if (sheetDoc && Array.isArray(sheetDoc.sheets) && sheetDoc.sheets.length > 0) {
              const liveTabs: Record<string, { name: string; headers: string[]; rows: any[] }> = {};

              sheetDoc.sheets.forEach((sheetItem: any) => {
                const title = sheetItem.properties?.title || 'Aba';
                const gridData = sheetItem.data?.[0]?.rowData || [];
                if (gridData.length === 0) return;

                // Row 0 is headers
                const headerRow = gridData[0]?.values || [];
                const headers: string[] = headerRow
                  .map((c: any) => (c?.formattedValue || c?.userEnteredValue?.stringValue || '').trim())
                  .filter(Boolean);

                const rows: any[] = [];
                for (let i = 1; i < gridData.length; i++) {
                  const rowValues = gridData[i]?.values || [];
                  const rowObj: any = { _rowIndex: i + 1 };
                  let hasValue = false;

                  headers.forEach((h, hIdx) => {
                    const cell = rowValues[hIdx];
                    const val = cell?.formattedValue || cell?.userEnteredValue?.stringValue || cell?.userEnteredValue?.numberValue || '';
                    if (val !== '' && val !== null && val !== undefined) {
                      hasValue = true;
                    }
                    rowObj[h] = val !== undefined ? String(val) : '';
                  });

                  if (hasValue) {
                    rows.push(rowObj);
                  }
                }

                liveTabs[title] = {
                  name: title,
                  headers,
                  rows,
                };
              });

              if (Object.keys(liveTabs).length > 0) {
                res.json({
                  success: true,
                  source: 'google_sheets_oauth_api',
                  spreadsheetTitle: sheetDoc.properties?.title || 'Planilha CMDIT',
                  updatedAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
                  tabs: liveTabs,
                });
                return;
              }
            }
          }
        } catch (oauthErr) {
          console.warn('OAuth Google Sheets API fetch failed, trying next strategy:', oauthErr);
        }
      }

      // 2. Strategy 2: Google Apps Script Webhook (doGet)
      if (webhookUrl && webhookUrl.startsWith('http')) {
        try {
          const fetchResp = await fetch(webhookUrl, {
            method: 'GET',
            redirect: 'follow',
          });

          if (fetchResp.ok) {
            const text = await fetchResp.text();
            try {
              const data: any = JSON.parse(text);
              if (data && data.tabs && Object.keys(data.tabs).length > 0) {
                res.json({
                  success: true,
                  source: 'apps_script_live',
                  spreadsheetTitle: data.spreadsheetTitle || 'Planilha CMDIT',
                  updatedAt: data.updatedAt || new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
                  tabs: data.tabs,
                });
                return;
              }
            } catch (jsonErr) {
              console.warn('Response from webhook is not valid JSON:', text.substring(0, 100));
            }
          }
        } catch (fetchErr) {
          console.warn('Apps script doGet not answering JSON, trying next strategy:', fetchErr);
        }
      }

      // 3. Strategy 3: Google Drive / Sheets Direct XLSX Export & Parser (Reads all tabs from Excel or Sheet files)
      if (spreadsheetId) {
        try {
          const downloadUrls = [
            `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`,
            `https://drive.google.com/uc?export=download&id=${spreadsheetId}`,
          ];

          for (const dUrl of downloadUrls) {
            try {
              const fetchHeaders: Record<string, string> = {};
              if (accessToken) {
                fetchHeaders['Authorization'] = `Bearer ${accessToken}`;
              }

              const dlResp = await fetch(dUrl, {
                headers: fetchHeaders,
                redirect: 'follow',
              });

              if (dlResp.ok) {
                const arrayBuffer = await dlResp.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                if (buffer.length > 500) {
                  const workbook = XLSX.read(buffer, { type: 'buffer' });
                  if (workbook && workbook.SheetNames && workbook.SheetNames.length > 0) {
                    const parsedTabs: Record<string, { name: string; headers: string[]; rows: any[] }> = {};

                    workbook.SheetNames.forEach((sheetName) => {
                      const worksheet = workbook.Sheets[sheetName];
                      if (!worksheet) return;

                      const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, {
                        header: 1,
                        defval: '',
                      }) as any[][];

                      if (!rawMatrix || rawMatrix.length === 0) return;

                      const headerRow = rawMatrix[0] || [];
                      const headers = headerRow.map((h: any, idx: number) => String(h || `COL_${idx + 1}`).trim());

                      const rows: any[] = [];
                      for (let r = 1; r < rawMatrix.length; r++) {
                        const rowVals = rawMatrix[r];
                        if (!rowVals || rowVals.length === 0) continue;

                        let hasContent = false;
                        const rowObj: any = { _rowIndex: r + 1 };

                        headers.forEach((hdr, cIdx) => {
                          const cellVal = rowVals[cIdx];
                          if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '') {
                            hasContent = true;
                          }
                          rowObj[hdr] = cellVal !== undefined && cellVal !== null ? String(cellVal) : '';
                        });

                        if (hasContent) {
                          rows.push(rowObj);
                        }
                      }

                      parsedTabs[sheetName] = {
                        name: sheetName,
                        headers,
                        rows,
                      };
                    });

                    if (Object.keys(parsedTabs).length > 0) {
                      res.json({
                        success: true,
                        source: 'google_drive_xlsx_live',
                        spreadsheetTitle: 'Planilha Excel / Google Drive',
                        updatedAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
                        tabs: parsedTabs,
                      });
                      return;
                    }
                  }
                }
              }
            } catch (xlsxFetchErr) {
              // Try next URL
            }
          }
        } catch (xlsxErr) {
          console.warn('Direct XLSX download failed, falling back to GViz:', xlsxErr);
        }
      }

      // 4. Strategy 4: Google Visualization API (GViz) for Shared / Public Spreadsheets
      if (spreadsheetId) {
        try {
          const possibleTabs = [
            '📥 Entrada',
            'Entrada',
            'ENTRADA',
            '📤 Saída',
            'Saída',
            'Saida',
            'SAIDA',
            '⛽ Combustível',
            'Combustível',
            'Combustivel',
            'Abastecimento',
            '🔍 Qualidade 51',
            'Qualidade 51',
            'Qualidade',
            '51',
            '📋 Fila PDC',
            'Fila PDC',
            'PDC',
            'Página1',
            'Sheet1',
            'Planilha1',
          ];

          const gvizTabs: Record<string, { name: string; headers: string[]; rows: any[] }> = {};

          await Promise.all(
            possibleTabs.map(async (sheetName) => {
              try {
                const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
                  sheetName
                )}`;
                const gvizResp = await fetch(gvizUrl, { redirect: 'follow' });
                if (!gvizResp.ok) return;

                const text = await gvizResp.text();
                const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
                if (!match || !match[1]) return;

                const gvizJson = JSON.parse(match[1]);
                if (!gvizJson.table || !gvizJson.table.rows) return;

                const cols = gvizJson.table.cols || [];
                const rawRows = gvizJson.table.rows || [];
                if (rawRows.length === 0 && cols.length === 0) return;

                let headers: string[] = cols
                  .map((c: any) => c.label || '')
                  .filter(Boolean);
                let startRowIdx = 0;

                if (headers.length === 0 && rawRows.length > 0) {
                  headers = (rawRows[0]?.c || [])
                    .map((cell: any) => (cell?.v !== undefined && cell?.v !== null ? String(cell.v).trim() : ''))
                    .filter(Boolean);
                  startRowIdx = 1;
                }

                if (headers.length === 0) {
                  headers = ['DATA', 'HORA', 'CONDUTOR', 'PLACA', 'ORIGEM', 'DESTINO', 'KM (ODÔMETRO)', 'NÍVEL DO COMBUSTÍVEL', 'LITROS ABASTECIDOS', 'TIPO DE COMBUSTÍVEL', 'OBSERVAÇÕES'];
                }

                const rows: any[] = [];
                for (let r = startRowIdx; r < rawRows.length; r++) {
                  const cellObjs = rawRows[r]?.c || [];
                  const rowItem: any = { _rowIndex: r + 1 };
                  let hasData = false;

                  headers.forEach((h, cIdx) => {
                    const cell = cellObjs[cIdx];
                    const val =
                      cell?.f !== undefined && cell?.f !== null
                        ? cell.f
                        : cell?.v !== undefined && cell?.v !== null
                        ? cell.v
                        : '';
                    if (val !== '' && val !== null && val !== undefined) {
                      hasData = true;
                    }
                    rowItem[h || `COL_${cIdx + 1}`] = val !== null && val !== undefined ? String(val) : '';
                  });

                  if (hasData) {
                    rows.push(rowItem);
                  }
                }

                if (rows.length > 0 || headers.length > 0) {
                  gvizTabs[sheetName] = {
                    name: sheetName,
                    headers,
                    rows,
                  };
                }
              } catch (tabErr) {
                // Ignore individual tab errors
              }
            })
          );

          if (Object.keys(gvizTabs).length > 0) {
            res.json({
              success: true,
              source: 'google_sheets_gviz_live',
              spreadsheetTitle: 'Planilha Online Google Drive',
              updatedAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
              tabs: gvizTabs,
            });
            return;
          }
        } catch (gvizAllErr) {
          console.warn('GViz query failed, falling back to server records:', gvizAllErr);
        }
      }

      // 5. Strategy 5: Faithful structured 5-tab output from server synced records
      const STANDARD_HEADERS = [
        'DATA',
        'HORA',
        'OPERADOR (AUDITORIA)',
        'PLACA',
        'CONDUTOR',
        'KM (ODÔMETRO)',
        'NÍVEL DO COMBUSTÍVEL',
        'LITROS ABASTECIDOS',
        'TIPO DE COMBUSTÍVEL',
        'DESTINO',
        'OBSERVAÇÕES'
      ];

      const allRecords = loadServerRecords();
      const tabs: Record<string, { name: string; headers: string[]; rows: any[] }> = {
        '📥 Entrada': {
          name: '📥 Entrada',
          headers: [...STANDARD_HEADERS],
          rows: [],
        },
        '📤 Saída': {
          name: '📤 Saída',
          headers: [...STANDARD_HEADERS],
          rows: [],
        },
        '⛽ Combustível': {
          name: '⛽ Combustível',
          headers: [...STANDARD_HEADERS],
          rows: [],
        },
        '🔍 Qualidade 51': {
          name: '🔍 Qualidade 51',
          headers: [...STANDARD_HEADERS],
          rows: [],
        },
        '📋 Fila PDC': {
          name: '📋 Fila PDC',
          headers: [...STANDARD_HEADERS],
          rows: [],
        },
      };

      // Sort newest first (pilha / LIFO - último registro no topo)
      const sortedRecords = [...allRecords].sort((a: any, b: any) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      sortedRecords.forEach((r: any) => {
        const d = new Date(r.createdAt || Date.now());
        const dateStr = d.toLocaleDateString('pt-BR');
        const timeStr = d.toLocaleTimeString('pt-BR');
        const op = String(r.operationType || '').toLowerCase();

        const operador = String(r.operatorName || 'OPERADOR').toUpperCase().trim();
        const condutor = String(r.driverName || r.condutor || '-').toUpperCase().trim();
        const placa = (r.plate || r.placa || '').toUpperCase().trim();
        const destino = String(r.destination || r.destino || (op === 'pdc' ? 'FILA PDC (LAVAGEM/OFICINA)' : '-')).toUpperCase().trim();
        const km = r.km ? `${String(r.km).replace(/\s*km/i, '').toUpperCase().trim()} KM` : (r.odometro ? `${String(r.odometro).replace(/\s*km/i, '').toUpperCase().trim()} KM` : '-');
        const nivelCombustivel = String(r.fuel || r.nivelCombustivel || r.combustivel || '-').toUpperCase().trim();
        const litrosAbastecidos = r.liters ? `${String(r.liters).replace(/\s*l/i, '').toUpperCase().trim()} L` : (r.litros ? `${String(r.litros).replace(/\s*l/i, '').toUpperCase().trim()} L` : '-');
        const tipoCombustivel = String(r.fuelType || r.tipoCombustivel || (op === 'abastecimento' || op === 'combustivel' ? 'DIESEL S10' : '-')).toUpperCase().trim();

        const extras: string[] = [];
        if (r.hasSpareKey !== undefined && r.hasSpareKey !== null) {
          extras.push(`CHAVE RESERVA: ${r.hasSpareKey ? 'SIM' : 'NÃO'}`);
        }
        if (r.fleetType) extras.push(`FROTA: ${String(r.fleetType).toUpperCase().trim()}`);
        if (r.entrySubtype) extras.push(`SUBTIPO: ${String(r.entrySubtype).toUpperCase().trim()}`);
        if (r.entryReason) extras.push(`MOTIVO: ${String(r.entryReason).toUpperCase().trim()}`);
        if (r.characteristic) extras.push(`CARACTERÍSTICA: ${String(r.characteristic).toUpperCase().trim()}`);
        if (r.location) extras.push(`LOCAL/POSTE: ${String(r.location).toUpperCase().trim()}`);
        if (r.origin) extras.push(`ORIGEM: ${String(r.origin).toUpperCase().trim()}`);

        let observacoes = r.notes || r.description || r.observacoes || '';
        if (extras.length > 0) {
          const extraStr = `[${extras.join(' | ')}]`;
          observacoes = observacoes ? `${extraStr} ${observacoes.toUpperCase().trim()}` : extraStr;
        }
        if (!observacoes) observacoes = '-';
        observacoes = observacoes.toUpperCase().trim();

        const rowObj = {
          DATA: dateStr,
          HORA: timeStr,
          'OPERADOR (AUDITORIA)': operador,
          PLACA: placa,
          CONDUTOR: condutor,
          'KM (ODÔMETRO)': km,
          'NÍVEL DO COMBUSTÍVEL': nivelCombustivel,
          'LITROS ABASTECIDOS': litrosAbastecidos,
          'TIPO DE COMBUSTÍVEL': tipoCombustivel,
          DESTINO: destino,
          OBSERVAÇÕES: observacoes,
          _rawDate: r.createdAt,
          _plate: placa,
        };

        if (op === 'saida' || op === 'saída') {
          tabs['📤 Saída'].rows.push(rowObj);
        } else if (op === 'abastecimento' || op === 'combustivel') {
          tabs['⛽ Combustível'].rows.push(rowObj);
        } else if (op === 'qualidade_51' || op === 'qualidade') {
          tabs['🔍 Qualidade 51'].rows.push(rowObj);
        } else if (op === 'pdc') {
          tabs['📋 Fila PDC'].rows.push(rowObj);
        } else {
          tabs['📥 Entrada'].rows.push(rowObj);
        }
      });

      res.setHeader('Content-Type', 'application/json');
      res.json({
        success: true,
        source: 'server_synced_store',
        spreadsheetTitle: 'Planilha CMDIT',
        updatedAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        tabs,
      });
    } catch (err: any) {
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Criar Planilha no Google Drive com 5 abas organizadas
  app.post('/api/sheets/create', async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : req.body.accessToken;

      if (!accessToken) {
        res.status(401).json({
          success: false,
          error: 'Token de acesso Google não fornecido.',
        });
        return;
      }

      const result = await createStandardFleetSpreadsheet(accessToken);
      res.json({
        success: true,
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl,
      });
    } catch (err: any) {
      console.error('Sheets Create Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Falha ao criar planilha no Google Drive.',
      });
    }
  });

  // API Route: Gravar Registro de Veículo na Planilha (Modo Append-Only)
  app.post('/api/sheets/append', async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : req.body.accessToken;

      const { spreadsheetId, record } = req.body;

      if (!accessToken) {
        res.status(401).json({
          success: false,
          error: 'Token de acesso Google não fornecido.',
        });
        return;
      }

      if (!spreadsheetId || !record) {
        res.status(400).json({
          success: false,
          error: 'spreadsheetId ou dados do registro ausentes.',
        });
        return;
      }

      const result = await appendVehicleRecordToSheet(spreadsheetId, record, accessToken);
      res.json({
        success: true,
        tabName: result.tabName,
        updatedRange: result.updatedRange,
      });
    } catch (err: any) {
      console.error('Sheets Append Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Falha ao registrar dados na planilha.',
      });
    }
  });

  // API Route: Inicializar ou Criar Todas as 4 Abas Oficiais na Planilha
  app.post('/api/sheets/init-tabs', async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : req.body.accessToken;

      const { spreadsheetId } = req.body;

      if (!accessToken) {
        res.status(401).json({
          success: false,
          error: 'Token de acesso Google não fornecido.',
        });
        return;
      }

      if (!spreadsheetId) {
        res.status(400).json({
          success: false,
          error: 'spreadsheetId ausente.',
        });
        return;
      }

      const result = await initializeAllSpreadsheetTabs(spreadsheetId, accessToken);
      res.json({
        success: true,
        tabs: result.tabs,
      });
    } catch (err: any) {
      console.error('Sheets Init Tabs Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Falha ao estruturar abas na planilha.',
      });
    }
  });

  // API Route: Dedicated Python Engine Endpoint
  app.post('/api/ocr/python-plate', async (req: Request, res: Response): Promise<void> => {
    try {
      const { photoDataUrl } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ success: false, error: 'API Key missing' });
        return;
      }
      const result = await executePythonEngine(photoDataUrl, apiKey);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Ultra-Fast In-Memory Vision Core with Zero Hallucination
  app.post('/api/ocr/gemini-plate', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    try {
      const { photoDataUrl } = req.body;

      if (!photoDataUrl || typeof photoDataUrl !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Foto não fornecida ou formato inválido.',
        });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          success: false,
          error: 'Chave GEMINI_API_KEY não configurada no servidor.',
        });
        return;
      }

      // Fast base64 parser
      let mimeType = 'image/jpeg';
      let base64Data = photoDataUrl;

      const commaIdx = photoDataUrl.indexOf(',');
      if (commaIdx !== -1) {
        const header = photoDataUrl.substring(0, commaIdx);
        base64Data = photoDataUrl.substring(commaIdx + 1);
        const mimeMatch = header.match(/data:([^;]+);/);
        if (mimeMatch) mimeType = mimeMatch[1];
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Streamlined prompt optimized for sub-500ms token generation
      const systemInstruction = `Perito em identificação de placas veiculares brasileiras (Mercosul e Antiga).
REGRAS ESTRITAS DE ZERO ALUCINAÇÃO:
1. Extraia os 7 caracteres da chapa da placa do veículo. Se não houver placa visível ou for ilegível, found: false e plate: "".
2. Ignore marcas do carro, molduras e textos como BRASIL/MERCOSUL.
3. Formatos:
   - Mercosul Carro: LLLNLNN (Pos 1-3 Letras; Pos 4 Número; Pos 5 Letra; Pos 6-7 Números)
   - Mercosul Moto: LLLNNLN (Pos 1-3 Letras; Pos 4-5 Números; Pos 6 Letra; Pos 7 Número)
   - Placa Antiga: LLLNNNN (Pos 1-3 Letras; Pos 4-7 Números)
4. Coordenadas da placa no boundingBox [ymin, xmin, ymax, xmax] normalizadas de 0 a 1000.`;

      let lastError: any = null;

      // Try fast-path models sequentially
      for (const modelName of FAST_VISION_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
              {
                text: 'Leia a placa veicular brasileira desta imagem imediatamente.',
              },
            ],
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  found: { type: Type.BOOLEAN },
                  plate: { type: Type.STRING },
                  plateType: { type: Type.STRING },
                  boundingBox: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                  },
                  isCertain: { type: Type.BOOLEAN },
                  analysisNotes: { type: Type.STRING },
                },
                required: ['found', 'plate', 'isCertain'],
              },
              temperature: 0.0,
            },
          });

          const responseText = response.text?.trim() || '{}';
          let parsedData: any = {};

          try {
            parsedData = JSON.parse(responseText);
          } catch {
            console.warn('JSON parse warning:', responseText);
          }

          const rawPlate = (parsedData.plate || '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 7);

          const isFound = Boolean(parsedData.found && rawPlate.length === 7);
          const elapsedMs = Date.now() - startTime;

          res.json({
            success: true,
            engine: 'high_speed_vision_engine',
            modelUsed: modelName,
            found: isFound,
            plate: rawPlate,
            plateType: parsedData.plateType || 'mercosul_car',
            boundingBox: parsedData.boundingBox || null,
            isCertain: Boolean(parsedData.isCertain),
            analysisNotes: parsedData.analysisNotes || `Lido em ${elapsedMs}ms via ${modelName}`,
            processingTimeMs: elapsedMs,
          });
          return;
        } catch (modelErr: any) {
          console.warn(`Model ${modelName} fast-path error:`, modelErr.message);
          lastError = modelErr;
        }
      }

      // If fast-path had temporary issues, fallback to Python engine
      const pyResult = await executePythonEngine(photoDataUrl, apiKey);
      if (pyResult && pyResult.success) {
        res.json({
          ...pyResult,
          processingTimeMs: Date.now() - startTime,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: lastError?.message || 'Falha ao processar visão computacional.',
      });
    } catch (err: any) {
      console.error('Vision API Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Erro ao processar imagem.',
      });
    }
  });

  // Vite middleware for development vs Static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
