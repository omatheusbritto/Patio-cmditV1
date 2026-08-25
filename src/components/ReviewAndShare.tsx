import React, { useState } from 'react';
import {
  EntrySubtype,
  FuelLevel,
  LocationCode,
  OperationType,
  VehicleCharacteristic,
  VehicleFleetType,
} from '../types';
import {
  formatPlateForDisplay,
  isMercosulFormat,
  sanitizeRawText,
} from '../utils/plateNormalizer';
import {
  shareToWhatsApp,
  shareSinglePhoto,
  generateWhatsAppMessage,
  ShareResult,
  getLocationMeaning,
  getEntrySubtypeLabel,
} from '../utils/shareService';
import {
  getStoredDriveConfig,
  getCachedGoogleToken,
  appendRecordToGoogleSheets,
  requestGoogleAccessToken,
  DEFAULT_SPREADSHEET_ID,
} from '../utils/googleDriveClient';
import { getCurrentSession } from '../utils/authService';
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
  User,
  Gauge,
  Key,
  Car,
  LogIn,
  LogOut,
  Package,
  ShieldCheck,
  Wrench,
  RotateCcw,
  Ban,
  FileSpreadsheet,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ReviewAndShareProps {
  photoDataUrl: string;
  dashboardPhotoUrl?: string;
  plate: string;
  operationType: OperationType;
  fuel: FuelLevel;
  driverName?: string;
  origin?: string;
  destination?: string;
  km?: string | number;
  hasSpareKey?: boolean;
  fleetType?: VehicleFleetType;
  entrySubtype?: EntrySubtype;
  entryReason?: string;
  liters?: string | number;
  fuelType?: string;
  characteristic?: VehicleCharacteristic | null;
  location?: LocationCode | null;
  onRetakePhoto?: () => void;
  onRetakeDashboardPhoto?: () => void;
  onEditPlate: () => void;
  onEditOperation: () => void;
  onEditDetails?: () => void;
  onEditFuel: () => void;
  onEditLocation?: () => void;
  onEditCharacteristic?: () => void;
  onNewRegistration: () => void;
  onSaveToHistory: (record: {
    photoDataUrl: string;
    dashboardPhotoUrl?: string;
    plate: string;
    operationType: OperationType;
    fuel: FuelLevel;
    driverName?: string;
    origin?: string;
    destination?: string;
    km?: string | number;
    hasSpareKey?: boolean;
    fleetType?: VehicleFleetType;
    entrySubtype?: EntrySubtype;
    entryReason?: string;
    liters?: string | number;
    fuelType?: string;
    characteristic?: VehicleCharacteristic | null;
    location?: LocationCode;
    description: string;
  }) => void;
}

