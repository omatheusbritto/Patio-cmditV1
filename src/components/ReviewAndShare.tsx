import React, { useState } from 'react';
import { FuelLevel, LocationCode, VehicleCharacteristic } from '../types';
import {
  generateRecordDescription,
  formatPlateForDisplay,
  isMercosulFormat,
  sanitizeRawText,
} from '../utils/plateNormalizer';
import { shareToWhatsApp, ShareResult } from '../utils/shareService';
import {
  Camera,
  CheckCircle2,
  Copy,
  Fuel,
  MapPin,
  Tag,
  Share2,
  Sparkles,
  Edit2,
  Download,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ReviewAndShareProps {
  photoDataUrl: string;
  plate: string;
  fuel: FuelLevel;
  characteristic: VehicleCharacteristic | null;
  location: LocationCode;
  onEditPlate: () => void;
  onRetakePhoto: () => void;
  onEditFuel: () => void;
  onEditCharacteristic: () => void;
  onEditLocation: () => void;
  onNewRegistration: () => void;
  onSaveToHistory: (record: {
    photoDataUrl: string;
    plate: string;
    fuel: FuelLevel;
    characteristic: VehicleCharacteristic | null;
    location: LocationCode;
    description: string;
  }) => void;
}

export const ReviewAndShare: React.FC<ReviewAndShareProps> = ({
  photoDataUrl,
  plate,
  fuel,
  characteristic,
  location,
  onEditPlate,
  onRetakePhoto,
  onEditFuel,
  onEditCharacteristic,
  onEditLocation,
  onNewRegistration,
  onSaveToHistory,
}) => {
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [shareStatusMsg, setShareStatusMsg] = useState<string | null>(null);
  const [isStatusError, setIsStatusError] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  const cleanPlate = sanitizeRawText(plate) || 'SEM_PLACA';
  const isMercosul = isMercosulFormat(cleanPlate);

  const description = generateRecordDescription({
    plate: cleanPlate,
    fuel,
    characteristic,
    location,
  });

  // Handle WhatsApp Share with double-click lock & status messages
  const handleShare = async () => {
    if (isSharing) return; // Prevent double tap

    setIsSharing(true);
    setIsStatusError(false);
    setShareStatusMsg('Preparando compartilhamento...');

    // Save to local history immediately
    onSaveToHistory({
      photoDataUrl,
      plate: cleanPlate,
      fuel,
      characteristic,
      location,
      description,
    });

    try {
      // Small visual pause for smooth transition
      await new Promise((r) => setTimeout(r, 200));

      const result: ShareResult = await shareToWhatsApp({
        photoDataUrl,
        description,
        plate: cleanPlate,
      });

      if (result.success) {
        setShareStatusMsg(result.message || 'Compartilhamento preparado!');
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      } else {
        setIsStatusError(true);
        setShareStatusMsg(result.message || 'Compartilhamento não concluído.');
      }
    } catch (err) {
      console.warn('Share error:', err);
      setIsStatusError(true);
      setShareStatusMsg('Compartilhamento não concluído.');
    } finally {
      setIsSharing(false);
    }
  };

  // Copy text helper
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(description);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch (err) {
      console.warn('Clipboard error:', err);
    }
  };

  // Download image helper
  const handleDownloadPhoto = () => {
    const link = document.createElement('a');
    link.href = photoDataUrl;
    link.download = `registro_${cleanPlate}_${Date.now()}.jpg`;
    link.click();
  };

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full pb-12">
      {/* Title card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            Etapa 5 • Revisão Final
          </span>
          <h2 className="text-lg font-black text-neutral-900 mt-1 leading-tight">
            Conferir e Compartilhar
          </h2>
        </div>

        <button
          onClick={onRetakePhoto}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 active:scale-95 flex items-center gap-1"
        >
          <Camera className="w-3.5 h-3.5" />
          Refazer Foto
        </button>
      </div>

      {/* Vehicle Photo Card */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-neutral-200 flex flex-col gap-2">
        <div className="relative rounded-xl overflow-hidden bg-neutral-950 aspect-video flex items-center justify-center">
          <img
            src={photoDataUrl}
            alt="Foto do veículo"
            className="w-full h-full object-cover"
          />
          <button
            onClick={handleDownloadPhoto}
            title="Baixar imagem original"
            className="absolute bottom-2 right-2 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm active:scale-90 transition text-xs flex items-center gap-1 font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Salvar Foto
          </button>
        </div>
      </div>

      {/* Review Details Table / Grid */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
          Dados do Registro
        </h3>

        {/* Plate Item */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              PL
            </div>
            <div>
              <span className="text-[11px] text-neutral-500 font-medium block leading-none">
                Placa Identificada
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xl font-black text-neutral-900 tracking-wider">
                  {formatPlateForDisplay(cleanPlate)}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/60 text-emerald-900">
                  {isMercosul ? 'Mercosul' : 'Antiga'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onEditPlate}
            className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-100 active:scale-95"
            title="Editar Placa"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        {/* Fuel & Location Row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Fuel */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200">
            <div className="flex items-center gap-2">
              <Fuel className="w-5 h-5 text-emerald-600" />
              <div>
                <span className="text-[10px] text-neutral-500 font-medium block leading-none">
                  Combustível
                </span>
                <span className="font-mono text-base font-black text-neutral-900 mt-0.5 block">
                  {fuel}
                </span>
              </div>
            </div>
            <button
              onClick={onEditFuel}
              className="p-1.5 text-neutral-500 hover:text-emerald-700"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Location */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <div>
                <span className="text-[10px] text-neutral-500 font-medium block leading-none">
                  Local
                </span>
                <span className="font-mono text-base font-black text-neutral-900 mt-0.5 block">
                  {location}
                </span>
              </div>
            </div>
            <button
              onClick={onEditLocation}
              className="p-1.5 text-neutral-500 hover:text-emerald-700"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Characteristic Item */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200">
          <div className="flex items-center gap-2.5">
            <Tag className="w-5 h-5 text-emerald-600" />
            <div>
              <span className="text-[10px] text-neutral-500 font-medium block leading-none">
                Característica
              </span>
              <span className="text-sm font-bold text-neutral-900 mt-0.5 block">
                {characteristic || (
                  <span className="text-neutral-400 font-normal italic">
                    Não informada (em branco)
                  </span>
                )}
              </span>
            </div>
          </div>
          <button
            onClick={onEditCharacteristic}
            className="p-1.5 text-neutral-500 hover:text-emerald-700"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Generated Text Description Box */}
      <div className="bg-emerald-950 text-white rounded-2xl p-4 shadow-sm border border-emerald-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Legenda / Descrição Gerada
          </span>
          <button
            onClick={handleCopyText}
            className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-900 hover:bg-emerald-800 text-emerald-200 flex items-center gap-1 active:scale-95 transition"
          >
            {copiedText ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Copiado!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copiar Texto
              </>
            )}
          </button>
        </div>

        <div className="p-3 bg-black/40 rounded-xl font-mono text-sm leading-relaxed border border-emerald-800/60 break-all select-all text-emerald-100">
          {description}
        </div>
        <span className="text-[10px] text-emerald-400/80">
          * A foto original é enviada separadamente e o texto acima é inserido como legenda no WhatsApp.
        </span>
      </div>

      {/* Status Feedback Message */}
      {shareStatusMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold animate-fade-in ${
            isStatusError
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          {isStatusError ? (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          )}
          <span>{shareStatusMsg}</span>
        </div>
      )}

      {/* Main WhatsApp Share Button */}
      <div className="flex flex-col gap-2.5 pt-1">
        <button
          type="button"
          disabled={isSharing}
          onClick={handleShare}
          className={`w-full py-4 px-6 rounded-2xl font-black text-base flex items-center justify-center gap-3 shadow-xl transition active:scale-98 ${
            isSharing
              ? 'bg-emerald-700 text-emerald-200 cursor-wait opacity-90'
              : 'bg-[#25D366] hover:bg-[#20bd5a] text-neutral-950 shadow-[#25D366]/30'
          }`}
        >
          {isSharing ? (
            <>
              <div className="w-5 h-5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
              <span>Preparando compartilhamento...</span>
            </>
          ) : (
            <>
              <Share2 className="w-5 h-5 text-neutral-950" />
              <span>Compartilhar no WhatsApp</span>
            </>
          )}
        </button>

        {/* New Registration Button */}
        <button
          type="button"
          onClick={onNewRegistration}
          className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-800 font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition shadow-sm"
        >
          <PlusCircle className="w-4 h-4 text-emerald-700" />
          Novo Registro de Veículo
        </button>
      </div>
    </div>
  );
};
