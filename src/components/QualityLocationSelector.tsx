import React, { useState } from 'react';
import { LocationCode, QualityLocationCode } from '../types';
import { MapPin, ArrowRight, ArrowLeft, Check, ShieldCheck, Edit2 } from 'lucide-react';
import { QuickPlateEditModal } from './QuickPlateEditModal';
import { formatPlateForDisplay } from '../utils/plateNormalizer';

interface QualityLocationSelectorProps {
  selectedLocation: LocationCode | null;
  onSelectLocation: (loc: QualityLocationCode) => void;
  onNext: () => void;
  onBack: () => void;
  plate: string;
  onUpdatePlate?: (newPlate: string) => void;
}

const QUALITY_LOCATION_OPTIONS: {
  code: QualityLocationCode;
  name: string;
  subname: string;
  tag: string;
  desc: string;
}[] = [
  {
    code: 'P1',
    name: 'P1 - Poste 1',
    subname: 'Poste 1',
    tag: 'Área 1',
    desc: 'Vagas na área do Poste 1',
  },
  {
    code: 'P2',
    name: 'P2 - Poste 2',
    subname: 'Poste 2',
    tag: 'Área 2',
    desc: 'Vagas na área do Poste 2',
  },
  {
    code: 'P3',
    name: 'P3 - Poste 3',
    subname: 'Poste 3',
    tag: 'Área 3',
    desc: 'Vagas na área do Poste 3',
  },
  {
    code: 'R1',
    name: 'R1 - Rua 1',
    subname: 'Rua 1',
    tag: 'Pista / Rua',
    desc: 'Corredor e vagas da Rua 1',
  },
  {
    code: 'ADM',
    name: 'ADM - Administrativo',
    subname: 'Administração',
    tag: 'Área ADM',
    desc: 'Vagas do Prédio / Área Administrativa',
  },
];

export const QualityLocationSelector: React.FC<QualityLocationSelectorProps> = ({
  selectedLocation,
  onSelectLocation,
  onNext,
  onBack,
  plate,
  onUpdatePlate,
}) => {
  const [isEditPlateOpen, setIsEditPlateOpen] = useState<boolean>(false);

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full pb-8">
      {/* Header Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-indigo-700">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-200">
              51 (Qualidade) • Etapa 3 (Local)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsEditPlateOpen(true)}
            className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white px-2.5 py-1 rounded-lg transition active:scale-95 cursor-pointer shadow-xs"
            title="Alterar placa sem alterar a foto"
          >
            <span className="text-xs font-mono font-bold">{formatPlateForDisplay(plate)}</span>
            <span className="text-[9px] bg-emerald-600 text-white font-bold px-1 rounded flex items-center gap-0.5">
              <Edit2 className="w-2.5 h-2.5" />
              Alterar
            </span>
          </button>
        </div>

        <h2 className="text-xl font-black text-neutral-900 leading-tight">
          Local do Veículo (Qualidade)
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Selecione o Poste (P1, P2, P3) ou Rua 1 (R1)
        </p>
      </div>

      {/* Grid of 4 Quality Location Buttons */}
      <div className="grid grid-cols-2 gap-3">
        {QUALITY_LOCATION_OPTIONS.map((loc) => {
          const isSelected = selectedLocation === loc.code;
          return (
            <button
              key={loc.code}
              type="button"
              onClick={() => onSelectLocation(loc.code)}
              className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between min-h-[110px] transition active:scale-[0.97] shadow-sm relative ${
                isSelected
                  ? 'bg-indigo-700 text-white border-indigo-900 ring-4 ring-indigo-100 shadow-md'
                  : 'bg-white text-neutral-900 border-neutral-200 hover:border-indigo-400 hover:bg-indigo-50/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xl font-black tracking-tight">
                  {loc.code}
                </span>
                {isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-white text-indigo-900 flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                ) : (
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                    {loc.tag}
                  </span>
                )}
              </div>

              <div>
                <span
                  className={`text-sm font-black block mt-2 ${
                    isSelected ? 'text-white' : 'text-neutral-900'
                  }`}
                >
                  {loc.subname}
                </span>
                <span
                  className={`text-[11px] font-medium block leading-tight ${
                    isSelected ? 'text-indigo-200' : 'text-neutral-500'
                  }`}
                >
                  {loc.desc}
                </span>
              </div>
            </button>
          );
        })}
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
          type="button"
          disabled={!selectedLocation}
          onClick={onNext}
          className={`flex-2 py-3.5 px-5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition shadow-lg ${
            selectedLocation
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-98 cursor-pointer'
              : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
          }`}
        >
          <span>Avançar para Revisão</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Modal para Alterar Placa mantendo a foto */}
      <QuickPlateEditModal
        isOpen={isEditPlateOpen}
        currentPlate={plate}
        onSave={(newPlate) => {
          if (onUpdatePlate) onUpdatePlate(newPlate);
        }}
        onClose={() => setIsEditPlateOpen(false)}
      />
    </div>
  );
};
