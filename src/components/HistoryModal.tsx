import React from 'react';
import { VehicleRecord } from '../types';
import { formatPlateForDisplay, isMercosulFormat } from '../utils/plateNormalizer';
import { shareToWhatsApp } from '../utils/shareService';
import { History, X, Trash2, Share2, Copy, CheckCircle2, Clock } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: VehicleRecord[];
  onClearHistory: () => void;
  onDeleteRecord: (id: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  records,
  onClearHistory,
  onDeleteRecord,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReshare = async (record: VehicleRecord) => {
    await shareToWhatsApp({
      photoDataUrl: record.photoDataUrl,
      description: record.description,
      plate: record.plate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-300" />
            <div>
              <h3 className="font-bold text-base leading-none">Registros Recentes</h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                {records.length} {records.length === 1 ? 'veículo registrado' : 'veículos registrados'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-emerald-700 text-emerald-200 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
          {records.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 flex flex-col items-center">
              <History className="w-12 h-12 stroke-1 mb-2" />
              <p className="font-medium text-sm">Nenhum registro no histórico</p>
              <p className="text-xs text-neutral-500">
                Os registros concluídos nesta sessão aparecerão aqui.
              </p>
            </div>
          ) : (
            records.map((rec) => (
              <div
                key={rec.id}
                className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-200 flex flex-col gap-2.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={rec.photoDataUrl}
                      alt={rec.plate}
                      className="w-14 h-14 rounded-xl object-cover border border-neutral-300"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-black text-neutral-900">
                          {formatPlateForDisplay(rec.plate)}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {isMercosulFormat(rec.plate) ? 'Mercosul' : 'Antiga'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-600 mt-0.5">
                        <span>Comb: <strong>{rec.fuel}</strong></span>
                        <span>•</span>
                        <span>Local: <strong>{rec.location}</strong></span>
                      </div>
                      {rec.characteristic && (
                        <span className="text-[11px] font-bold text-neutral-800 block mt-0.5">
                          {rec.characteristic}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteRecord(rec.id)}
                    title="Excluir este registro"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Description bar */}
                <div className="p-2 bg-neutral-200/70 rounded-lg font-mono text-[11px] text-neutral-800 break-all select-all">
                  {rec.description}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleCopy(rec.id, rec.description)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-neutral-300 text-neutral-700 text-xs font-semibold flex items-center gap-1 active:scale-95 transition"
                  >
                    {copiedId === rec.id ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copiar Texto
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleReshare(rec)}
                    className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-neutral-950 text-xs font-bold flex items-center gap-1.5 shadow active:scale-95 transition"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Recompartilhar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {records.length > 0 && (
          <div className="p-3 bg-neutral-100 border-t border-neutral-200 flex items-center justify-between">
            <button
              onClick={onClearHistory}
              className="text-xs text-rose-700 font-bold hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpar Histórico Local
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
