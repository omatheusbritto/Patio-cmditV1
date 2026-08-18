import React from 'react';
import { VehicleCharacteristic } from '../types';
import { Tag, ArrowRight, ArrowLeft, Check, X } from 'lucide-react';

interface CharacteristicSelectorProps {
  selectedCharacteristic: VehicleCharacteristic | null;
  onSelectCharacteristic: (char: VehicleCharacteristic | null) => void;
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
    value: '🔵 DT',
    label: '🔵 DT',
    dotColor: 'bg-blue-500',
    bgActive: 'bg-blue-50 border-blue-500 text-blue-950',
    borderActive: 'border-blue-500 ring-4 ring-blue-100',
    description: 'Veículo com destinação técnica / diretoria / transfer',
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
        <div className="flex items-center gap-2 mb-1 text-emerald-700">
          <Tag className="w-6 h-6" />
          <span className="text-xs font-bold uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-full">
            Etapa 3 • Opcional
          </span>
        </div>
        <h2 className="text-xl font-black text-neutral-900 leading-tight">
          Característica do Veículo
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Selecione uma das opções abaixo ou deixe em branco se não aplicável
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
                onSelectCharacteristic(isSelected ? null : opt.value);
              }}
              className={`p-4 rounded-2xl border-2 text-left flex items-center justify-between transition active:scale-98 shadow-sm ${
                isSelected
                  ? `${opt.bgActive} ${opt.borderActive} shadow-md`
                  : 'bg-white text-neutral-800 border-neutral-200 hover:border-emerald-400 hover:bg-neutral-50'
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

        {/* Option to clear / keep empty */}
        <button
          type="button"
          onClick={() => onSelectCharacteristic(null)}
          className={`p-3 rounded-xl border text-center text-xs font-bold transition ${
            selectedCharacteristic === null
              ? 'bg-neutral-100 border-neutral-400 text-neutral-800'
              : 'bg-white border-dashed border-neutral-300 text-neutral-500 hover:bg-neutral-50'
          }`}
        >
          {selectedCharacteristic ? (
            <span className="flex items-center justify-center gap-1">
              <X className="w-3.5 h-3.5" /> Desmarcar e deixar em branco
            </span>
          ) : (
            <span>⚪ Nenhuma característica (Deixar em branco)</span>
          )}
        </button>
      </div>

      {/* Navigation Buttons */}
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
          onClick={onNext}
          className="flex-[2] py-3.5 px-6 rounded-xl font-bold text-base bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-98 transition"
        >
          <span>Avançar para Local</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
