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
  RotateCcw,
  Sparkles,
  FileSpreadsheet,
  X,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { LocationCode, VehicleCharacteristic, VehicleRecord, VehicleStatus } from '../types';
import { exportRecordsToCsv, SECTORS } from '../utils/storageService';
import { formatPlateForDisplay } from '../utils/plateNormalizer';
import { generateWhatsAppMessage, openWhatsAppShare } from '../utils/shareService';

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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'parked' | 'released'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'today' | 'yesterday' | 'week'>('ALL');
  const [sectorFilter, setSectorFilter] = useState<LocationCode | 'ALL'>(
    initialSectorFilter || 'ALL'
  );
  const [characteristicFilter, setCharacteristicFilter] = useState<string>('ALL');

  // Preview Photo Modal
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Fast Memoized Filter
  const filteredRecords = useMemo(() => {
    const start = performance.now();
    const cleanSearch = searchTerm.trim().toUpperCase();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

    const result = records.filter((r) => {
      // 1. Search Query (Plate or notes)
      if (cleanSearch) {
        const plateMatch = r.plate.toUpperCase().includes(cleanSearch);
        const notesMatch = r.notes?.toUpperCase().includes(cleanSearch);
        if (!plateMatch && !notesMatch) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }

      // 3. Sector Filter
      if (sectorFilter !== 'ALL' && r.location !== sectorFilter) {
        return false;
      }

      // 4. Date Filter
      if (dateFilter === 'today' && r.createdAt < startOfToday) return false;
      if (dateFilter === 'yesterday' && (r.createdAt < startOfYesterday || r.createdAt >= startOfToday))
        return false;
      if (dateFilter === 'week' && r.createdAt < startOfWeek) return false;

      // 5. Characteristic Filter
      if (characteristicFilter !== 'ALL') {
        if (!r.characteristic || !r.characteristic.includes(characteristicFilter)) return false;
      }

      return true;
    });

    return result;
  }, [records, searchTerm, statusFilter, sectorFilter, dateFilter, characteristicFilter]);

  const handleExportCsv = () => {
    exportRecordsToCsv(filteredRecords);
  };

  const getFuelBadgeColor = (fuel: string) => {
    if (fuel === '1/8' || fuel === '2/8') return 'bg-rose-100 text-rose-800 border-rose-300';
    if (fuel === '3/8' || fuel === '4/8' || fuel === '5/8')
      return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300';
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
            <span className="hidden sm:inline">Exportar</span> Excel
          </button>
        </div>
      </div>

      {/* Instant Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Busca rápida por placa (ex: BRA2E19, ABC)..."
          className="w-full pl-9 pr-8 py-3 text-sm font-semibold bg-white border border-neutral-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-600 uppercase shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600 font-bold p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Row 1: Status & Date */}
      <div className="flex flex-col gap-2 bg-white rounded-2xl p-3 border border-neutral-200 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold text-neutral-500">
          <span>Status do Veículo:</span>
          <span>Período:</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Status Buttons */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                statusFilter === 'ALL'
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('parked')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                statusFilter === 'parked'
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              No Pátio
            </button>
            <button
              onClick={() => setStatusFilter('released')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                statusFilter === 'released'
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Liberados
            </button>
          </div>

          {/* Date Selector */}
          <select
            value={dateFilter}
            onChange={(e: any) => setDateFilter(e.target.value)}
            className="text-xs font-bold bg-neutral-100 border border-neutral-200 rounded-xl px-2.5 py-1.5 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">Todo Período</option>
            <option value="today">Hoje</option>
            <option value="yesterday">Ontem</option>
            <option value="week">Últimos 7 dias</option>
          </select>
        </div>

        {/* Sector Chips */}
        <div className="pt-2 border-t border-neutral-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-neutral-400 mr-1 flex-shrink-0">Setor:</span>
          <button
            onClick={() => setSectorFilter('ALL')}
            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
              sectorFilter === 'ALL'
                ? 'bg-emerald-800 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            Todos
          </button>
          {SECTORS.map((s) => (
            <button
              key={s.code}
              onClick={() => setSectorFilter(s.code)}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                sectorFilter === s.code
                  ? 'bg-emerald-800 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {s.code}
            </button>
          ))}
        </div>
      </div>

      {/* Results List */}
      <div className="flex flex-col gap-2.5">
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-neutral-200 flex flex-col items-center gap-2">
            <Car className="w-10 h-10 text-neutral-300" />
            <p className="text-sm font-bold text-neutral-800">
              Nenhum registro encontrado para este filtro.
            </p>
            <p className="text-xs text-neutral-500">
              Tente buscar por outra placa ou redefinir os filtros acima.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setDateFilter('ALL');
                setSectorFilter('ALL');
                setCharacteristicFilter('ALL');
              }}
              className="mt-2 text-xs text-emerald-700 font-bold hover:underline"
            >
              Limpar todos os filtros
            </button>
          </div>
        ) : (
          filteredRecords.map((r) => {
            const dateStr = new Date(r.createdAt).toLocaleDateString('pt-BR');
            const timeStr = new Date(r.createdAt).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const isParked = r.status === 'parked';

            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl p-3.5 border border-neutral-200 shadow-sm flex flex-col gap-2.5 hover:border-emerald-300 transition"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {/* Location Badge */}
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 border border-neutral-200 flex items-center justify-center font-mono font-black text-sm">
                      {r.location}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-black text-neutral-900 tracking-wider">
                          {formatPlateForDisplay(r.plate)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            isParked
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                          }`}
                        >
                          {isParked ? '🟢 No Pátio' : '⚪ Liberado'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-neutral-400" />
                          {dateStr} às {timeStr}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fuel & Characteristic Badges */}
                  <div className="text-right flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getFuelBadgeColor(
                        r.fuel
                      )}`}
                    >
                      ⛽ {r.fuel}
                    </span>
                    {r.characteristic && (
                      <span className="text-[10px] font-bold text-neutral-700">
                        {r.characteristic}
                      </span>
                    )}
                  </div>
                </div>

                {/* Photo Thumbnail if available */}
                {r.photoDataUrl && (
                  <div className="flex items-center gap-2 bg-neutral-50 p-2 rounded-xl border border-neutral-100">
                    <img
                      src={r.photoDataUrl}
                      alt={`Foto placa ${r.plate}`}
                      className="w-14 h-10 object-cover rounded-lg border border-neutral-200 cursor-pointer"
                      onClick={() => setPreviewPhotoUrl(r.photoDataUrl)}
                    />
                    <div className="flex-1 text-[11px] text-neutral-500">
                      <span className="font-semibold text-neutral-700 block">Foto capturada</span>
                      <button
                        onClick={() => setPreviewPhotoUrl(r.photoDataUrl)}
                        className="text-emerald-700 font-bold hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <Eye className="w-3 h-3" />
                        Visualizar imagem ampliada
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* WhatsApp */}
                    <button
                      onClick={() => {
                        const msg = generateWhatsAppMessage({
                          plate: r.plate,
                          fuel: r.fuel,
                          characteristic: r.characteristic,
                          location: r.location,
                          timestamp: new Date(r.createdAt),
                        });
                        openWhatsAppShare(msg);
                      }}
                      className="py-1.5 px-3 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-emerald-950 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>WhatsApp</span>
                    </button>

                    {/* Toggle Status */}
                    <button
                      onClick={() => onUpdateStatus(r.id, isParked ? 'released' : 'parked')}
                      className="py-1.5 px-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold flex items-center gap-1 active:scale-95 transition"
                    >
                      {isParked ? (
                        <>
                          <LogOut className="w-3.5 h-3.5 text-neutral-500" />
                          <span>Liberar</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Reativar</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => {
                      if (confirm(`Deseja excluir o registro da placa ${r.plate}?`)) {
                        onDeleteRecord(r.id);
                      }
                    }}
                    title="Excluir Registro"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Clear All History Button */}
      {records.length > 0 && (
        <div className="pt-2 text-center">
          <button
            onClick={() => {
              if (
                confirm(
                  'Tem certeza que deseja apagar todo o histórico de veículos salvos localmente?'
                )
              ) {
                onClearHistory();
              }
            }}
            className="text-xs text-neutral-400 hover:text-rose-600 font-semibold"
          >
            Limpar todos os registros do aparelho
          </button>
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-lg w-full bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-700">
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewPhotoUrl} alt="Foto original" className="w-full h-auto max-h-[75vh] object-contain" />
            <div className="p-3 text-center text-xs text-neutral-300">
              Toque fora da imagem para fechar
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
