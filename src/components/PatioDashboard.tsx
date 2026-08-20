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
} from 'lucide-react';
import { LocationCode, PatioMetrics, VehicleRecord } from '../types';
import { SECTORS } from '../utils/storageService';
import { formatPlateForDisplay } from '../utils/plateNormalizer';
import { generateWhatsAppMessage, getLocationMeaning, openWhatsAppShare } from '../utils/shareService';

interface PatioDashboardProps {
  records: VehicleRecord[];
  metrics: PatioMetrics;
  onSelectSectorForNew: (sector: LocationCode) => void;
  onReleaseVehicle: (id: string) => void;
  onStartNewRegistration: () => void;
  onOpenHistoryTab: (initialSectorFilter?: LocationCode) => void;
}

export const PatioDashboard: React.FC<PatioDashboardProps> = ({
  records,
  metrics,
  onSelectSectorForNew,
  onReleaseVehicle,
  onStartNewRegistration,
  onOpenHistoryTab,
}) => {
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<LocationCode | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const parkedRecords = records.filter((r) => r.status === 'parked');

  const filteredParked = parkedRecords.filter((v) => {
    const matchesSector = selectedSectorFilter === 'ALL' || v.location === selectedSectorFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      v.plate.toUpperCase().includes(searchQuery.trim().toUpperCase()) ||
      (v.driverName && v.driverName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.notes && v.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSector && matchesSearch;
  });

  const getFuelBadgeColor = (fuel: string) => {
    if (fuel === '1/8' || fuel === '2/8') return 'bg-rose-100 text-rose-800 border-rose-300';
    if (fuel === '3/8' || fuel === '4/8' || fuel === '5/8')
      return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  };

  const getOperationIcon = (op?: string) => {
    switch (op) {
      case 'entrada':
        return <LogIn className="w-3.5 h-3.5 text-emerald-700" />;
      case 'saida':
        return <LogOut className="w-3.5 h-3.5 text-rose-700" />;
      case 'pdc':
        return <Package className="w-3.5 h-3.5 text-amber-700" />;
      case 'qualidade_51':
        return <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />;
      default:
        return <Car className="w-3.5 h-3.5 text-emerald-700" />;
    }
  };

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
                Ocupação do Pátio
              </h2>
              <p className="text-[11px] text-emerald-200 font-semibold mt-0.5">
                CMDIT Gestão em Tempo Real
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
                Nível Médio de Combustível da Frota
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
                <strong>{metrics.criticalFuelCount} veículo(s)</strong> com tanque na reserva (≤ 2/8).
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sector Capacity Grid */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-700" />
            Vagas por Setor
          </h3>
          <span className="text-[11px] font-bold text-neutral-600">
            {metrics.totalParked} ocupadas • {71 - metrics.totalParked} livres
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SECTORS.map((sec) => {
            const occ = metrics.sectorOccupancy[sec.code] || {
              count: 0,
              capacity: sec.capacity,
              percent: 0,
              isFull: false,
            };
            const isSelected = selectedSectorFilter === sec.code;

            return (
              <button
                key={sec.code}
                type="button"
                onClick={() =>
                  setSelectedSectorFilter((prev) => (prev === sec.code ? 'ALL' : sec.code))
                }
                className={`p-3 rounded-2xl text-left border transition-all active:scale-95 flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? 'bg-emerald-900 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500'
                    : 'bg-white text-neutral-900 border-neutral-200 hover:border-emerald-300 shadow-sm'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-black text-sm px-2 py-0.5 rounded-lg ${
                        isSelected
                          ? 'bg-emerald-700 text-white'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {sec.code}
                    </span>
                    <span
                      className={`text-[11px] font-bold truncate max-w-[85px] ${
                        isSelected ? 'text-emerald-200' : 'text-neutral-600'
                      }`}
                    >
                      {sec.name}
                    </span>
                  </div>

                  {occ.isFull && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-600 text-white">
                      Lotado
                    </span>
                  )}
                </div>

                {/* Numbers */}
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-black font-mono leading-none">
                    {occ.count}
                    <span
                      className={`text-xs font-normal ${
                        isSelected ? 'text-emerald-300' : 'text-neutral-500'
                      }`}
                    >
                      /{sec.capacity}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      isSelected ? 'text-emerald-300' : 'text-neutral-600'
                    }`}
                  >
                    {occ.percent}%
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  className={`w-full h-1.5 rounded-full overflow-hidden mt-2 ${
                    isSelected ? 'bg-emerald-950' : 'bg-neutral-100'
                  }`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      occ.percent >= 90
                        ? 'bg-rose-500'
                        : occ.percent >= 70
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(4, occ.percent)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-2xl p-3 border border-neutral-200 shadow-sm flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar placa ou condutor..."
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
            className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar</span>
          </button>
        </div>

        {/* Sector Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedSectorFilter('ALL')}
            className={`px-3 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition ${
              selectedSectorFilter === 'ALL'
                ? 'bg-emerald-800 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Todos ({metrics.totalParked})
          </button>
          {SECTORS.map((s) => {
            const count = metrics.sectorOccupancy[s.code]?.count || 0;
            return (
              <button
                key={s.code}
                onClick={() => setSelectedSectorFilter(s.code)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition flex items-center gap-1 ${
                  selectedSectorFilter === s.code
                    ? 'bg-emerald-800 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <span>{s.code}</span>
                <span className="text-[10px] px-1 rounded bg-black/10">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Parked Vehicles List */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Veículos Estacionados ({filteredParked.length})
          </h3>
          {selectedSectorFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedSectorFilter('ALL')}
              className="text-[11px] font-bold text-emerald-700 hover:underline"
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
                  : selectedSectorFilter !== 'ALL'
                  ? `Nenhum veículo estacionado no setor ${selectedSectorFilter}.`
                  : 'Nenhum veículo no pátio no momento.'}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Cadastre um novo veículo para acompanhar a ocupação.
              </p>
            </div>
            <button
              onClick={onStartNewRegistration}
              className="mt-2 py-2 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow"
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
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-mono font-black text-sm">
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
                        className="p-2 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-emerald-900 text-xs font-bold flex items-center gap-1 active:scale-95 transition"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                      </button>

                      <button
                        onClick={() => onReleaseVehicle(v.id)}
                        title="Marcar Saída do Pátio"
                        className="py-1.5 px-2.5 rounded-xl bg-neutral-100 hover:bg-rose-100 text-neutral-700 hover:text-rose-700 text-xs font-bold flex items-center gap-1 active:scale-95 transition border border-neutral-200"
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
