import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Zap,
  ShieldCheck,
  Download,
  Upload,
  Save,
  Check,
  X,
  Info,
  Layers,
  Users,
  FileJson,
  HardDrive,
  HelpCircle,
  FileText,
  Lock,
  KeyRound,
} from 'lucide-react';
import {
  checkDatabaseHealth,
  configureDatabaseUrl,
  DatabaseDiagnosticResult,
  downloadDatabaseBackup,
  restoreDatabaseBackup,
} from '../utils/authService';

interface DatabaseTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatabaseTestModal: React.FC<DatabaseTestModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'diagnostic' | 'backup'>('diagnostic');
  const [diagnostic, setDiagnostic] = useState<DatabaseDiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [customDbUrl, setCustomDbUrl] = useState('');
  const [masterPasswordForDb, setMasterPasswordForDb] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Backup & Restore states
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<any | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ text: string; isError: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runTest = async () => {
    setLoading(true);
    setSaveMessage(null);
    try {
      const data = await checkDatabaseHealth();
      setDiagnostic(data);
    } catch (err: any) {
      setDiagnostic({
        success: false,
        status: 'disconnected',
        type: 'json',
        provider: 'Falha de Conexão',
        isRenderPostgres: false,
        latencyMs: 0,
        userCount: 0,
        connectionUrlMasked: 'Desconectado',
        message: err.message || 'Erro ao testar banco de dados',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runTest();
      setDownloadSuccess(null);
      setRestoreResult(null);
      setRestoreFile(null);
      setParsedBackup(null);
    }
  }, [isOpen]);

  const handleSaveDbUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDbUrl.trim()) return;

    if (!masterPasswordForDb.trim()) {
      setSaveMessage({
        text: 'Acesso restrito: Digite a senha de usuário Master para autorizar.',
        isError: true,
      });
      return;
    }

    setSavingUrl(true);
    setSaveMessage(null);
    try {
      const res = await configureDatabaseUrl(customDbUrl.trim(), masterPasswordForDb.trim());
      if (res.success) {
        setSaveMessage({ text: res.message || 'Banco conectado com sucesso!', isError: false });
        if (res.diagnostic) {
          setDiagnostic(res.diagnostic);
        } else {
          runTest();
        }
        setCustomDbUrl('');
        setMasterPasswordForDb('');
      } else {
        setSaveMessage({ text: res.message || 'Falha ao conectar na URL fornecida.', isError: true });
      }
    } catch (err: any) {
      setSaveMessage({ text: err.message || 'Erro ao conectar.', isError: true });
    } finally {
      setSavingUrl(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    setDownloadSuccess(null);
    try {
      const result = await downloadDatabaseBackup();
      if (result.success) {
        setDownloadSuccess(`Arquivo salvo no seu computador: ${result.filename}`);
      } else {
        alert(result.error || 'Erro ao baixar backup.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        setParsedBackup(json);
      } catch (err) {
        setRestoreResult({
          text: 'O arquivo selecionado não é um JSON válido de backup.',
          isError: true,
        });
        setParsedBackup(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!parsedBackup) return;
    if (!window.confirm('Tem certeza que deseja restaurar os dados do arquivo? Os registros existentes serão combinados e atualizados.')) {
      return;
    }

    setIsRestoring(true);
    setRestoreResult(null);
    try {
      const res = await restoreDatabaseBackup(parsedBackup);
      if (res.success) {
        setRestoreResult({
          text: res.message || 'Backup restaurado com sucesso!',
          isError: false,
        });
        setRestoreFile(null);
        setParsedBackup(null);
        runTest();
      } else {
        setRestoreResult({
          text: res.message || 'Falha ao restaurar backup.',
          isError: true,
        });
      }
    } catch (err: any) {
      setRestoreResult({
        text: err.message || 'Erro ao restaurar backup.',
        isError: true,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = diagnostic?.status === 'connected';
  const isPostgres = diagnostic?.type === 'postgres';

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">Banco de Dados & Backups</h3>
              <p className="text-xs text-slate-300">Conexão OnRender / PostgreSQL & Gestão de Backups</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 p-1.5 flex gap-1 border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('diagnostic')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'diagnostic'
                ? 'bg-white text-indigo-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Diagnóstico & Conexão</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-white text-indigo-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Backup & Restauração Manual</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-neutral-800 flex-1">
          {activeTab === 'diagnostic' ? (
            <>
              {/* Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3.5 transition ${
                  loading
                    ? 'bg-neutral-50 border-neutral-200 text-neutral-700'
                    : isConnected
                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50/90 border-amber-300 text-amber-950'
                }`}
              >
                {loading ? (
                  <RefreshCw className="w-6 h-6 text-neutral-500 animate-spin shrink-0 mt-0.5" />
                ) : isConnected ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black tracking-tight">
                      {loading
                        ? 'Testando conexão com o banco...'
                        : isConnected
                        ? isPostgres
                          ? 'Banco PostgreSQL (Render) Ativo e Operacional'
                          : 'Banco de Dados Conectado'
                        : 'Modo Local / Aguardando Configuração do Banco'}
                    </span>
                    {diagnostic && !loading && (
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isConnected
                            ? 'bg-emerald-200 text-emerald-900'
                            : 'bg-amber-200 text-amber-900'
                        }`}
                      >
                        {diagnostic.type.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1 leading-relaxed opacity-90">
                    {loading
                      ? 'Aguardando resposta do servidor...'
                      : diagnostic?.message || 'Status verificado.'}
                  </p>
                </div>
              </div>

              {/* Diagnostic Metrics Grid */}
              {diagnostic && !loading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                    <div className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1">
                      <Server className="w-3.5 h-3.5 text-indigo-500" /> Provedor
                    </div>
                    <div className="text-xs font-black text-neutral-900 mt-1 truncate">
                      {diagnostic.provider}
                    </div>
                  </div>

                  <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                    <div className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500" /> Latência
                    </div>
                    <div className="text-xs font-black text-neutral-900 mt-1">
                      {diagnostic.latencyMs} ms
                    </div>
                  </div>

                  <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 col-span-2 sm:col-span-1">
                    <div className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-emerald-500" /> Usuários no BD
                    </div>
                    <div className="text-xs font-black text-neutral-900 mt-1">
                      {diagnostic.userCount} cadastrados
                    </div>
                  </div>
                </div>
              )}

              {/* Table Verification Badges */}
              {diagnostic?.tables && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Integridade das Tabelas do Sistema:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 font-medium">
                      {diagnostic.tables.users ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-rose-500" />
                      )}
                      <span>users (Usuários & Senhas)</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      {diagnostic.tables.vehicle_records ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-rose-500" />
                      )}
                      <span>vehicle_records (Pátio)</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      {diagnostic.tables.access_logs ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-rose-500" />
                      )}
                      <span>access_logs (Auditoria)</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      {diagnostic.tables.app_settings ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-rose-500" />
                      )}
                      <span>app_settings (Configurações)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* OnRender Connection String Form */}
              <form onSubmit={handleSaveDbUrl} className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Configurar URL do PostgreSQL (Render):</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Requer Senha Master
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="postgresql://user:pass@dpg-xxxx.render.com/dbname"
                  value={customDbUrl}
                  onChange={(e) => setCustomDbUrl(e.target.value)}
                  className="w-full bg-white border border-neutral-300 focus:border-indigo-600 rounded-xl px-3 py-2 text-xs font-mono text-neutral-900 outline-none transition"
                />

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-700 flex items-center gap-1.5">
                    <KeyRound className="w-3 h-3 text-amber-600" />
                    <span>Senha de Usuário Master:</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Digite a senha de usuário Master para autorizar"
                    value={masterPasswordForDb}
                    onChange={(e) => setMasterPasswordForDb(e.target.value)}
                    className="w-full bg-white border border-neutral-300 focus:border-indigo-600 rounded-xl px-3 py-2 text-xs text-neutral-900 outline-none transition"
                  />
                </div>

                {saveMessage && (
                  <div
                    className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                      saveMessage.isError
                        ? 'bg-rose-50 border border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>{saveMessage.text}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-neutral-500">
                    Ou configure no Render na variável <code className="font-bold">DATABASE_URL</code>
                  </span>
                  <button
                    type="submit"
                    disabled={savingUrl || !customDbUrl.trim() || !masterPasswordForDb.trim()}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingUrl ? 'Conectando...' : 'Conectar Banco (Master)'}</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* BACKUP & RESTORE TAB */
            <div className="space-y-4">
              {/* Card 1: Baixar Backup Manual */}
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">Baixar Backup no seu Computador</h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Gera um arquivo completo com todos os usuários, senhas, histórico de veículos, auditoria e configurações.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between gap-3 pt-2 border-t border-emerald-200/80">
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Formato: <strong className="font-bold">JSON Estruturado</strong> (.json)
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    disabled={isDownloading}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
                  >
                    <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                    <span>{isDownloading ? 'Baixando...' : 'Baixar Arquivo Agora'}</span>
                  </button>
                </div>

                {downloadSuccess && (
                  <div className="mt-3 p-2.5 bg-emerald-100/80 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{downloadSuccess}</span>
                  </div>
                )}
              </div>

              {/* Card 2: Restaurar Backup Manual */}
              <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-indigo-950">Restaurar Backup do seu Computador</h4>
                    <p className="text-xs text-indigo-800 mt-0.5">
                      Suba o arquivo de backup baixado anteriormente para restaurar os dados no banco.
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 space-y-3">
                  <input
                    type="file"
                    accept=".json,application/json"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl p-4 bg-white text-center cursor-pointer transition"
                  >
                    <FileJson className="w-8 h-8 text-indigo-600 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-neutral-800">
                      {restoreFile ? restoreFile.name : 'Clique para selecionar o arquivo de backup (.json)'}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {restoreFile ? `${(restoreFile.size / 1024).toFixed(1)} KB` : 'Arraste ou clique para buscar no computador'}
                    </p>
                  </div>

                  {parsedBackup && (
                    <div className="bg-white p-3 rounded-xl border border-indigo-200 space-y-2 text-xs">
                      <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Arquivo validado com sucesso! Conteúdo encontrado:</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-100">
                          <div className="text-[11px] text-neutral-500">Usuários</div>
                          <div className="font-bold text-neutral-900 text-sm">
                            {parsedBackup.counts?.users || parsedBackup.data?.users?.length || 0}
                          </div>
                        </div>
                        <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-100">
                          <div className="text-[11px] text-neutral-500">Veículos</div>
                          <div className="font-bold text-neutral-900 text-sm">
                            {parsedBackup.counts?.records || parsedBackup.data?.records?.length || 0}
                          </div>
                        </div>
                        <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-100">
                          <div className="text-[11px] text-neutral-500">Logs</div>
                          <div className="font-bold text-neutral-900 text-sm">
                            {parsedBackup.counts?.logs || parsedBackup.data?.logs?.length || 0}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleExecuteRestore}
                        disabled={isRestoring}
                        className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                        <span>{isRestoring ? 'Restaurando Banco de Dados...' : 'Confirmar e Restaurar Dados Agora'}</span>
                      </button>
                    </div>
                  )}

                  {restoreResult && (
                    <div
                      className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                        restoreResult.isError
                          ? 'bg-rose-50 border border-rose-200 text-rose-800'
                          : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      }`}
                    >
                      {restoreResult.isError ? (
                        <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      )}
                      <span>{restoreResult.text}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Backups Nativos do Render (PostgreSQL) */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-slate-600" />
                  <span>Como funciona o Backup no painel do OnRender:</span>
                </div>
                <p className="leading-relaxed">
                  Além do botão de baixar/restaurar deste aplicativo, o próprio **Render** oferece ferramentas nativas:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>
                    <strong>No Painel do Render:</strong> Acesse seu banco PostgreSQL em <em>dashboard.render.com</em> e clique na aba <em>Backups</em> (o Render realiza snapshots diários).
                  </li>
                  <li>
                    <strong>Via terminal com pg_dump:</strong> Para extrair um dump SQL completo do PostgreSQL para seu computador:
                    <pre className="mt-1 p-2 bg-slate-900 text-emerald-400 rounded-lg overflow-x-auto text-[10px] font-mono select-all">
                      pg_dump -d "postgresql://usuario:senha@dpg-xxx.render.com/dbname" -F c -b -v -f backup_render.dump
                    </pre>
                  </li>
                  <li>
                    <strong>Para restaurar via pg_restore:</strong>
                    <pre className="mt-1 p-2 bg-slate-900 text-emerald-400 rounded-lg overflow-x-auto text-[10px] font-mono select-all">
                      pg_restore -d "postgresql://usuario:senha@dpg-xxx.render.com/dbname" -v backup_render.dump
                    </pre>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-3 shrink-0">
          {activeTab === 'diagnostic' ? (
            <button
              type="button"
              onClick={runTest}
              disabled={loading}
              className="px-4 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-800 text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Testando...' : 'Testar Novamente'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={isDownloading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Backup</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
