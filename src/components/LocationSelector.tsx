import React from 'react';
import { LocationCode } from '../types';
import { MapPin, ArrowRight, ArrowLeft, Check } from 'lucide-react';

interface LocationSelectorProps {
  selectedLocation: LocationCode | null;
  onSelectLocation: (loc: LocationCode) => void;
  onNext: () => void;
  onBack: () => void;
}

const LOCATION_OPTIONS: { code: LocationCode; name: string; tag: string }[] = [
  { code: 'P1', name: 'Pátio 1', tag: 'Principal' },
  { code: 'P2', name: 'Pátio 2', tag: 'Estoque' },
  { code: 'P3', name: 'Pátio 3', tag: 'Apoio' },
  { code: 'R1', name: 'Recepção 1', tag: 'Entrada' },
  { code: 'ADM', name: 'Administrativo', tag: 'Escritório' },
  { code: 'PDC', name: 'Ponto de Controle', tag: 'Vistoria / Prévia' },
];

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  selectedLocation,
  onSelectLocation,
  onNext,
  onBack,
}) => {
  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full pb-8">
      {/* Header Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-200">
        <div className="flex items-center gap-2 mb-1 text-emerald-700">
          <MapPin className="w-6 h-6" />
          <span className="text-xs font-bold uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-full">
            Etapa 4 • Obrigatório
          </span>
        </div>
        <h2 className="text-xl font-black text-neutral-900 leading-tight">
          Local do Veículo
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Selecione o setor ou pátio onde o carro está localizado
        </p>
      </div>

      {/* Grid of Location Buttons */}
      <div className="grid grid-cols-2 gap-3">
        {LOCATION_OPTIONS.map((loc) => {
          const isSelected = selectedLocation === loc.code;
          return (
            <button
              key={loc.code}
              type="button"
              onClick={() => onSelectLocation(loc.code)}
              className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between min-h-[90px] transition active:scale-97 shadow-sm ${
                isSelected
                  ? 'bg-emerald-700 text-white border-emerald-800 ring-4 ring-emerald-100 shadow-md'
                  : 'bg-white text-neutral-900 border-neutral-200 hover:border-emerald-500 hover:bg-emerald-50/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xl font-black tracking-tight">
                  {loc.code}
                </span>
                {isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-white text-emerald-800 flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                ) : (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
                    {loc.tag}
                  </span>
                )}
              </div>

              <span
                className={`text-xs font-semibold mt-2 ${
                  isSelected ? 'text-emerald-100' : 'text-neutral-600'
                }`}
              >
                {loc.name}
              </span>
            </button>
          );
        })}
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
          disabled={!selectedLocation}
          onClick={onNext}
          className={`flex-[2] py-3.5 px-6 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-98 transition ${
            selectedLocation
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
          }`}
        >
          <span>Revisar Registro</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
