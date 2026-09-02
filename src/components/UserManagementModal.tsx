import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  X,
  AlertCircle,
  Search,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  Lock,
  Unlock,
  Shield,
  Phone,
  MessageCircle,
  Eye,
  EyeOff,
  Activity,
  Check,
  Copy,
  HelpCircle,
  Edit3,
  Save,
} from 'lucide-react';
import {
  getAllUsers,
  fetchServerUsers,
  createNewUser,
  updateUserAccount,
  resetUserPassword,
  toggleUserStatus,
  deleteUser,
  restoreUsersFromSheetClient,
} from '../utils/authService';
import {
  syncAllUsersToSheet,
  getStoredDriveConfig,
  getOfficialSpreadsheetUrl,
  fetchServerDriveConfig,
  fetchSpreadsheetDirectly,
  fetchSheetDiagnostic,
  getAppsScriptTemplateCode,
} from '../utils/googleDriveClient';
import { UserAccount, UserRole, getRoleBadgeStyle, getRoleDisplayName } from '../types';

interface UserManagementModalProps {
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ onClose }) => {
  const [users, setUsers] = useState<UserAccount[]>(() => getAllUsers());
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'diagnostic'>('list');
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [driveConfig, setDriveConfig] = useState(() => getStoredDriveConfig());
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Diagnostic State
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<{
    testedAt: string;
    webhookOk: boolean;
    spreadsheetTitle?: string;
    hasUserTab: boolean;
    userTabHeaders?: string[];
    sheetUsersCount: number;
    appUsersCount: number;
    colWhatsappName?: string;
    colPasswordName?: string;
    status: 'perfect' | 'needs_sync' | 'unreachable';
    details: string;
  } | null>(null);

  // Form State para Novo Usuário
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('patio');
  const [formMsg, setFormMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('patio');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editMsg, setEditMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const startEditUser = (user: UserAccount) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditWhatsapp(user.whatsapp || '');
    setEditPassword(user.password || '');
    setEditRole(user.role);
    setEditIsActive(user.isActive !== false);
    setEditMsg(null);
  };

  const cancelEditUser = () => {
    setEditingUser(null);
    setEditMsg(null);
  };

  const handleCopyAppsScript = () => {
    const code = getAppsScriptTemplateCode();
    navigator.clipboard.writeText(code);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 4000);
  };

  // Reset Password State
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [serverUsers, updatedConfig] = await Promise.all([
        fetchServerUsers(),
        fetchServerDriveConfig(),
      ]);
      setUsers(serverUsers);
      setDriveConfig(updatedConfig);
    } catch {
      setUsers(getAllUsers());
      setDriveConfig(getStoredDriveConfig());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const officialUrl = getOfficialSpreadsheetUrl() || driveConfig.spreadsheetUrl;

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleSyncWithSpreadsheet = async () => {
    setIsSyncingSheet(true);
    setSyncStatusMsg({ text: 'Sincronizando operadores com a planilha oficial...', type: 'info' });
    try {
      const res = await syncAllUsersToSheet(users);
      if (res.success) {
        setSyncStatusMsg({
          text: `🎉 Sucesso! ${users.length} operadores salvos com colunas corretas (WhatsApp na Coluna 5 e Senha na Coluna 6) na aba USUARIOS_CMDIT!`,
          type: 'success',
        });
      } else {
        setSyncStatusMsg({
          text: `⚠️ ${res.error || 'Configure o Webhook da planilha no Painel Master para sincronização direta.'}`,
          type: 'error',
        });
      }
    } catch {
      setSyncStatusMsg({ text: '⚠️ Falha na comunicação com a planilha.', type: 'error' });
    } finally {
      setIsSyncingSheet(false);
      setTimeout(() => setSyncStatusMsg(null), 8000);
    }
  };

  const handleRestoreFromSpreadsheet = async () => {
    setIsSyncingSheet(true);
    setSyncStatusMsg({ text: '📥 Restaurando operadores da aba USUARIOS_CMDIT da planilha oficial...', type: 'info' });
    try {
      const res = await restoreUsersFromSheetClient();
      if (res.success) {
        setSyncStatusMsg({
          text: `🎉 Sucesso! ${res.totalRestored || res.users?.length || 0} operadores sincronizados e ativos no sistema!`,
          type: 'success',
        });
        await loadData();
      } else {
        setSyncStatusMsg({
          text: `⚠️ ${res.error || 'Nenhum operador encontrado na planilha para restaurar.'}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setSyncStatusMsg({ text: `⚠️ Falha ao restaurar: ${err.message}`, type: 'error' });
    } finally {
      setIsSyncingSheet(false);
      setTimeout(() => setSyncStatusMsg(null), 6000);
    }
  };

  const runDiagnostic = async () => {
    setIsDiagnosing(true);
    setActiveTab('diagnostic');
    try {
      const config = await fetchServerDriveConfig();
      setDriveConfig(config);
      const url = config.webhookUrl || config.spreadsheetUrl;
      
      const diagRes = await fetchSheetDiagnostic(url);
      if (diagRes && diagRes.success && diagRes.diagnostic) {
        setDiagnosticData(diagRes.diagnostic);
      } else {
        setDiagnosticData({
          testedAt: new Date().toLocaleTimeString('pt-BR'),
          webhookOk: false,
          hasUserTab: false,
          sheetUsersCount: 0,
          appUsersCount: users.length,
          status: 'unreachable',
          details: diagRes?.error || 'Não foi possível consultar a planilha diretamente.',
        });
      }
    } catch (err: any) {
      setDiagnosticData({
        testedAt: new Date().toLocaleTimeString('pt-BR'),
        webhookOk: false,
        hasUserTab: false,
        sheetUsersCount: 0,
        appUsersCount: users.length,
        status: 'unreachable',
        details: err.message || 'Erro ao testar comunicação.',
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    setIsSubmitting(true);

    try {
      const res = await createNewUser(newUsername, newName, newPassword, newRole, newWhatsapp);
      setIsSubmitting(false);
      if (res.success) {
        setFormMsg({
          text: '✅ Operador cadastrado com sucesso e integrado à planilha oficial!',
          type: 'success',
        });
        setNewUsername('');
        setNewName('');
        setNewWhatsapp('');
        setNewPassword('');
        await loadData();
        // Sincroniza em background com a planilha única
        syncAllUsersToSheet();
        setTimeout(() => {
          setActiveTab('list');
          setFormMsg(null);
        }, 1400);
      } else {
        setFormMsg({ text: res.error || 'Erro ao cadastrar.', type: 'error' });
      }
    } catch {
      setIsSubmitting(false);
      setFormMsg({ text: 'Erro ao conectar ao servidor.', type: 'error' });
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditMsg(null);
    setIsUpdating(true);

    try {
      const res = await updateUserAccount(editingUser.id, {
        name: editName.trim(),
        username: editUsername.trim().toLowerCase(),
        whatsapp: editWhatsapp.trim() || undefined,
        password: editPassword.trim() || undefined,
        role: editRole,
        isActive: editIsActive,
      });

      setIsUpdating(false);
      if (res.success) {
        setEditMsg({ text: '✅ Colaborador atualizado com sucesso e sincronizado!', type: 'success' });
        await loadData();
        syncAllUsersToSheet();
        setTimeout(() => {
          setEditingUser(null);
          setEditMsg(null);
        }, 1200);
      } else {
        setEditMsg({ text: res.error || 'Erro ao atualizar colaborador.', type: 'error' });
      }
    } catch {
      setIsUpdating(false);
      setEditMsg({ text: 'Erro ao salvar alterações no servidor.', type: 'error' });
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!resetNewPassword.trim()) {
      alert('Informe a nova senha.');
      return;
    }
    const res = await resetUserPassword(userId, resetNewPassword);
    if (res.success) {
      alert('Senha redefinida com sucesso e atualizada na planilha!');
      setResettingUserId(null);
      setResetNewPassword('');
      await loadData();
      syncAllUsersToSheet();
    } else {
      alert(res.error || 'Falha ao redefinir senha.');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    const res = await toggleUserStatus(userId);
    if (res.success) {
      await loadData();
      syncAllUsersToSheet();
    }
  };

  const handleDeleteUser = async (user: UserAccount) => {
    if (user.role === 'master' || user.username.toLowerCase() === 'mastercmdit') {
      alert('Não é permitido excluir o usuário Master principal.');
      return;
    }
    if (confirm(`Tem certeza que deseja excluir o operador "${user.name}" (${user.username})?`)) {
      const res = await deleteUser(user.id);
      if (res.success) {
        await loadData();
        syncAllUsersToSheet();
      } else {
        alert(res.error || 'Erro ao excluir.');
      }
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.whatsapp && u.whatsapp.toLowerCase().includes(searchTerm.toLowerCase())) ||
      getRoleDisplayName(u.role).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] border border-neutral-200 animate-in fade-in duration-150">
        {/* Header */}
        <div className="p-4 bg-neutral-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight flex items-center gap-2">
                Painel do Master
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30 font-bold">
                  Planilha Única
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Gestão consolidada de operadores e acessos na planilha oficial
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Consolidated Single Spreadsheet Info & Direct Link Banner */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-850 to-neutral-900 text-white p-3.5 border-b border-emerald-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 bg-emerald-700/80 rounded-xl text-emerald-200 shrink-0 mt-0.5">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black text-white">
                  {driveConfig.spreadsheetTitle || 'Planilha Oficial CMDIT'}
                </span>
                <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-400/30 font-bold uppercase">
                  Aba USUARIOS_CMDIT
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/90 mt-0.5 leading-snug">
                Estrutura de 8 colunas: <strong>WhatsApp na Coluna 5</strong> e <strong>Senha na Coluna 6</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {officialUrl ? (
              <a
                href={officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer active:scale-95"
                title="Abrir a planilha oficial gravada no Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir no Google Sheets</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={handleSyncWithSpreadsheet}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sincronizar</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-neutral-200 bg-neutral-50 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`pb-2.5 px-3 text-xs font-black flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
              activeTab === 'list'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Operadores ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-3 text-xs font-black flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
              activeTab === 'create'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Cadastrar Novo</span>
          </button>

          <button
            type="button"
            onClick={runDiagnostic}
            className={`pb-2.5 px-3 text-xs font-black flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
              activeTab === 'diagnostic'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Diagnóstico & Como Saber</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-neutral-50/50">
          {activeTab === 'diagnostic' ? (
            <div className="flex flex-col gap-3.5 max-w-lg mx-auto py-1">
              <div className="p-4 bg-white rounded-2xl border border-neutral-200 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-neutral-900">Como Saber se Funcionou a Sincronização?</h3>
                      <p className="text-[11px] text-neutral-500">Confirmação em tempo real entre o App e o Google Sheets</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={runDiagnostic}
                    disabled={isDiagnosing}
                    className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition flex items-center gap-1 text-xs font-bold"
                    title="Repetir Teste de Diagnóstico"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin text-emerald-600' : ''}`} />
                    <span className="hidden sm:inline">Atualizar</span>
                  </button>
                </div>

                {/* 3 Formas Práticas de Saber que Funcionou */}
                <div className="flex flex-col gap-2 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-emerald-950 text-xs">
                  <h4 className="font-black text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    3 Formas de Confirmar que Funcionou:
                  </h4>
                  <ul className="flex flex-col gap-1.5 text-[11px] list-disc list-inside">
                    <li>
                      <strong>1. Abrir o Google Sheets:</strong> Clique no botão superior <span className="font-bold text-emerald-900 underline">"Abrir no Google Sheets"</span> e veja a aba <strong>USUARIOS_CMDIT</strong>.
                    </li>
                    <li>
                      <strong>2. Conferência das Colunas:</strong> Verifique que a <strong>Coluna D (4ª)</strong> é <span className="font-mono bg-white px-1 py-0.5 rounded border border-emerald-300 font-bold">SENHA</span> e a <strong>Coluna E (5ª)</strong> é <span className="font-mono bg-white px-1 py-0.5 rounded border border-emerald-300 font-bold">WHATSAPP</span>.
                    </li>
                    <li>
                      <strong>3. Teste de Cadastro em Tempo Real:</strong> Ao criar um novo operador ou redefinir uma senha, a linha correspondente é atualizada imediatamente na planilha.
                    </li>
                  </ul>
                </div>

                {/* Resultado do Diagnóstico Automático */}
                {isDiagnosing ? (
                  <div className="p-6 text-center flex flex-col items-center justify-center gap-2 text-xs text-neutral-600">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                    <p className="font-bold">Consultando o Google Apps Script e a aba USUARIOS_CMDIT...</p>
                  </div>
                ) : diagnosticData ? (
                  <div className="flex flex-col gap-2.5 pt-1">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200">
                        <span className="text-[10px] text-neutral-400 block font-bold">Comunicação Webhook</span>
                        <span className={`font-black flex items-center gap-1 mt-0.5 ${diagnosticData.webhookOk ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {diagnosticData.webhookOk ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                          {diagnosticData.webhookOk ? 'Conectado (HTTP 200)' : 'Não configurado / Erro'}
                        </span>
                      </div>

                      <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200">
                        <span className="text-[10px] text-neutral-400 block font-bold">Aba USUARIOS_CMDIT</span>
                        <span className={`font-black flex items-center gap-1 mt-0.5 ${diagnosticData.hasUserTab ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {diagnosticData.hasUserTab ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                          {diagnosticData.hasUserTab ? 'Presente na Planilha' : 'Será criada na 1ª sync'}
                        </span>
                      </div>

                      <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200">
                        <span className="text-[10px] text-neutral-400 block font-bold">Coluna 4 (D) - Senha</span>
                        <span className="font-mono font-bold text-neutral-800 truncate block mt-0.5" title={diagnosticData.colPasswordName}>
                          {diagnosticData.colPasswordName}
                        </span>
                      </div>

                      <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200">
                        <span className="text-[10px] text-neutral-400 block font-bold">Coluna 5 (E) - WhatsApp</span>
                        <span className="font-mono font-bold text-neutral-800 truncate block mt-0.5" title={diagnosticData.colWhatsappName}>
                          {diagnosticData.colWhatsappName}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-neutral-100 rounded-xl text-neutral-800 text-[11px] flex items-center justify-between">
                      <span>Operadores no App: <strong>{diagnosticData.appUsersCount}</strong></span>
                      <span>Operadores na Planilha: <strong>{diagnosticData.sheetUsersCount}</strong></span>
                    </div>

                    <div className={`p-3.5 rounded-xl text-[11px] leading-relaxed flex flex-col gap-2 ${
                      diagnosticData.status === 'perfect'
                        ? 'bg-emerald-950 text-emerald-100 border border-emerald-700'
                        : diagnosticData.status === 'needs_sync'
                        ? 'bg-amber-950 text-amber-100 border border-amber-700'
                        : 'bg-neutral-900 text-white'
                    }`}>
                      <div className="flex items-start gap-2">
                        <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{diagnosticData.details}</span>
                      </div>

                      {/* Se o Webhook não estiver funcionando ou exigir login */}
                      {!diagnosticData.webhookOk && (
                        <div className="mt-2 pt-2 border-t border-neutral-700 flex flex-col gap-2">
                          <p className="font-bold text-amber-300">
                            ⚙️ Passo a Passo para conectar o Webhook:
                          </p>
                          <ol className="list-decimal list-inside space-cols text-[10.5px] text-neutral-300 flex flex-col gap-1">
                            <li>Abra sua Planilha Google ➔ menu <strong>Extensões</strong> ➔ <strong>Apps Script</strong></li>
                            <li>Cole o código oficial do aplicativo e clique em Salvar</li>
                            <li>Clique no botão azul <strong>Implantar</strong> ➔ <strong>Nova implantação</strong></li>
                            <li>Selecione <strong>Aplicativo da Web</strong> e configure <em>"Quem pode acessar"</em> como <strong>"Qualquer pessoa" (Anyone)</strong></li>
                            <li>Copie a URL gerada (terminada em <code>/exec</code>) e cole nas configurações do Master</li>
                          </ol>
                          <button
                            type="button"
                            onClick={handleCopyAppsScript}
                            className="mt-1 py-1.5 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedScript ? 'Código Copiado com Sucesso!' : 'Copiar Código Completo do Apps Script'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSyncWithSpreadsheet}
                    disabled={isSyncingSheet}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                    <span>Forçar Sincronização e Corrigir Aba Agora</span>
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'create' ? (
            <form onSubmit={handleCreateUser} className="flex flex-col gap-3.5 max-w-md mx-auto py-1">
              {formMsg && (
                <div
                  className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs ${
                    formMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                      : 'bg-rose-50 text-rose-900 border border-rose-300'
                  }`}
                >
                  {formMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
                  )}
                  <span>{formMsg.text}</span>
                </div>
              )}

              <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-neutral-700">Nome Completo do Colaborador:</label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Silva"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-emerald-600 outline-none transition"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-neutral-700">
                    Usuário ou Matrícula (para Login):
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: carlossilva ou 1042"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-emerald-600 outline-none transition"
                    autoCapitalize="none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-neutral-700">Senha Inicial:</label>
                  <input
                    type="text"
                    placeholder="Defina a senha de acesso (Ex: 123456)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-emerald-600 outline-none transition"
                    required
                  />
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    A senha será salva na coluna <strong>SENHA</strong> (Coluna 4 / D da planilha).
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-neutral-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      Número de WhatsApp do Operador:
                    </span>
                    <span className="text-[10px] text-neutral-400 font-semibold">(Opcional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="Ex: (11) 98765-4321"
                    value={newWhatsapp}
                    onChange={(e) => setNewWhatsapp(e.target.value)}
                    className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-emerald-600 outline-none transition"
                  />
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    Salvo na coluna <strong>WHATSAPP</strong> (Coluna 5 / E da planilha).
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-neutral-700">Função / Perfil de Acesso:</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:bg-white focus:border-emerald-600 outline-none transition"
                  >
                    <option value="patio">Operador do Pátio (Todas as 5 operações do pátio)</option>
                    <option value="entrada_saida">Operador de Entrada e Saída (Apenas Entrada e Saída)</option>
                    <option value="combustivel">Operador do Combustível (Apenas Abastecimento)</option>
                    <option value="pdc">Operador da Fila PDC (Apenas Fila PDC)</option>
                    <option value="qualidade_51">Operador 51 Qualidade (Bolsão 51 ➔ P1, P2, P3, R1, ADM, outros)</option>
                    <option value="master">Administrador Master (Acesso total + Gestão de Usuários e Planilha)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50 active:scale-98"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'Gravando na Planilha...' : 'Salvar e Sincronizar na Planilha'}</span>
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Top Sync & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Buscar por colaborador, matrícula ou WhatsApp..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-800 outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleRestoreFromSpreadsheet}
                    disabled={isSyncingSheet}
                    className="px-2.5 py-2 rounded-xl bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
                    title="Restaurar lista de operadores diretamente da aba USUARIOS_CMDIT do Google Sheets"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin text-emerald-700' : 'text-emerald-700'}`} />
                    <span>📥 Restaurar</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncWithSpreadsheet}
                    disabled={isSyncingSheet}
                    className="px-2.5 py-2 rounded-xl bg-white border border-neutral-200 hover:border-emerald-500 text-neutral-700 hover:text-emerald-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
                    title="Sincronizar todos os operadores agora com a planilha oficial garantindo colunas separadas"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin text-emerald-600' : ''}`} />
                    <span className="hidden sm:inline">Gravar Planilha</span>
                  </button>
                </div>
              </div>

              {/* Status Message */}
              {syncStatusMsg && (
                <div
                  className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs ${
                    syncStatusMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                      : syncStatusMsg.type === 'info'
                      ? 'bg-blue-50 text-blue-900 border border-blue-200'
                      : 'bg-rose-50 text-rose-900 border border-rose-300'
                  }`}
                >
                  {syncStatusMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                  ) : syncStatusMsg.type === 'info' ? (
                    <RefreshCw className="w-4 h-4 shrink-0 text-blue-700 animate-spin" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
                  )}
                  <span>{syncStatusMsg.text}</span>
                </div>
              )}

              {/* Users List */}
              <div className="flex flex-col gap-2">
                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-neutral-200 text-neutral-500 text-xs">
                    Nenhum colaborador encontrado para a busca.
                  </div>
                ) : (
                  filteredUsers.map((user) => {
                    const roleStyle = getRoleBadgeStyle(user.role);
                    const roleTitle = getRoleDisplayName(user.role);
                    const isMasterUser = user.role === 'master' || user.username.toLowerCase() === 'mastercmdit';
                    const isPasswordVisible = !!visiblePasswords[user.id];

                    return (
                      <div
                        key={user.id}
                        className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 transition ${
                          user.isActive === false
                            ? 'bg-neutral-100 border-neutral-300 opacity-60'
                            : 'bg-white border-neutral-200 shadow-xs hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-inner ${
                                isMasterUser
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-neutral-200 text-neutral-800'
                              }`}
                            >
                              {isMasterUser ? <Shield className="w-4 h-4" /> : user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-neutral-900 truncate">
                                  {user.name}
                                </span>
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${roleStyle.badgeClass}`}
                                >
                                  {roleStyle.label}
                                </span>
                                {user.isActive === false && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                                    Bloqueado
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5 flex-wrap">
                                <span>Login: <strong className="text-neutral-800 font-mono font-bold">{user.username}</strong></span>
                                <span>•</span>
                                <span>{roleTitle}</span>
                                <span>•</span>
                                <div className="inline-flex items-center gap-1 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-700 font-mono text-[9px]">
                                  <span>Senha:</span>
                                  <strong>{isPasswordVisible ? (user.password || '123456') : '••••••'}</strong>
                                  <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility(user.id)}
                                    className="text-neutral-500 hover:text-neutral-800 ml-0.5"
                                    title={isPasswordVisible ? 'Ocultar senha' : 'Ver senha'}
                                  >
                                    {isPasswordVisible ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                                  </button>
                                </div>
                                {user.whatsapp && user.whatsapp !== '-' && (
                                  <>
                                    <span>•</span>
                                    <a
                                      href={`https://wa.me/55${user.whatsapp.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded font-bold transition"
                                      title="Abrir conversa no WhatsApp"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MessageCircle className="w-2.5 h-2.5 text-emerald-600" />
                                      <span>{user.whatsapp}</span>
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditUser(user)}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-emerald-200"
                              title="Editar Dados Completos do Operador (Master CRUD)"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                              <span className="hidden sm:inline text-[10px]">Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setResettingUserId(resettingUserId === user.id ? null : user.id);
                                setResetNewPassword('');
                              }}
                              className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Redefinir Senha do Operador"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline text-[10px]">Senha</span>
                            </button>

                            {!isMasterUser && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(user.id)}
                                  className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                    user.isActive === false
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                  }`}
                                  title={user.isActive === false ? 'Desbloquear Operador' : 'Bloquear Acesso'}
                                >
                                  {user.isActive === false ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                  <span className="hidden sm:inline text-[10px]">
                                    {user.isActive === false ? 'Ativar' : 'Bloquear'}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user)}
                                  className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                                  title="Excluir Colaborador"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Reset Password Form Inline */}
                        {resettingUserId === user.id && (
                          <div className="p-3 bg-neutral-50 border border-neutral-300 rounded-xl flex items-center gap-2 mt-1 animate-in fade-in">
                            <input
                              type="text"
                              placeholder="Digite a nova senha..."
                              value={resetNewPassword}
                              onChange={(e) => setResetNewPassword(e.target.value)}
                              className="flex-1 bg-white border border-neutral-300 rounded-lg px-3 py-1.5 text-xs focus:outline-emerald-600 font-medium"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleResetPassword(user.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-xs cursor-pointer active:scale-95 transition"
                            >
                              Salvar Senha
                            </button>
                            <button
                              type="button"
                              onClick={() => setResettingUserId(null)}
                              className="p-1.5 text-neutral-500 hover:text-neutral-800 text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal de Edição Completa de Usuário (Master CRUD) */}
        {editingUser && (
          <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 bg-neutral-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black leading-tight">Editar Colaborador (Master)</h3>
                    <p className="text-[11px] text-neutral-400">Alteração cadastral com sincronização na planilha</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={cancelEditUser}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editMsg && (
                <div
                  className={`p-3 text-xs font-bold flex items-center gap-2 ${
                    editMsg.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-b border-emerald-200' : 'bg-rose-50 text-rose-900 border-b border-rose-200'
                  }`}
                >
                  {editMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-700" /> : <AlertCircle className="w-4 h-4 text-rose-700" />}
                  <span>{editMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveEditUser} className="p-4 flex flex-col gap-3 bg-neutral-50/50">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-neutral-700">Nome Completo:</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:border-emerald-600 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-neutral-700">Usuário / Matrícula (Login):</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:border-emerald-600 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-neutral-700">Senha de Acesso (Coluna 4 - D):</label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:border-emerald-600 outline-none"
                    placeholder="Deixe em branco para manter a atual"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-neutral-700 flex items-center justify-between">
                    <span>WhatsApp (Coluna 5 - E):</span>
                    <span className="text-[10px] text-neutral-400">(Opcional)</span>
                  </label>
                  <input
                    type="tel"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    className="bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:border-emerald-600 outline-none"
                    placeholder="Ex: (11) 98765-4321"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-neutral-700">Função / Perfil de Acesso:</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:border-emerald-600 outline-none"
                  >
                    <option value="patio">Operador do Pátio (Todas as operações)</option>
                    <option value="entrada_saida">Operador Entrada/Saída</option>
                    <option value="combustivel">Operador Combustível</option>
                    <option value="pdc">Operador Fila PDC</option>
                    <option value="qualidade_51">Operador 51 Qualidade</option>
                    <option value="master">Administrador Master</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-neutral-200 mt-1">
                  <span className="text-xs font-black text-neutral-700">Status do Operador:</span>
                  <button
                    type="button"
                    onClick={() => setEditIsActive(!editIsActive)}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                      editIsActive
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {editIsActive ? '🟢 Ativo' : '🔴 Bloqueado'}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 mt-1">
                  <button
                    type="button"
                    onClick={cancelEditUser}
                    className="px-3.5 py-2 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isUpdating ? 'Salvando...' : 'Salvar Alterações'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
