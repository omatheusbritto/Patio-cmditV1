import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  LogIn,
  LogOut,
  Clock,
  User,
  Smartphone,
  Laptop,
  Search,
  RefreshCw,
  Download,
  Trash2,
  Phone,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Filter,
  Users,
  Eye,
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';
import { AccessLog, LogEventType, UserRole, AuthSession } from '../types';
import { fetchServerLogs, restoreLogsFromSheet, clearServerLogs } from '../utils/googleDriveClient';

interface AccessLogsTabProps {
  currentSession: AuthSession | null;
  onOpenSpreadsheetModal?: () => void;
}

export const AccessLogsTab: React.FC<AccessLogsTabProps> = ({
  currentSession,
  onOpenSpreadsheetModal,
}) => {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [eventFilter, setEventFilter] = useState<'ALL' | LogEventType>('ALL');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selectedLog, setSelectedLog] = useState<AccessLog | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  const isMaster = currentSession?.user?.role === 'master';

  // Load logs on mount
  const loadLogs = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetchServerLogs();
      if (res.success && Array.isArray(res.logs)) {
        setLogs(res.logs);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar logs:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Restore logs from Google Sheets
  const handleRestoreFromSheet = async () => {
    setIsRestoring(true);
    setStatusMessage({ type: 'info', text: 'Buscando histórico na planilha Google Sheets (Aba LOGS_ACESSO)...' });
    try {
      const res = await restoreLogsFromSheet();
      if (res.success) {
        if (Array.isArray(res.logs) && res.logs.length > 0) {
          setLogs(res.logs);
          setStatusMessage({
            type: 'success',
            text: `Histórico sincronizado! ${res.totalRestored || res.logs.length} registro(s) carregados da planilha.`,
          });
        } else {
          setStatusMessage({
            type: 'info',
            text: 'Nenhum log encontrado na aba da planilha ou sincronização concluída.',
          });
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Falha ao restaurar dados da planilha Google Sheets.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Erro inesperado na sincronização com a planilha.',
      });
    } finally {
      setIsRestoring(false);
      setTimeout(() => setStatusMessage(null), 6000);
    }
  };

  // Clear logs (Master only)
  const handleClearLogs = async () => {
    try {
      const res = await clearServerLogs();
      if (res.success) {
        setLogs([]);
        setShowClearConfirm(false);
        setStatusMessage({ type: 'success', text: 'Histórico de logs limpo com sucesso.' });
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Não foi possível limpar os logs.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Erro ao limpar logs.' });
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = [
      'Data / Hora',
      'Evento',
      'Matrícula / Usuário',
      'Nome Completo',
      'Função / Cargo',
      'WhatsApp / Contato',
      'Dispositivo / Navegador',
      'IP',
      'Detalhes / Observações',
    ];

    const rows = filteredLogs.map((l) => [
      `"${l.dateFormatted || l.timestamp}"`,
      `"${l.event}"`,
      `"${l.username}"`,
      `"${l.name}"`,
      `"${formatRoleLabel(l.role)}"`,
      `"${l.whatsapp || '-'}"`,
      `"${(l.userAgent || l.deviceType || '-').replace(/"/g, '""')}"`,
      `"${l.ip || '-'}"`,
      `"${(l.details || '-').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CMDIT_Logs_Acesso_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const now = new Date();

    return logs.filter((log) => {
      // Event filter
      if (eventFilter !== 'ALL' && log.event !== eventFilter) {
        return false;
      }

      // Role filter
      if (roleFilter !== 'ALL' && log.role !== roleFilter) {
        return false;
      }

      // Period filter
      if (periodFilter !== 'all') {
        const logDate = new Date(log.timestamp);
        if (!isNaN(logDate.getTime())) {
          const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 3600 * 24);
          if (periodFilter === 'today' && (diffDays > 1 || logDate.getDate() !== now.getDate())) {
            return false;
          }
          if (periodFilter === '7days' && diffDays > 7) {
            return false;
          }
          if (periodFilter === '30days' && diffDays > 30) {
            return false;
          }
        }
      }

      // Search term
      if (term) {
        const matchUser = log.username?.toLowerCase().includes(term);
        const matchName = log.name?.toLowerCase().includes(term);
        const matchWhats = log.whatsapp?.toLowerCase().includes(term);
        const matchDetails = log.details?.toLowerCase().includes(term);
        const matchIp = log.ip?.toLowerCase().includes(term);
        const matchAgent = log.userAgent?.toLowerCase().includes(term);
        const matchDate = log.dateFormatted?.toLowerCase().includes(term);

        if (!matchUser && !matchName && !matchWhats && !matchDetails && !matchIp && !matchAgent && !matchDate) {
          return false;
        }
      }

      return true;
    });
  }, [logs, searchTerm, eventFilter, periodFilter, roleFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = logs.length;
    const logins = logs.filter((l) => l.event === 'LOGIN').length;
    const logouts = logs.filter((l) => l.event === 'LOGOUT').length;
    const uniqueUsers = new Set(logs.map((l) => l.username.toLowerCase())).size;

    return { total, logins, logouts, uniqueUsers };
  }, [logs]);

  function formatRoleLabel(role?: UserRole | string): string {
    switch (role) {
      case 'master':
        return '👑 Administrador Master';
      case 'patio':
        return '📋 Operador do Pátio';
      case 'qualidade_51':
        return '🔍 Operador 51 Qualidade';
      case 'pdc':
        return '📋 Operador Fila PDC';
      case 'combustivel':
        return '⛽ Operador Combustível';
      case 'entrada_saida':
        return '🚪 Entrada / Saída';
      case 'vistoriador':
        return '🔍 Vistoriador';
      case 'motorista':
        return '🚗 Motorista';
      default:
        return '👤 Operador';
    }
  }

  function getDeviceIcon(log: AccessLog) {
    const str = `${log.userAgent || ''} ${log.deviceType || ''}`.toLowerCase();
    if (str.includes('mobile') || str.includes('android') || str.includes('iphone')) {
      return <Smartphone className="w-3.5 h-3.5 text-blue-500" title="Dispositivo Móvel" />;
    }
    return <Laptop className="w-3.5 h-3.5 text-neutral-500" title="Computador / Desktop" />;
  }

  return (
    <div className="space-y-4 pb-20 max-w-4xl mx-auto px-2 sm:px-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-slate-700/60 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Auditoria & Segurança em Tempo Real
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Tratamento de Logs de Acesso
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Registro automático de entradas, saídas e auditoria multi-dispositivo sincronizado com a planilha Google Sheets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
            <button
              type="button"
              onClick={() => loadLogs(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 border border-slate-600 text-xs font-bold text-white transition-all shadow-sm"
              title="Recarregar registros"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Atualizar</span>
            </button>

            <button
              type="button"
              onClick={handleRestoreFromSheet}
              disabled={isRestoring}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-xs font-bold text-white transition-all shadow-sm"
              title="Sincronizar histórico com Google Sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isRestoring ? 'Sincronizando...' : 'Planilha Sheets'}</span>
            </button>

            {onOpenSpreadsheetModal && (
              <button
                type="button"
                onClick={onOpenSpreadsheetModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 border border-slate-600 text-xs font-bold text-slate-200 transition-all"
                title="Abrir visualizador de planilhas online"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ver Planilha</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notification Toast / Alert */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-all animate-in fade-in shadow-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200'
              : 'bg-indigo-50 text-indigo-900 border border-indigo-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : statusMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          )}
          <span className="flex-1">{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-neutral-400 hover:text-neutral-700 text-xs font-bold p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Total de Eventos</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-neutral-900">{metrics.total}</span>
            <span className="text-[10px] text-neutral-500 block mt-0.5">Acessos auditados</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Logins Realizados</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <LogIn className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-700">{metrics.logins}</span>
            <span className="text-[10px] text-emerald-600 block mt-0.5">Sessões iniciadas</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Logouts Registrados</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-700">{metrics.logouts}</span>
            <span className="text-[10px] text-amber-600 block mt-0.5">Sessões finalizadas</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Operadores Únicos</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-blue-800">{metrics.uniqueUsers}</span>
            <span className="text-[10px] text-blue-600 block mt-0.5">Identificados nos logs</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por nome, matrícula, WhatsApp, data ou IP..."
            className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-neutral-800 placeholder-neutral-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Chips and Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Event Pills */}
            <button
              type="button"
              onClick={() => setEventFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                eventFilter === 'ALL'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Todos ({logs.length})
            </button>

            <button
              type="button"
              onClick={() => setEventFilter('LOGIN')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                eventFilter === 'LOGIN'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Logins ({metrics.logins})</span>
            </button>

            <button
              type="button"
              onClick={() => setEventFilter('LOGOUT')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                eventFilter === 'LOGOUT'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logouts ({metrics.logouts})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Period Dropdown */}
            <div className="relative">
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as any)}
                className="text-xs font-semibold py-1.5 pl-2.5 pr-7 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
              >
                <option value="all">Todo o período</option>
                <option value="today">Hoje</option>
                <option value="7days">Últimos 7 dias</option>
                <option value="30days">Últimos 30 dias</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 text-xs font-bold transition-all"
              title="Exportar registros filtrados para CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>

            {/* Master Clear Logs Button */}
            {isMaster && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all"
                title="Limpar histórico de logs (Apenas Master)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal to Clear Logs */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-neutral-900">Limpar Histórico de Logs?</h3>
              <p className="text-xs text-neutral-600">
                Esta ação apagará os registros de acesso no servidor local. A planilha Google Sheets continuará com os dados intactos.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="py-2 px-3 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearLogs}
                className="py-2 px-3 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 shadow-sm"
              >
                Confirmar Limpeza
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal for Selected Log */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-neutral-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    selectedLog.event === 'LOGIN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {selectedLog.event === 'LOGIN' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Detalhes do Acesso</h3>
                  <span className="text-[11px] text-neutral-500 font-mono">ID: {selectedLog.id}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-neutral-700">
              <div className="grid grid-cols-2 gap-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                <div>
                  <span className="text-[10px] font-bold text-neutral-500 block">Evento</span>
                  <span
                    className={`font-black ${
                      selectedLog.event === 'LOGIN' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {selectedLog.event}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-neutral-500 block">Data e Hora</span>
                  <span className="font-semibold text-neutral-800">{selectedLog.dateFormatted || selectedLog.timestamp}</span>
                </div>
              </div>

              <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 space-y-1.5">
                <div>
                  <span className="text-[10px] font-bold text-neutral-500 block">Colaborador / Operador</span>
                  <span className="font-bold text-neutral-900 text-sm">{selectedLog.name}</span>
                  <span className="text-neutral-500 font-mono text-[11px] block">Matrícula: {selectedLog.username}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-neutral-500 block">Função / Cargo</span>
                  <span className="font-semibold text-indigo-900">{formatRoleLabel(selectedLog.role)}</span>
                </div>
                {selectedLog.whatsapp && selectedLog.whatsapp !== '-' && (
                  <div>
                    <span className="text-[10px] font-bold text-neutral-500 block">WhatsApp / Contato</span>
                    <a
                      href={`https://wa.me/55${selectedLog.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                      {selectedLog.whatsapp}
                    </a>
                  </div>
                )}
              </div>

              <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 space-y-1">
                <span className="text-[10px] font-bold text-neutral-500 block">Dispositivo / User Agent</span>
                <span className="text-[11px] text-neutral-600 font-mono break-all block">
                  {selectedLog.userAgent || 'Não identificado'}
                </span>
                {selectedLog.ip && (
                  <span className="text-[10px] text-neutral-500 block font-mono">IP: {selectedLog.ip}</span>
                )}
              </div>

              {selectedLog.details && (
                <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                  <span className="text-[10px] font-bold text-neutral-500 block">Observações do Sistema</span>
                  <span className="text-neutral-700">{selectedLog.details}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="w-full py-2 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Logs List / Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-xs font-bold text-neutral-500">Carregando histórico de acessos...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-neutral-800">Nenhum log encontrado</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                {searchTerm || eventFilter !== 'ALL'
                  ? 'Nenhum registro corresponde aos filtros selecionados. Tente limpar a busca.'
                  : 'Os registros de login e logout dos operadores aparecerão automaticamente aqui assim que forem efetuados.'}
              </p>
            </div>
            {(searchTerm || eventFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setEventFilter('ALL');
                  setPeriodFilter('all');
                }}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-3">Evento</th>
                    <th className="py-3 px-3">Matrícula</th>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-3">Função / Cargo</th>
                    <th className="py-3 px-3">WhatsApp</th>
                    <th className="py-3 px-3">Dispositivo</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredLogs.map((log) => {
                    const isLogin = log.event === 'LOGIN';
                    return (
                      <tr key={log.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-neutral-700 whitespace-nowrap">
                          {log.dateFormatted || log.timestamp}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                              isLogin
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isLogin ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                            {log.event}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-neutral-900 whitespace-nowrap">
                          {log.username}
                        </td>
                        <td className="py-3 px-4 font-bold text-neutral-900 whitespace-nowrap">
                          {log.name}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-neutral-700">
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-[11px] font-medium border border-neutral-200">
                            {formatRoleLabel(log.role)}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {log.whatsapp && log.whatsapp !== '-' ? (
                            <a
                              href={`https://wa.me/55${log.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold border border-emerald-200"
                            >
                              <Phone className="w-3 h-3 text-emerald-600" />
                              {log.whatsapp}
                            </a>
                          ) : (
                            <span className="text-neutral-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-neutral-500">
                          <div className="flex items-center gap-1.5">
                            {getDeviceIcon(log)}
                            <span className="text-[11px] truncate max-w-[120px]">
                              {log.userAgent ? (log.userAgent.includes('Mobile') ? 'Celular' : 'Computador') : '-'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                            title="Ver detalhes completos"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-neutral-100">
              {filteredLogs.map((log) => {
                const isLogin = log.event === 'LOGIN';
                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="p-3.5 hover:bg-neutral-50 active:bg-neutral-100 transition-colors cursor-pointer space-y-2 relative"
                  >
                    {/* Header Row: Event badge + Date/Time */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                          isLogin
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isLogin ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                        {log.event}
                      </span>
                      <span className="text-[11px] font-mono font-medium text-neutral-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {log.dateFormatted || log.timestamp}
                      </span>
                    </div>

                    {/* Operator Name & Matrícula */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-neutral-900 text-sm leading-tight">{log.name}</div>
                        <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                          Matrícula: <strong className="text-neutral-800">{log.username}</strong>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                        {formatRoleLabel(log.role).split(' ')[0]}
                      </span>
                    </div>

                    {/* Footer Row: WhatsApp & Device */}
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-100/80">
                      <div className="flex items-center gap-1.5">
                        {getDeviceIcon(log)}
                        <span className="truncate max-w-[150px]">
                          {log.userAgent ? (log.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop') : '-'}
                        </span>
                      </div>

                      {log.whatsapp && log.whatsapp !== '-' && (
                        <a
                          href={`https://wa.me/55${log.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{log.whatsapp}</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="p-3 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
          <span>Mostrando {filteredLogs.length} de {logs.length} registro(s)</span>
          <span className="font-medium">Sincronizado com aba LOGS_ACESSO</span>
        </div>
      </div>
    </div>
  );
};
