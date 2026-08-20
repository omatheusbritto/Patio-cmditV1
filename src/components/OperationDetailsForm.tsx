import React, { useState } from 'react';
import { OperationType, VehicleFleetType } from '../types';
import {
  User,
  MapPin,
  Gauge,
  Key,
  Car,
  ArrowRight,
  ArrowLeft,
  Check,
  Building,
  Plane,
  Wrench,
  Sparkles,
} from 'lucide-react';

interface OperationDetailsFormProps {
  operationType: 'entrada' | 'saida';
  initialDriverName?: string;
  initialOrigin?: string;
  initialDestination?: string;
  initialKm?: string | number;
  initialHasSpareKey?: boolean;
  initialFleetType?: VehicleFleetType;
  plate: string;
  onSubmit: (details: {
    driverName: string;
    origin?: string;
    destination?: string;
    km: string;
    hasSpareKey: boolean;
    fleetType: VehicleFleetType;
  }) => void;
  onBack: () => void;
}

const QUICK_ORIGINS = [
  'Matriz',
  'Filial Centro',
  'Cliente',
  'Aeroporto',
  'Oficina / Revisão',
  'Pátio Apoio',
];

const QUICK_DESTINATIONS = [
  'Aeroporto',
  'Cliente (Entrega)',
  'Oficina / Manutenção',
  'Filial Centro',
  'Higienização / Lavagem',
  'Locação Ativa',
];

export const OperationDetailsForm: React.FC<OperationDetailsFormProps> = ({
  operationType,
  initialDriverName = '',
  initialOrigin = '',
  initialDestination = '',
  initialKm = '',
  initialHasSpareKey = true,
  initialFleetType = 'RAC',
  plate,
  onSubmit,
  onBack,
}) => {
  const [driverName, setDriverName] = useState<string>(initialDriverName);
  const [origin, setOrigin] = useState<string>(initialOrigin);
  const [destination, setDestination] = useState<string>(initialDestination);
  const [km, setKm] = useState<string>(initialKm ? String(initialKm) : '');
  const [hasSpareKey, setHasSpareKey] = useState<boolean>(initialHasSpareKey);
  const [fleetType, setFleetType] = useState<VehicleFleetType>(initialFleetType);

  const isEntrada = operationType === 'entrada';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      driverName: driverName.trim(),
      origin: isEntrada ? origin.trim() : undefined,
      destination: !isEntrada ? destination.trim() : undefined,
      km: km.trim(),
      hasSpareKey,
      fleetType,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 max-w-md mx-auto w-full pb-10">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200">
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              isEntrada
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}
          >
            {isEntrada ? '🟢 Registro de Entrada' : '🔴 Registro de Saída'}
          </span>
          <span className="text-xs font-mono font-bold bg-neutral-900 text-white px-2.5 py-1 rounded-lg">
            {plate}
          </span>
        </div>

        <h2 className="text-xl font-black text-neutral-900 leading-tight">
          {isEntrada ? 'Dados de Entrada' : 'Dados de Saída'}
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Preencha as informações do condutor, odômetro e chave
        </p>
      </div>

      {/* Condutor Input */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-2">
        <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
          <User className="w-4 h-4 text-emerald-700" />
          Nome do Condutor / Motorista
        </label>
        <input
          type="text"
          value={driverName}
          onChange={(e) => setDriverName(e.target.value)}
          placeholder="Ex: Carlos Eduardo / João Silva"
          className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 text-sm font-medium transition outline-none"
        />
      </div>

      {/* Origem or Destino Input */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-2.5">
        <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-emerald-700" />
          {isEntrada ? 'Origem do Veículo' : 'Destino do Veículo'}
        </label>
        <input
          type="text"
          value={isEntrada ? origin : destination}
          onChange={(e) => (isEntrada ? setOrigin(e.target.value) : setDestination(e.target.value))}
          placeholder={isEntrada ? 'Ex: Filial Centro / Matriz / Cliente' : 'Ex: Aeroporto / Manutenção / Cliente'}
          className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 text-sm font-medium transition outline-none"
        />

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(isEntrada ? QUICK_ORIGINS : QUICK_DESTINATIONS).map((chip) => {
            const currentVal = isEntrada ? origin : destination;
            const isSelected = currentVal === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => (isEntrada ? setOrigin(chip) : setDestination(chip))}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition active:scale-95 ${
                  isSelected
                    ? 'bg-emerald-700 text-white border-emerald-800 font-bold'
                    : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>

      {/* KM (Odômetro) Input */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-2">
        <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-emerald-700" />
          Quilometragem (KM Atual)
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder="Ex: 45200"
            className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 text-base font-mono font-bold transition outline-none pr-12"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 font-mono">
            KM
          </span>
        </div>
      </div>

      {/* Chave Reserva & Tipo de Veículo in 2 columns */}
      <div className="grid grid-cols-2 gap-3">
        {/* Chave Reserva Toggle */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-neutral-200 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 mb-2">
            <Key className="w-4 h-4 text-amber-600" />
            <span>Chave Reserva?</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setHasSpareKey(true)}
              className={`py-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border ${
                hasSpareKey
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
              }`}
            >
              {hasSpareKey && <Check className="w-3.5 h-3.5" />}
              <span>SIM</span>
            </button>

            <button
              type="button"
              onClick={() => setHasSpareKey(false)}
              className={`py-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border ${
                !hasSpareKey
                  ? 'bg-neutral-800 text-white border-neutral-900 shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
              }`}
            >
              {!hasSpareKey && <Check className="w-3.5 h-3.5" />}
              <span>NÃO</span>
            </button>
          </div>
        </div>

        {/* Tipo de Veículo (RAC / GF) */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-neutral-200 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 mb-2">
            <Car className="w-4 h-4 text-blue-600" />
            <span>Tipo (RAC/GF)</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setFleetType('RAC')}
              className={`py-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border ${
                fleetType === 'RAC'
                  ? 'bg-blue-700 text-white border-blue-800 shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
              }`}
            >
              {fleetType === 'RAC' && <Check className="w-3.5 h-3.5" />}
              <span>RAC</span>
            </button>

            <button
              type="button"
              onClick={() => setFleetType('GF')}
              className={`py-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border ${
                fleetType === 'GF'
                  ? 'bg-indigo-700 text-white border-indigo-800 shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
              }`}
            >
              {fleetType === 'GF' && <Check className="w-3.5 h-3.5" />}
              <span>GF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3.5 px-4 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <button
          type="submit"
          className="flex-2 py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-98 transition"
        >
          <span>Avançar (Combustível)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
};
