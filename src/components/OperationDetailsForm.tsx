import React, { useState } from 'react';
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
} from 'lucide-react';

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
  plate: string;
  onSubmit: (details: {
    driverName: string;
    origin?: string;
    destination?: string;
    km: string;
    hasSpareKey?: boolean;
    fleetType?: VehicleFleetType;
    entrySubtype?: EntrySubtype;
    entryReason?: string;
  }) => void;
  onBack: () => void;
}

const QUICK_REASONS_RETORNO = [
  'Avaria / Batida',
  'Problema Mecânico',
  'Higienização Incompleta',
  'Cliente desistiu',
  'Documentação',
  'Troca de Frota',
];

const QUICK_REASONS_RECUSA = [
  'Avaria não conformada',
  'Luz de injeção acesa',
  'Pneu danificado',
  'Mau cheiro / Sujeira',
  'Veículo divergente',
  'Falta de opcionais',
];

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
  plate,
  onSubmit,
  onBack,
}) => {
  const isEntrada = operationType === 'entrada';

  const [driverName, setDriverName] = useState<string>(initialDriverName);
  const [origin, setOrigin] = useState<string>(initialOrigin);
  const [destination, setDestination] = useState<string>(initialDestination);
  const [km, setKm] = useState<string>(initialKm ? String(initialKm) : '');
  const [hasSpareKey, setHasSpareKey] = useState<boolean | undefined>(
    isEntrada ? initialHasSpareKey : (initialHasSpareKey ?? true)
  );
  const [fleetType, setFleetType] = useState<VehicleFleetType | undefined>(initialFleetType);
  const [customFleetType, setCustomFleetType] = useState<string>(
    initialFleetType && !['RAC', 'GF'].includes(initialFleetType) ? initialFleetType : ''
  );
  const [entrySubtype, setEntrySubtype] = useState<EntrySubtype | undefined>(initialEntrySubtype);
  const [entryReason, setEntryReason] = useState<string>(initialEntryReason);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalFleetType =
      fleetType === 'OUTROS'
        ? customFleetType.trim() || 'OUTROS'
        : fleetType;

    onSubmit({
      driverName: driverName.trim(),
      origin: isEntrada ? origin.trim() : undefined,
      destination: !isEntrada ? destination.trim() : undefined,
      km: km.trim(),
      hasSpareKey,
      fleetType: finalFleetType,
      entrySubtype: isEntrada ? entrySubtype : undefined,
      entryReason: isEntrada && (entrySubtype === 'retorno' || entrySubtype === 'recusa') ? entryReason.trim() : undefined,
    });
  };

  const handleToggleSpareKey = (val: boolean) => {
    if (isEntrada && hasSpareKey === val) {
      setHasSpareKey(undefined);
    } else {
      setHasSpareKey(val);
    }
  };

  const handleToggleFleetType = (type: 'RAC' | 'GF' | 'OUTROS') => {
    if (fleetType === type) {
      setFleetType(undefined);
    } else {
      setFleetType(type);
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
          <span className="text-xs font-mono font-bold bg-neutral-900 text-white px-2.5 py-1 rounded-lg">
            {plate}
          </span>
        </div>

        <h2 className="text-xl font-black text-neutral-900 leading-tight">
          {isEntrada ? 'Dados de Entrada' : 'Dados de Saída'}
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Preencha as informações do condutor, odômetro e chave
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
          onChange={(e) => setDriverName(e.target.value)}
          placeholder="Ex: Carlos Eduardo / João Silva"
          className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 text-sm font-medium transition outline-none"
        />
      </div>

      {/* Origem or Destino Input (sem sugestões) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-2">
        <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-emerald-700" />
          {isEntrada ? 'Origem do Veículo' : 'Destino do Veículo'}
        </label>
        <input
          type="text"
          value={isEntrada ? origin : destination}
          onChange={(e) => (isEntrada ? setOrigin(e.target.value) : setDestination(e.target.value))}
          placeholder={isEntrada ? 'Digite a origem do veículo' : 'Digite o destino do veículo'}
          className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 text-sm font-medium transition outline-none"
        />
      </div>

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

      {/* Local de Entrada (Bolsão 40 / Retorno / Recusa) - Apenas em Entrada */}
      {isEntrada && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
              <Package className="w-4 h-4 text-emerald-700" />
              <span>Local de Entrada</span>
            </div>
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
              Opcional
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Bolsão 40 */}
            <button
              type="button"
              onClick={() => handleToggleEntrySubtype('bolsao_40')}
              className={`p-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex flex-col items-center justify-center gap-1 border text-center ${
                entrySubtype === 'bolsao_40'
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-1">
                {entrySubtype === 'bolsao_40' && <Check className="w-3.5 h-3.5" />}
                <span>Bolsão 40</span>
              </div>
              <span className={`text-[9px] font-normal leading-tight ${entrySubtype === 'bolsao_40' ? 'text-emerald-100' : 'text-neutral-400'}`}>
                Triagem padrão
              </span>
            </button>

            {/* Remoção de Adesivos */}
            <button
              type="button"
              onClick={() => handleToggleEntrySubtype('remocao_adesivos')}
              className={`p-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex flex-col items-center justify-center gap-1 border text-center ${
                entrySubtype === 'remocao_adesivos'
                  ? 'bg-blue-700 text-white border-blue-800 shadow-sm'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-1">
                {entrySubtype === 'remocao_adesivos' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Sparkles className="w-3 h-3 text-blue-600" />
                )}
                <span>Remoção de Adesivos</span>
              </div>
              <span className={`text-[9px] font-normal leading-tight ${entrySubtype === 'remocao_adesivos' ? 'text-blue-100' : 'text-neutral-400'}`}>
                Descaracterização
              </span>
            </button>

            {/* Retorno */}
            <button
              type="button"
              onClick={() => handleToggleEntrySubtype('retorno')}
              className={`p-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex flex-col items-center justify-center gap-1 border text-center ${
                entrySubtype === 'retorno'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-1">
                {entrySubtype === 'retorno' ? <Check className="w-3.5 h-3.5" /> : <RotateCcw className="w-3 h-3 text-amber-600" />}
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
              className={`p-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex flex-col items-center justify-center gap-1 border text-center ${
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
                onChange={(e) => setEntryReason(e.target.value)}
                placeholder={
                  entrySubtype === 'retorno'
                    ? 'Ex: Avaria pós-locação / Problema mecânico / Troca de frota'
                    : 'Ex: Avaria não acordada / Luz de injeção acesa / Pneu furado'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 text-neutral-900 text-xs font-medium transition outline-none"
              />

              {/* Sugestões rápidas de motivos */}
              <div className="flex flex-wrap gap-1 pt-0.5">
                {(entrySubtype === 'retorno' ? QUICK_REASONS_RETORNO : QUICK_REASONS_RECUSA).map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setEntryReason(reason)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition active:scale-95 ${
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
                className="text-[10px] font-semibold text-neutral-400 hover:text-neutral-600 underline"
              >
                Limpar local (deixar em branco)
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
                  className="text-[10px] text-neutral-400 hover:text-neutral-600 underline"
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
              className={`py-2 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border ${
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
              className={`py-2 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border ${
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

        {/* Tipo de Veículo (RAC / GF / OUTROS) - Opcional */}
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

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleToggleFleetType('RAC')}
              className={`py-2 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border ${
                fleetType === 'RAC'
                  ? 'bg-blue-700 text-white border-blue-800 shadow-sm'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              {fleetType === 'RAC' && <Check className="w-3.5 h-3.5" />}
              <span>RAC</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleFleetType('GF')}
              className={`py-2 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border ${
                fleetType === 'GF'
                  ? 'bg-indigo-700 text-white border-indigo-800 shadow-sm'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              {fleetType === 'GF' && <Check className="w-3.5 h-3.5" />}
              <span>GF</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleFleetType('OUTROS')}
              className={`py-2 rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1 border ${
                fleetType === 'OUTROS'
                  ? 'bg-neutral-800 text-white border-neutral-900 shadow-sm'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              {fleetType === 'OUTROS' && <Check className="w-3.5 h-3.5" />}
              <span>OUTROS</span>
            </button>
          </div>

          {fleetType === 'OUTROS' && (
            <input
              type="text"
              value={customFleetType}
              onChange={(e) => setCustomFleetType(e.target.value)}
              placeholder="Especifique o tipo (Ex: Terceiro, Diretoria...)"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-neutral-900 text-xs font-medium transition outline-none"
            />
          )}

          {fleetType && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setFleetType(undefined)}
                className="text-[10px] font-semibold text-neutral-400 hover:text-neutral-600 underline"
              >
                Limpar seleção (deixar em branco)
              </button>
            </div>
          )}
        </div>
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
          type="submit"
          className="flex-2 py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-98 transition"
        >
          <span>Avançar (Combustível)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
};
