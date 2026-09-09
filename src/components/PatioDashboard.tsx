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
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  Grid,
  Check,
  Radio,
  Building2,
  ParkingSquare,
  Camera,
} from 'lucide-react';
import { LocationCode, PatioMetrics, VehicleRecord } from '../types';
import { formatPlateForDisplay } from '../utils/plateNormalizer';
import { generateWhatsAppMessage, openWhatsAppShare } from '../utils/shareService';
import { SharePhotoModal } from './SharePhotoModal';
import {
  BASE_YARD_LOCATIONS,
  KEY_YARD_SLOTS,
  QUADRANT_ROWS,
  formatQuadrantRow,
  formatQuadrantRowCode,
  matchLocationToGroup,
  matchVehicleToYardGroup,
} from '../utils/yardLocations';

interface PatioDashboardProps {
  records: VehicleRecord[];
  metrics: PatioMetrics;
  onSelectSectorForNew: (sector: LocationCode) => void;
  onReleaseVehicle: (id: string) => void;
  onStartNewRegistration: () => void;
  onOpenHistoryTab: (initialSectorFilter?: LocationCode) => void;
  onMoveVehicle?: (vehicle: VehicleRecord) => void;
  onInventoryVehicle?: (vehicle: VehicleRecord) => void;
}

export const PatioDashboard: React.FC<PatioDashboardProps> = ({
  records,
  metrics,
  onSelectSectorForNew,
  onReleaseVehicle,
  onStartNewRegistration,
  onOpenHistoryTab,
  onMoveVehicle,
  onInventoryVehicle,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [expandedQuadrant, setExpandedQuadrant] = useState<number | null>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'vagas' | 'quadrantes' | 'especiais' | 'todos'>('vagas');
  const [shareModalVehicle, setShareModalVehicle] = useState<VehicleRecord | null>(null);

  // Veículos atualmente estacionados no pátio (status === 'parked')
  const parkedRecords = records.filter((r) => r.status === 'parked');

  // Veículos por grupo / vaga com suporte a localização, destino e PDC
  const getVehiclesInSlot = (slotCode: string): VehicleRecord[] => {
    return parkedRecords.filter((v) => matchVehicleToYardGroup(v, slotCode));
  };

  const getCountInLocation = (target: string): number => {
    return getVehiclesInSlot(target).length;
  };

  const filteredParked = parkedRecords.filter((v) => {
    const matchesFilter = selectedFilter === 'ALL' || matchVehicleToYardGroup(v, selectedFilter);
    const matchesSearch =
      !searchQuery.trim() ||
      v.plate.toUpperCase().includes(searchQuery.trim().toUpperCase()) ||
      (v.driverName && v.driverName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.location && v.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.destination && v.destination.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.notes && v.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const getFuelBadgeColor = (fuel: string) => {
    if (fuel === '1/8' || fuel === '2/8') return 'bg-rose-100 text-rose-800 border-rose-300';
    if (fuel === '3/8' || fuel === '4/8' || fuel === '5/8')
      return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  };

  const individualSlots = KEY_YARD_SLOTS.filter((s) => s.category === 'vaga_individual');
  const bolsaoSlots = KEY_YARD_SLOTS.filter((s) => s.category === 'bolsao');
  const quadrants = BASE_YARD_LOCATIONS.filter((l) => l.isQuadrant);
  const specials = BASE_YARD_LOCATIONS.filter((l) => l.category === 'especial');

  // Calcula tempo de permanência formatado (ex: "há 1h 20m")
  const formatTimeParked = (createdAt: number) => {
    const diffMs = Date.now() - createdAt;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'há poucos instantes';
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    return `há ${diffHours}h ${remMin > 0 ? `${remMin}m` : ''}`;
  };

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full px-4 py-4 pb-24">
      {/* Top Banner with Real-time Yard Stats */}
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white rounded-3xl p-5 shadow-lg border border-emerald-600/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/30 flex items-center justify-center border border-emerald-400/40 backdrop-blur-md">
              <Layers className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                <h2 className="text-lg font-black tracking-tight leading-none text-white">
                  Pátio & Vagas
                </h2>
              </div>
              <p className="text-[11px] text-emerald-200 font-semibold">
                Atualização instantânea conforme registros
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
          <div className="w-full bg-emerald-900/80 h-2.5 rounded-full overflow-hidden p-0.5 border border-emerald-700/60 flex">
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

      {/* Navegação de Abas do Pátio */}
      <div className="grid grid-cols-4 gap-1 bg-neutral-200/80 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => {
            setViewMode('vagas');
            setSelectedFilter('ALL');
          }}
          className={`py-2 px-1 rounded-xl text-[11px] font-black transition text-center ${
            viewMode === 'vagas'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Vagas & Bolsões
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode('quadrantes');
            setSelectedFilter('ALL');
          }}
          className={`py-2 px-1 rounded-xl text-[11px] font-black transition text-center ${
            viewMode === 'quadrantes'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Q1 a Q5
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode('especiais');
            setSelectedFilter('ALL');
          }}
          className={`py-2 px-1 rounded-xl text-[11px] font-black transition text-center ${
            viewMode === 'especiais'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Setores Apoio
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode('todos');
            setSelectedFilter('ALL');
          }}
          className={`py-2 px-1 rounded-xl text-[11px] font-black transition text-center ${
            viewMode === 'todos' && selectedFilter === 'ALL'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Todos ({metrics.totalParked})
        </button>
      </div>

      {/* 1. VISÃO DE VAGAS PRINCIPAIS & BOLSÕES (P1, P2, P3, R1, ADM, Bolsão 40, Fila PDC, Bolsão superior) */}
      {viewMode === 'vagas' && (
        <div className="flex flex-col gap-4">
          {/* Sub-seção A: Vagas Individuais (P1, P2, P3, R1, ADM) */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                <ParkingSquare className="w-4 h-4 text-emerald-700" />
                Vagas Prioritárias (P1, P2, P3, R1, ADM)
              </h3>
              <span className="text-[10px] font-bold text-neutral-500">
                Status ao Vivo
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {individualSlots.map((slot) => {
                const vehicles = getVehiclesInSlot(slot.code);
                const isOccupied = vehicles.length > 0;
                const activeVehicle = isOccupied ? vehicles[0] : null;

                return (
                  <div
                    key={slot.id}
                    className={`rounded-2xl p-3.5 border transition-all duration-200 shadow-sm ${
                      isOccupied
                        ? 'bg-white border-neutral-300 ring-1 ring-neutral-200'
                        : 'bg-emerald-50/40 border-dashed border-emerald-300 hover:border-emerald-500'
                    }`}
                  >
                    {/* Header da Vaga */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg border ${
                            isOccupied
                              ? 'bg-neutral-900 text-white border-neutral-800'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          {slot.code}
                        </span>
                        <div>
                          <span className="text-xs font-black text-neutral-900 block leading-tight">
                            {slot.name}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {slot.description}
                          </span>
                        </div>
                      </div>

                      {/* Status Pill */}
                      {isOccupied ? (
                        <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                          OCUPADA {vehicles.length > 1 ? `(${vehicles.length})` : ''}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Check className="w-3 h-3 text-emerald-700" />
                          LIVRE
                        </span>
                      )}
                    </div>

                    {/* Conteúdo dinâmico da vaga */}
                    {isOccupied && activeVehicle ? (
                      <div className="bg-neutral-50 rounded-xl p-2.5 border border-neutral-200 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-black text-neutral-900 tracking-wider">
                              {formatPlateForDisplay(activeVehicle.plate)}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getFuelBadgeColor(
                                activeVehicle.fuel
                              )}`}
                            >
                              ⛽ {activeVehicle.fuel}
                            </span>
                          </div>

                          <span className="text-[10px] font-bold text-neutral-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-neutral-400" />
                            {formatTimeParked(activeVehicle.createdAt)}
                          </span>
                        </div>

                        {/* Detalhes do condutor ou observações */}
                        <div className="flex items-center justify-between text-[11px] text-neutral-600">
                          <span>
                            {activeVehicle.driverName ? `Condutor: ${activeVehicle.driverName}` : 'Condutor não informado'}
                          </span>
                          {activeVehicle.characteristic && (
                            <span className="font-bold text-neutral-800 text-[10px] bg-neutral-200 px-1.5 py-0.5 rounded">
                              {activeVehicle.characteristic}
                            </span>
                          )}
                        </div>

                        {/* Botões de Ação Imediata na Vaga */}
                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-neutral-200">
                          {onMoveVehicle && (
                            <button
                              type="button"
                              onClick={() => onMoveVehicle(activeVehicle)}
                              title="Remanejar / Mover para outra vaga"
                              className="py-1 px-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold flex items-center gap-1 border border-teal-200 transition cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3 h-3 text-teal-700" />
                              <span>Mover</span>
                            </button>
                          )}

                          {onInventoryVehicle && (
                            <button
                              type="button"
                              onClick={() => onInventoryVehicle(activeVehicle)}
                              title="Conferir Inventário"
                              className="py-1 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-bold flex items-center gap-1 border border-blue-200 transition cursor-pointer"
                            >
                              <ClipboardCheck className="w-3 h-3 text-blue-700" />
                              <span>Inventário</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              const msg = generateWhatsAppMessage({
                                operationType: activeVehicle.operationType || 'entrada',
                                plate: activeVehicle.plate,
                                fuel: activeVehicle.fuel,
                                driverName: activeVehicle.driverName,
                                origin: activeVehicle.origin,
                                destination: activeVehicle.destination || slot.code,
                                km: activeVehicle.km,
                                hasSpareKey: activeVehicle.hasSpareKey,
                                fleetType: activeVehicle.fleetType,
                                characteristic: activeVehicle.characteristic,
                                location: activeVehicle.location || slot.code,
                                timestamp: new Date(activeVehicle.createdAt),
                              });
                              openWhatsAppShare(msg);
                            }}
                            title="Compartilhar no WhatsApp"
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer"
                          >
                            <Share2 className="w-3 h-3 text-emerald-700" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onReleaseVehicle(activeVehicle.id)}
                            title="Liberar Saída do Pátio"
                            className="py-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-bold flex items-center gap-1 border border-rose-200 transition cursor-pointer"
                          >
                            <LogOut className="w-3 h-3 text-rose-700" />
                            <span>Saída</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Vaga pronta para receber veículo
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectSectorForNew(slot.code as LocationCode)}
                          className="py-1 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Alocar nesta Vaga</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-seção B: Bolsões Operacionais (Bolsão 40, Fila PDC, Bolsão Superior) */}
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-700" />
                Bolsões de Capacidade Ampliada
              </h3>
              <span className="text-[10px] font-bold text-neutral-500">
                Múltiplos Veículos
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {bolsaoSlots.map((bolsao) => {
                const vehicles = getVehiclesInSlot(bolsao.code);
                const count = vehicles.length;

                return (
                  <div
                    key={bolsao.id}
                    className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300">
                          {bolsao.shortCode}
                        </span>
                        <div>
                          <span className="text-sm font-black text-neutral-900 block leading-tight">
                            {bolsao.name}
                          </span>
                          <span className="text-[11px] text-neutral-500">
                            {bolsao.description}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs font-black px-2.5 py-1 rounded-xl border ${
                            count > 0
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                          }`}
                        >
                          {count} {count === 1 ? 'veículo' : 'veículos'}
                        </span>
                      </div>
                    </div>

                    {/* Lista de veículos no bolsão */}
                    {count > 0 ? (
                      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {vehicles.map((v) => (
                          <div
                            key={v.id}
                            className="bg-neutral-50 p-2 rounded-xl border border-neutral-200 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-black text-neutral-900">
                                {formatPlateForDisplay(v.plate)}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-1 py-0.2 rounded border ${getFuelBadgeColor(
                                  v.fuel
                                )}`}
                              >
                                {v.fuel}
                              </span>
                              {v.driverName && (
                                <span className="text-[10px] text-neutral-600 truncate max-w-[90px]">
                                  {v.driverName}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {onMoveVehicle && (
                                <button
                                  type="button"
                                  onClick={() => onMoveVehicle(v)}
                                  title="Mover"
                                  className="p-1 rounded bg-white text-teal-800 border border-teal-200 hover:bg-teal-50"
                                >
                                  <ArrowLeftRight className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onReleaseVehicle(v.id)}
                                title="Saída"
                                className="p-1 rounded bg-white text-rose-800 border border-rose-200 hover:bg-rose-50"
                              >
                                <LogOut className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-neutral-50 rounded-xl text-center border border-neutral-200/80">
                        <span className="text-xs text-neutral-500">
                          Bolsão livre de veículos no momento.
                        </span>
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => onSelectSectorForNew(bolsao.code as LocationCode)}
                        className="py-1 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-black flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Alocar para {bolsao.name}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-seção C: Quadrantes Principais (Q1, Q2, Q3, Q4, Q5) */}
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                <Grid className="w-4 h-4 text-emerald-700" />
                Quadrantes Principais (Q1 a Q5)
              </h3>
              <span className="text-[10px] font-bold text-neutral-500">
                5 Filas por Quadrante
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[1, 2, 3, 4, 5].map((qNum) => {
                const qCode = `Q${qNum}`;
                const quadVehicles = getVehiclesInSlot(qCode);
                const count = quadVehicles.length;

                return (
                  <div
                    key={qCode}
                    className="bg-white rounded-2xl p-3.5 border border-neutral-200 shadow-sm flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-950 font-mono font-black text-xs flex items-center justify-center border border-emerald-300">
                          {qCode}
                        </span>
                        <div>
                          <span className="text-xs font-black text-neutral-900 block leading-tight">
                            Quadrante {qNum}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            Filas 1 a 5 (Q{qNum}F1 - Q{qNum}F5)
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                          count > 0
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                        }`}
                      >
                        {count} {count === 1 ? 'veículo' : 'veículos'}
                      </span>
                    </div>

                    {/* Placas no quadrante */}
                    {count > 0 ? (
                      <div className="flex flex-wrap gap-1 bg-neutral-50 p-2 rounded-xl border border-neutral-200">
                        {quadVehicles.slice(0, 4).map((v) => (
                          <span
                            key={v.id}
                            className="font-mono text-[10px] font-bold bg-white text-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200"
                          >
                            {formatPlateForDisplay(v.plate)}
                          </span>
                        ))}
                        {count > 4 && (
                          <span className="text-[10px] text-neutral-500 font-bold self-center">
                            +{count - 4} mais
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-700 bg-emerald-50/50 p-1.5 rounded-xl border border-dashed border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Todas as filas livres</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode('quadrantes');
                          setExpandedQuadrant(qNum);
                        }}
                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ver Filas 1 a 5</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectSectorForNew(qCode as LocationCode)}
                        className="py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer transition active:scale-95"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Alocar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. VISÃO DETALHADA DE QUADRANTES (1 AO 5 COM FILAS 1 A 5) */}
      {viewMode === 'quadrantes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-emerald-700" />
              Ocupação dos Quadrantes & Filas
            </h3>
            <span className="text-[10px] text-emerald-700 font-bold">Q1 a Q5 • 5 Filas cada</span>
          </div>

          <div className="space-y-2.5">
            {quadrants.map((quad) => {
              const qNum = quad.quadrantNumber!;
              const isExpanded = expandedQuadrant === qNum;
              const quadVehicles = getVehiclesInSlot(`Q${qNum}`);
              const quadCount = quadVehicles.length;

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
                    <div className="p-3 bg-neutral-50/70 border-t border-neutral-100 flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-150">
                      <div className="grid grid-cols-5 gap-1.5">
                        {QUADRANT_ROWS.map((rowNum) => {
                          const rowCode = formatQuadrantRowCode(qNum, rowNum);
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

                      {/* Botão de Alocar diretamente no quadrante */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => onSelectSectorForNew(`Q${qNum}` as LocationCode)}
                          className="py-1 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-black flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Alocar em {quad.name}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. VISÃO SETORES OPERACIONAIS & APOIO (FP, AM, Apoio, Rampa, DT, 51, Fábrica, Estética) */}
      {viewMode === 'especiais' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-700" />
              Setores Operacionais & Apoio
            </h3>
            <span className="text-[10px] text-neutral-500">Clique para filtrar</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {specials.map((loc) => {
              const count = getCountInLocation(loc.shortCode || loc.name);
              const isSelected = selectedFilter === loc.shortCode || selectedFilter === loc.name;

              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setSelectedFilter((prev) => (prev === loc.shortCode ? 'ALL' : loc.shortCode))}
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
              placeholder="Buscar placa, vaga, local ou condutor..."
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onStartNewRegistration}
            className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar</span>
          </button>
        </div>
      </div>

      {/* 4. LISTA GERAL DE VEÍCULOS ESTACIONADOS */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-neutral-700">
            Veículos no Pátio ({filteredParked.length})
          </h3>
          {selectedFilter !== 'ALL' && (
            <button
              type="button"
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
              type="button"
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
                        {v.location || v.destination || 'P1'}
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

                      {/* Botão Rápido: Inventariar */}
                      {onInventoryVehicle && (
                        <button
                          type="button"
                          onClick={() => onInventoryVehicle(v)}
                          title="Fazer Inventário deste veículo"
                          className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold flex items-center gap-1 active:scale-95 transition border border-blue-200 cursor-pointer"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5 text-blue-700" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setShareModalVehicle(v)}
                        title="Compartilhar Foto e Dados no WhatsApp"
                        className="p-2 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-emerald-900 text-xs font-bold flex items-center gap-1 active:scale-95 transition cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onReleaseVehicle(v.id)}
                        title="Marcar Saída do Pátio"
                        className="py-1.5 px-2.5 rounded-xl bg-neutral-100 hover:bg-rose-100 text-neutral-700 hover:text-rose-700 text-xs font-bold flex items-center gap-1 active:scale-95 transition border border-neutral-200 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Saída</span>
                      </button>
                    </div>
                  </div>

                  {/* Foto anexada se houver */}
                  {(v.photoUrl || v.dashboardPhotoUrl) && (
                    <div
                      onClick={() => setShareModalVehicle(v)}
                      className="relative rounded-xl overflow-hidden border border-neutral-200 bg-neutral-900 cursor-pointer group"
                    >
                      <img
                        src={v.photoUrl || v.dashboardPhotoUrl || ''}
                        alt={`Foto do veículo ${v.plate}`}
                        className="w-full h-28 object-cover group-hover:opacity-90 transition"
                      />
                      <div className="absolute bottom-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                        <Camera className="w-3 h-3 text-emerald-400" />
                        <span>Foto Registrada (Toque para Compartilhar)</span>
                      </div>
                    </div>
                  )}

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

      {/* Share Photo & Data Modal */}
      {shareModalVehicle && (
        <SharePhotoModal
          isOpen={Boolean(shareModalVehicle)}
          onClose={() => setShareModalVehicle(null)}
          photoUrl={shareModalVehicle.photoUrl || shareModalVehicle.dashboardPhotoUrl}
          plate={shareModalVehicle.plate}
          title={`Veículo no Pátio (${shareModalVehicle.operationType?.toUpperCase() || 'ENTRADA'})`}
          dataFields={[
            { label: 'Local / Vaga', value: shareModalVehicle.location },
            { label: 'Tipo de Frota', value: shareModalVehicle.fleetType },
            { label: 'Característica', value: shareModalVehicle.characteristic },
            { label: 'Motorista', value: shareModalVehicle.driverName },
            { label: 'Origem', value: shareModalVehicle.origin },
            { label: 'Destino', value: shareModalVehicle.destination },
            { label: 'Combustível', value: shareModalVehicle.fuel },
            { label: 'KM', value: shareModalVehicle.km ? `${shareModalVehicle.km} km` : undefined },
            { label: 'Observação', value: shareModalVehicle.notes },
          ]}
        />
      )}
    </div>
  );
};
