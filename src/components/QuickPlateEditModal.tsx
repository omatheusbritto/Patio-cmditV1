import React, { useState, useEffect, useRef } from 'react';
import {
  formatPlateForDisplay,
  isMercosulFormat,
  isValidBrazilianPlate,
  sanitizeRawText,
  MERCOSUL_REGEX,
  MERCOSUL_MOTO_REGEX,
  OLD_PLATE_REGEX,
} from '../utils/plateNormalizer';
import {
  Check,
  AlertCircle,
  Edit3,
  HelpCircle,
  X,
  ShieldCheck,
  Camera,
} from 'lucide-react';

interface QuickPlateEditModalProps {
  isOpen: boolean;
  currentPlate: string;
  photoUrl?: string;
  onSave: (newPlate: string) => void;
  onClose: () => void;
}

export const QuickPlateEditModal: React.FC<QuickPlateEditModalProps> = ({
  isOpen,
  currentPlate,
  photoUrl,
  onSave,
  onClose,
}) => {
  const [plateChars, setPlateChars] = useState<string[]>(() => {
    const clean = sanitizeRawText(currentPlate);
    const arr = clean.split('').slice(0, 7);
    while (arr.length < 7) arr.push('');
    return arr;
  });

  const [activeSlot, setActiveSlot] = useState<number>(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync state when modal opens or currentPlate changes
  useEffect(() => {
    if (isOpen) {
      const clean = sanitizeRawText(currentPlate);
      const arr = clean.split('').slice(0, 7);
      while (arr.length < 7) arr.push('');
      setPlateChars(arr);
      setActiveSlot(0);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen, currentPlate]);

  if (!isOpen) return null;

  const cleanPlate = sanitizeRawText(plateChars.join(''));
  const isValid = isValidBrazilianPlate(cleanPlate);
  const isMercosul = isMercosulFormat(cleanPlate);
  const isMercosulCar = MERCOSUL_REGEX.test(cleanPlate);
  const isMercosulMoto = MERCOSUL_MOTO_REGEX.test(cleanPlate);
  const isOldPlate = OLD_PLATE_REGEX.test(cleanPlate);

  const handleCharChange = (index: number, val: string) => {
    const raw = sanitizeRawText(val);
    const char = raw.slice(-1);

    const newChars = [...plateChars];
    newChars[index] = char;
    setPlateChars(newChars);

    if (char && index < 6) {
      inputRefs.current[index + 1]?.focus();
      setActiveSlot(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!plateChars[index] && index > 0) {
        const newChars = [...plateChars];
        newChars[index - 1] = '';
        setPlateChars(newChars);
        inputRefs.current[index - 1]?.focus();
        setActiveSlot(index - 1);
      } else {
        const newChars = [...plateChars];
        newChars[index] = '';
        setPlateChars(newChars);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setActiveSlot(index - 1);
    } else if (e.key === 'ArrowRight' && index < 6) {
      inputRefs.current[index + 1]?.focus();
      setActiveSlot(index + 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = sanitizeRawText(e.clipboardData.getData('text')).slice(0, 7);
    if (!pasted) return;

    const arr = pasted.split('');
    while (arr.length < 7) arr.push('');
    setPlateChars(arr);
    inputRefs.current[Math.min(6, pasted.length)]?.focus();
  };

  const handleFullStringChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeRawText(e.target.value).slice(0, 7);
    const arr = raw.split('');
    while (arr.length < 7) arr.push('');
    setPlateChars(arr);
  };

  const handleSwapCharacter = (fromChar: string, toChar: string) => {
    const newChars = plateChars.map((c) => {
      if (c === fromChar) return toChar;
      if (c === toChar) return fromChar;
      return c;
    });
    setPlateChars(newChars);
  };

  const handleConfirm = () => {
    if (cleanPlate.length > 0) {
      onSave(cleanPlate);
      onClose();
    }
  };

  const getExpectedType = (idx: number): { label: string } => {
    if (idx <= 2) return { label: 'LET' };
    if (idx === 3) return { label: 'NÚM' };
    if (idx === 4) return { label: isOldPlate ? 'NÚM' : 'L/N' };
    if (idx === 5) return { label: isMercosulMoto ? 'LET' : 'NÚM' };
    return { label: 'NÚM' };
  };

  return (
    <div
      id="modal-quick-plate-edit"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-neutral-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/40">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black leading-tight text-white flex items-center gap-1.5">
                <span>Confirmar / Alterar Placa</span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                A foto original será mantida intacta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4">
          {/* Photo Preview Badge */}
          {photoUrl && (
            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-neutral-50 border border-neutral-200">
              <div className="w-16 h-12 rounded-xl overflow-hidden bg-neutral-900 shrink-0 border border-neutral-300">
                <img
                  src={photoUrl}
                  alt="Veículo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                  Foto Registrada Preservada
                </span>
                <p className="text-xs text-neutral-600 truncate">
                  Altere apenas os caracteres lidos pela câmera
                </p>
              </div>
            </div>
          )}

          {/* Realistic Plate Preview */}
          <div className="flex flex-col items-center">
            <div className="w-full max-w-[260px] bg-white border-3 border-neutral-900 rounded-xl overflow-hidden shadow-md">
              {isMercosul ? (
                <div className="bg-[#003399] px-2.5 py-0.5 flex items-center justify-between text-white">
                  <span className="text-[9px] font-black tracking-widest">MERCOSUL</span>
                  <span className="text-[10px] font-black tracking-wider">BRASIL</span>
                  <span className="w-2.5 h-1.5 bg-amber-400 rounded-xs" />
                </div>
              ) : (
                <div className="bg-neutral-200 px-2.5 py-0.5 text-center text-neutral-600 text-[9px] font-bold tracking-wider border-b border-neutral-300">
                  BRASIL
                </div>
              )}
              <div className="py-2 px-2 text-center bg-white">
                <span className="font-mono font-black text-3xl tracking-widest text-neutral-950">
                  {cleanPlate ? formatPlateForDisplay(cleanPlate) : '-------'}
                </span>
              </div>
            </div>

            {/* Validation Tag */}
            <div className="mt-2 flex items-center gap-1.5">
              {isValid ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <Check className="w-3 h-3" />
                  {isMercosulCar
                    ? 'Mercosul Carro Válida'
                    : isMercosulMoto
                    ? 'Mercosul Moto Válida'
                    : 'Placa Antiga Válida'}
                </span>
              ) : cleanPlate.length > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                  <AlertCircle className="w-3 h-3" />
                  {cleanPlate.length < 7
                    ? `Incompleta (${cleanPlate.length}/7 dígitos)`
                    : 'Formato divergente'}
                </span>
              ) : (
                <span className="text-[11px] text-neutral-500">
                  Digite os 7 caracteres da placa
                </span>
              )}
            </div>
          </div>

          {/* 7 Interactive Slots */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Editar Dígito por Dígito
              </label>
              <span className="text-[10px] text-neutral-500">7 caracteres</span>
            </div>

            <div
              className="grid grid-cols-7 gap-1 sm:gap-1.5"
              onPaste={handlePaste}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((idx) => {
                const char = plateChars[idx] || '';
                const expected = getExpectedType(idx);
                const isFocused = activeSlot === idx;

                return (
                  <div key={idx} className="flex flex-col items-center gap-0.5">
                    <input
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      type="text"
                      maxLength={1}
                      value={char}
                      onFocus={() => setActiveSlot(idx)}
                      onChange={(e) => handleCharChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      autoCapitalize="characters"
                      autoComplete="off"
                      className={`w-full aspect-square text-center text-lg sm:text-xl font-mono font-black uppercase rounded-xl border-2 outline-none transition shadow-xs ${
                        isFocused
                          ? 'border-emerald-600 ring-2 ring-emerald-200 bg-emerald-50 text-emerald-950 scale-105'
                          : char
                          ? 'border-neutral-400 bg-white text-neutral-900'
                          : 'border-dashed border-neutral-300 bg-neutral-50 text-neutral-400'
                      }`}
                    />
                    <span
                      className={`text-[8px] font-bold ${
                        idx <= 2
                          ? 'text-sky-700'
                          : idx === 3
                          ? 'text-amber-700'
                          : idx === 4
                          ? 'text-purple-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {expected.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full string fallback input */}
          <div>
            <label
              htmlFor="quickFullPlateInput"
              className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1"
            >
              Ou Digite a Placa Completa
            </label>
            <div className="relative">
              <input
                id="quickFullPlateInput"
                type="text"
                value={cleanPlate}
                onChange={handleFullStringChange}
                placeholder="Ex: BRA2E19 ou ABC1234"
                maxLength={7}
                autoCapitalize="characters"
                autoComplete="off"
                className="w-full text-center text-lg font-mono font-black tracking-widest uppercase py-2 px-3 rounded-xl border-2 border-neutral-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none text-neutral-900 bg-neutral-50 transition"
              />
              {cleanPlate.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPlateChars(['', '', '', '', '', '', ''])}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold px-2 py-0.5 rounded"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Quick Ambiguity Swapper Buttons */}
          <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
            <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-700 mb-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />
              <span>Trocar Dígitos Frequentes:</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-xs">
              <button
                type="button"
                onClick={() => handleSwapCharacter('0', 'O')}
                className="py-1 px-1 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition text-center text-[11px]"
              >
                0 ↔ O
              </button>
              <button
                type="button"
                onClick={() => handleSwapCharacter('1', 'I')}
                className="py-1 px-1 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition text-center text-[11px]"
              >
                1 ↔ I
              </button>
              <button
                type="button"
                onClick={() => handleSwapCharacter('8', 'B')}
                className="py-1 px-1 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition text-center text-[11px]"
              >
                8 ↔ B
              </button>
              <button
                type="button"
                onClick={() => handleSwapCharacter('5', 'S')}
                className="py-1 px-1 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition text-center text-[11px]"
              >
                5 ↔ S
              </button>
              <button
                type="button"
                onClick={() => handleSwapCharacter('2', 'Z')}
                className="py-1 px-1 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition text-center text-[11px]"
              >
                2 ↔ Z
              </button>
              <button
                type="button"
                onClick={() => handleSwapCharacter('6', 'G')}
                className="py-1 px-1 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition text-center text-[11px]"
              >
                6 ↔ G
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-bold transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={cleanPlate.length === 0}
            className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition ${
              cleanPlate.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-98'
                : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Salvar Placa ({cleanPlate || '---'})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
