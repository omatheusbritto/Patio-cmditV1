import React, { useState } from 'react';
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  FileJson,
  ShieldCheck,
  HardDrive,
  Info,
} from 'lucide-react';
import { downloadDatabaseBackup, restoreDatabaseBackup } from '../utils/movementService';
import { getCurrentSession } from '../utils/authService';

interface MasterDatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreComplete?: () => void;
}

export const MasterDatabaseBackupModal: React.FC<MasterDatabaseBackupModalProps> = ({
  isOpen,
  onClose,
  onRestoreComplete,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<{
    success: boolean;
    message: string;
    counts?: any;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const session = getCurrentSession();
  const isMaster =
    session?.user.role === 'master' || session?.user.username.toLowerCase() === 'mastercmdit';

  if (!isOpen) return null;

  const handleDownloadBackup = async () => {
    setErrorMessage(null);
    setRestoreStatus(null);
    setDownloading(true);
    try {
      await downloadDatabaseBackup();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao baixar backup');
    } finally {
      setDownloading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.json')) {
        setErrorMessage('Por favor, selecione um arquivo válido no formato .json');
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Selecione um arquivo de backup (.json) para restaurar.');
      return;
    }

    const confirmed = window.confirm(
      '⚠️ ATENÇÃO - RESTAURAÇÃO DE BANCO:\n\nTem certeza que deseja restaurar este backup no PostgreSQL do Render? Os dados serão integrados ao banco de dados existente.'
    );
    if (!confirmed) return;

    setRestoring(true);
    setErrorMessage(null);
    setRestoreStatus(null);

    try {
      const fileText = await selectedFile.text();
      let jsonData: any;
      try {
        jsonData = JSON.parse(fileText);
      } catch {
        throw new Error('O arquivo selecionado não contém um JSON válido.');
      }

      const res = await restoreDatabaseBackup(jsonData);
      if (res.success) {
        setRestoreStatus({
          success: true,
          message: res.message || 'Banco de dados restaurado com sucesso!',
          counts: res.restoredCounts,
        });
        setSelectedFile(null);
        if (onRestoreComplete) {
          onRestoreComplete();
        }
      } else {
        setErrorMessage(res.message || 'Falha ao restaurar banco.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar arquivo de backup.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight text-white">
                  Backup & Restauração
                </h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Master
                </span>
              </div>
              <p className="text-xs text-slate-300">
                PostgreSQL Render • Tabelas e Registros CMDIT
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-neutral-800">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {restoreStatus && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium space-y-2">
              <div className="flex items-center gap-2 font-black text-sm text-emerald-950">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{restoreStatus.message}</span>
              </div>
              {restoreStatus.counts && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200 text-xs">
                  <div>
                    <strong className="text-neutral-900">Usuários:</strong>{' '}
                    {restoreStatus.counts.users ?? 0}
                  </div>
                  <div>
                    <strong className="text-neutral-900">Registros Veiculares:</strong>{' '}
                    {restoreStatus.counts.vehicleRecords ?? 0}
                  </div>
                  <div>
                    <strong className="text-neutral-900">Movimentações:</strong>{' '}
                    {restoreStatus.counts.movements ?? 0}
                  </div>
                  <div>
                    <strong className="text-neutral-900">Logs de Acesso:</strong>{' '}
                    {restoreStatus.counts.accessLogs ?? 0}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 1: EXPORTAR BACKUP */}
          <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-neutral-900 leading-tight">
                  1. Exportar Backup Completo (.JSON)
                </h4>
                <p className="text-[11px] text-neutral-500">
                  Gera um arquivo com todos os usuários, veículos, movimentações e logs do Render.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={downloading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
            >
              <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
              <span>{downloading ? 'Gerando Arquivo de Backup...' : 'Baixar Backup Agora'}</span>
            </button>
          </div>

          {/* SECTION 2: RESTAURAR BACKUP */}
          <form
            onSubmit={handleRestoreSubmit}
            className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-neutral-900 leading-tight">
                  2. Restaurar Backup no PostgreSQL
                </h4>
                <p className="text-[11px] text-neutral-500">
                  Importa dados a partir de um arquivo .json de backup gerado pelo sistema.
                </p>
              </div>
            </div>

            {/* File selector input */}
            <div className="border-2 border-dashed border-neutral-300 hover:border-indigo-500 rounded-2xl p-4 text-center bg-white transition cursor-pointer relative">
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                <FileJson className="w-7 h-7 text-indigo-600" />
                <span className="text-xs font-bold text-neutral-800">
                  {selectedFile ? selectedFile.name : 'Clique para selecionar arquivo .JSON'}
                </span>
                <span className="text-[10px] text-neutral-400">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                    : 'Formatos suportados: backup_patiocmdit_*.json'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={restoring || !selectedFile}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition disabled:opacity-40 cursor-pointer"
            >
              <Upload className={`w-4 h-4 ${restoring ? 'animate-spin' : ''}`} />
              <span>{restoring ? 'Restaurando Banco de Dados...' : 'Iniciar Restauração'}</span>
            </button>
          </form>

          {/* Information box */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Segurança Master:</strong> O backup e a restauração afetam diretamente a
              base relacional PostgreSQL do Render. As planilhas do Google Sheets mantêm seu histórico
              preservado independentemente.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end shrink-0">
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
