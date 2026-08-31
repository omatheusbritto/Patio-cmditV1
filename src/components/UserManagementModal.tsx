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
} from 'lucide-react';
import {
  getAllUsers,
  fetchServerUsers,
  createNewUser,
  resetUserPassword,
  toggleUserStatus,
  deleteUser,
} from '../utils/authService';
import { UserAccount, UserRole, getRoleBadgeStyle, getRoleDisplayName } from '../types';

interface UserManagementModalProps {
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ onClose }) => {
  const [users, setUsers] = useState<UserAccount[]>(() => getAllUsers());
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

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

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const serverUsers = await fetchServerUsers();
      setUsers(serverUsers);
    } catch {
      setUsers(getAllUsers());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    setIsSubmitting(true);

    try {
      const res = await createNewUser(newUsername, newName, newPassword, newRole);
      setIsSubmitting(false);
      if (res.success) {
        setFormMsg({ text: 'Operador cadastrado com sucesso!', type: 'success' });
        setNewUsername('');
        setNewName('');
        setNewPassword('');
        await loadUsers();
        setTimeout(() => {
          setActiveTab('list');
          setFormMsg(null);
        }, 1000);
      } else {
        setFormMsg({ text: res.error || 'Erro ao cadastrar.', type: 'error' });
      }
    } catch (err: any) {
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
      alert('Senha redefinida com sucesso!');
      setResettingUserId(null);
      setResetNewPassword('');
      await loadUsers();
    } else {
      alert(res.error || 'Falha ao redefinir senha.');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    const res = await toggleUserStatus(userId);
    if (res.success) {
      await loadUsers();
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
        await loadUsers();
      } else {
        alert(res.error || 'Erro ao excluir.');
      }
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-neutral-200 animate-in fade-in duration-150">
        {/* Header */}
        <div className="p-4 bg-neutral-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight flex items-center gap-2">
                Painel do Master
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Gestão de Acessos
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Criar operadores, recuperar senhas e excluir usuários
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
            <span>Criar Novo Usuário</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'create' ? (
            <form onSubmit={handleCreateUser} className="flex flex-col gap-3 max-w-sm mx-auto py-2">
              {formMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    formMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {formMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{formMsg.text}</span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">Nome do Colaborador:</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-emerald-600 outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">
                  Usuário ou Matrícula (para login):
                </label>
                <input
                  type="text"
                  placeholder="Ex: carlossilva ou 1042"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-emerald-600 outline-none"
                  autoCapitalize="none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">Senha Inicial:</label>
                <input
                  type="text"
                  placeholder="Defina a senha do operador"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-emerald-600 outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">Função / Perfil de Acesso:</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:bg-white focus:border-emerald-600 outline-none"
                >
                  <option value="patio">Operador do Pátio (Todas as 5 operações do pátio)</option>
                  <option value="entrada_saida">Operador de Entrada e Saída (Apenas Entrada e Saída)</option>
                  <option value="combustivel">Operador do Combustível (Apenas Abastecimento)</option>
                  <option value="pdc">Operador da Fila PDC (Apenas Fila PDC)</option>
                  <option value="qualidade_51">Operador 51 Qualidade (Bolsão 51 ➔ P1, P2, P3, R1, ADM)</option>
                  <option value="master">Administrador Master (Acesso total + Gestão de Usuários e Planilhas)</option>
                </select>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  O operador só terá acesso aos botões e telas autorizados para seu perfil.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-3 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'Cadastrando...' : 'Salvar e Cadastrar'}</span>
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar colaborador ou matrícula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-800 outline-none focus:bg-white focus:border-emerald-600"
                />
              </div>

              {/* Users List */}
              <div className="flex flex-col gap-2">
                {filteredUsers.map((user) => {
                  const roleStyle = getRoleBadgeStyle(user.role);
                  const roleTitle = getRoleDisplayName(user.role);

                  return (
                    <div
                      key={user.id}
                      className={`p-3 rounded-2xl border flex flex-col gap-2 transition ${
                        user.isActive === false
                          ? 'bg-neutral-100 border-neutral-300 opacity-60'
                          : 'bg-white border-neutral-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                              user.role === 'master'
                                ? 'bg-emerald-700 text-white'
                                : 'bg-neutral-200 text-neutral-700'
                            }`}
                          >
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-neutral-900 leading-tight">
                                {user.name}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${roleStyle.badgeClass}`}>
                                {roleStyle.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
                              <span>Login: <strong className="text-neutral-700 font-mono">{user.username}</strong></span>
                              <span>•</span>
                              <span>{roleTitle}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setResettingUserId(resettingUserId === user.id ? null : user.id);
                              setResetNewPassword('');
                            }}
                            className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Resetar Senha"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-[10px]">Senha</span>
                          </button>

                          {user.role !== 'master' && user.username.toLowerCase() !== 'mastercmdit' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(user.id)}
                                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  user.isActive === false
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                                title={user.isActive === false ? 'Desbloquear' : 'Bloquear'}
                              >
                                {user.isActive === false ? 'Ativar' : 'Bloquear'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteUser(user)}
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                                title="Excluir Usuário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Reset Password Form Inline */}
                      {resettingUserId === user.id && (
                        <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center gap-2 mt-1">
                          <input
                            type="text"
                            placeholder="Digite a nova senha..."
                            value={resetNewPassword}
                            onChange={(e) => setResetNewPassword(e.target.value)}
                            className="flex-1 bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-xs focus:outline-emerald-600"
                          />
                          <button
                            type="button"
                            onClick={() => handleResetPassword(user.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                          >
                            Salvar Nova Senha
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
