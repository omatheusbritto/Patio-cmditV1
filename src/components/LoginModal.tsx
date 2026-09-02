import React, { useState } from 'react';
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
  FileSpreadsheet,
} from 'lucide-react';
import { loginUser, restoreUsersFromSheetClient, fetchServerUsers } from '../utils/authService';
import { AuthSession } from '../types';

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
    <div className="fixed inset-0 z-50 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-4">
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
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

          {/* Botão de Sincronizar Dados da Planilha */}
          <div className="pt-2 border-t border-neutral-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSyncFromSpreadsheet}
              disabled={isSyncingSheet || isLoading}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isSyncingSheet ? 'animate-spin' : ''}`} />
              <span>{isSyncingSheet ? 'Sincronizando com a Planilha...' : 'Sincronizar Dados (Planilha)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