export const ReviewAndShare: React.FC<ReviewAndShareProps> = ({
  photoDataUrl,
  dashboardPhotoUrl,
  plate,
  operationType,
  fuel,
  driverName,
  origin,
  destination,
  km,
  hasSpareKey,
  fleetType,
  entrySubtype,
  entryReason,
  liters,
  fuelType,
  characteristic,
  location,
  onRetakePhoto,
  onRetakeDashboardPhoto,
  onEditPlate,
  onEditOperation,
  onEditDetails,
  onEditFuel,
  onEditLocation,
  onEditCharacteristic,
  onNewRegistration,
  onSaveToHistory,
}) => {
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [shareStatusMsg, setShareStatusMsg] = useState<string | null>(null);
  const [isStatusError, setIsStatusError] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  const cleanPlate = sanitizeRawText(plate) || 'SEM_PLACA';
  const isMercosul = isMercosulFormat(cleanPlate);

  const messageText = generateWhatsAppMessage({
    operationType,
    plate: cleanPlate,
    fuel,
    driverName,
    origin,
    destination,
    km,
    hasSpareKey,
    fleetType,
    entrySubtype,
    entryReason,
    liters,
    fuelType,
    location: location || undefined,
    characteristic,
  });

  const [sheetSyncStatus, setSheetSyncStatus] = useState<string | null>(null);

  // Handle WhatsApp Share with double-click lock & status messages
  const handleShare = async () => {
    if (isSharing) return;

    setIsSharing(true);
    setIsStatusError(false);
    setShareStatusMsg('Preparando compartilhamento...');

    // Save to local history immediately
    onSaveToHistory({
      photoDataUrl,
      dashboardPhotoUrl,
      plate: cleanPlate,
      operationType,
      fuel,
      driverName,
      origin,
      destination,
      km,
      hasSpareKey,
      fleetType,
      entrySubtype,
      entryReason,
      liters,
      fuelType,
      characteristic,
      location: location || (operationType === 'pdc' ? 'PDC' : 'P1'),
      description: messageText,
    });

    // Auto-record to Google Sheets (Universal Webhook + Server sync, ZERO Google Login required!)
    const driveConfig = getStoredDriveConfig();
    const session = getCurrentSession();
    const isMaster = session?.user.role === 'master' || session?.user.username.toLowerCase() === 'mastercmdit';
    const operatorName = session ? `${session.user.name} (${session.user.username})` : 'Operador';
    const targetSpreadsheetId = driveConfig.spreadsheetId || DEFAULT_SPREADSHEET_ID;

    const recordPayload = {
      plate: cleanPlate,
      operationType,
      fuel,
      operatorName,
      driverName,
      origin,
      destination,
      km,
      hasSpareKey,
      fleetType,
      entrySubtype,
      entryReason,
      liters,
      fuelType,
      characteristic,
      location: location || undefined,
    };

    setSheetSyncStatus('Registrando movimentação...');
    appendRecordToGoogleSheets(targetSpreadsheetId, recordPayload, getCachedGoogleToken() || undefined)
      .then((res) => {
        if (res.method === 'webhook' || res.method === 'sheets_api') {
          setSheetSyncStatus(`✅ Gravado na planilha (${res.tabName})`);
        } else {
          setSheetSyncStatus('✅ Registrado com sucesso no sistema');
        }
      })
      .catch((err) => {
        console.warn('Sheets sync info:', err);
        setSheetSyncStatus('✅ Registrado localmente');
      });

    try {
      await new Promise((r) => setTimeout(r, 200));

      const result: ShareResult = await shareToWhatsApp({
        photoDataUrl,
        dashboardPhotoDataUrl: dashboardPhotoUrl,
        description: messageText,
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
      await navigator.clipboard.writeText(messageText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch (err) {
      console.warn('Clipboard error:', err);
    }
  };

  // Download image helper
  const handleDownloadPhoto = () => {
    const timestamp = Date.now();
    const link1 = document.createElement('a');
    link1.href = photoDataUrl;
    link1.download = dashboardPhotoUrl
      ? `1_placa_${cleanPlate}_${timestamp}.jpg`
      : `registro_${cleanPlate}_${timestamp}.jpg`;
    document.body.appendChild(link1);
    link1.click();
    document.body.removeChild(link1);

    if (dashboardPhotoUrl) {
      setTimeout(() => {
        const link2 = document.createElement('a');
        link2.href = dashboardPhotoUrl;
        link2.download = `2_painel_${cleanPlate}_${timestamp}.jpg`;
        document.body.appendChild(link2);
        link2.click();
        document.body.removeChild(link2);
      }, 300);
    }
  };

  const getOperationBadge = () => {
    switch (operationType) {
      case 'entrada':
        return {
          label: '🟢 ENTRADA',
          color: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          icon: LogIn,
        };
      case 'saida':
        return {
          label: '🔴 SAÍDA',
          color: 'bg-rose-100 text-rose-900 border-rose-300',
          icon: LogOut,
        };
      case 'abastecimento':
        return {
          label: '⛽ ABASTECIMENTO',
          color: 'bg-cyan-100 text-cyan-900 border-cyan-300',
          icon: Fuel,
        };
      case 'pdc':
        return {
          label: 'FILA PDC',
          color: 'bg-amber-100 text-amber-900 border-amber-300',
          icon: Wrench,
        };
      case 'qualidade_51':
        return {
          label: '🔍 51 (QUALIDADE)',
          color: 'bg-indigo-100 text-indigo-900 border-indigo-300',
          icon: ShieldCheck,
        };
      default:
        return {
          label: '🚗 VEÍCULO',
          color: 'bg-neutral-100 text-neutral-900 border-neutral-300',
          icon: Car,
        };
    }
  };

  const opBadge = getOperationBadge();
  const OpIcon = opBadge.icon;

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full pb-16">
      {/* Top Completion Header */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 text-center flex flex-col items-center gap-1.5">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1 shadow-sm">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-neutral-900 leading-tight">
          Registro Concluído
        </h2>
        <p className="text-xs text-neutral-500 max-w-xs">
          Revise os dados abaixo e envie o relatório fotográfico no WhatsApp
        </p>
      </div>

      {/* Main Review Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        {/* Photo Container - Supports Single Photo or Dual Photo (Plate + Dashboard) */}
        {dashboardPhotoUrl ? (
          <div className="p-3 bg-neutral-950 flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" />
                2 Fotos Registradas
              </span>
              <div className="bg-white/95 backdrop-blur-sm px-2.5 py-0.5 rounded-lg border border-neutral-300 flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-neutral-500 uppercase">Placa:</span>
                <span className="font-mono text-xs font-black text-neutral-900">
                  {formatPlateForDisplay(cleanPlate)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Photo 1: Plate */}
              <div className="relative aspect-video rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900 group">
                <img
                  src={photoDataUrl}
                  alt="Placa"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded">
                  1. Placa
                </span>
                {onRetakePhoto && (
                  <button
                    type="button"
                    onClick={onRetakePhoto}
                    className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded hover:bg-black/90 text-[10px] flex items-center gap-0.5"
                    title="Refazer foto da placa"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Photo 2: Dashboard */}
              <div className="relative aspect-video rounded-xl overflow-hidden border border-cyan-800/80 bg-neutral-900 group">
                <img
                  src={dashboardPhotoUrl}
                  alt="Painel"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-cyan-950/90 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">
                  2. Painel
                </span>
                {onRetakeDashboardPhoto && (
                  <button
                    type="button"
                    onClick={onRetakeDashboardPhoto}
                    className="absolute top-1 right-1 p-1 bg-cyan-950/80 text-cyan-300 rounded hover:bg-cyan-900 text-[10px] flex items-center gap-0.5"
                    title="Refazer foto do painel"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full aspect-video bg-neutral-950 flex items-center justify-center overflow-hidden">
            {photoDataUrl ? (
              <img
                src={photoDataUrl}
                alt="Veículo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-neutral-500 text-xs">Sem foto capturada</div>
            )}

            {/* Operation Badge Floating */}
            <div className="absolute top-3 left-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md border ${opBadge.color}`}
              >
                <OpIcon className="w-3.5 h-3.5" />
                {opBadge.label}
              </span>
            </div>

            {/* Floating Plate Display */}
            <div className="absolute bottom-3 left-3">
              <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-neutral-300 shadow-lg flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase">
                  Placa
                </span>
                <span className="font-mono text-base font-black text-neutral-900 tracking-wider">
                  {formatPlateForDisplay(cleanPlate)}
                </span>
              </div>
            </div>

            {/* Edit photo button */}
            <button
              type="button"
              onClick={onRetakePhoto}
              className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm transition text-xs flex items-center gap-1.5"
              title="Refazer foto"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">Refazer</span>
            </button>
          </div>
        )}

        {/* Dynamic Fields List based on Operation */}
        <div className="p-4 flex flex-col gap-2.5">
          {/* Operation Switcher Row */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 border border-neutral-200">
            <div className="flex items-center gap-2">
              <OpIcon className="w-4 h-4 text-neutral-700" />
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Operação
                </span>
                <span className="text-xs font-black text-neutral-900">
                  {opBadge.label}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onEditOperation}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-emerald-50"
            >
              <Edit2 className="w-3 h-3" />
              Alterar
            </button>
          </div>

          {/* If ABASTECIMENTO */}
          {operationType === 'abastecimento' && (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-cyan-50/70 border border-cyan-200">
              <div className="flex items-center justify-between pb-1.5 border-b border-cyan-200/60">
                <span className="text-[10px] font-bold text-cyan-900 uppercase flex items-center gap-1">
                  <Fuel className="w-3.5 h-3.5 text-cyan-700" />
                  Detalhes do Abastecimento
                </span>
                {onEditDetails && (
                  <button
                    type="button"
                    onClick={onEditDetails}
                    className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    Editar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-neutral-500 block">Odômetro:</span>
                  <span className="font-mono font-black text-neutral-900 text-sm">
                    {km ? `${km} km` : 'Não informado'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-500 block">Nível do combustível:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {fuel}
                  </span>
                </div>

                {destination && (
                  <div>
                    <span className="text-[10px] text-neutral-500 block">Destino (Opcional):</span>
                    <span className="font-bold text-neutral-900">{destination}</span>
                  </div>
                )}

                {driverName && (
                  <div>
                    <span className="text-[10px] text-neutral-500 block">Condutor (Opcional):</span>
                    <span className="font-bold text-neutral-900">{driverName}</span>
                  </div>
                )}

                {liters && (
                  <div>
                    <span className="text-[10px] text-neutral-500 block">Litros:</span>
                    <span className="font-bold text-neutral-900">
                      {liters} L
                    </span>
                  </div>
                )}

                {fuelType && (
                  <div>
                    <span className="text-[10px] text-neutral-500 block">Tipo de Combustível:</span>
                    <span className="font-bold text-neutral-900">
                      {fuelType}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* If ENTRADA or SAIDA */}
          {(operationType === 'entrada' || operationType === 'saida') && (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200">
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200/60">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">
                  Detalhes do Transporte
                </span>
                {onEditDetails && (
                  <button
                    type="button"
                    onClick={onEditDetails}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    Editar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-neutral-500 block">Condutor:</span>
                  <span className="font-bold text-neutral-900 font-sans">
                    {driverName || 'Não informado'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-500 block">
                    {operationType === 'entrada' ? 'Origem:' : 'Destino:'}
                  </span>
                  <span className="font-bold text-neutral-900 font-sans">
                    {(operationType === 'entrada' ? origin : destination) || 'Não informado'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-500 block">Quilometragem:</span>
                  <span className="font-mono font-bold text-neutral-900">
                    {km ? `${km} km` : 'Não informada'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-500 block">Chave Reserva:</span>
                  <span
                    className={`font-black ${
                      hasSpareKey === true
                        ? 'text-emerald-700'
                        : hasSpareKey === false
                        ? 'text-neutral-700'
                        : 'text-neutral-400'
                    }`}
                  >
                    {hasSpareKey === true
                      ? '✅ SIM'
                      : hasSpareKey === false
                      ? '❌ NÃO'
                      : 'Não informada'}
                  </span>
                </div>

                <div className="col-span-2 pt-1 border-t border-neutral-200/60 flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500">Tipo de Veículo:</span>
                  {fleetType ? (
                    <span className="font-black px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-[11px]">
                      {fleetType}
                    </span>
                  ) : (
                    <span className="text-neutral-400 font-medium text-[11px]">
                      Não informado
                    </span>
                  )}
                </div>

                {operationType === 'entrada' && entrySubtype && (
                  <div className="col-span-2 pt-1 border-t border-neutral-200/60 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500">Local:</span>
                      <span
                        className={`font-black px-2 py-0.5 rounded text-[11px] ${
                          entrySubtype === 'bolsao_40'
                            ? 'bg-emerald-100 text-emerald-800'
                            : entrySubtype === 'remocao_adesivos'
                            ? 'bg-blue-100 text-blue-800'
                            : entrySubtype === 'retorno'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {getEntrySubtypeLabel(entrySubtype)}
                      </span>
                    </div>
                    {entryReason && (
                      <div className="text-[11px] text-neutral-700 bg-neutral-100 p-1.5 rounded-lg mt-0.5">
                        <span className="font-bold text-neutral-500 text-[10px] block">Motivo:</span>
                        {entryReason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* If 51 (QUALIDADE) */}
          {operationType === 'qualidade_51' && (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-indigo-50/60 border border-indigo-200">
              <div className="flex items-center justify-between pb-1.5 border-b border-indigo-200/60">
                <span className="text-[10px] font-bold text-indigo-800 uppercase">
                  Local & Característica (51 Qualidade)
                </span>
                {onEditLocation && (
                  <button
                    type="button"
                    onClick={onEditLocation}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    Editar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-neutral-500 block">Localização:</span>
                  <span className="font-black text-indigo-950 font-mono text-sm">
                    {getLocationMeaning(location || undefined) || 'P1 (Poste 1)'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-500 block">Característica:</span>
                  <span className="font-bold text-neutral-900">
                    {characteristic || 'Sem característica'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* If FILA PDC */}
          {operationType === 'pdc' && (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200">
              <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/60">
                <span className="text-[10px] font-bold text-amber-900 uppercase flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5 text-amber-700" />
                  Detalhes da Fila PDC
                </span>
                {onEditOperation && (
                  <button
                    type="button"
                    onClick={onEditOperation}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    Editar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-neutral-500 block">Status:</span>
                  <span className="font-bold text-amber-950">
                    Em Fila PDC (Lavagem / Oficina)
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-500 block">Setor:</span>
                  <span className="font-black text-amber-900 font-mono">
                    PDC (Pátio Desembarque)
                  </span>
                </div>

                {km && (
                  <div>
                    <span className="text-[10px] text-neutral-500 block">KM:</span>
                    <span className="font-mono font-bold text-neutral-900">{km} km</span>
                  </div>
                )}

                {driverName && (
                  <div>
                    <span className="text-[10px] text-neutral-500 block">Responsável/Condutor:</span>
                    <span className="font-bold text-neutral-900">{driverName}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Combustível Row (Present in all operations) */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 border border-neutral-200">
            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-emerald-700" />
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Nível de Combustível
                </span>
                <span className="text-sm font-mono font-black text-neutral-900">
                  {fuel} do Tanque
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onEditFuel}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-emerald-50"
            >
              <Edit2 className="w-3 h-3" />
              Alterar
            </button>
          </div>

          {/* Timestamp Row with Seconds */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-100/80 border border-neutral-200 text-xs text-neutral-600">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-[10px] font-bold uppercase text-neutral-500">Horário Oficial do Registro:</span>
            </div>
            <span className="font-mono font-bold text-[11px] text-neutral-800">
              {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        {/* WhatsApp Preview Text Box */}
        <div className="p-4 pt-0">
          <div className="bg-emerald-950 text-emerald-100 rounded-xl p-3 text-xs font-mono whitespace-pre-wrap relative border border-emerald-800 shadow-inner">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-emerald-800 text-[10px] text-emerald-300 uppercase tracking-wider font-bold">
              <span>Texto Formatado WhatsApp</span>
              <button
                type="button"
                onClick={handleCopyText}
                className="flex items-center gap-1 hover:text-white transition"
              >
                <Copy className="w-3 h-3" />
                {copiedText ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            {messageText}
          </div>
        </div>
      </div>

      {/* Share Actions Container */}
      <div className="flex flex-col gap-2.5 pt-1">
        {/* Main WhatsApp Share Button */}
        <button
          type="button"
          disabled={isSharing}
          onClick={handleShare}
          className={`w-full py-4 px-6 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition shadow-xl ${
            isSharing
              ? 'bg-emerald-800 text-white/80 cursor-wait'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-98 cursor-pointer'
          }`}
        >
          <Share2 className={`w-5 h-5 ${isSharing ? 'animate-spin' : ''}`} />
          <span>
            {isSharing
              ? 'Preparando Envio...'
              : dashboardPhotoUrl
              ? 'Compartilhar no WhatsApp (Placa + Painel)'
              : 'Compartilhar no WhatsApp'}
          </span>
        </button>

        {/* Status Message Notification */}
        {shareStatusMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${
              isStatusError
                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            {isStatusError ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0" />
            )}
            <span>{shareStatusMsg}</span>
          </div>
        )}

        {/* Google Sheets Sync Indicator */}
        {sheetSyncStatus && (
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-medium flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{sheetSyncStatus}</span>
          </div>
        )}

        {/* If dual photo, offer individual photo share buttons as well */}
        {dashboardPhotoUrl && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-cyan-50/80 border border-cyan-200">
            <span className="text-[10px] font-bold text-cyan-900 uppercase shrink-0">
              Avulsos:
            </span>
            <button
              type="button"
              onClick={() =>
                shareSinglePhoto(
                  photoDataUrl,
                  cleanPlate,
                  'placa',
                  `*Foto 1 (Placa):* ${formatPlateForDisplay(cleanPlate)}`
                )
              }
              className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-cyan-300 hover:bg-cyan-100 text-cyan-950 font-bold text-[11px] flex items-center justify-center gap-1 shadow-2xs active:scale-98 transition"
            >
              <Camera className="w-3 h-3 text-cyan-700" />
              <span>Só Placa</span>
            </button>
            <button
              type="button"
              onClick={() =>
                shareSinglePhoto(
                  dashboardPhotoUrl,
                  cleanPlate,
                  'painel',
                  `*Foto 2 (Painel/KM):* ${formatPlateForDisplay(cleanPlate)}`
                )
              }
              className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-cyan-300 hover:bg-cyan-100 text-cyan-950 font-bold text-[11px] flex items-center justify-center gap-1 shadow-2xs active:scale-98 transition"
            >
              <Gauge className="w-3 h-3 text-cyan-700" />
              <span>Só Painel</span>
            </button>
          </div>
        )}

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleDownloadPhoto}
            className="py-3 px-3 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-98 transition"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>{dashboardPhotoUrl ? 'Salvar as 2 Fotos' : 'Salvar Foto'}</span>
          </button>

          <button
            type="button"
            onClick={onNewRegistration}
            className="py-3 px-3 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-98 transition"
          >
            <PlusCircle className="w-4 h-4 text-emerald-700" />
            <span>Novo Registro</span>
          </button>
        </div>
      </div>
    </div>
  );
};
