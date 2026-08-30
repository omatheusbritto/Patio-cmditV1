import React, { useState, useRef } from 'react';
import { EntrySubtype, OperationType, VehicleFleetType } from '../types';
import {
  User,
  MapPin,
  Gauge,
  Key,
  Car,
  ArrowRight,
  ArrowLeft,
  Check,
  Building,
  Plane,
  Wrench,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Ban,
  Package,
  Edit2,
  FileText,
  Camera,
  Image as ImageIcon,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import { QuickPlateEditModal } from './QuickPlateEditModal';
import { formatPlateForDisplay } from '../utils/plateNormalizer';
import { stampDateTimeOnCanvas, stampDateTimeOnDataUrl } from '../utils/imageOptimizer';

interface OperationDetailsFormProps {
  operationType: 'entrada' | 'saida';
  initialDriverName?: string;
  initialOrigin?: string;
  initialDestination?: string;
  initialKm?: string | number;
  initialHasSpareKey?: boolean;
  initialFleetType?: VehicleFleetType;
  initialEntrySubtype?: EntrySubtype;
  initialEntryReason?: string;
  initialDocumentPhotoUrl?: string;
  plate: string;
  onUpdatePlate?: (newPlate: string) => void;
  onSubmit: (details: {
    driverName: string;
    origin?: string;
    destination?: string;
    km: string;
    hasSpareKey?: boolean;
    fleetType?: VehicleFleetType;
    entrySubtype?: EntrySubtype;
    entryReason?: string;
    documentPhotoUrl?: string;
  }) => void;
  onBack: () => void;
}

const QUICK_REASONS_RETORNO = [
  'AVARIA / BATIDA',
  'PROBLEMA MECÂNICO',
  'HIGIENIZAÇÃO INCOMPLETA',
  'CLIENTE DESISTIU',
  'DOCUMENTAÇÃO',
  'TROCA DE FROTA',
];

const QUICK_REASONS_RECUSA = [
  'AVARIA NÃO CONFORMADA',
  'LUZ DE INJEÇÃO ACESA',
  'PNEU DANIFICADO',
  'MAU CHEIRO / SUJEIRA',
  'VEÍCULO DIVERGENTE',
  'FALTA DE OPCIONAIS',
];

type EntradaDestOption = 'bolsao_40' | 'remocao_adesivos' | 'outros';

export const OperationDetailsForm: React.FC<OperationDetailsFormProps> = ({
  operationType,
  initialDriverName = '',
  initialOrigin = '',
  initialDestination = '',
  initialKm = '',
  initialHasSpareKey,
  initialFleetType,
  initialEntrySubtype,
  initialEntryReason = '',
  initialDocumentPhotoUrl = '',
  plate,
  onUpdatePlate,
  onSubmit,
  onBack,
}) => {
  const isEntrada = operationType === 'entrada';

  const [driverName, setDriverName] = useState<string>(initialDriverName);
  const [origin, setOrigin] = useState<string>(initialOrigin);
  const [destination, setDestination] = useState<string>(initialDestination);

  // Document photo state (optional)
  const [documentPhotoUrl, setDocumentPhotoUrl] = useState<string>(initialDocumentPhotoUrl);
  const [isProcessingDocPhoto, setIsProcessingDocPhoto] = useState<boolean>(false);
  const docCameraInputRef = useRef<HTMLInputElement | null>(null);
  const docGalleryInputRef = useRef<HTMLInputElement | null>(null);

  // Entrada specific destination option: 'bolsao_40' | 'remocao_adesivos' | 'outros'
  const determineInitialDestOption = (): EntradaDestOption | undefined => {
    if (!isEntrada) return undefined;
    const destUpper = (initialDestination || '').toUpperCase().trim();
    if (initialEntrySubtype === 'bolsao_40' || destUpper.includes('BOLSÃO 40') || destUpper.includes('BOLSAO 40')) {
      return 'bolsao_40';
    }
    if (initialEntrySubtype === 'remocao_adesivos' || destUpper.includes('REMOÇÃO DE ADESIVO') || destUpper.includes('REMOCAO')) {
      return 'remocao_adesivos';
    }
    if (initialDestination) {
      return 'outros';
    }
    return undefined;
  };

  const [entradaDestOption, setEntradaDestOption] = useState<EntradaDestOption | undefined>(
    determineInitialDestOption
  );
  const [customDestination, setCustomDestination] = useState<string>(
    initialDestination &&
      !['BOLSÃO 40', 'BOLSAO 40', 'REMOÇÃO DE ADESIVO', 'REMOÇÃO DE ADESIVOS', 'REMOCAO DE ADESIVO'].includes(
        initialDestination.toUpperCase().trim()
      )
      ? initialDestination
      : ''
  );

  const [km, setKm] = useState<string>(initialKm ? String(initialKm) : '');
  const [hasSpareKey, setHasSpareKey] = useState<boolean | undefined>(
    isEntrada ? initialHasSpareKey : (initialHasSpareKey ?? true)
  );

  // Fleet Type: GF | RAC | OUTROS
  const determineInitialFleetType = (): VehicleFleetType | undefined => {
    if (!initialFleetType) return undefined;
    const upper = initialFleetType.toUpperCase().trim();
    if (['GF', 'RAC'].includes(upper)) return upper as VehicleFleetType;
    return 'OUTROS';
  };

  const [fleetType, setFleetType] = useState<VehicleFleetType | undefined>(determineInitialFleetType);
  const [customFleetType, setCustomFleetType] = useState<string>(
    initialFleetType && !['GF', 'RAC'].includes(initialFleetType.toUpperCase().trim())
      ? initialFleetType
      : ''
  );

  const [entrySubtype, setEntrySubtype] = useState<EntrySubtype | undefined>(initialEntrySubtype);
  const [entryReason, setEntryReason] = useState<string>(initialEntryReason);
  const [isEditPlateOpen, setIsEditPlateOpen] = useState<boolean>(false);

  const handleFileSelected = async (file: File) => {
    if (!file) return;
    setIsProcessingDocPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawDataUrl = e.target?.result as string;
        if (rawDataUrl) {
          try {
            const stamped = await stampDateTimeOnDataUrl(rawDataUrl);
            setDocumentPhotoUrl(stamped);
          } catch {
            setDocumentPhotoUrl(rawDataUrl);
          }
        }
        setIsProcessingDocPhoto(false);
      };
      reader.onerror = () => setIsProcessingDocPhoto(false);
      reader.readAsDataURL(file);
    } catch {
      setIsProcessingDocPhoto(false);
    }
  };

  const handleSelectEntradaDest = (option: EntradaDestOption) => {
    if (entradaDestOption === option) {
      setEntradaDestOption(undefined);
      setCustomDestination('');
      setEntrySubtype(undefined);
    } else {
      setEntradaDestOption(option);
      if (option === 'bolsao_40') {
        setEntrySubtype('bolsao_40');
      } else if (option === 'remocao_adesivos') {
        setEntrySubtype('remocao_adesivos');
      } else {
        if (entrySubtype === 'bolsao_40' || entrySubtype === 'remocao_adesivos') {
          setEntrySubtype(undefined);
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalFleetType =
      fleetType === 'OUTROS'
        ? (customFleetType.trim().toUpperCase() || 'OUTROS')
        : fleetType;

    let finalDestination: string | undefined = undefined;
    let finalEntrySubtype: EntrySubtype | undefined = entrySubtype;

    if (isEntrada) {
      if (entradaDestOption === 'bolsao_40') {
        finalDestination = 'BOLSÃO 40';
        finalEntrySubtype = 'bolsao_40';
      } else if (entradaDestOption === 'remocao_adesivos') {
        finalDestination = 'REMOÇÃO DE ADESIVO';
        finalEntrySubtype = 'remocao_adesivos';
      } else if (entradaDestOption === 'outros') {
        finalDestination = customDestination.trim().toUpperCase() || 'OUTROS';
        if (finalEntrySubtype === 'bolsao_40' || finalEntrySubtype === 'remocao_adesivos') {
          finalEntrySubtype = undefined;
        }
      } else if (destination.trim()) {
        finalDestination = destination.trim().toUpperCase();
      }
    } else {
      finalDestination = destination.trim().toUpperCase() || undefined;
    }

    onSubmit({
      driverName: driverName.trim().toUpperCase(),
      origin: isEntrada ? (origin.trim().toUpperCase() || undefined) : undefined,
      destination: finalDestination,
      km: km.trim().toUpperCase(),
      hasSpareKey,
      fleetType: finalFleetType ? finalFleetType.toUpperCase() : undefined,
      entrySubtype: isEntrada ? finalEntrySubtype : undefined,
      entryReason: isEntrada && (finalEntrySubtype === 'retorno' || finalEntrySubtype === 'recusa') ? entryReason.trim().toUpperCase() : undefined,
      documentPhotoUrl: documentPhotoUrl || undefined,
    });
  };

  const handleToggleSpareKey = (val: boolean) => {
    if (isEntrada && hasSpareKey === val) {
      setHasSpareKey(undefined);
    } else {
      setHasSpareKey(val);
    }
  };

  const handleToggleFleetType = (type: 'GF' | 'RAC' | 'OUTROS') => {
    if (fleetType === type) {
      setFleetType(undefined);
      setCustomFleetType('');
    } else {
      setFleetType(type);
      if (type !== 'OUTROS') {
        setCustomFleetType('');
      }
    }
  };

  const handleToggleEntrySubtype = (subtype: EntrySubtype) => {
    if (entrySubtype === subtype) {
      setEntrySubtype(undefined);
      setEntryReason('');
    } else {
      setEntrySubtype(subtype);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 max-w-md mx-auto w-full pb-10">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200">
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              isEntrada
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}
          >
            {isEntrada ? '🟢 Registro de Entrada' : '🔴 Registro de Saída'}
          </span>
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
          {isEntrada ? 'Dados de Entrada' : 'Dados de Saída'}
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Preencha as informações do condutor, odômetro e veículo
        </p>
      </div>

      {/* Condutor Input */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-2">
        <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
          <User className="w-4 h-4 text-emerald-700" />
          Nome do Condutor / Motorista
        </label>
        <input
          type="text"
          value={driverName}
          onChange={(e) => setDriverName(e.target.value.toUpperCase())}
          placeholder="Ex: CARLOS EDUARDO / JOÃO SILVA"
          className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 text-sm font-semibold uppercase placeholder:normal-case transition outline-none"
        />
      </div>

      {/* Origem do Veículo (para Entrada) */}
      {isEntrada && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-700" />
              Origem do Veículo
            </label>
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
              Opcional
            </span>
          </div>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value.toUpperCase())}
            placeholder="Ex: PÁTIO PRINCIPAL, CLIENTE, BASE..."
            className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 text-sm font-semibold uppercase placeholder:normal-case transition outline-none"
          />
        </div>
      )}

      {/* DESTINO DO VEÍCULO NA ENTRADA (Bolsão 40 / Remoção de Adesivo / Outros) */}
      {isEntrada ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-700" />
              <span>Destino do Veículo</span>
            </label>
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
              Selecione
            </span>
          </div>

          {/* 3 Opções Rápidas de Destino: Bolsão 40 | Remoção de Adesivo | Outros */}
          <div className="grid grid-cols-3 gap-2">
            {/* Bolsão 40 */}
            <button
              type="button"
              onClick={() => handleSelectEntradaDest('bolsao_40')}
              className={`p-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex flex-col items-center justify-center gap-1 border text-center cursor-pointer ${
                entradaDestOption === 'bolsao_40'
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-1">
                {entradaDestOption === 'bolsao_40' && <Check className="w-3.5 h-3.5" />}
                <span className="leading-tight">Bolsão 40</span>
              </div>
              <span className={`text-[9px] font-normal leading-tight ${entradaDestOption === 'bolsao_40' ? 'text-emerald-100' : 'text-neutral-400'}`}>
                Triagem
              </span>
            </button>

            {/* Remoção de Adesivo */}
            <button
              type="button"
              onClick={() => handleSelectEntradaDest('remocao_adesivos')}
              className={`p-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex flex-col items-center justify-center gap-1 border text-center cursor-pointer ${
                entradaDestOption === 'remocao_adesivos'
                  ? 'bg-blue-700 text-white border-blue-800 shadow-sm ring-2 ring-blue-500/20'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-1">
                {entradaDestOption === 'remocao_adesivos' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Sparkles className="w-3 h-3 text-blue-600" />
                )}
                <span className="leading-tight">Remoção de Adesivo</span>
              </div>
              <span className={`text-[9px] font-normal leading-tight ${entradaDestOption === 'remocao_adesivos' ? 'text-blue-100' : 'text-neutral-400'}`}>
                Descaracterizar
              </span>
            </button>

            {/* Outros */}
            <button
              type="button"
              onClick={() => handleSelectEntradaDest('outros')}
              className={`p-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex flex-col items-center justify-center gap-1 border text-center cursor-pointer ${
                entradaDestOption === 'outros'
                  ? 'bg-neutral-800 text-white border-neutral-900 shadow-sm ring-2 ring-neutral-500/20'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-1">
                {entradaDestOption === 'outros' && <Check className="w-3.5 h-3.5" />}
                <span className="leading-tight">Outros</span>
              </div>
              <span className={`text-[9px] font-normal leading-tight ${entradaDestOption === 'outros' ? 'text-neutral-300' : 'text-neutral-400'}`}>
                Especificar
              </span>
            </button>
          </div>

          {/* Caixa de Texto se escolher OUTROS no Destino */}
          {entradaDestOption === 'outros' && (
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="text-[11px] font-bold text-neutral-700">
                Informe o Destino:
              </label>
              <input
                type="text"
                autoFocus
                value={customDestination}
                onChange={(e) => setCustomDestination(e.target.value.toUpperCase())}
                placeholder="Ex: OFICINA, LAVAGEM, PÁTIO P2, MANUTENÇÃO..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-neutral-800 focus:ring-2 focus:ring-neutral-800/10 text-neutral-900 text-xs font-semibold uppercase placeholder:normal-case transition outline-none"
              />
            </div>
          )}

          {entradaDestOption && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setEntradaDestOption(undefined);
                  setCustomDestination('');
                }}
                className="text-[10px] font-semibold text-neutral-400 hover:text-neutral-600 underline cursor-pointer"
              >
                Limpar destino
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Destino do Veículo (para Saída) */
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-2">
          <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-700" />
            Destino do Veículo
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value.toUpperCase())}
            placeholder="Digite o destino do veículo (Ex: LOJA CENTRO, CLIENTE...)"
            className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 text-sm font-semibold uppercase placeholder:normal-case transition outline-none"
          />
        </div>
      )}

      {/* KM (Odômetro) Input - Opcional na Entrada */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-emerald-700" />
            <span>Quilometragem (KM Atual)</span>
          </label>
          {isEntrada && (
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
              Opcional
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder={isEntrada ? 'Ex: 45200 (opcional)' : 'Ex: 45200'}
            className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 text-base font-mono font-bold transition outline-none pr-12"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 font-mono">
            KM
          </span>
        </div>
      </div>

      {/* Motivos de Exceção na Entrada (Retorno / Recusa) */}
      {isEntrada && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
              <Package className="w-4 h-4 text-amber-700" />
              <span>Ocorrência Especial</span>
            </div>
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
              Se houver
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Retorno */}
            <button
              type="button"
              onClick={() => handleToggleEntrySubtype('retorno')}
              className={`p-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex flex-col items-center justify-center gap-1 border text-center cursor-pointer ${
                entrySubtype === 'retorno'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-1">
                {entrySubtype === 'retorno' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <RotateCcw className="w-3 h-3 text-amber-600" />
                )}
                <span>Retorno</span>
              </div>
              <span className={`text-[9px] font-normal leading-tight ${entrySubtype === 'retorno' ? 'text-amber-100' : 'text-neutral-400'}`}>
                Reentrada
              </span>
            </button>

            {/* Recusa */}
            <button
              type="button"
              onClick={() => handleToggleEntrySubtype('recusa')}
              className={`p-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex flex-col items-center justify-center gap-1 border text-center cursor-pointer ${
                entrySubtype === 'recusa'
                  ? 'bg-rose-700 text-white border-rose-800 shadow-sm'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-1">
                {entrySubtype === 'recusa' ? <Check className="w-3.5 h-3.5" /> : <Ban className="w-3 h-3 text-rose-600" />}
                <span>Recusa</span>
              </div>
              <span className={`text-[9px] font-normal leading-tight ${entrySubtype === 'recusa' ? 'text-rose-100' : 'text-neutral-400'}`}>
                Não aceito
              </span>
            </button>
          </div>

          {/* Campo de Motivo (se for Retorno ou Recusa) */}
          {(entrySubtype === 'retorno' || entrySubtype === 'recusa') && (
            <div className="pt-2 border-t border-neutral-200/80 flex flex-col gap-2">
              <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <AlertCircle className={`w-3.5 h-3.5 ${entrySubtype === 'recusa' ? 'text-rose-600' : 'text-amber-600'}`} />
                <span>Motivo do {entrySubtype === 'retorno' ? 'Retorno' : 'Recusa'} *</span>
              </label>
              <input
                type="text"
                value={entryReason}
                onChange={(e) => setEntryReason(e.target.value.toUpperCase())}
                placeholder={
                  entrySubtype === 'retorno'
                    ? 'Ex: AVARIA PÓS-LOCAÇÃO / PROBLEMA MECÂNICO'
                    : 'Ex: AVARIA NÃO ACORDADA / LUZ DE INJEÇÃO ACESA'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 text-neutral-900 text-xs font-semibold uppercase placeholder:normal-case transition outline-none"
              />

              {/* Sugestões rápidas de motivos */}
              <div className="flex flex-wrap gap-1 pt-0.5">
                {(entrySubtype === 'retorno' ? QUICK_REASONS_RETORNO : QUICK_REASONS_RECUSA).map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setEntryReason(reason)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition active:scale-95 cursor-pointer ${
                      entryReason === reason
                        ? 'bg-neutral-800 text-white border-neutral-900'
                        : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          )}

          {entrySubtype && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setEntrySubtype(undefined);
                  setEntryReason('');
                }}
                className="text-[10px] font-semibold text-neutral-400 hover:text-neutral-600 underline cursor-pointer"
              >
                Limpar ocorrência
              </button>
            </div>
          )}
        </div>
      )}

      {/* Chave Reserva & Tipo de Veículo */}
      <div className="flex flex-col gap-3">
        {/* Chave Reserva Toggle */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-neutral-200 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
              <Key className="w-4 h-4 text-amber-600" />
              <span>Chave Reserva no Veículo?</span>
            </div>

            <div className="flex items-center gap-2">
              {isEntrada && (
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
                  Opcional
                </span>
              )}
              {isEntrada && hasSpareKey !== undefined && (
                <button
                  type="button"
                  onClick={() => setHasSpareKey(undefined)}
                  className="text-[10px] text-neutral-400 hover:text-neutral-600 underline cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleToggleSpareKey(true)}
              className={`py-2 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border cursor-pointer ${
                hasSpareKey === true
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
              }`}
            >
              {hasSpareKey === true && <Check className="w-3.5 h-3.5" />}
              <span>SIM</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleSpareKey(false)}
              className={`py-2 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border cursor-pointer ${
                hasSpareKey === false
                  ? 'bg-neutral-800 text-white border-neutral-900 shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
              }`}
            >
              {hasSpareKey === false && <Check className="w-3.5 h-3.5" />}
              <span>NÃO</span>
            </button>
          </div>
        </div>

        {/* Tipo de Veículo (GF / RAC / OUTROS) */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-neutral-200 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
              <Car className="w-4 h-4 text-blue-600" />
              <span>Tipo de Veículo</span>
            </div>
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
              Opcional
            </span>
          </div>

          {/* 3 Opções: GF | RAC | OUTROS */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleToggleFleetType('GF')}
              className={`py-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border cursor-pointer ${
                fleetType === 'GF'
                  ? 'bg-indigo-700 text-white border-indigo-800 shadow-sm ring-2 ring-indigo-500/20'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              {fleetType === 'GF' && <Check className="w-3.5 h-3.5" />}
              <span>GF</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleFleetType('RAC')}
              className={`py-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border cursor-pointer ${
                fleetType === 'RAC'
                  ? 'bg-blue-700 text-white border-blue-800 shadow-sm ring-2 ring-blue-500/20'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              {fleetType === 'RAC' && <Check className="w-3.5 h-3.5" />}
              <span>RAC</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleFleetType('OUTROS')}
              className={`py-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border cursor-pointer ${
                fleetType === 'OUTROS'
                  ? 'bg-neutral-800 text-white border-neutral-900 shadow-sm ring-2 ring-neutral-500/20'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              {fleetType === 'OUTROS' && <Check className="w-3.5 h-3.5" />}
              <span>OUTROS</span>
            </button>
          </div>

          {/* Caixa de Texto se escolher OUTROS no Tipo de Veículo */}
          {fleetType === 'OUTROS' && (
            <div className="flex flex-col gap-1 pt-1">
              <label className="text-[11px] font-bold text-neutral-700">
                Especifique o Tipo:
              </label>
              <input
                type="text"
                autoFocus
                value={customFleetType}
                onChange={(e) => setCustomFleetType(e.target.value.toUpperCase())}
                placeholder="Ex: TERCEIRO, DIRETORIA, PARTICULAR..."
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-neutral-900 text-xs font-semibold uppercase placeholder:normal-case transition outline-none"
              />
            </div>
          )}

          {fleetType && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setFleetType(undefined);
                  setCustomFleetType('');
                }}
                className="text-[10px] font-semibold text-neutral-400 hover:text-neutral-600 underline cursor-pointer"
              >
                Limpar tipo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Foto do Documento do Veículo (Opcional) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
            <FileText className="w-4 h-4 text-emerald-700" />
            <span>Foto do Documento (CRLV / Doc)</span>
          </div>
          <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
            Opcional
          </span>
        </div>

        <p className="text-[11px] text-neutral-500 leading-tight">
          Tire uma foto rápida ou anexe da galeria. O status será gravado nas observações da planilha e no relatório.
        </p>

        {/* Hidden File Inputs */}
        <input
          ref={docCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelected(f);
          }}
        />
        <input
          ref={docGalleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelected(f);
          }}
        />

        {documentPhotoUrl ? (
          <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Documento Anexado com Sucesso</span>
              </div>
              <button
                type="button"
                onClick={() => setDocumentPhotoUrl('')}
                className="p-1 rounded-lg text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                title="Remover foto do documento"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-video rounded-lg overflow-hidden border border-emerald-300 bg-neutral-950 max-h-36">
              <img
                src={documentPhotoUrl}
                alt="Documento do Veículo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-1 right-1 text-[9px] font-bold bg-black/75 text-emerald-300 px-1.5 py-0.5 rounded">
                Foto do Documento
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => docCameraInputRef.current?.click()}
                className="flex-1 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-bold hover:bg-emerald-100 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Tirar Outra Foto</span>
              </button>
              <button
                type="button"
                onClick={() => docGalleryInputRef.current?.click()}
                className="flex-1 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-bold hover:bg-emerald-100 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Trocar da Galeria</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isProcessingDocPhoto}
              onClick={() => docCameraInputRef.current?.click()}
              className="py-3 px-3 rounded-xl border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
            >
              <Camera className="w-5 h-5 text-emerald-700" />
              <span>Tirar Foto Doc</span>
              <span className="text-[9px] font-normal text-neutral-500">Câmera direta</span>
            </button>

            <button
              type="button"
              disabled={isProcessingDocPhoto}
              onClick={() => docGalleryInputRef.current?.click()}
              className="py-3 px-3 rounded-xl border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
            >
              <ImageIcon className="w-5 h-5 text-blue-700" />
              <span>Buscar na Galeria</span>
              <span className="text-[9px] font-normal text-neutral-500">Arquivo/Imagem</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3.5 px-4 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <button
          type="submit"
          className="flex-2 py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-98 transition cursor-pointer"
        >
          <span>Avançar (Combustível)</span>
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
    </form>
  );
};
