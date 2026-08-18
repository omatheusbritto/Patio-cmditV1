import React from 'react';
import { FuelLevel } from '../types';
import { Fuel, ArrowRight, ArrowLeft, Check } from 'lucide-react';

interface FuelSelectorProps {
  selectedFuel: FuelLevel | null;
  onSelectFuel: (fuel: FuelLevel) => void;
  onBack: () => void;
}

const FUEL_OPTIONS: { level: FuelLevel; label: string; percent: number; colorClass: string }[] = [
  { level: '1/8', label: 'Reserva', percent: 12.5, colorClass: 'bg-rose-500 text-rose-50 border-rose-600' },
  { level: '2/8', label: '1/4 Baixo', percent: 25, colorClass: 'bg-amber-500 text-amber-50 border-amber-600' },
  { level: '3/8', label: '3/8', percent: 37.5, colorClass: 'bg-amber-500 text-amber-50 border-amber-600' },
  { level: '4/8', label: 'Meio Tanque (1/2)', percent: 50, colorClass: 'bg-emerald-600 text-emerald-50 border-emerald-700' },
  { level: '5/8', label: '5/8', percent: 62.5, colorClass: 'bg-emerald-600 text-emerald-50 border-emerald-700' },
  { level: '6/8', label: '3/4 Tanque', percent: 75, colorClass: 'bg-emerald-600 text-emerald-50 border-emerald-700' },
  { level: '7/8', label: '7/8 Quase Cheio', percent: 87.5, colorClass: 'bg-emerald-600 text-emerald-50 border-emerald-700' },
  { level: '8/8', label: 'Tanque Cheio', percent: 100, colorClass: 'bg-emerald-600 text-emerald-50 border-emerald-700' },
];

export const FuelSelector: React.FC<FuelSelectorProps> = ({
  selectedFuel,
  onSelectFuel,
  onBack,
}) => {
  const currentOption = FUEL_OPTIONS.find((f) => f.level === selectedFuel);
  const currentPercent = currentOption ? currentOption.percent : 0;

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full pb-8">
      {/* Title card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-200">
        <div className="flex items-center gap-2 mb-1 text-emerald-700">
          <Fuel className="w-6 h-6" />
          <span className="text-xs font-bold uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-full">
            Etapa 2 • Obrigatório
          </span>
        </div>
        <h2 className="text-xl font-black text-neutral-900 leading-tight">
          Nível de Combustível
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Selecione a quantidade de combustível no marcador do painel
        </p>

        {/* Visual Fuel Gauge Meter */}
        <div className="mt-4 p-4 rounded-xl bg-neutral-900 text-white flex flex-col gap-3 shadow-inner">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> E (Vazio)
            </span>
            <span className="text-neutral-400">1/2</span>
            <span className="text-emerald-400 font-bold">F (Cheio)</span>
          </div>

          {/* Gauge Bar */}
          <div className="w-full h-5 bg-neutral-800 rounded-lg overflow-hidden p-1 flex gap-1 border border-neutral-700">
            {FUEL_OPTIONS.map((opt) => {
              const isActive = selectedFuel && opt.percent <= currentPercent;
              let fillBg = 'bg-neutral-700';
              if (isActive) {
                if (opt.percent <= 15) fillBg = 'bg-rose-500 shadow-[0_0_8px_#f43f5e]';
                else if (opt.percent <= 38) fillBg = 'bg-amber-400 shadow-[0_0_8px_#fbbf24]';
                else fillBg = 'bg-emerald-400 shadow-[0_0_8px_#34d399]';
              }
              return (
                <div
                  key={opt.level}
                  className={`flex-1 h-full rounded-sm transition-all duration-300 ${fillBg}`}
                />
              );
            })}
          </div>

          {/* Current Selection Feedback */}
          <div className="text-center">
            {selectedFuel ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700">
                <span className="text-xs text-neutral-400">Selecionado:</span>
                <span className="text-sm font-black text-emerald-300 font-mono">
                  {selectedFuel}
                </span>
                <span className="text-xs text-neutral-300">({currentOption?.label})</span>
              </div>
            ) : (
              <span className="text-xs text-neutral-400 italic">
                Toque em um dos botões abaixo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grid of 8 Fuel Level Buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        {FUEL_OPTIONS.map((opt) => {
          const isSelected = selectedFuel === opt.level;
          return (
            <button
              key={opt.level}
              type="button"
              onClick={() => onSelectFuel(opt.level)}
              className={`py-3.5 px-4 rounded-xl border-2 font-bold text-left flex items-center justify-between transition active:scale-97 shadow-sm ${
                isSelected
                  ? 'bg-emerald-700 text-white border-emerald-800 ring-4 ring-emerald-100 shadow-md'
                  : 'bg-white text-neutral-800 border-neutral-200 hover:border-emerald-500 hover:bg-emerald-50/50'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-mono text-xl font-black tracking-tight leading-none">
                  {opt.level}
                </span>
                <span
                  className={`text-[11px] font-medium mt-1 leading-none ${
                    isSelected ? 'text-emerald-100' : 'text-neutral-500'
                  }`}
                >
                  {opt.label}
                </span>
              </div>

              {isSelected ? (
                <div className="w-6 h-6 rounded-full bg-white text-emerald-800 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-3 h-3 rounded-full border-2 border-neutral-300" />
              )}
            </button>
          );
        })}
      </div>

      {/* Navigation actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3.5 px-4 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <button
          type="button"
          disabled={!selectedFuel}
          onClick={() => {
            if (selectedFuel) onSelectFuel(selectedFuel);
          }}
          className={`flex-[2] py-3.5 px-6 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-98 transition ${
            selectedFuel
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
          }`}
        >
          <span>Avançar</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
