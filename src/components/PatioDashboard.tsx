import React, { useState } from 'react';
import {
  Car,
  Fuel,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Share2,
  LogOut,
  Plus,
  Layers,
  Search,
  Filter,
  BarChart3,
  Flame,
  ArrowUpRight,
  Clock,
  Sparkles,
  LogIn,
  Package,
  ShieldCheck,
  Wrench,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Grid,
} from 'lucide-react';
import { LocationCode, PatioMetrics, VehicleRecord } from '../types';
import { formatPlateForDisplay } from '../utils/plateNormalizer';
import { generateWhatsAppMessage, openWhatsAppShare } from '../utils/shareService';
import {
  BASE_YARD_LOCATIONS,
  QUADRANT_ROWS,
  formatQuadrantRow,
  formatQuadrantRowCode,
  matchLocationToGroup,
} from '../utils/yardLocations';

interface PatioDashboardProps {
  records: VehicleRecord[];
  metrics: PatioMetrics;
  onSelectSectorForNew: (sector: LocationCode) => void;
  onReleaseVehicle: (id: string) => void;
  onStartNewRegistration: () => void;
  onOpenHistoryTab: (initialSectorFilter?: LocationCode) => void;
  onMoveVehicle?: (vehicle: VehicleRecord) => void;
}

