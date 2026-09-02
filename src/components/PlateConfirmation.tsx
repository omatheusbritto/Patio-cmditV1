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
  Camera,
  Check,
  AlertCircle,
  Sparkles,
  Edit3,
  ArrowRight,
  Bot,
  ZoomIn,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

interface PlateConfirmationProps {
  photoDataUrl: string;
  initialPlate: string;
  plateSource?: 'local_ocr' | 'gemini_ai' | 'manual' | null;
  croppedPlateUrl?: string | null;
  isCertain?: boolean;
  analysisNotes?: string;
  aiDetails?: string;
  isOcrLoading: boolean;
  ocrProgressMsg: string;
  onConfirmPlate: (plate: string) => void;
  onRetakePhoto: () => void;
  onReanalyzeWithAi?: () => void;
  autoReadEnabled?: boolean;
  onToggleAutoRead?: () => void;
}

export const PlateConfirmation: React.FC<PlateConfirmationProps> = ({
  photoDataUrl,
  initialPlate,
  plateSource,
  croppedPlateUrl,
  isCertain = true,
  analysisNotes,
  isOcrLoading,
  ocrProgressMsg,
  onConfirmPlate,
  onRetakePhoto,
  onReanalyzeWithAi,
  autoReadEnabled = true,
  onToggleAutoRead,
}) => {
  const [plateChars, setPlateChars] = useState<string[]>(() => {
    const clean = sanitizeRawText(initialPlate);
    const arr = clean.split('').slice(0, 7);
    while (arr.length < 7) arr.push('');
    return arr;
  });

  const [isPhotoExpanded, setIsPhotoExpanded] = useState<boolean>(false);
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync state when new initialPlate arrives from background AI / OCR
  useEffect(() => {
    if (initialPlate) {
      const clean = sanitizeRawText(initialPlate);
      const arr = clean.split('').slice(0, 7);
      while (arr.length < 7) arr.push('');
      setPlateChars(arr);
    }
  }, [initialPlate]);

  const cleanPlate = sanitizeRawText(plateChars.join(''));
  const isValid = isValidBrazilianPlate(cleanPlate);
  const isMercosul = isMercosulFormat(cleanPlate);
  const isMercosulCar = MERCOSUL_REGEX.test(cleanPlate);
  const isMercosulMoto = MERCOSUL_MOTO_REGEX.test(cleanPlate);
  const isOldPlate = OLD_PLATE_REGEX.test(cleanPlate);

  // Handle single character change
  const handleCharChange = (index: number, val: string) => {
    const raw = sanitizeRawText(val);
    const char = raw.slice(-1); // take the last character typed

    const newChars = [...plateChars];
    newChars[index] = char;
    setPlateChars(newChars);

    // Auto-advance to next input if a char was entered
    if (char && index < 6) {
      inputRefs.current[index + 1]?.focus();
      setActiveSlot(index + 1);
    }
  };

  // Handle key navigation (Backspace, Arrow keys)
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!plateChars[index] && index > 0) {
        // Move back and clear previous
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
    }
  };

  // Handle paste of full plate string
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = sanitizeRawText(e.clipboardData.getData('text')).slice(0, 7);
    if (!pasted) return;

    const arr = pasted.split('');
    while (arr.length < 7) arr.push('');
    setPlateChars(arr);
    inputRefs.current[Math.min(6, pasted.length)]?.focus();
  };

  // Full string direct edit
  const handleFullStringChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeRawText(e.target.value).slice(0, 7);
    const arr = raw.split('');
    while (arr.length < 7) arr.push('');
    setPlateChars(arr);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanPlate.length > 0) {
      onConfirmPlate(cleanPlate);
    }
  };

  // Helper to get expected type for each of the 7 positions
  const getExpectedType = (idx: number): { label: string; isLetter: boolean; isDigit: boolean } => {
    if (idx <= 2) {
      return { label: 'LETRA', isLetter: true, isDigit: false };
    }
    if (idx === 3) {
      return { label: 'NÚMERO', isLetter: false, isDigit: true };
    }
    if (idx === 4) {
      // 5th character: Letter in Mercosul Car, Digit in Old/Moto
      if (isOldPlate) return { label: 'NÚMERO', isLetter: false, isDigit: true };
      return { label: 'LETRA/NÚM', isLetter: true, isDigit: true };
    }
    // idx 5 & 6:
    if (idx === 5) {
      if (isMercosulMoto) return { label: 'LETRA', isLetter: true, isDigit: false };
      return { label: 'NÚMERO', isLetter: false, isDigit: true };
    }
    return { label: 'NÚMERO', isLetter: false, isDigit: true };
  };

  // One-click ambiguity swapper (e.g. 0 to O, 1 to I, etc.)
  const handleSwapCharacter = (fromChar: string, toChar: string) => {
    const newChars = plateChars.map((c) => {
      if (c === fromChar) return toChar;
      if (c === toChar) return fromChar;
      return c;
    });
    setPlateChars(newChars);
  };

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full pb-8">
      {/* Header card with Photo and Optical Crop */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 leading-tight flex items-center gap-1.5">
              <span>Conferência da Placa</span>
              {isValid && isCertain && (
                <ShieldCheck className="w-5 h-5 text-emerald-600 inline" />
              )}
            </h2>
            <p className="text-xs text-neutral-500">
              {isOcrLoading
                ? ocrProgressMsg || 'Lendo placa com IA...'
                : plateSource === 'gemini_ai'
                ? 'Leitura determinística por IA (Precisão Máxima)'
                : plateSource === 'local_ocr'
                ? 'Leitura via OCR do dispositivo'
                : 'Insira ou corrija os 7 caracteres da placa.'}
            </p>
          </div>
          <button
            onClick={onRetakePhoto}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 active:scale-95 transition"
          >
            <Camera className="w-3.5 h-3.5" />
            Nova Foto
          </button>
        </div>

        {/* Visual comparison: Optical Plate Crop vs Full Image */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Full Photo */}
          <div className="relative rounded-xl overflow-hidden bg-neutral-900 border border-neutral-200 shadow-inner group h-36">
            <img
              src={photoDataUrl}
              alt="Veículo fotografado"
              className="w-full h-full object-cover cursor-pointer group-hover:opacity-90 transition"
              onClick={() => setIsPhotoExpanded(true)}
            />
            <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded backdrop-blur-sm pointer-events-none">
              Foto Original
            </div>
            <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-1 pointer-events-none">
              <ZoomIn className="w-3 h-3" /> Ampliar
            </div>

            {isOcrLoading && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-2 p-2 text-center">
                <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-emerald-300 animate-pulse">
                  {ocrProgressMsg || 'Processando imagem...'}
                </p>
              </div>
            )}
          </div>

          {/* Optical Zoom of the Plate (if cropped from AI bounding box) */}
          <div className="relative rounded-xl overflow-hidden bg-neutral-900 border border-neutral-300 shadow-inner flex flex-col items-center justify-center p-1 h-36">
            {croppedPlateUrl ? (
              <>
                <div className="absolute top-1.5 left-1.5 bg-emerald-950/90 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm z-10">
                  🔍 Recorte Óptico da Placa
                </div>
                <img
                  src={croppedPlateUrl}
                  alt="Recorte da Placa"
                  className="w-full h-full object-contain cursor-pointer hover:scale-105 transition duration-200"
                  onClick={() => setIsPhotoExpanded(true)}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-3 text-neutral-400">
                <Sparkles className="w-6 h-6 mb-1 text-neutral-500" />
                <span className="text-[11px] font-medium">
                  {isOcrLoading ? 'Localizando placa...' : 'Enquadre a placa para zoom automático'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Source and AI Notes */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {plateSource === 'gemini_ai' ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-50 text-violet-800 border border-violet-200">
                <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                <span>IA de Alta Precisão (Zero Alucinação)</span>
              </div>
            ) : plateSource === 'local_ocr' ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>OCR Local do Aparelho</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-600 bg-neutral-100">
                <Edit3 className="w-3 h-3" />
                <span>Entrada Manual</span>
              </div>
            )}

            {/* Quick Toggle of Auto-Read preference */}
            {onToggleAutoRead && (
              <button
                type="button"
                onClick={onToggleAutoRead}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition active:scale-95 cursor-pointer ${
                  autoReadEnabled
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                }`}
                title="Alternar Leitura Automática de Placas"
              >
                <Sparkles className={`w-3 h-3 ${autoReadEnabled ? 'text-emerald-600' : 'text-neutral-400'}`} />
                <span>Auto: <strong>{autoReadEnabled ? 'ON' : 'OFF'}</strong></span>
              </button>
            )}
          </div>

          {/* Re-analyze with AI button */}
          {onReanalyzeWithAi && (
            <button
              type="button"
              onClick={onReanalyzeWithAi}
              disabled={isOcrLoading}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-violet-100 hover:bg-violet-200 px-3 py-1.5 rounded-lg active:scale-95 transition border border-violet-300 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{cleanPlate.length === 0 ? '✨ Ler Placa com IA' : 'Reanalisar com IA'}</span>
            </button>
          )}
        </div>

        {analysisNotes && (
          <div className="mt-2 text-[11px] text-neutral-600 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-200 flex items-start gap-1.5">
            <span className="font-semibold text-neutral-700 shrink-0">Diagnóstico:</span>
            <span>{analysisNotes}</span>
          </div>
        )}
      </div>

      {/* Brazilian Plate Display & 7-Segment Slot Editor */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-200 flex flex-col gap-4">
        {/* Realistic Brazilian Plate Badge */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[300px] bg-white border-4 border-neutral-900 rounded-xl overflow-hidden shadow-md">
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

            {/* Plate letters with Brazilian font styling */}
            <div className="py-3 px-2 text-center bg-white">
              <span className="font-mono font-black text-4xl tracking-widest text-neutral-950 select-all">
                {cleanPlate ? formatPlateForDisplay(cleanPlate) : '-------'}
              </span>
            </div>
          </div>

          {/* Validation Tag */}
          <div className="mt-2.5 flex items-center gap-1.5">
            {isValid ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
                <Check className="w-3.5 h-3.5" />
                {isMercosulCar
                  ? 'Mercosul Carro Válida (LLL-N-L-NN)'
                  : isMercosulMoto
                  ? 'Mercosul Moto Válida (LLL-NN-L-N)'
                  : 'Placa Antiga Válida (LLL-NNNN)'}
              </span>
            ) : cleanPlate.length > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                <AlertCircle className="w-3.5 h-3.5" />
                {cleanPlate.length < 7
                  ? `Incompleta (${cleanPlate.length}/7 dígitos)`
                  : 'Formato não reconhecido'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-neutral-500">
                <Edit3 className="w-3.5 h-3.5" />
                Digite os 7 caracteres da placa
              </span>
            )}
          </div>
        </div>

        {/* 7-Segment Individual Character Editor */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                Editar Caractere por Caractere
              </label>
              <span className="text-[11px] text-neutral-500">7 dígitos exatos</span>
            </div>

            {/* 7 Interactive Boxes */}
            <div
              className="grid grid-cols-7 gap-1.5 sm:gap-2"
              onPaste={handlePaste}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((idx) => {
                const char = plateChars[idx] || '';
                const expected = getExpectedType(idx);
                const isFocused = activeSlot === idx;

                return (
                  <div key={idx} className="flex flex-col items-center gap-1">
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
                      className={`w-full aspect-square text-center text-xl sm:text-2xl font-mono font-black uppercase rounded-xl border-2 outline-none transition shadow-sm ${
                        isFocused
                          ? 'border-emerald-600 ring-2 ring-emerald-200 bg-emerald-50 text-emerald-950 scale-105'
                          : char
                          ? 'border-neutral-400 bg-white text-neutral-900'
                          : 'border-dashed border-neutral-300 bg-neutral-50 text-neutral-400'
                      }`}
                    />
                    <span
                      className={`text-[9px] font-bold tracking-tight ${
                        idx <= 2
                          ? 'text-sky-700'
                          : idx === 3
                          ? 'text-amber-700'
                          : idx === 4
                          ? 'text-purple-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {expected.label === 'LETRA' ? 'LET' : expected.label === 'NÚMERO' ? 'NÚM' : 'L/N'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full string fallback input */}
          <div>
            <label
              htmlFor="fullPlateInput"
              className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1"
            >
              Ou Digite Tudo de uma Vez
            </label>
            <div className="relative">
              <input
                id="fullPlateInput"
                type="text"
                value={cleanPlate}
                onChange={handleFullStringChange}
                placeholder="Ex: BRA2E19 ou ABC1234"
                maxLength={7}
                autoCapitalize="characters"
                autoComplete="off"
                className="w-full text-center text-xl font-mono font-black tracking-widest uppercase py-2.5 px-4 rounded-xl border-2 border-neutral-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none text-neutral-900 bg-neutral-50 transition"
              />
              {cleanPlate.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPlateChars(['', '', '', '', '', '', ''])}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold px-2 py-1 rounded-md"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Quick toggle helpers for optical ambiguities */}
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <div className="flex items-center gap-1 text-xs font-bold text-neutral-700 mb-2">
              <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />
              <span>Corrigir Caracteres Confusos:</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleSwapCharacter('0', 'O')}
                className="py-1 px-1.5 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition shadow-xs text-center"
              >
                0 ↔ O
              </button>
              <button
                type="button"
                onClick={() => handleSwapCharacter('1', 'I')}
                className="py-1 px-1.5 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition shadow-xs text-center"
              >
                1 ↔ I
              </button>
              <button
                type="button"
                onClick={() => handleSwapCharacter('8', 'B')}
                className="py-1 px-1.5 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition shadow-xs text-center"
              >
                8 ↔ B
              </button>
              <button
                type="button"
                onClick={() => handleSwapCharacter('5', 'S')}
                className="py-1 px-1.5 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition shadow-xs text-center"
              >
                5 ↔ S
              </button>
              <button
                type="button"
                onClick={() => handleSwapCharacter('2', 'Z')}
                className="py-1 px-1.5 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition shadow-xs text-center"
              >
                2 ↔ Z
              </button>
              <button
                type="button"
                onClick={() => handleSwapCharacter('6', 'G')}
                className="py-1 px-1.5 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition shadow-xs text-center"
              >
                6 ↔ G
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
            <span>Confirmar Placa ({cleanPlate || '---'})</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Expanded photo modal */}
      {isPhotoExpanded && (
        <div
          onClick={() => setIsPhotoExpanded(false)}
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md"
        >
          <div className="relative max-w-4xl max-h-[85vh] w-full flex flex-col items-center justify-center">
            {croppedPlateUrl && (
              <div className="mb-4 bg-white p-2 rounded-xl shadow-2xl border-2 border-emerald-500 max-w-sm">
                <p className="text-xs font-bold text-neutral-800 mb-1 text-center">
                  Recorte Óptico em Alta Resolução
                </p>
                <img
                  src={croppedPlateUrl}
                  alt="Recorte Óptico da Placa"
                  className="w-full h-auto object-contain rounded-lg"
                />
              </div>
            )}
            <img
              src={photoDataUrl}
              alt="Veículo ampliado"
              className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-2xl border border-white/20"
            />
            <p className="text-white text-xs font-semibold mt-4 bg-neutral-900/80 border border-neutral-700 px-4 py-2 rounded-full">
              Toque em qualquer lugar para fechar
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
