import React, { useState } from 'react';
import { MapPin, ArrowLeft, Check, X, Compass, ChevronRight } from 'lucide-react';
import {
  BASE_YARD_LOCATIONS,
  QUADRANT_ROWS,
  formatQuadrantRow,
  formatQuadrantRowCode,
  YardLocationOption,
} from '../utils/yardLocations';

interface YardLocationPickerModalProps {
  isOpen: boolean;
  title: string; // e.g. "Selecionar Origem" ou "Selecionar Destino"
  currentValue?: string;
  onSelect: (location: string) => void;
  onClose: () => void;
}

export const YardLocationPickerModal: React.FC<YardLocationPickerModalProps> = ({
  isOpen,
  title,
  currentValue,
  onSelect,
  onClose,
}) => {
  const [selectedQuadrant, setSelectedQuadrant] = useState<YardLocationOption | null>(null);

  if (!isOpen) return null;

  const handleSelectDirect = (locName: string) => {
    onSelect(locName);
    setSelectedQuadrant(null);
    onClose();
  };

  const handleSelectRow = (rowNum: number) => {
    if (!selectedQuadrant || !selectedQuadrant.quadrantNumber) return;
    const finalLocation = formatQuadrantRow(selectedQuadrant.quadrantNumber, rowNum);
    onSelect(finalLocation);
    setSelectedQuadrant(null);
    onClose();
  };

  const handleBackToMain = () => {
    setSelectedQuadrant(null);
  };

  const quadrants = BASE_YARD_LOCATIONS.filter((l) => l.isQuadrant);
  const specials = BASE_YARD_LOCATIONS.filter((l) => !l.isQuadrant);

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {selectedQuadrant ? (
              <button
                type="button"
                onClick={handleBackToMain}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-emerald-500/30 flex items-center justify-center text-emerald-300">
                <MapPin className="w-4 h-4" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white">{title}</h3>
              <p className="text-[11px] text-emerald-200">
                {selectedQuadrant
                  ? `Selecione a fila do ${selectedQuadrant.name}`
                  : 'Escolha o quadrante ou setor no pátio'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* STEP 2: Quadrant Row Selector */}
          {selectedQuadrant && selectedQuadrant.quadrantNumber ? (
            <div className="space-y-3 animate-in slide-in-from-right duration-150">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Quadrante Selecionado
                  </span>
                  <span className="text-base font-black text-emerald-950">
                    {selectedQuadrant.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleBackToMain}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                >
                  Trocar
                </button>
              </div>

              <div className="text-xs font-bold text-neutral-600 uppercase tracking-wider px-1">
                Selecione a Fila (1 a 5):
              </div>

              <div className="grid grid-cols-1 gap-2">
                {QUADRANT_ROWS.map((rowNum) => {
                  const label = formatQuadrantRow(selectedQuadrant.quadrantNumber!, rowNum);
                  const code = formatQuadrantRowCode(selectedQuadrant.quadrantNumber!, rowNum);
                  const isCur = currentValue === label || currentValue?.toUpperCase() === code;

                  return (
                    <button
                      key={rowNum}
                      type="button"
                      onClick={() => handleSelectRow(rowNum)}
                      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition active:scale-98 cursor-pointer ${
                        isCur
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-emerald-500'
                          : 'bg-white hover:bg-emerald-50/50 border-neutral-200 hover:border-emerald-300 text-neutral-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center font-mono ${
                            isCur
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {code}
                        </span>
                        <div>
                          <span className="text-sm font-bold block leading-tight">{label}</span>
                          <span
                            className={`text-[11px] block mt-0.5 ${
                              isCur ? 'text-emerald-100' : 'text-neutral-500'
                            }`}
                          >
                            Vaga em fila contínua {rowNum}
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-5 h-5 ${isCur ? 'text-white' : 'text-neutral-400'}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* STEP 1: Main Quadrants & Special Locations */
            <div className="space-y-4">
              {/* Quadrantes 1 ao 5 */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2 px-1 flex items-center justify-between">
                  <span>Quadrantes do Pátio (1 ao 5)</span>
                  <span className="text-[10px] text-emerald-700 font-bold lowercase">
                    solicita fila 1-5
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quadrants.map((quad) => (
                    <button
                      key={quad.id}
                      type="button"
                      onClick={() => setSelectedQuadrant(quad)}
                      className="p-3 bg-white hover:bg-emerald-50/50 border border-neutral-200 hover:border-emerald-400 rounded-2xl text-left flex items-center justify-between transition active:scale-98 cursor-pointer shadow-sm group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900 font-black text-xs flex items-center justify-center font-mono group-hover:bg-emerald-600 group-hover:text-white transition">
                          {quad.shortCode}
                        </span>
                        <span className="text-xs font-bold text-neutral-900">{quad.name}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Setores Especiais / Operacionais */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2 px-1">
                  Setores Especiais & Destinos Operacionais
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {specials.map((loc) => {
                    const isCur = currentValue?.toUpperCase() === loc.name.toUpperCase();
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleSelectDirect(loc.name)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition active:scale-95 cursor-pointer ${
                          isCur
                            ? 'bg-emerald-800 text-white border-emerald-900 shadow-sm'
                            : 'bg-neutral-50 hover:bg-white hover:border-emerald-400 border-neutral-200 text-neutral-900'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <span
                            className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded mr-1 ${
                              isCur
                                ? 'bg-emerald-900 text-white'
                                : 'bg-neutral-200 text-neutral-800'
                            }`}
                          >
                            {loc.shortCode}
                          </span>
                          <span className="text-xs font-bold truncate block mt-0.5">
                            {loc.name}
                          </span>
                        </div>
                        {isCur && <Check className="w-4 h-4 text-emerald-300 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-neutral-500 truncate max-w-[240px]">
            {currentValue ? `Atual: ${currentValue}` : 'Nenhum local selecionado'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