export const PatioDashboard: React.FC<PatioDashboardProps> = ({
  records,
  metrics,
  onSelectSectorForNew,
  onReleaseVehicle,
  onStartNewRegistration,
  onOpenHistoryTab,
  onMoveVehicle,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [expandedQuadrant, setExpandedQuadrant] = useState<number | null>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'quadrantes' | 'especiais' | 'todos'>('quadrantes');

  const parkedRecords = records.filter((r) => r.status === 'parked');

  // Count vehicles in a specific location string or quadrant code
  const getCountInLocation = (target: string): number => {
    return parkedRecords.filter((v) => matchLocationToGroup(v.location, target)).length;
  };

  const filteredParked = parkedRecords.filter((v) => {
    const matchesFilter = selectedFilter === 'ALL' || matchLocationToGroup(v.location, selectedFilter);
    const matchesSearch =
      !searchQuery.trim() ||
      v.plate.toUpperCase().includes(searchQuery.trim().toUpperCase()) ||
      (v.driverName && v.driverName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.location && v.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.notes && v.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const getFuelBadgeColor = (fuel: string) => {
    if (fuel === '1/8' || fuel === '2/8') return 'bg-rose-100 text-rose-800 border-rose-300';
    if (fuel === '3/8' || fuel === '4/8' || fuel === '5/8')
      return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  };

  const quadrants = BASE_YARD_LOCATIONS.filter((l) => l.isQuadrant);
  const specials = BASE_YARD_LOCATIONS.filter((l) => !l.isQuadrant);

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full px-4 py-4 pb-24">
      {/* Top Banner with Stats */}
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white rounded-3xl p-5 shadow-lg border border-emerald-600/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/30 flex items-center justify-center border border-emerald-400/40 backdrop-blur-md">
              <Layers className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight leading-none text-white">
                Pátio & Vagas
              </h2>
              <p className="text-[11px] text-emerald-200 font-semibold mt-0.5">
                Gestão Visual de Quadrantes & Filas CMDIT
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-3xl font-black text-white leading-none block">
              {metrics.totalParked}
            </span>
            <span className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">
              Veículos no Pátio
            </span>
          </div>
        </div>

        {/* Fleet Fuel Gauge Card */}
        <div className="bg-emerald-950/60 rounded-2xl p-3.5 border border-emerald-500/30 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-bold text-emerald-100">
                Nível Médio de Combustível
              </span>
            </div>
            <span className="font-mono text-sm font-black text-emerald-300">
              {metrics.averageFuelNumeric} / 8 ({metrics.averageFuelPercent}%)
            </span>
          </div>

          {/* Fuel visual bar */}
          <div className="w-full bg-emerald-900/80 h-3 rounded-full overflow-hidden p-0.5 border border-emerald-700/60 flex">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                metrics.averageFuelPercent < 30
                  ? 'bg-rose-500'
                  : metrics.averageFuelPercent < 60
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.max(5, metrics.averageFuelPercent)}%` }}
            />
          </div>

          {/* Fuel Critical Notice */}
          {metrics.criticalFuelCount > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-200 font-medium pt-0.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>
                <strong>{metrics.criticalFuelCount} veículo(s)</strong> na reserva (≤ 2/8).
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Switcher: Visão por Quadrantes vs Setores Especiais */}
      <div className="grid grid-cols-3 gap-1.5 bg-neutral-200/70 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setViewMode('quadrantes')}
          className={`py-2 px-2 rounded-xl text-xs font-black transition ${
            viewMode === 'quadrantes'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Quadrantes (1-5)
        </button>
        <button
          type="button"
          onClick={() => setViewMode('especiais')}
          className={`py-2 px-2 rounded-xl text-xs font-black transition ${
            viewMode === 'especiais'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Setores Especiais
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode('todos');
            setSelectedFilter('ALL');
          }}
          className={`py-2 px-2 rounded-xl text-xs font-black transition ${
            viewMode === 'todos' && selectedFilter === 'ALL'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Todos ({metrics.totalParked})
        </button>
      </div>

      {/* 1. VISÃO DETALHADA DE QUADRANTES (1 AO 5 COM FILAS 1 A 5) */}
      {viewMode === 'quadrantes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-emerald-700" />
              Ocupação dos Quadrantes & Filas
            </h3>
            <span className="text-[10px] text-emerald-700 font-bold">5 Filas por Quadrante</span>
          </div>

          <div className="space-y-2.5">
            {quadrants.map((quad) => {
              const qNum = quad.quadrantNumber!;
              const isExpanded = expandedQuadrant === qNum;
              const quadCount = getCountInLocation(`Q${qNum}`);

              return (
                <div
                  key={quad.id}
                  className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm transition"
                >
                  {/* Quadrant Header Button */}
                  <button
                    type="button"
                    onClick={() => setExpandedQuadrant(isExpanded ? null : qNum)}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-neutral-50 transition cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-900 font-black text-sm flex items-center justify-center font-mono">
                        {quad.shortCode}
                      </span>
                      <div>
                        <span className="text-sm font-black text-neutral-900 block leading-tight">
                          {quad.name}
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          Filas 1 a 5 (Q{qNum}F1 a Q{qNum}F5)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                          quadCount > 0
                            ? 'bg-emerald-600 text-white'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {quadCount} {quadCount === 1 ? 'veículo' : 'veículos'}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-neutral-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>
                  </button>

                  {/* Filas 1 a 5 Grid inside Quadrant */}
                  {isExpanded && (
                    <div className="p-3 bg-neutral-50/70 border-t border-neutral-100 grid grid-cols-5 gap-1.5 animate-in slide-in-from-top-2 duration-150">
                      {QUADRANT_ROWS.map((rowNum) => {
                        const rowCode = formatQuadrantRowCode(qNum, rowNum);
                        const rowName = formatQuadrantRow(qNum, rowNum);
                        const countInRow = getCountInLocation(rowCode);
                        const isFiltered = selectedFilter === rowCode;

                        return (
                          <button
                            key={rowNum}
                            type="button"
                            onClick={() => {
                              setSelectedFilter((prev) => (prev === rowCode ? 'ALL' : rowCode));
                            }}
                            className={`p-2 rounded-xl text-center border transition active:scale-95 cursor-pointer flex flex-col items-center justify-between ${
                              isFiltered
                                ? 'bg-emerald-800 text-white border-emerald-900 shadow-md ring-2 ring-emerald-500'
                                : countInRow > 0
                                ? 'bg-white hover:bg-emerald-50 border-emerald-300 text-neutral-900 shadow-sm'
                                : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-600'
                            }`}
                          >
                            <span className="text-[10px] font-black uppercase font-mono block">
                              Fila {rowNum}
                            </span>
                            <span
                              className={`text-lg font-black my-0.5 leading-none font-mono ${
                                isFiltered
                                  ? 'text-white'
                                  : countInRow > 0
                                  ? 'text-emerald-700'
                                  : 'text-neutral-400'
                              }`}
                            >
                              {countInRow}
                            </span>
                            <span
                              className={`text-[9px] font-bold uppercase rounded px-1 ${
                                isFiltered
                                  ? 'bg-emerald-900 text-emerald-200'
                                  : countInRow > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-neutral-100 text-neutral-500'
                              }`}
                            >
                              {rowCode}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. VISÃO SETORES ESPECIAIS & OPERACIONAIS */}
      {viewMode === 'especiais' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-700" />
              Setores Operacionais & Apoio
            </h3>
            <span className="text-[10px] text-neutral-500">Clique para filtrar</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {specials.map((loc) => {
              const count = getCountInLocation(loc.name);
              const isSelected = selectedFilter === loc.name;

              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setSelectedFilter((prev) => (prev === loc.name ? 'ALL' : loc.name))}
                  className={`p-3 rounded-2xl text-left border transition active:scale-95 flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-900 text-white border-emerald-950 shadow-md ring-2 ring-emerald-500'
                      : 'bg-white hover:bg-emerald-50/40 border-neutral-200 hover:border-emerald-300 text-neutral-900 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded font-mono ${
                        isSelected ? 'bg-emerald-700 text-white' : 'bg-neutral-100 text-neutral-800'
                      }`}
                    >
                      {loc.shortCode}
                    </span>
                    <span className="text-base font-black font-mono">{count}</span>
                  </div>
                  <span
                    className={`text-xs font-bold truncate block ${
                      isSelected ? 'text-emerald-100' : 'text-neutral-700'
                    }`}
                  >
                    {loc.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Filter Pill */}
      {selectedFilter !== 'ALL' && (
        <div className="bg-emerald-50 p-2.5 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-700" />
            <span className="text-emerald-900 font-bold">
              Filtrando por: <strong>{selectedFilter}</strong> ({filteredParked.length} veículos)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedFilter('ALL')}
            className="text-emerald-700 hover:text-emerald-900 font-black underline text-xs cursor-pointer"
          >
            Limpar Filtro
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-2xl p-3 border border-neutral-200 shadow-sm flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar placa, local ou condutor..."
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={onStartNewRegistration}
            className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar</span>
          </button>
        </div>
      </div>

      {/* Parked Vehicles List */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Veículos Estacionados ({filteredParked.length})
          </h3>
          {selectedFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedFilter('ALL')}
              className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              Ver todos os setores
            </button>
          )}
        </div>

        {filteredParked.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-neutral-200 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-800">
                {searchQuery
                  ? 'Nenhum veículo encontrado para esta busca.'
                  : selectedFilter !== 'ALL'
                  ? `Nenhum veículo estacionado no local "${selectedFilter}".`
                  : 'Nenhum veículo no pátio no momento.'}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Cadastre um novo veículo ou registre uma movimentação.
              </p>
            </div>
            <button
              onClick={onStartNewRegistration}
              className="mt-2 py-2 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Veículo
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredParked.map((v) => {
              const timeFormatted = new Date(v.createdAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={v.id}
                  className="bg-white rounded-2xl p-3.5 border border-neutral-200 shadow-sm flex flex-col gap-2.5 hover:border-emerald-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="min-w-[44px] px-2 h-10 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-mono font-black text-xs text-center border border-emerald-200">
                        {v.location || 'P1'}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-base font-black text-neutral-900 tracking-wider">
                            {formatPlateForDisplay(v.plate)}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getFuelBadgeColor(
                              v.fuel
                            )}`}
                          >
                            ⛽ {v.fuel}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-neutral-400" />
                            {timeFormatted}
                          </span>
                          {v.driverName && (
                            <span className="font-medium text-neutral-700 truncate max-w-[120px]">
                              • {v.driverName}
                            </span>
                          )}
                          {v.characteristic && (
                            <span className="text-[10px] font-bold text-neutral-700">
                              • {v.characteristic}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {/* Botão Rápido: Movimentar */}
                      {onMoveVehicle && (
                        <button
                          type="button"
                          onClick={() => onMoveVehicle(v)}
                          title="Movimentar este veículo"
                          className="p-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center gap-1 active:scale-95 transition border border-teal-200 cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5 text-teal-700" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const msg = generateWhatsAppMessage({
                            operationType: v.operationType || 'entrada',
                            plate: v.plate,
                            fuel: v.fuel,
                            driverName: v.driverName,
                            origin: v.origin,
                            destination: v.destination,
                            km: v.km,
                            hasSpareKey: v.hasSpareKey,
                            fleetType: v.fleetType,
                            characteristic: v.characteristic,
                            location: v.location,
                            timestamp: new Date(v.createdAt),
                          });
                          openWhatsAppShare(msg);
                        }}
                        title="Enviar no WhatsApp"
                        className="p-2 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-emerald-900 text-xs font-bold flex items-center gap-1 active:scale-95 transition cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                      </button>

                      <button
                        onClick={() => onReleaseVehicle(v.id)}
                        title="Marcar Saída do Pátio"
                        className="py-1.5 px-2.5 rounded-xl bg-neutral-100 hover:bg-rose-100 text-neutral-700 hover:text-rose-700 text-xs font-bold flex items-center gap-1 active:scale-95 transition border border-neutral-200 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Saída</span>
                      </button>
                    </div>
                  </div>

                  {v.notes && (
                    <p className="text-[11px] text-neutral-500 bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                      📝 {v.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
