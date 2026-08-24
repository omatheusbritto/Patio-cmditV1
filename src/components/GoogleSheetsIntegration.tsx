import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  ExternalLink,
  PlusCircle,
  Layers,
  Sparkles,
  LogOut,
  AlertTriangle,
  LogIn,
} from 'lucide-react';
import {
  getStoredDriveConfig,
  saveDriveConfig,
  getCachedGoogleToken,
  requestGoogleAccessToken,
  createDriveSpreadsheet,
  clearGoogleToken,
  initAuth,
  initSpreadsheetTabs,
} from '../utils/googleDriveClient';
import { getCurrentSession } from '../utils/authService';

interface GoogleSheetsIntegrationProps {
  onSyncTriggered?: () => void;
}

export const GoogleSheetsIntegration: React.FC<GoogleSheetsIntegrationProps> = ({
  onSyncTriggered,
}) => {
  const [config, setConfig] = useState(getStoredDriveConfig());
  const [token, setToken] = useState<string | null>(getCachedGoogleToken());
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [manualIdInput, setManualIdInput] = useState('');
  const [showManualSetup, setShowManualSetup] = useState(false);

  const session = getCurrentSession();
  const isMaster = session?.user.role === 'master' || session?.user.username.toLowerCase() === 'mastercmdit';

  useEffect(() => {
    const unsubscribe = initAuth(
      (_user, activeToken) => {
        setToken(activeToken);
      },
      () => {
        setToken(getCachedGoogleToken());
      }
    );
    setConfig(getStoredDriveConfig());
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Strict User Access Control: Ordinary operators do NOT see or access the Google Sheets panel
  if (!isMaster) {
    return null;
  }

  const handleConnectAndCreateSpreadsheet = async () => {
    if (!isMaster) return;

    setIsLoading(true);
    setStatusMsg({ text: 'Conectando ao Google Drive...', type: 'info' });

    try {
      let activeToken = token || getCachedGoogleToken();
      if (!activeToken) {
        setStatusMsg({ text: 'Solicitando permissão no Google...', type: 'info' });
        activeToken = await requestGoogleAccessToken();
        setToken(activeToken);
      }

      setStatusMsg({ text: 'Criando planilha oficial com as 5 abas organizadas...', type: 'info' });
      const result = await createDriveSpreadsheet(activeToken);
      
      const newConfig = saveDriveConfig({
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl,
        autoSync: true,
      });
      setConfig(newConfig);

      setStatusMsg({
        text: 'Planilha criada com sucesso no seu Google Drive com as 5 abas oficiais!',
        type: 'success',
      });
      if (onSyncTriggered) onSyncTriggered();
    } catch (err: any) {
      console.error('Spreadsheet create error:', err);
      setStatusMsg({
        text: err.message || 'Falha ao criar planilha. Verifique a permissão do Google.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveManualId = () => {
    if (!isMaster) return;
    if (!manualIdInput.trim()) return;
    let cleanId = manualIdInput.trim();
    // Support pasting full Google Sheets URL
    const urlMatch = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch && urlMatch[1]) {
      cleanId = urlMatch[1];
    }

    const newConfig = saveDriveConfig({
      spreadsheetId: cleanId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
      autoSync: true,
    });
    setConfig(newConfig);
    setShowManualSetup(false);
    setManualIdInput('');
    setStatusMsg({
      text: 'ID da Planilha vinculado com sucesso!',
      type: 'success',
    });
  };

  const handleDisconnect = () => {
    if (!isMaster) return;
    clearGoogleToken();
    setToken(null);
    const newConfig = saveDriveConfig({
      spreadsheetId: null,
      spreadsheetUrl: null,
    });
    setConfig(newConfig);
    setStatusMsg({ text: 'Desconectado da planilha.', type: 'info' });
  };

  const handleStructureTabs = async () => {
    if (!isMaster || !config.spreadsheetId) return;

    setIsLoading(true);
    setStatusMsg({ text: 'Verificando e estruturando as 5 abas no Google Sheets...', type: 'info' });

    try {
      let activeToken = token || getCachedGoogleToken();
      if (!activeToken) {
        setStatusMsg({ text: 'Solicitando permissão no Google...', type: 'info' });
        activeToken = await requestGoogleAccessToken();
        setToken(activeToken);
      }

      const result = await initSpreadsheetTabs(config.spreadsheetId, activeToken);
      setStatusMsg({
        text: `5 Abas estruturadas com sucesso: ${result.tabs.join(', ')}`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Structure tabs error:', err);
      setStatusMsg({
        text: err.message || 'Falha ao estruturar abas.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-neutral-900 leading-tight flex items-center gap-1.5">
              Planilha Oficial Google Sheets
              <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Painel Master
              </span>
            </h3>
            <p className="text-[11px] text-neutral-500">
              Gravação automática em 5 abas oficiais separadas
            </p>
          </div>
        </div>

        {config.spreadsheetId ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" />
            Ativa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-[10px] font-bold">
            Não Vinculada
          </span>
        )}
      </div>

      {/* 5 Tabs visual overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 py-1">
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-1.5 text-center">
          <span className="text-[9px] font-black text-neutral-700 block uppercase">📥 Entrada</span>
          <span className="text-[8.5px] text-neutral-400">Origem, KM, Motivo</span>
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-1.5 text-center">
          <span className="text-[9px] font-black text-neutral-700 block uppercase">📤 Saída</span>
          <span className="text-[8.5px] text-neutral-400">Destino, KM, Chave</span>
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-1.5 text-center">
          <span className="text-[9px] font-black text-neutral-700 block uppercase">⛽ Combustível</span>
          <span className="text-[8.5px] text-neutral-400">Litros, KM, Posto</span>
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-1.5 text-center">
          <span className="text-[9px] font-black text-amber-800 block uppercase">📋 Fila PDC</span>
          <span className="text-[8.5px] text-neutral-400">Lavagem, Oficina</span>
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-1.5 text-center">
          <span className="text-[9px] font-black text-indigo-800 block uppercase">🔍 Qualidade 51</span>
          <span className="text-[8.5px] text-neutral-400">Pátio, Tag, Vistoria</span>
        </div>
      </div>

      {/* Status Message */}
      {statusMsg && (
        <div
          className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : statusMsg.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {statusMsg.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 shrink-0" />
          )}
          <span className="leading-tight">{statusMsg.text}</span>
        </div>
      )}

      {/* Action Buttons / Master Panel */}
      {config.spreadsheetId ? (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-2">
            <a
              href={config.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Abrir Planilha Oficial no Drive</span>
            </a>

            {!token && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsLoading(true);
                    setStatusMsg({ text: 'Autorizando acesso ao Google Sheets...', type: 'info' });
                    const newToken = await requestGoogleAccessToken();
                    setToken(newToken);
                    setStatusMsg({ text: 'Conta Google autorizada para gravação com sucesso!', type: 'success' });
                  } catch (e: any) {
                    setStatusMsg({ text: e.message || 'Falha ao autorizar no Google', type: 'error' });
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Conectar Conta Google para Gravação Automática"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Autorizar Gravação</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDisconnect}
              className="p-2.5 rounded-xl border border-neutral-300 text-neutral-600 hover:bg-neutral-100 transition cursor-pointer"
              title="Desconectar Planilha (Master)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[10px] text-neutral-500 text-center font-medium">
            ⚡ Gravação 100% automática: cada registro enviado via WhatsApp gera uma linha na respectiva aba com o carimbo do operador.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              disabled={isLoading}
              onClick={handleStructureTabs}
              className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Criar ou Verificar as 5 Abas Oficiais na Planilha"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Atualizar / Estruturar 5 Abas Oficiais</span>
            </button>

            <button
              type="button"
              onClick={() => setShowManualSetup(!showManualSetup)}
              className="text-[11px] text-neutral-500 hover:text-neutral-800 underline font-medium cursor-pointer"
            >
              {showManualSetup ? 'Ocultar alteração de link' : 'Alterar Link / ID da Planilha'}
            </button>
          </div>

          {showManualSetup && (
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col gap-2 mt-1">
              <label className="text-[11px] font-bold text-neutral-700">
                Cole o novo link ou ID da planilha do Google:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/... ou ID"
                  value={manualIdInput}
                  onChange={(e) => setManualIdInput(e.target.value)}
                  className="flex-1 bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-emerald-600"
                />
                <button
                  type="button"
                  onClick={handleSaveManualId}
                  className="bg-neutral-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-800 cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleConnectAndCreateSpreadsheet}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Criar Nova Planilha Oficial no Google Drive (5 Abas)</span>
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowManualSetup(!showManualSetup)}
              className="text-[11px] text-neutral-500 hover:text-neutral-800 underline font-medium cursor-pointer"
            >
              {showManualSetup ? 'Ocultar inserção manual' : 'Já tem uma planilha existente? Vincular por ID ou Link'}
            </button>
          </div>

          {showManualSetup && (
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col gap-2 mt-1">
              <label className="text-[11px] font-bold text-neutral-700">
                Cole o link ou ID da planilha já existente:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/... ou ID"
                  value={manualIdInput}
                  onChange={(e) => setManualIdInput(e.target.value)}
                  className="flex-1 bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-emerald-600"
                />
                <button
                  type="button"
                  onClick={handleSaveManualId}
                  className="bg-neutral-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-800 cursor-pointer"
                >
                  Vincular
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
