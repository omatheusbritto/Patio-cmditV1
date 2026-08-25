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
  Copy,
  Check,
  Zap,
  Code2,
  HelpCircle,
  PlayCircle,
} from 'lucide-react';
import {
  getStoredDriveConfig,
  saveDriveConfig,
  fetchServerDriveConfig,
  getCachedGoogleToken,
  requestGoogleAccessToken,
  createDriveSpreadsheet,
  clearGoogleToken,
  initAuth,
  initSpreadsheetTabs,
  testWebhookUrl,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL,
} from '../utils/googleDriveClient';
import { getCurrentSession } from '../utils/authService';

interface GoogleSheetsIntegrationProps {
  onSyncTriggered?: () => void;
  onOpenSpreadsheetOnline?: () => void;
}

export const GoogleSheetsIntegration: React.FC<GoogleSheetsIntegrationProps> = ({
  onSyncTriggered,
  onOpenSpreadsheetOnline,
}) => {
  const [config, setConfig] = useState(getStoredDriveConfig());
  const [token, setToken] = useState<string | null>(getCachedGoogleToken());
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Inputs
  const [webhookInput, setWebhookInput] = useState(config.webhookUrl || '');
  const [manualIdInput, setManualIdInput] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showManualSetup, setShowManualSetup] = useState(false);

  const session = getCurrentSession();
  const isMaster = session?.user.role === 'master' || session?.user.username.toLowerCase() === 'mastercmdit';

  useEffect(() => {
    fetchServerDriveConfig().then((serverCfg) => {
      setConfig(serverCfg);
      if (serverCfg.webhookUrl) {
        setWebhookInput(serverCfg.webhookUrl);
      }
    });

    const unsubscribe = initAuth(
      (_user, activeToken) => {
        setToken(activeToken);
      },
      () => {
        setToken(getCachedGoogleToken());
      }
    );
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Strict User Access Control: Ordinary operators do NOT see or access the Google Sheets panel
  if (!isMaster) {
    return null;
  }

  const handleSaveWebhook = () => {
    if (!isMaster) return;
    const cleanUrl = webhookInput.trim();
    const newConfig = saveDriveConfig({
      webhookUrl: cleanUrl || null,
      autoSync: true,
    });
    setConfig(newConfig);
    setStatusMsg({
      text: cleanUrl
        ? '✅ URL do Webhook salva com sucesso! Todos os celulares agora gravam direto na planilha.'
        : 'Webhook removido.',
      type: 'success',
    });
  };

  const handleTestWebhook = async (opType: string = 'entrada') => {
    const urlToTest = webhookInput.trim() || config.webhookUrl;
    if (!urlToTest) {
      setStatusMsg({
        text: 'Por favor, cole a URL do Webhook do Google Apps Script antes de testar.',
        type: 'error',
      });
      return;
    }

    setIsTesting(true);
    setStatusMsg({ text: `Enviando linha de teste para ${opType.toUpperCase()}...`, type: 'info' });

    try {
      const res = await testWebhookUrl(urlToTest, opType);
      setStatusMsg({
        text: `🎉 Sucesso! Gravado na aba: ${res.tabName || 'Planilha'}`,
        type: 'success',
      });
      // Save config if not already saved
      if (urlToTest !== config.webhookUrl) {
        saveDriveConfig({ webhookUrl: urlToTest, autoSync: true });
        setConfig(getStoredDriveConfig());
      }
    } catch (err: any) {
      setStatusMsg({
        text: err.message || 'Falha ao comunicar com o Webhook. Verifique se a implantação está para "Qualquer pessoa".',
        type: 'error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    } catch {
      alert('Não foi possível copiar automaticamente. Selecione e copie o código manualmente.');
    }
  };

  const handleSaveManualId = () => {
    if (!isMaster) return;
    if (!manualIdInput.trim()) return;
    let cleanId = manualIdInput.trim();
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
      webhookUrl: null,
      spreadsheetId: null,
      spreadsheetUrl: null,
    });
    setConfig(newConfig);
    setWebhookInput('');
    setStatusMsg({ text: 'Desconectado da planilha.', type: 'info' });
  };

  const hasWebhook = Boolean(config.webhookUrl);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-neutral-900 leading-tight flex items-center gap-1.5">
              Gravação Direta na Planilha Google
              <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Painel Master
              </span>
            </h3>
            <p className="text-[11px] text-neutral-500">
              5 abas oficiais automáticas • Sem login do Google nos celulares
            </p>
          </div>
        </div>

        {hasWebhook ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Gravação Automática Ativa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
            Configuração Pendente
          </span>
        )}
      </div>

      {/* 5 Tabs visual overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
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
          className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : statusMsg.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {statusMsg.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span className="leading-tight">{statusMsg.text}</span>
        </div>
      )}

      {/* Action Button: Consultar Planilha Online */}
      {onOpenSpreadsheetOnline && (
        <button
          type="button"
          onClick={onOpenSpreadsheetOnline}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-2.5 px-4 rounded-xl flex items-center justify-between shadow-md active:scale-98 transition cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <span>Consultar Planilha Online (5 Abas)</span>
          </div>
          <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full group-hover:bg-emerald-500 transition">
            Abrir Painel ➔
          </span>
        </button>
      )}

      {/* Direct Webhook Configuration Card */}
      <div className="bg-neutral-50 rounded-xl p-3.5 border border-neutral-200/80 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-black text-neutral-800">
              Webhook Direto Google Apps Script (Recomendado)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showInstructions ? 'Ocultar Tutorial' : 'Como Gerar em 1 Minuto?'}</span>
          </button>
        </div>

        <p className="text-[11px] text-neutral-600 leading-relaxed">
          Com a URL do Webhook configurada, <strong>qualquer celular da empresa grava instantaneamente</strong> na sua planilha Google sem precisar de login, sem popups e sem erros de verificação do Google!
        </p>

        {/* Instructions dropdown */}
        {showInstructions && (
          <div className="bg-white rounded-xl p-3 border border-emerald-200 text-xs text-neutral-700 flex flex-col gap-2.5 my-1">
            <div className="flex items-center justify-between font-black text-emerald-900 border-b border-emerald-100 pb-1.5">
              <span>Passo a Passo Rápido (1 minuto):</span>
              <button
                type="button"
                onClick={handleCopyScript}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition active:scale-95"
              >
                {copiedScript ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedScript ? 'Copiado!' : '1. Copiar Código do Script'}</span>
              </button>
            </div>

            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-neutral-600">
              <li>Abra sua Planilha Google no computador ou navegador.</li>
              <li>Clique no menu superior em: <strong>Extensões ➔ Apps Script</strong>.</li>
              <li>Apague o que estiver lá, <strong>cole o código copiado</strong> e salve (Ctrl+S).</li>
              <li>Clique no botão azul superior: <strong>Implantar ➔ Nova implantação</strong>.</li>
              <li>Escolha tipo: <strong>Aplicativo da Web</strong> (Web app).</li>
              <li>Em <em>"Quem pode acessar"</em>, selecione: <strong>Qualquer pessoa (Anyone)</strong>.</li>
              <li>Clique em <strong>Implantar</strong>, copie a URL gerada e cole no campo abaixo.</li>
            </ol>
          </div>
        )}

        {/* Input for Webhook URL */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="url"
            placeholder="Cole aqui a URL (ex: https://script.google.com/macros/s/.../exec)"
            value={webhookInput}
            onChange={(e) => setWebhookInput(e.target.value)}
            className="flex-1 bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs focus:outline-emerald-600 font-mono text-neutral-800"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveWebhook}
              className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-sm"
            >
              Salvar URL
            </button>
          </div>
        </div>

        {/* Quick Test Buttons for each Tab */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-neutral-200/60">
          <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">
            Testar Gravação em Cada Aba:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              disabled={isTesting}
              onClick={() => handleTestWebhook('entrada')}
              className="bg-white hover:bg-emerald-50 border border-neutral-200 hover:border-emerald-300 text-neutral-800 hover:text-emerald-700 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <span>📥 Testar Entrada</span>
            </button>
            <button
              type="button"
              disabled={isTesting}
              onClick={() => handleTestWebhook('saida')}
              className="bg-white hover:bg-rose-50 border border-neutral-200 hover:border-rose-300 text-neutral-800 hover:text-rose-700 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <span>📤 Testar Saída</span>
            </button>
            <button
              type="button"
              disabled={isTesting}
              onClick={() => handleTestWebhook('abastecimento')}
              className="bg-white hover:bg-sky-50 border border-neutral-200 hover:border-sky-300 text-neutral-800 hover:text-sky-700 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <span>⛽ Testar Abastec.</span>
            </button>
            <button
              type="button"
              disabled={isTesting}
              onClick={() => handleTestWebhook('qualidade_51')}
              className="bg-white hover:bg-purple-50 border border-neutral-200 hover:border-purple-300 text-neutral-800 hover:text-purple-700 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <span>🔍 Testar Qualidade</span>
            </button>
          </div>
        </div>
      </div>

      {/* Spreadsheet Links and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-100">
        <a
          href={config.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${config.spreadsheetId || DEFAULT_SPREADSHEET_ID}/edit`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Abrir Planilha Oficial no Google Drive</span>
        </a>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyScript}
            className="text-[11px] font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
            title="Copiar código para o Google Apps Script"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{copiedScript ? 'Código Copiado!' : 'Copiar Script 5 Abas'}</span>
          </button>

          {hasWebhook && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
              title="Remover configuração"
            >
              Desconectar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

