import React, { useState } from 'react';
import {
  History,
  X,
  Car,
  UserCheck,
} from 'lucide-react';
import { VehicleRecord } from '../types';
import { getCurrentSession } from '../utils/authService';

interface MyShiftHistoryModalProps {
  onClose: () => void;
  allRecords: VehicleRecord[];
}

export const MyShiftHistoryModal: React.FC<MyShiftHistoryModalProps> = ({
  onClose,
  allRecords,
}) => {
  const session = getCurrentSession();
  const [filterOp, setFilterOp] = useState<string>('all');

  // Registros das últimas 9 horas (turno)
  const shiftStartTime = session ? session.loginTimestamp : Date.now() - 9 * 60 * 60 * 1000;

  const myShiftRecords = allRecords.filter((record) => {
    return record.createdAt >= shiftStartTime - 1000 * 60 * 60 * 9;
  });

  const filtered = myShiftRecords.filter((rec) => {
    if (filterOp === 'all') return true;
    return rec.operationType === filterOp;
  });

  const getOpBadge = (op: string) => {
    switch (op) {
      case 'entrada':
        return <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded text-[10px] font-black uppercase">Entrada</span>;
      case 'saida':
        return <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded text-[10px] font-black uppercase">Saída</span>;
      case 'qualidade_51':
        return <span className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded text-[10px] font-black uppercase">51 Qualidade</span>;
      case 'abastecimento':
        return <span className="bg-cyan-100 text-cyan-900 px-2 py-0.5 rounded text-[10px] font-black uppercase">Abastecimento</span>;
      default:
        return <span className="bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded text-[10px] font-black uppercase">{op}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-neutral-200 animate-in fade-in duration-150">
        {/* Header */}
        <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight">Meus Registros de Hoje</h2>
              <div className="flex items-center gap-1 text-xs text-emerald-200 mt-0.5">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Operador: {session?.user.name || 'Operador'}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-3 bg-neutral-50 border-b border-neutral-200 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilterOp('all')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              filterOp === 'all'
                ? 'bg-neutral-900 text-white'
                : 'bg-white border border-neutral-300 text-neutral-600'
            }`}
          >
            Todos ({myShiftRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterOp('entrada')}
            className={`px-2.5 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              filterOp === 'entrada'
                ? 'bg-emerald-700 text-white'
                : 'bg-white border border-neutral-300 text-neutral-600'
            }`}
          >
            Entradas
          </button>
          <button
            type="button"
            onClick={() => setFilterOp('saida')}
            className={`px-2.5 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              filterOp === 'saida'
                ? 'bg-rose-700 text-white'
                : 'bg-white border border-neutral-300 text-neutral-600'
            }`}
          >
            Saídas
          </button>
          <button
            type="button"
            onClick={() => setFilterOp('qualidade_51')}
            className={`px-2.5 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              filterOp === 'qualidade_51'
                ? 'bg-indigo-700 text-white'
                : 'bg-white border border-neutral-300 text-neutral-600'
            }`}
          >
            51 Qualidade
          </button>
          <button
            type="button"
            onClick={() => setFilterOp('abastecimento')}
            className={`px-2.5 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
              filterOp === 'abastecimento'
                ? 'bg-cyan-700 text-white'
                : 'bg-white border border-neutral-300 text-neutral-600'
            }`}
          >
            Abastecimentos
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-neutral-400 flex flex-col items-center gap-2">
              <Car className="w-10 h-10 stroke-1" />
              <p className="text-xs font-medium">Nenhum registro encontrado no seu turno atual.</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-white rounded-2xl border border-neutral-200 shadow-xs flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300">
                      {item.plate}
                    </span>
                    {getOpBadge(item.operationType || 'entrada')}
                  </div>
                  <span className="text-[11px] font-bold text-neutral-500">
                    {new Date(item.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[11px] text-neutral-600 pt-1 border-t border-neutral-100">
                  {item.driverName && (
                    <div><span className="text-neutral-400">Condutor:</span> <strong>{item.driverName}</strong></div>
                  )}
                  {item.origin && (
                    <div><span className="text-neutral-400">Origem:</span> <strong>{item.origin}</strong></div>
                  )}
                  {item.destination && (
                    <div><span className="text-neutral-400">Destino:</span> <strong>{item.destination}</strong></div>
                  )}
                  {item.km && (
                    <div><span className="text-neutral-400">KM:</span> <strong>{item.km}</strong></div>
                  )}
                  {item.fuel && (
                    <div><span className="text-neutral-400">Comb.:</span> <strong>{item.fuel}</strong></div>
                  )}
                  {item.location && (
                    <div><span className="text-neutral-400">Pátio:</span> <strong>{item.location}</strong></div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
