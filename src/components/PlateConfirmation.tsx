import React, { useState } from 'react';
import {
  formatPlateForDisplay,
  isMercosulFormat,
  isValidBrazilianPlate,
  sanitizeRawText,
} from '../utils/plateNormalizer';
import { Camera, Check, AlertCircle, Sparkles, RefreshCcw, Edit3, ArrowRight } from 'lucide-react';

interface PlateConfirmationProps {
  photoDataUrl: string;
  initialPlate: string;
  isOcrLoading: boolean;
  ocrProgressMsg: string;
  onConfirmPlate: (plate: string) => void;
  onRetakePhoto: () => void;
}

export const PlateConfirmation: React.FC<PlateConfirmationProps> = ({
  photoDataUrl,
  initialPlate,
  isOcrLoading,
  ocrProgressMsg,
  onConfirmPlate,
  onRetakePhoto,
}) => {
  const [plateInput, setPlateInput] = useState<string>(sanitizeRawText(initialPlate));
  const [isPhotoExpanded, setIsPhotoExpanded] = useState<boolean>(false);

  const cleanPlate = sanitizeRawText(plateInput);
  const isValid = isValidBrazilianPlate(cleanPlate);
  const isMercosul = isMercosulFormat(cleanPlate);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeRawText(e.target.value).slice(0, 7);
    setPlateInput(sanitized);
  };

  const handleQuickChar = (char: string) => {
    if (plateInput.length < 7) {
      setPlateInput((prev) => (prev + char).slice(0, 7));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanPlate.length > 0) {
      onConfirmPlate(cleanPlate);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full pb-8">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 leading-tight">
              Confira a Placa
            </h2>
            <p className="text-xs text-neutral-500">
              {isOcrLoading
                ? ocrProgressMsg || 'Lendo placa...'
                : 'OCR local concluído. Você pode editar se necessário.'}
            </p>
          </div>
          <button
            onClick={onRetakePhoto}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 active:scale-95 transition"
          >
            <Camera className="w-3.5 h-3.5" />
            Refazer Foto
          </button>
        </div>

        {/* Captured Photo thumbnail with expand */}
        <div className="relative rounded-xl overflow-hidden bg-neutral-900 border border-neutral-200 shadow-inner group">
          <img
            src={photoDataUrl}
            alt="Veículo fotografado"
            className="w-full h-44 object-cover cursor-pointer group-hover:opacity-95 transition"
            onClick={() => setIsPhotoExpanded(!isPhotoExpanded)}
          />
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] px-2 py-0.5 rounded-md backdrop-blur-sm pointer-events-none">
            Toque para ampliar
          </div>

          {isOcrLoading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-2">
              <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-emerald-300 animate-pulse">
                {ocrProgressMsg || 'Lendo placa...'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Plate Visual & Editor Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-200 flex flex-col gap-4">
        {/* Realistic Brazilian Plate Badge */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[280px] bg-white border-4 border-neutral-900 rounded-xl overflow-hidden shadow-md">
            {/* Mercosul Blue Header or Old Plate Gray Header */}
            {isMercosul ? (
              <div className="bg-[#003399] px-3 py-1 flex items-center justify-between text-white">
                <span className="text-[10px] font-black tracking-widest">MERCOSUL</span>
                <span className="text-xs font-black tracking-wider">BRASIL</span>
                <span className="w-3 h-2 bg-amber-400 rounded-sm" />
              </div>
            ) : (
              <div className="bg-neutral-200 px-3 py-0.5 text-center text-neutral-600 text-[10px] font-bold tracking-wider border-b border-neutral-300">
                BRASIL
              </div>
            )}

            {/* Plate letters */}
            <div className="py-3 px-2 text-center bg-white">
              <span className="font-mono font-black text-4xl tracking-widest text-neutral-950">
                {cleanPlate ? formatPlateForDisplay(cleanPlate) : '--- ----'}
              </span>
            </div>
          </div>

          {/* Validation tag */}
          <div className="mt-2.5 flex items-center gap-1.5">
            {isValid ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Check className="w-3.5 h-3.5" />
                {isMercosul ? 'Placa Mercosul Válida' : 'Placa Antiga Válida'}
              </span>
            ) : cleanPlate.length > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                <AlertCircle className="w-3.5 h-3.5" />
                Formato incompleto ({cleanPlate.length}/7)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-neutral-500">
                <Edit3 className="w-3.5 h-3.5" />
                Digite ou confirme os 7 dígitos da placa
              </span>
            )}
          </div>
        </div>

        {/* Input field */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label
              htmlFor="plateInput"
              className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5"
            >
              Editar Placa Manualmente
            </label>
            <div className="relative">
              <input
                id="plateInput"
                type="text"
                value={plateInput}
                onChange={handleInputChange}
                placeholder="Ex: ABC1D23 ou ABC1234"
                maxLength={7}
                autoCapitalize="characters"
                autoComplete="off"
                className="w-full text-center text-2xl font-mono font-black tracking-widest uppercase py-3.5 px-4 rounded-xl border-2 border-neutral-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 outline-none text-neutral-900 bg-neutral-50 transition"
              />
              {cleanPlate.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPlateInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold px-2 py-1 rounded-md"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Quick toggle helpers for frequent OCR confusion (0/O, 1/I, 8/B) */}
          <div className="flex items-center justify-between bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 text-xs">
            <span className="text-neutral-500 font-medium text-[11px]">Correções rápidas:</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (cleanPlate.includes('0')) setPlateInput(cleanPlate.replace(/0/g, 'O'));
                  else if (cleanPlate.includes('O')) setPlateInput(cleanPlate.replace(/O/g, '0'));
                }}
                className="px-2 py-1 bg-white border border-neutral-300 rounded font-mono font-bold text-neutral-700 hover:bg-neutral-100"
              >
                0 ↔ O
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cleanPlate.includes('1')) setPlateInput(cleanPlate.replace(/1/g, 'I'));
                  else if (cleanPlate.includes('I')) setPlateInput(cleanPlate.replace(/I/g, '1'));
                }}
                className="px-2 py-1 bg-white border border-neutral-300 rounded font-mono font-bold text-neutral-700 hover:bg-neutral-100"
              >
                1 ↔ I
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cleanPlate.includes('8')) setPlateInput(cleanPlate.replace(/8/g, 'B'));
                  else if (cleanPlate.includes('B')) setPlateInput(cleanPlate.replace(/B/g, '8'));
                }}
                className="px-2 py-1 bg-white border border-neutral-300 rounded font-mono font-bold text-neutral-700 hover:bg-neutral-100"
              >
                8 ↔ B
              </button>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            type="submit"
            disabled={cleanPlate.length === 0}
            className={`w-full py-4 px-6 rounded-xl font-black text-base flex items-center justify-center gap-2 shadow-lg active:scale-98 transition ${
              cleanPlate.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            }`}
          >
            <span>Confirmar Placa</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Expanded photo modal */}
      {isPhotoExpanded && (
        <div
          onClick={() => setIsPhotoExpanded(false)}
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
        >
          <img
            src={photoDataUrl}
            alt="Veículo ampliado"
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
          />
          <p className="text-white text-sm font-semibold mt-4 bg-neutral-800/80 px-4 py-2 rounded-full">
            Toque em qualquer lugar para fechar
          </p>
        </div>
      )}
    </div>
  );
};
