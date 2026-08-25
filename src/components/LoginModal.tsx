import React, { useState } from 'react';
import {
  Lock,
  User,
  KeyRound,
  AlertCircle,
  Clock,
  LogIn,
  HelpCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { loginUser } from '../utils/authService';
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
  const [showDefaultHint, setShowDefaultHint] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

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

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Card */}
        <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 p-6 text-white text-center relative">
          <div className="w-14 h-14 mx-auto bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center mb-3 shadow-inner">
            <Lock className="w-7 h-7 text-emerald-300" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Registro Veicular CMDIT</h2>
          <p className="text-xs text-emerald-200 mt-1">
            Autenticação & Controle de Pátio
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

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-neutral-500" />
              <span>Usuário / Matrícula</span>
            </label>
            <input
              type="text"
              placeholder="Ex: mastercmdit ou sua matrícula"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-300 focus:border-emerald-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-semibold text-neutral-900 outline-none transition"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition active:scale-98 disabled:opacity-70 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{isLoading ? 'Autenticando...' : 'Acessar o Sistema'}</span>
          </button>

          {/* Master Info & Hint */}
          <div className="pt-2 border-t border-neutral-100 text-center">
            <button
              type="button"
              onClick={() => setShowDefaultHint(!showDefaultHint)}
              className="text-[11px] text-neutral-500 hover:text-emerald-700 flex items-center justify-center gap-1 mx-auto font-medium cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Como acessar como Master?</span>
            </button>

            {showDefaultHint && (
              <div className="mt-2.5 p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-left text-[11px] text-neutral-600 flex flex-col gap-1">
                <span className="font-bold text-neutral-800">Credenciais Master:</span>
                <div>• Usuário: <code className="bg-neutral-200 px-1.5 py-0.5 rounded text-neutral-900 font-bold">mastercmdit</code></div>
                <div>• Senha: <code className="bg-neutral-200 px-1.5 py-0.5 rounded text-neutral-900 font-bold">Master@123</code></div>
                <span className="text-[10px] text-neutral-400 mt-1">
                  * Apenas o Master pode criar operadores, recuperar senhas e excluir usuários.
                </span>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
