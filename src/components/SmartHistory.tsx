import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  Filter,
  Download,
  Share2,
  Trash2,
  Car,
  Clock,
  MapPin,
  Fuel,
  CheckCircle2,
  LogOut,
  LogIn,
  Package,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  FileSpreadsheet,
  X,
  Eye,
  AlertCircle,
  Key,
  User,
  Gauge,
} from 'lucide-react';
import { LocationCode, OperationType, VehicleCharacteristic, VehicleRecord, VehicleStatus } from '../types';
import { exportRecordsToCsv, SECTORS } from '../utils/storageService';
import { formatPlateForDisplay } from '../utils/plateNormalizer';
import { generateWhatsAppMessage, getLocationMeaning, openWhatsAppShare } from '../utils/shareService';

interface SmartHistoryProps {
  records: VehicleRecord[];
  onUpdateStatus: (id: string, status: VehicleStatus) => void;
  onDeleteRecord: (id: string) => void;
  onClearHistory: () => void;
  initialSectorFilter?: LocationCode;
}

export const SmartHistory: React.FC<SmartHistoryProps> = ({
  records,
  onUpdateStatus,
  onDeleteRecord,
  onClearHistory,
  initialSectorFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [operationFilter, setOperationFilter] = useState<OperationType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'parked' | 'released'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'today' | 'yesterday' | 'week'>('ALL');
  const [sectorFilter, setSectorFilter] = useState<LocationCode | 'ALL'>(
    initialSectorFilter || 'ALL'
  );

  // Preview Photo Modal
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Fast Memoized Filter
  const filteredRecords = useMemo(() => {
    const cleanSearch = searchTerm.trim().toUpperCase();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

    return records.filter((r) => {
      // 1. Search Query (Plate, Driver, Origin/Dest or notes)
      if (cleanSearch) {
        const plateMatch = r.plate.toUpperCase().includes(cleanSearch);
        const driverMatch = r.driverName?.toUpperCase().includes(cleanSearch);
        const originMatch = r.origin?.toUpperCase().includes(cleanSearch);
        const destMatch = r.destination?.toUpperCase().includes(cleanSearch);
        const notesMatch = r.notes?.toUpperCase().includes(cleanSearch);
        if (!plateMatch && !driverMatch && !originMatch && !destMatch && !notesMatch) return false;
      }

      // 2. Operation Filter
      if (operationFilter !== 'ALL' && r.operationType !== operationFilter) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }

      // 4. Sector Filter
      if (sectorFilter !== 'ALL' && r.location !== sectorFilter) {
        return false;
      }

      // 5. Date Filter
      if (dateFilter === 'today' && r.createdAt < startOfToday) return false;
      if (dateFilter === 'yesterday' && (r.createdAt < startOfYesterday || r.createdAt >= startOfToday))
        return false;
      if (dateFilter === 'week' && r.createdAt < startOfWeek) return false;

      return true;
    });
  }, [records, searchTerm, operationFilter, statusFilter, sectorFilter, dateFilter]);

  const handleExportCsv = () => {
    exportRecordsToCsv(filteredRecords);
  };

  const getFuelBadgeColor = (fuel: string) => {
    if (fuel === '1/8' || fuel === '2/8') return 'bg-rose-100 text-rose-800 border-rose-300';
    if (fuel === '3/8' || fuel === '4/8' || fuel === '5/8')
      return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  };

  const getOperationBadge = (op: OperationType) => {
    switch (op) {
      case 'entrada':
        return { label: 'Entrada', color: 'bg-emerald-100 text-emerald-900 border-emerald-300', icon: LogIn };
      case 'saida':
        return { label: 'Saída', color: 'bg-rose-100 text-rose-900 border-rose-300', icon: LogOut };
      case 'pdc':
        return { label: 'PDC', color: 'bg-amber-100 text-amber-900 border-amber-300', icon: Package };
      case 'qualidade_51':
        return { label: '51 Qualidade', color: 'bg-indigo-100 text-indigo-900 border-indigo-300', icon: ShieldCheck };
    }
  };

  return (
    <div className="flex flex-col gap-3.5 max-w-md mx-auto w-full px-4 py-4 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-neutral-900 tracking-tight leading-none">
            Histórico & Busca
          </h2>
          <p className="text-xs text-neutral-500 font-medium mt-0.5">
            {filteredRecords.length} de {records.length} registros encontrados
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportCsv}
            title="Exportar registros em planilha CSV"
            className="py-1.5 px-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-1 active:scale-95 transition border border-emerald-300"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Planilha CSV</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por placa, condutor, destino..."
          className="w-full pl-10 pr-9 py-3 rounded-2xl bg-white border border-neutral-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition shadow-sm outline-none placeholder:text-neutral-400"
        />
        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="w-6 h-6 rounded-full bg-neutral-200 hover:bg-neutral-300 text-neutral-600 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Operation Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider pl-1">
          Tipo:
        </span>
        <button
          type="button"
          onClick={() => setOperationFilter('ALL')}
          className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
            operationFilter === 'ALL'
              ? 'bg-neutral-900 text-white border-neutral-900'
              : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          Todos ({records.length})
        </button>

        <button
          type="button"
          onClick={() => setOperationFilter('entrada')}
          className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition border flex items-center gap-1 ${
            operationFilter === 'entrada'
              ? 'bg-emerald-700 text-white border-emerald-800'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <LogIn className="w-3 h-3" />
          Entrada
        </button>

        <button
          type="button"
          onClick={() => setOperationFilter('saida')}
          className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition border flex items-center gap-1 ${
            operationFilter === 'saida'
              ? 'bg-rose-700 text-white border-rose-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
          }`}
        >
          <LogOut className="w-3 h-3" />
          Saída
        </button>

        <button
          type="button"
          onClick={() => setOperationFilter('pdc')}
          className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition border flex items-center gap-1 ${
            operationFilter === 'pdc'
              ? 'bg-amber-700 text-white border-amber-800'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <Package className="w-3 h-3" />
          PDC
        </button>

        <button
          type="button"
          onClick={() => setOperationFilter('qualidade_51')}
          className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition border flex items-center gap-1 ${
            operationFilter === 'qualidade_51'
              ? 'bg-indigo-700 text-white border-indigo-800'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
          }`}
        >
          <ShieldCheck className="w-3 h-3" />
          51 (Qualidade)
        </button>
      </div>

      {/* Date & Status Filter Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDateFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold border transition ${
              dateFilter === 'ALL'
                ? 'bg-neutral-800 text-white border-neutral-900'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
            }`}
          >
            Sempre
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('today')}
            className={`px-2.5 py-1 rounded-lg font-bold border transition ${
              dateFilter === 'today'
                ? 'bg-neutral-800 text-white border-neutral-900'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
            }`}
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('yesterday')}
            className={`px-2.5 py-1 rounded-lg font-bold border transition ${
              dateFilter === 'yesterday'
                ? 'bg-neutral-800 text-white border-neutral-900'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
            }`}
          >
            Ontem
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold border transition ${
              statusFilter === 'ALL'
                ? 'bg-emerald-800 text-white border-emerald-900'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
            }`}
          >
            Todos Status
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('parked')}
            className={`px-2.5 py-1 rounded-lg font-bold border transition ${
              statusFilter === 'parked'
                ? 'bg-emerald-700 text-white border-emerald-800'
                : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            No Pátio
          </button>
        </div>
      </div>

      {/* Records List */}
      <div className="flex flex-col gap-2.5 pt-1">
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-neutral-200 text-center flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8 text-neutral-400" />
            <h3 className="font-bold text-neutral-800 text-sm">Nenhum registro encontrado</h3>
            <p className="text-xs text-neutral-500 max-w-xs">
              Tente mudar os filtros de busca ou cadastre um novo veículo.
            </p>
          </div>
        ) : (
          filteredRecords.map((r) => {
            const opBadge = getOperationBadge(r.operationType);
            const OpIcon = opBadge.icon;
            const isParked = r.status === 'parked';

            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl p-3.5 border border-neutral-200 shadow-sm flex flex-col gap-2.5 hover:border-emerald-300 transition"
              >
                {/* Header: Plate + Operation Badge + Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-neutral-900 tracking-wider bg-neutral-100 px-2 py-0.5 rounded-lg border border-neutral-300">
                      {formatPlateForDisplay(r.plate)}
                    </span>

                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border flex items-center gap-1 ${opBadge.color}`}
                    >
                      <OpIcon className="w-3 h-3" />
                      {opBadge.label}
                    </span>
                  </div>

                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                      isParked
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                    }`}
                  >
                    {isParked ? 'No Pátio' : 'Liberado'}
                  </span>
                </div>

                {/* Operation-specific Details Grid */}
                {(r.operationType === 'entrada' || r.operationType === 'saida') && (
                  <div className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-200/80 text-xs grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[9px] text-neutral-400 block uppercase font-bold">Condutor</span>
                      <span className="font-bold text-neutral-800 truncate block">
                        {r.driverName || 'Não informado'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-neutral-400 block uppercase font-bold">
                        {r.operationType === 'entrada' ? 'Origem' : 'Destino'}
                      </span>
                      <span className="font-bold text-neutral-800 truncate block">
                        {(r.operationType === 'entrada' ? r.origin : r.destination) || 'Não informado'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-neutral-400 block uppercase font-bold">KM</span>
                      <span className="font-mono font-bold text-neutral-800">
                        {r.km ? `${r.km} km` : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-neutral-400 block uppercase font-bold">Chave Reserva / Tipo</span>
                      <span className="font-bold text-neutral-800 text-[11px]">
                        {r.hasSpareKey ? '🔑 Sim' : '❌ Não'} • <span className="text-blue-700 font-black">{r.fleetType || 'RAC'}</span>
                      </span>
                    </div>
                  </div>
                )}

                {r.operationType === 'qualidade_51' && (
                  <div className="bg-indigo-50/70 rounded-xl p-2.5 border border-indigo-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-indigo-700 block uppercase font-bold">Local</span>
                      <span className="font-black text-indigo-950 font-mono">
                        {getLocationMeaning(r.location)}
                      </span>
                    </div>
                    {r.characteristic && (
                      <div>
                        <span className="text-[9px] text-indigo-700 block uppercase font-bold">Característica</span>
                        <span className="font-bold text-neutral-800 text-[11px]">
                          {r.characteristic}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Combustível & Horário */}
                <div className="flex items-center justify-between text-xs text-neutral-600 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <Fuel className="w-3.5 h-3.5 text-neutral-500" />
                    <span
                      className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${getFuelBadgeColor(
                        r.fuel
                      )}`}
                    >
                      {r.fuel}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(r.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                      })}{' '}
                      às{' '}
                      {new Date(r.createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-neutral-100">
                  <div className="flex items-center gap-1.5">
                    {r.photoDataUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewPhotoUrl(r.photoDataUrl)}
                        className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-bold flex items-center gap-1 transition"
                        title="Ver foto"
                      >
                        <Eye className="w-3 h-3 text-neutral-600" />
                        <span>Foto</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const msg = generateWhatsAppMessage({
                          operationType: r.operationType,
                          plate: r.plate,
                          fuel: r.fuel,
                          driverName: r.driverName,
                          origin: r.origin,
                          destination: r.destination,
                          km: r.km,
                          hasSpareKey: r.hasSpareKey,
                          fleetType: r.fleetType,
                          location: r.location,
                          characteristic: r.characteristic,
                          timestamp: new Date(r.createdAt),
                        });
                        openWhatsAppShare(msg);
                      }}
                      className="p-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1 transition border border-emerald-200"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>WhatsApp</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isParked ? (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(r.id, 'released')}
                        className="py-1 px-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[10px] font-bold flex items-center gap-1 transition"
                      >
                        <LogOut className="w-3 h-3 text-neutral-500" />
                        <span>Liberar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(r.id, 'parked')}
                        className="py-1 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1 transition"
                      >
                        <RotateCcw className="w-3 h-3 text-emerald-600" />
                        <span>Re-estacionar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteRecord(r.id)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Excluir registro"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Clear All History Button */}
      {records.length > 0 && (
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Tem certeza que deseja apagar todo o histórico local?')) {
                onClearHistory();
              }
            }}
            className="text-xs text-neutral-400 hover:text-rose-600 font-semibold transition"
          >
            Limpar todos os registros locais
          </button>
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 rounded-3xl p-3 max-w-sm w-full border border-neutral-700 shadow-2xl relative flex flex-col gap-2"
          >
            <div className="flex items-center justify-between px-2 text-white">
              <span className="text-xs font-bold">Foto do Registro</span>
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden aspect-video bg-black flex items-center justify-center">
              <img
                src={previewPhotoUrl}
                alt="Foto do veículo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
