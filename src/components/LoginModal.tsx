import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  KeyRound,
  AlertCircle,
  LogIn,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  Database,
  ShieldCheck,
  Server,
  AlertTriangle,
} from 'lucide-react';
import {
  loginUser,
  restoreUsersFromSheetClient,
  fetchServerUsers,
  checkDatabaseHealth,
  configureDatabaseUrl,
} from '../utils/authService';
import { AuthSession } from '../types';
import { DatabaseTestModal } from './DatabaseTestModal';

interface LoginModalProps {
  onLoginSuccess: (session: AuthSession) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sincronização direta com a Planilha Google
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal e Status do Banco de Dados
  const [isDbTestOpen, setIsDbTestOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    tested: boolean;
    connected: boolean;
    type: string;
    userCount: number;
    latency: number;
  }>({
    tested: false,
    connected: false,
    type: '',
    userCount: 0,
    latency: 0,
  });

  // Conexão rápida da URL externa (Protegida por senha de usuário Master)
  const [quickDbUrl, setQuickDbUrl] = useState('');
  const [masterPasswordForDb, setMasterPasswordForDb] = useState('');
  const [showMasterPasswordForDb, setShowMasterPasswordForDb] = useState(false);
  const [showExternalUrlForm, setShowExternalUrlForm] = useState(false);
  const [isSavingQuickUrl, setIsSavingQuickUrl] = useState(false);
  const [quickUrlMsg, setQuickUrlMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const refreshDbStatus = async () => {
    try {
      const diag = await checkDatabaseHealth();
      setDbStatus({
        tested: true,
        connected: diag.status === 'connected',
        type: diag.type,
        userCount: diag.userCount,
        latency: diag.latencyMs,
      });
      return diag;
    } catch {
      setDbStatus({
        tested: true,
        connected: false,
        type: 'local',
        userCount: 0,
        latency: 0,
      });
    }
  };

  // Checa status do banco ao carregar tela
  useEffect(() => {
    refreshDbStatus();
  }, []);

  const handleQuickSaveDbUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickUrlMsg(null);

    if (!quickDbUrl.trim()) {
      setQuickUrlMsg({ text: 'Informe a URL EXTERNAL do PostgreSQL.', isError: true });
      return;
    }

    if (!masterPasswordForDb.trim()) {
      setQuickUrlMsg({
        text: 'Acesso restrito: Digite a senha de usuário Master para autorizar.',
        isError: true,
      });
      return;
    }

    setIsSavingQuickUrl(true);
    try {
      const res = await configureDatabaseUrl(quickDbUrl.trim(), masterPasswordForDb.trim());
      if (res.success) {
        setQuickUrlMsg({ text: 'Conectado ao PostgreSQL com sucesso!', isError: false });
        await refreshDbStatus();
        setQuickDbUrl('');
        setMasterPasswordForDb('');
        setShowExternalUrlForm(false);
      } else {
        setQuickUrlMsg({ text: res.message || 'Falha ao conectar na URL informada.', isError: true });
      }
    } catch (err: any) {
      setQuickUrlMsg({ text: err?.message || 'Erro de conexão.', isError: true });
    } finally {
      setIsSavingQuickUrl(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSyncFeedback(null);

    if (!username.trim()) {
      setErrorMsg('Informe o usuário ou matrícula.');
      return;
    }
    if (!password.trim()) {
      setErrorMsg('Informe a senha.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginUser(username, password);
      setIsLoading(false);

      if (result.success && result.session) {
        onLoginSuccess(result.session);
      } else {
        setErrorMsg(result.error || 'Credenciais inválidas.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg('Erro de conexão ao autenticar. Tente novamente.');
    }
  };

  const handleSyncFromSpreadsheet = async () => {
    setErrorMsg(null);
    setSyncFeedback(null);
    setIsSyncingSheet(true);

    try {
      // 1. Tenta restaurar diretamente da aba USUARIOS_CMDIT da Planilha Google
      const result = await restoreUsersFromSheetClient();
      
      if (result.success) {
        setSyncFeedback({
          text: `✅ ${result.totalRestored || 'Todos os'} usuários e senhas sincronizados direto da planilha!`,
          type: 'success',
        });
      } else {
        // Fallback: sincroniza com o servidor central
        const serverUsers = await fetchServerUsers();
        if (serverUsers && serverUsers.length > 0) {
          setSyncFeedback({
            text: `✅ ${serverUsers.length} usuários sincronizados com sucesso!`,
            type: 'success',
          });
        } else {
          setSyncFeedback({
            text: result.error || 'Não foi possível buscar os dados da planilha. Verifique a conexão.',
            type: 'error',
          });
        }
      }
    } catch (err: any) {
      setSyncFeedback({
        text: err.message || 'Erro ao sincronizar com a planilha.',
        type: 'error',
      });
    } finally {
      setIsSyncingSheet(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Card */}
        <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 p-6 text-white text-center relative">
          <div className="w-14 h-14 mx-auto bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center mb-3 shadow-inner">
            <Lock className="w-7 h-7 text-emerald-300" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Registro Veicular CMDIT</h2>
          <p className="text-xs text-emerald-200 mt-1 font-medium">
            Acesso ao Sistema
          </p>
        </div>

        {/* Status do Banco de Dados / Opção de colar External Database URL se desconectado */}
        <div className="px-6 pt-4">
          {dbStatus.tested && (
            <>
              {dbStatus.connected ? (
                // Banco Funcionando: Exibe status online limpo e opção de alterar sob senha Master
                <div className="space-y-2">
                  <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-bold text-emerald-900">
                        Banco de Dados: Online ({dbStatus.type.toUpperCase()})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                        {dbStatus.latency}ms
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowExternalUrlForm(!showExternalUrlForm)}
                        title="Alterar ligação do banco (Requer Senha Master)"
                        className="text-[10px] font-extrabold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                      >
                        {showExternalUrlForm ? 'Fechar' : 'Alterar'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Formulário de Ligação da URL EXTERNAL - Exibido se desconectado ou se solicitado alteração */}
              {(!dbStatus.connected || showExternalUrlForm) && (
                <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 space-y-2.5 text-left mt-2 shadow-xs animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Ligação do Banco de Dados</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-amber-900 bg-amber-200/90 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      Requer Senha Master
                    </span>
                  </div>

                  <p className="text-[11px] text-amber-900 leading-snug">
                    A ligação do banco de dados (<strong>URL EXTERNAL</strong>) só é permitida mediante autorização com a <strong>senha de usuário Master</strong>:
                  </p>

                  <form onSubmit={handleQuickSaveDbUrl} className="flex flex-col gap-2">
                    {/* Campo 1: URL EXTERNAL */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1">
                        <Database className="w-3 h-3 text-amber-700 shrink-0" />
                        <span>URL EXTERNAL (PostgreSQL / Render):</span>
                      </label>
                      <input
                        type="text"
                        placeholder="postgresql://user:pass@dpg-xxx.render.com/db..."
                        value={quickDbUrl}
                        onChange={(e) => setQuickDbUrl(e.target.value)}
                        className="w-full bg-white border border-amber-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-500 rounded-xl px-2.5 py-1.5 text-xs text-neutral-900 outline-none font-mono placeholder:text-neutral-400"
                      />
                    </div>

                    {/* Campo 2: Senha de Usuário Master */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-amber-700 shrink-0" />
                        <span>Senha de Usuário Master:</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showMasterPasswordForDb ? 'text' : 'password'}
                          placeholder="Digite a senha do usuário Master"
                          value={masterPasswordForDb}
                          onChange={(e) => setMasterPasswordForDb(e.target.value)}
                          className="w-full bg-white border border-amber-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-500 rounded-xl pl-2.5 pr-8 py-1.5 text-xs text-neutral-900 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowMasterPasswordForDb(!showMasterPasswordForDb)}
                          className="absolute right-2.5 top-2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                        >
                          {showMasterPasswordForDb ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Botão de Ação */}
                    <button
                      type="submit"
                      disabled={isSavingQuickUrl || !quickDbUrl.trim() || !masterPasswordForDb.trim()}
                      className="w-full mt-1 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{isSavingQuickUrl ? 'Validando e Conectando...' : 'Autorizar e Ligar Banco (Master)'}</span>
                    </button>
                  </form>

                  {quickUrlMsg && (
                    <div
                      className={`p-2.5 rounded-xl text-[11px] font-bold flex items-start gap-1.5 ${
                        quickUrlMsg.isError
                          ? 'bg-rose-100/90 border border-rose-300 text-rose-800'
                          : 'bg-emerald-100/90 border border-emerald-300 text-emerald-800'
                      }`}
                    >
                      {quickUrlMsg.isError ? (
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                      )}
                      <span className="leading-snug">{quickUrlMsg.text}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 pt-4 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {syncFeedback && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                syncFeedback.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border border-amber-200 text-amber-800'
              }`}
            >
              {syncFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              )}
              <span>{syncFeedback.text}</span>
            </div>
          )}

          {/* Usuário / Matrícula */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-neutral-500" />
              <span>Usuário / Matrícula</span>
            </label>
            <input
              type="text"
              placeholder="Digite seu usuário ou matrícula"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-300 focus:border-emerald-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-semibold text-neutral-900 outline-none transition"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          {/* Senha */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
              <span>Senha</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-300 focus:border-emerald-600 focus:bg-white rounded-xl pl-3.5 pr-10 py-2.5 text-sm font-semibold text-neutral-900 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Botão de Login Principal */}
          <button
            type="submit"
            disabled={isLoading || isSyncingSheet}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition active:scale-98 disabled:opacity-70 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{isLoading ? 'Autenticando...' : 'Acessar o Sistema'}</span>
          </button>

          {/* Botão Utilitário: Sincronizar Planilha */}
          <div className="pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={handleSyncFromSpreadsheet}
              disabled={isSyncingSheet || isLoading}
              className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isSyncingSheet ? 'animate-spin' : ''}`} />
              <span>{isSyncingSheet ? 'Sincronizando com a Planilha...' : 'Sincronizar Dados (Planilha)'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Modal de Diagnóstico e Backup do Banco de Dados */}
      <DatabaseTestModal
        isOpen={isDbTestOpen}
        onClose={() => {
          setIsDbTestOpen(false);
          refreshDbStatus();
        }}
      />
    </div>
  );
};

