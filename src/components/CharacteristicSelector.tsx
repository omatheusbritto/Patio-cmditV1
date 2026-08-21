import React from 'react';
import { VehicleCharacteristic } from '../types';
import { Tag, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react';

interface CharacteristicSelectorProps {
  selectedCharacteristic: VehicleCharacteristic | null;
  onSelectCharacteristic: (char: VehicleCharacteristic) => void;
  onNext: () => void;
  onBack: () => void;
}

const CHARACTERISTIC_OPTIONS: {
  value: VehicleCharacteristic;
  label: string;
  dotColor: string;
  bgActive: string;
  borderActive: string;
  description: string;
}[] = [
  {
    value: '🟣 DT',
    label: '🟣 DT',
    dotColor: 'bg-purple-500',
    bgActive: 'bg-purple-50 border-purple-500 text-purple-950',
    borderActive: 'border-purple-500 ring-4 ring-purple-100',
    description: 'Veículo com destinação técnica / diretoria / transfer',
  },
  {
    value: '🟠 REVENDA',
    label: '🟠 REVENDA',
    dotColor: 'bg-orange-500',
    bgActive: 'bg-orange-50 border-orange-500 text-orange-950',
    borderActive: 'border-orange-500 ring-4 ring-orange-100',
    description: 'Veículo destinado à comercialização / revenda',
  },
  {
    value: '🟢 CONSUMIDOR',
    label: '🟢 CONSUMIDOR',
    dotColor: 'bg-emerald-500',
    bgActive: 'bg-emerald-50 border-emerald-500 text-emerald-950',
    borderActive: 'border-emerald-500 ring-4 ring-emerald-100',
    description: 'Veículo em uso direto por consumidor / cliente',
  },
  {
    value: '⚪ OUTROS',
    label: '⚪ OUTROS',
    dotColor: 'bg-neutral-400',
    bgActive: 'bg-neutral-100 border-neutral-600 text-neutral-900',
    borderActive: 'border-neutral-600 ring-4 ring-neutral-200',
    description: 'Outras finalidades operacionais / não categorizado',
  },
];

export const CharacteristicSelector: React.FC<CharacteristicSelectorProps> = ({
  selectedCharacteristic,
  onSelectCharacteristic,
  onNext,
  onBack,
}) => {
  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full pb-8">
      {/* Header Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-200">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-purple-700">
            <Tag className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200 text-purple-800">
              51 (Qualidade) • Etapa 1
            </span>
          </div>
          <span className="text-[10px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
            Obrigatório
          </span>
        </div>
        <h2 className="text-xl font-black text-neutral-900 leading-tight mt-1">
          Característica do Veículo
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Selecione a característica correspondente para prosseguir
        </p>
      </div>

      {/* Option Cards */}
      <div className="flex flex-col gap-3">
        {CHARACTERISTIC_OPTIONS.map((opt) => {
          const isSelected = selectedCharacteristic === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onSelectCharacteristic(opt.value);
              }}
              className={`p-4 rounded-2xl border-2 text-left flex items-center justify-between transition active:scale-98 shadow-sm cursor-pointer ${
                isSelected
                  ? `${opt.bgActive} ${opt.borderActive} shadow-md`
                  : 'bg-white text-neutral-800 border-neutral-200 hover:border-purple-400 hover:bg-purple-50/20'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tight">{opt.label}</span>
                <span className="text-xs text-neutral-500 mt-0.5">{opt.description}</span>
              </div>

              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition ${
                  isSelected
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'border-neutral-300 bg-neutral-50'
                }`}
              >
                {isSelected ? <Check className="w-4 h-4" /> : null}
              </div>
            </button>
          );
        })}
      </div>

      {!selectedCharacteristic && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Escolha uma característica para liberar o avanço.</span>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3.5 px-4 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <button
          type="button"
          disabled={!selectedCharacteristic}
          onClick={onNext}
          className={`flex-[2] py-3.5 px-6 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition ${
            selectedCharacteristic
              ? 'bg-purple-700 hover:bg-purple-600 text-white shadow-lg shadow-purple-700/30 active:scale-98 cursor-pointer'
              : 'bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none'
          }`}
        >
          <span>Avançar para Combustível</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

