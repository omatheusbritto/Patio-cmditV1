import React, { useState } from 'react';
import { FuelLevel } from '../types';
import {
  Fuel,
  Gauge,
  User,
  Camera,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Check,
  Droplets,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';

interface FuelingDetailsFormProps {
  plate: string;
  platePhotoUrl?: string;
  dashboardPhotoUrl?: string;
  initialKm?: string | number;
  initialFuel?: FuelLevel | null;
  initialLiters?: string | number;
  initialFuelType?: string;
  initialDriverName?: string;
  onRetakeDashboardPhoto?: () => void;
  onSubmit: (data: {
    km: string;
    fuel: FuelLevel;
    liters?: string;
    fuelType?: string;
    driverName?: string;
  }) => void;
  onBack: () => void;
}

const FUEL_LEVELS: { id: FuelLevel; label: string; percent: string; color: string }[] = [
  { id: '1/8', label: '1/8', percent: '12.5%', color: 'bg-rose-500 text-white' },
  { id: '2/8', label: '2/8', percent: '25%', color: 'bg-amber-500 text-white' },
  { id: '3/8', label: '3/8', percent: '37.5%', color: 'bg-amber-400 text-neutral-900' },
  { id: '4/8', label: '4/8 (1/2)', percent: '50%', color: 'bg-yellow-400 text-neutral-900' },
  { id: '5/8', label: '5/8', percent: '62.5%', color: 'bg-lime-500 text-white' },
  { id: '6/8', label: '6/8 (3/4)', percent: '75%', color: 'bg-emerald-500 text-white' },
  { id: '7/8', label: '7/8', percent: '87.5%', color: 'bg-emerald-600 text-white' },
  { id: '8/8', label: '8/8 (Cheio)', percent: '100%', color: 'bg-emerald-700 text-white' },
];

const FUEL_TYPES = [
  'Gasolina Comum',
  'Gasolina Aditivada',
  'Etanol',
  'Diesel S10',
  'Diesel Comum',
  'Arla 32',
];

const QUICK_LITERS = ['10', '20', '30', '40', '50', '60'];

export const FuelingDetailsForm: React.FC<FuelingDetailsFormProps> = ({
  plate,
  platePhotoUrl,
  dashboardPhotoUrl,
  initialKm = '',
  initialFuel = '8/8',
  initialLiters = '',
  initialFuelType = 'Gasolina Comum',
  initialDriverName = '',
  onRetakeDashboardPhoto,
  onSubmit,
  onBack,
}) => {
  const [km, setKm] = useState<string>(String(initialKm || ''));
  const [fuel, setFuel] = useState<FuelLevel>(initialFuel || '8/8');
  const [liters, setLiters] = useState<string>(String(initialLiters || ''));
  const [fuelType, setFuelType] = useState<string>(initialFuelType || 'Gasolina Comum');
  const [driverName, setDriverName] = useState<string>(initialDriverName || '');
  const [error, setError] = useState<string | null>(null);

  const handleAdjustKm = (amount: number) => {
    const cleanCurrent = parseInt(km.replace(/\D/g, ''), 10) || 0;
    const nextVal = Math.max(0, cleanCurrent + amount);
    setKm(nextVal.toLocaleString('pt-BR'));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuel) {
      setError('Por favor, selecione o nível de combustível.');
      return;
    }
    setError(null);
    onSubmit({
      km: km.trim(),
      fuel,
      liters: liters.trim(),
      fuelType: fuelType.trim(),
      driverName: driverName.trim(),
    });
  };

  return (
    <div className="flex flex-col gap-3.5 max-w-md mx-auto w-full pb-10">
      {/* Header Info */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider bg-cyan-100 text-cyan-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Fuel className="w-3 h-3 text-cyan-700" />
            Abastecimento • Detalhes
          </span>
          <span className="text-xs font-mono font-bold bg-neutral-900 text-white px-2.5 py-1 rounded-lg">
            {plate}
          </span>
        </div>

        <h2 className="text-xl font-black text-neutral-900 leading-tight">
          Dados do Abastecimento
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Confirme ou ajuste o odômetro e a quantidade de combustível
        </p>
      </div>

      {/* Photos Preview Card (Plate + Dashboard) */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-neutral-200">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
          Fotos Registradas
        </span>

        <div className="grid grid-cols-2 gap-2">
          {/* Plate Photo */}
          <div className="relative rounded-xl overflow-hidden border border-neutral-200 bg-neutral-900 aspect-video flex items-center justify-center">
            {platePhotoUrl ? (
              <img
                src={platePhotoUrl}
                alt="Placa"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-[10px] text-neutral-400">Sem foto da placa</span>
            )}
            <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded backdrop-blur-xs">
              1. Placa
            </span>
          </div>

          {/* Dashboard Photo */}
          <div className="relative rounded-xl overflow-hidden border border-neutral-200 bg-neutral-900 aspect-video flex items-center justify-center">
            {dashboardPhotoUrl ? (
              <img
                src={dashboardPhotoUrl}
                alt="Painel"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-2 text-center">
                <Gauge className="w-5 h-5 text-neutral-500 mb-0.5" />
                <span className="text-[9px] text-neutral-400 font-medium">Sem foto do painel</span>
              </div>
            )}
            <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-cyan-950/80 text-cyan-300 px-1.5 py-0.5 rounded backdrop-blur-xs border border-cyan-500/30">
              2. Painel
            </span>
            {onRetakeDashboardPhoto && (
              <button
                type="button"
                onClick={onRetakeDashboardPhoto}
                className="absolute top-1 right-1 p-1 bg-neutral-900/80 text-white rounded-lg hover:bg-neutral-800 active:scale-95 transition"
                title="Tirar nova foto do painel"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {/* 1. Odômetro / KM Input */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <label htmlFor="km-input" className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-600" />
              <span>Odômetro / KM do Veículo</span>
            </label>
            <span className="text-[10px] font-semibold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
              Manual ou Foto
            </span>
          </div>

          <div className="relative">
            <input
              id="km-input"
              type="text"
              inputMode="numeric"
              placeholder="Ex: 48.350"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              className="w-full text-lg font-mono font-black py-3 px-3.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-neutral-50/50"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
              KM
            </span>
          </div>

          {/* Quick KM helper adjustments */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] text-neutral-400 font-semibold">Ajustes:</span>
            <button
              type="button"
              onClick={() => handleAdjustKm(100)}
              className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 active:scale-95 rounded-lg text-[10px] font-bold text-neutral-700 transition"
            >
              +100
            </button>
            <button
              type="button"
              onClick={() => handleAdjustKm(500)}
              className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 active:scale-95 rounded-lg text-[10px] font-bold text-neutral-700 transition"
            >
              +500
            </button>
            <button
              type="button"
              onClick={() => handleAdjustKm(1000)}
              className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 active:scale-95 rounded-lg text-[10px] font-bold text-neutral-700 transition"
            >
              +1.000
            </button>
            <button
              type="button"
              onClick={() => setKm('')}
              className="px-2 py-1 text-neutral-400 hover:text-neutral-600 rounded-lg text-[10px] font-semibold ml-auto"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* 2. Nível de Combustível (1/8 a 8/8) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <Fuel className="w-4 h-4 text-emerald-600" />
              <span>Nível do Tanque (Pós-Abastecimento)</span>
            </label>
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              {fuel === '8/8' ? '8/8 • Tanque Cheio' : fuel}
            </span>
          </div>

          {/* Quick 8/8 full tank button */}
          <button
            type="button"
            onClick={() => setFuel('8/8')}
            className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-black transition active:scale-[0.98] ${
              fuel === '8/8'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-400'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span>Tanque Cheio (8/8 • 100%)</span>
          </button>

          {/* 8-level visual grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {FUEL_LEVELS.map((lvl) => {
              const isSelected = fuel === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setFuel(lvl.id)}
                  className={`py-2 px-1 rounded-xl border text-center transition active:scale-95 flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-md ring-2 ring-emerald-500'
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-800'
                  }`}
                >
                  <span className="text-xs font-black leading-none">{lvl.label}</span>
                  <span
                    className={`text-[9px] font-semibold ${
                      isSelected ? 'text-emerald-300' : 'text-neutral-400'
                    }`}
                  >
                    {lvl.percent}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Quantidade Abastecida (Litros) & Tipo de Combustível */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label htmlFor="liters-input" className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-cyan-600" />
              <span>Quantidade / Litros Abastecidos</span>
            </label>
            <span className="text-[10px] font-semibold text-neutral-400 uppercase bg-neutral-100 px-2 py-0.5 rounded-full">
              Opcional
            </span>
          </div>

          <div className="relative">
            <input
              id="liters-input"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 45.5"
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              className="w-full text-base font-mono font-bold py-2.5 px-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-neutral-50/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
              Litros
            </span>
          </div>

          {/* Quick liters selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-neutral-400 font-semibold">Atalhos:</span>
            {QUICK_LITERS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLiters(l)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition active:scale-95 ${
                  liters === l
                    ? 'bg-cyan-600 text-white border-cyan-700'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-200'
                }`}
              >
                {l} L
              </button>
            ))}
          </div>

          {/* Tipo de Combustível */}
          <div className="pt-2 border-t border-neutral-100 flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-neutral-700">
              Tipo de Combustível:
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {FUEL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFuelType(t)}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold text-left border transition active:scale-95 flex items-center justify-between ${
                    fuelType === t
                      ? 'bg-cyan-50 border-cyan-500 text-cyan-900 ring-1 ring-cyan-400'
                      : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                  }`}
                >
                  <span>{t}</span>
                  {fuelType === t && <Check className="w-3 h-3 text-cyan-700 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Responsável / Condutor */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-2">
          <label htmlFor="driver-input" className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
            <User className="w-4 h-4 text-neutral-600" />
            <span>Responsável pelo Abastecimento / Condutor</span>
          </label>
          <input
            id="driver-input"
            type="text"
            placeholder="Nome do motorista / operador"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            className="w-full text-sm font-semibold py-2.5 px-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-neutral-50/50"
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold text-center">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="w-full py-3.5 px-4 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 active:scale-98 font-bold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </button>

          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white active:scale-98 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/30 transition"
          >
            <span>Revisar & Enviar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
