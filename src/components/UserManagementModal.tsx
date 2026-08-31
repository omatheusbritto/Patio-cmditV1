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
} from 'lucide-react';
import {
  getAllUsers,
  fetchServerUsers,
  createNewUser,
  resetUserPassword,
  toggleUserStatus,
  deleteUser,
} from '../utils/authService';
import {
  syncAllUsersToSheet,
  getStoredDriveConfig,
  getOfficialSpreadsheetUrl,
  fetchServerDriveConfig,
} from '../utils/googleDriveClient';
import { UserAccount, UserRole, getRoleBadgeStyle, getRoleDisplayName } from '../types';

interface UserManagementModalProps {
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ onClose }) => {
  const [users, setUsers] = useState<UserAccount[]>(() => getAllUsers());
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [driveConfig, setDriveConfig] = useState(() => getStoredDriveConfig());

  // Form State para Novo Usuário
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('patio');
  const [formMsg, setFormMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSyncWithSpreadsheet = async () => {
    setIsSyncingSheet(true);
    setSyncStatusMsg({ text: 'Sincronizando operadores com a planilha oficial...', type: 'info' });
    try {
      const res = await syncAllUsersToSheet(users);
      if (res.success) {
        setSyncStatusMsg({
          text: `🎉 Sucesso! ${users.length} operadores salvos na aba USUARIOS_CMDIT da planilha oficial!`,
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
      setTimeout(() => setSyncStatusMsg(null), 6000);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    setIsSubmitting(true);

    try {
      const res = await createNewUser(newUsername, newName, newPassword, newRole);
      setIsSubmitting(false);
      if (res.success) {
        setFormMsg({
          text: '✅ Operador cadastrado com sucesso e integrado à planilha oficial!',
          type: 'success',
        });
        setNewUsername('');
        setNewName('');
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
                Tudo centralizado em uma única planilha: Veículos (Entrada, Saída, 51, Combustível, PDC) + Usuários.
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
                <span>Abrir Planilha Oficial</span>
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
            <span>Operadores Ativos ({users.length})</span>
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
            <span>Cadastrar Operador</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-neutral-50/50">
          {activeTab === 'create' ? (
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
                    placeholder="Defina a senha de acesso"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-emerald-600 outline-none transition"
                    required
                  />
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
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    O operador terá acesso restrito exclusivamente às telas e formulários da sua função.
                  </p>
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
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Buscar por colaborador, matrícula ou função..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-800 outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSyncWithSpreadsheet}
                  disabled={isSyncingSheet}
                  className="px-3 py-2 rounded-xl bg-white border border-neutral-200 hover:border-emerald-500 text-neutral-700 hover:text-emerald-700 font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-2xs transition cursor-pointer disabled:opacity-50"
                  title="Sincronizar todos os operadores agora com a planilha oficial"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin text-emerald-600' : ''}`} />
                  <span className="hidden sm:inline">Sincronizar Planilha</span>
                </button>
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
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
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
      </div>
    </div>
  );
};
