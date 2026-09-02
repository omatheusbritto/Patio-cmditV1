import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Trash2,
  Car,
  Fuel,
  MapPin,
  Tag,
  Calendar,
  Clock,
  User,
  Gauge,
  Key,
  Truck,
  FileText,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Camera,
  Upload,
  Layers,
  ArrowRightLeft,
  Flame,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  VehicleRecord,
  OperationType,
  FuelLevel,
  VehicleCharacteristic,
  LocationCode,
  EntrySubtype,
  VehicleFleetType,
  VehicleStatus,
} from '../types';
import {
  formatPlateForDisplay,
  isValidBrazilianPlate,
  sanitizeRawText,
} from '../utils/plateNormalizer';

interface MasterRecordCrudModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialRecord?: VehicleRecord | null;
  onSave: (record: VehicleRecord) => Promise<void> | void;
  onDelete?: (recordId: string) => Promise<void> | void;
  onClose: () => void;
}

const FUEL_LEVELS: FuelLevel[] = ['1/8', '2/8', '3/8', '4/8', '5/8', '6/8', '7/8', '8/8'];

const CHARACTERISTICS: { id: VehicleCharacteristic; label: string; color: string }[] = [
  { id: '🟣 DT', label: 'DT (Desativação)', color: 'bg-purple-100 text-purple-900 border-purple-300' },
  { id: '🟠 REVENDA', label: 'Revenda Seminovos', color: 'bg-amber-100 text-amber-900 border-amber-300' },
  { id: '🟢 CONSUMIDOR', label: 'Consumidor', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  { id: '⚪ OUTROS', label: 'Outros Pátio', color: 'bg-neutral-100 text-neutral-800 border-neutral-300' },
];

const LOCATIONS: LocationCode[] = ['P1', 'P2', 'P3', 'R1', 'ADM', 'PDC', 'OUTROS'];

export const MasterRecordCrudModal: React.FC<MasterRecordCrudModalProps> = ({
  isOpen,
  mode,
  initialRecord,
  onSave,
  onDelete,
  onClose,
}) => {
  const [plate, setPlate] = useState('');
  const [operationType, setOperationType] = useState<OperationType>('entrada');
  const [status, setStatus] = useState<VehicleStatus>('parked');
  const [fuel, setFuel] = useState<FuelLevel>('4/8');
  const [location, setLocation] = useState<LocationCode>('P1');
  const [characteristic, setCharacteristic] = useState<VehicleCharacteristic | ''>('🟢 CONSUMIDOR');
  
  const [driverName, setDriverName] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [km, setKm] = useState<string>('');
  const [hasSpareKey, setHasSpareKey] = useState<boolean>(false);
  const [fleetType, setFleetType] = useState<VehicleFleetType>('RAC');
  const [entrySubtype, setEntrySubtype] = useState<EntrySubtype | ''>('bolsao_40');
  const [entryReason, setEntryReason] = useState('');
  
  const [liters, setLiters] = useState<string>('');
  const [fuelType, setFuelType] = useState<string>('Gasolina Comum');
  
  const [dateStr, setDateStr] = useState<string>('');
  const [timeStr, setTimeStr] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && initialRecord) {
      setPlate(initialRecord.plate || '');
      setOperationType(initialRecord.operationType || 'entrada');
      setStatus(initialRecord.status || 'parked');
      setFuel(initialRecord.fuel || '4/8');
      setLocation(initialRecord.location || 'P1');
      setCharacteristic(initialRecord.characteristic || '');
      setDriverName(initialRecord.driverName || '');
      setOrigin(initialRecord.origin || '');
      setDestination(initialRecord.destination || '');
      setKm(initialRecord.km !== undefined ? String(initialRecord.km) : '');
      setHasSpareKey(Boolean(initialRecord.hasSpareKey));
      setFleetType(initialRecord.fleetType || 'RAC');
      setEntrySubtype(initialRecord.entrySubtype || '');
      setEntryReason(initialRecord.entryReason || '');
      setLiters(initialRecord.liters !== undefined ? String(initialRecord.liters) : '');
      setFuelType(initialRecord.fuelType || 'Gasolina Comum');
      setNotes(initialRecord.notes || initialRecord.description || '');
      setPhotoDataUrl(initialRecord.photoDataUrl || '');

      const d = initialRecord.createdAt ? new Date(initialRecord.createdAt) : new Date();
      setDateStr(d.toISOString().split('T')[0]);
      setTimeStr(d.toTimeString().split(' ')[0].substring(0, 5));
    } else {
      // Create mode default
      setPlate('');
      setOperationType('entrada');
      setStatus('parked');
      setFuel('4/8');
      setLocation('P1');
      setCharacteristic('🟢 CONSUMIDOR');
      setDriverName('');
      setOrigin('');
      setDestination('');
      setKm('');
      setHasSpareKey(false);
      setFleetType('RAC');
      setEntrySubtype('bolsao_40');
      setEntryReason('');
      setLiters('');
      setFuelType('Gasolina Comum');
      setNotes('');
      setPhotoDataUrl('');

      const now = new Date();
      setDateStr(now.toISOString().split('T')[0]);
      setTimeStr(now.toTimeString().split(' ')[0].substring(0, 5));
    }
    setErrorMessage(null);
  }, [isOpen, mode, initialRecord]);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPhotoDataUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPlate = sanitizeRawText(plate);
    if (!cleanPlate) {
      setErrorMessage('A placa do veículo é obrigatória.');
      return;
    }

    if (cleanPlate.length < 5) {
      setErrorMessage('Digite uma placa válida com pelo menos 5 caracteres.');
      return;
    }

    let timestamp = Date.now();
    if (dateStr && timeStr) {
      const parsed = new Date(`${dateStr}T${timeStr}:00`);
      if (!isNaN(parsed.getTime())) {
        timestamp = parsed.getTime();
      }
    }

    const recordToSave: VehicleRecord = {
      id: mode === 'edit' && initialRecord ? initialRecord.id : `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: timestamp,
      plate: cleanPlate.toUpperCase(),
      plateSource: initialRecord?.plateSource || 'manual',
      photoDataUrl: photoDataUrl || initialRecord?.photoDataUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23888" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
      operationType,
      status,
      fuel,
      location,
      characteristic: (characteristic as VehicleCharacteristic) || null,
      driverName: driverName.trim() || undefined,
      origin: origin.trim() || undefined,
      destination: destination.trim() || undefined,
      km: km.trim() ? km.trim() : undefined,
      hasSpareKey,
      fleetType: fleetType || undefined,
      entrySubtype: (entrySubtype as EntrySubtype) || undefined,
      entryReason: entryReason.trim() || undefined,
      liters: liters.trim() ? liters.trim() : undefined,
      fuelType: operationType === 'abastecimento' ? fuelType : undefined,
      notes: notes.trim() || undefined,
      description: notes.trim() || undefined,
      releasedAt: status === 'released' ? (initialRecord?.releasedAt || Date.now()) : undefined,
    };

    setIsSaving(true);
    try {
      await onSave(recordToSave);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar registro.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialRecord || !onDelete) return;
    if (confirm(`Tem certeza que deseja EXCLUIR permanentemente o registro da placa ${initialRecord.plate}?`)) {
      setIsDeleting(true);
      try {
        await onDelete(initialRecord.id);
        onClose();
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao excluir registro.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] border border-neutral-200 animate-in fade-in duration-150 my-auto">
        
        {/* Header */}
        <div className="p-4 bg-neutral-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center font-black shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black leading-tight">
                  {mode === 'edit' ? 'Editar Registro (Master CRUD)' : 'Criar Registro Manual (Master)'}
                </h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30 font-bold uppercase">
                  Acesso Total
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                {mode === 'edit'
                  ? `Alteração irrestrita de dados da placa ${initialRecord?.plate || ''}`
                  : 'Cadastro direto no pátio com preenchimento completo de campos'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 bg-neutral-50/50">
          
          {/* Main Vehicle Info Grid */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col gap-3.5">
            <h3 className="text-xs font-black text-neutral-900 flex items-center gap-1.5 pb-2 border-b border-neutral-100">
              <Car className="w-4 h-4 text-amber-600" />
              Identificação & Operação
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Placa */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black text-neutral-700">Placa do Veículo *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="Ex: ABC1D23"
                    className="w-full font-mono font-black text-base uppercase bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-neutral-900 focus:bg-white focus:border-amber-600 outline-none tracking-wider"
                    required
                  />
                  {plate && (
                    <span className="absolute right-3 top-2.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700">
                      {formatPlateForDisplay(plate)}
                    </span>
                  )}
                </div>
              </div>

              {/* Tipo de Operação */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black text-neutral-700">Tipo de Operação *</label>
                <select
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value as OperationType)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-black text-neutral-900 focus:bg-white focus:border-amber-600 outline-none transition"
                >
                  <option value="entrada">🟢 Entrada de Veículo</option>
                  <option value="saida">🔴 Saída de Veículo</option>
                  <option value="abastecimento">⛽ Abastecimento</option>
                  <option value="pdc">⏳ Fila PDC</option>
                  <option value="qualidade_51">📋 51 Qualidade (Bolsão 51)</option>
                </select>
              </div>

              {/* Status do Veículo */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black text-neutral-700">Status no Pátio</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('parked')}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      status === 'parked'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>No Pátio</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('released')}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      status === 'released'
                        ? 'bg-neutral-800 text-white border-neutral-900 shadow-2xs'
                        : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
                    }`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Liberado / Saída</span>
                  </button>
                </div>
              </div>

              {/* Setor / Localização */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black text-neutral-700">Setor / Localização</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-black text-neutral-900 focus:bg-white focus:border-amber-600 outline-none transition"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      Setor {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Combustível e Característica */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col gap-3">
            <h3 className="text-xs font-black text-neutral-900 flex items-center gap-1.5 pb-2 border-b border-neutral-100">
              <Fuel className="w-4 h-4 text-emerald-600" />
              Nível de Combustível & Característica
            </h3>

            {/* Seletor de Nível 1/8 a 8/8 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
                <span>Nível do Tanque:</span>
                <span className="font-mono font-black text-emerald-700">{fuel}</span>
              </label>
              <div className="grid grid-cols-8 gap-1">
                {FUEL_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFuel(lvl)}
                    className={`py-1.5 rounded-lg text-xs font-black border transition cursor-pointer ${
                      fuel === lvl
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs scale-105'
                        : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Característica */}
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="text-xs font-bold text-neutral-700">Característica do Veículo:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CHARACTERISTICS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCharacteristic(characteristic === c.id ? '' : c.id)}
                    className={`p-2 rounded-xl text-xs font-black border transition cursor-pointer text-left flex items-center justify-between ${
                      characteristic === c.id
                        ? `${c.color} ring-2 ring-amber-500 shadow-xs`
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <span className="truncate">{c.label}</span>
                    {characteristic === c.id && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Abastecimento Details (se operação = abastecimento) */}
          {operationType === 'abastecimento' && (
            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 flex flex-col gap-3">
              <h3 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-700" />
                Dados do Abastecimento
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-neutral-700">Litros Abastecidos:</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 45.50"
                    value={liters}
                    onChange={(e) => setLiters(e.target.value)}
                    className="bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:border-amber-600 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-black text-neutral-700">Tipo de Combustível:</label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    className="bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:border-amber-600 outline-none"
                  >
                    <option value="Gasolina Comum">Gasolina Comum</option>
                    <option value="Gasolina Aditivada">Gasolina Aditivada</option>
                    <option value="Etanol">Etanol</option>
                    <option value="Diesel S10">Diesel S10</option>
                    <option value="Diesel S500">Diesel S500</option>
                    <option value="GNV">GNV</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Detalhes Operacionais */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col gap-3">
            <h3 className="text-xs font-black text-neutral-900 flex items-center gap-1.5 pb-2 border-b border-neutral-100">
              <User className="w-4 h-4 text-blue-600" />
              Condutor & Detalhes Operacionais
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Condutor */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">Nome do Condutor / Motorista:</label>
                <input
                  type="text"
                  placeholder="Ex: João Ferreira"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-amber-600 outline-none"
                />
              </div>

              {/* KM */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">KM / Odômetro:</label>
                <input
                  type="text"
                  placeholder="Ex: 48250"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-neutral-900 focus:bg-white focus:border-amber-600 outline-none"
                />
              </div>

              {/* Origem */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">Origem:</label>
                <input
                  type="text"
                  placeholder="Ex: Loja Centro / Filial"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-amber-600 outline-none"
                />
              </div>

              {/* Destino */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">Destino:</label>
                <input
                  type="text"
                  placeholder="Ex: Oficina / Cliente / Pátio"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-amber-600 outline-none"
                />
              </div>

              {/* Tipo de Frota */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">Tipo de Frota:</label>
                <select
                  value={fleetType}
                  onChange={(e) => setFleetType(e.target.value)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:bg-white focus:border-amber-600 outline-none"
                >
                  <option value="RAC">RAC (Aluguel)</option>
                  <option value="GF">GF (Gestão de Frota)</option>
                  <option value="OUTROS">OUTROS</option>
                </select>
              </div>

              {/* Chave Reserva */}
              <div className="flex flex-col gap-1 justify-center">
                <label className="text-xs font-bold text-neutral-700">Chave Reserva:</label>
                <button
                  type="button"
                  onClick={() => setHasSpareKey(!hasSpareKey)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-between ${
                    hasSpareKey
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-neutral-50 text-neutral-600 border-neutral-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    {hasSpareKey ? 'Possui Chave Reserva' : 'Não possui Chave Reserva'}
                  </span>
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${hasSpareKey ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-neutral-400'}`}>
                    {hasSpareKey && <Check className="w-2.5 h-2.5" />}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Data, Hora e Observações */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col gap-3">
            <h3 className="text-xs font-black text-neutral-900 flex items-center gap-1.5 pb-2 border-b border-neutral-100">
              <Calendar className="w-4 h-4 text-neutral-600" />
              Data, Hora & Observações
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">Data do Registro:</label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-amber-600 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700">Hora do Registro:</label>
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:bg-white focus:border-amber-600 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 pt-1">
              <label className="text-xs font-bold text-neutral-700">Observações / Avarias / Apontamentos:</label>
              <textarea
                rows={2}
                placeholder="Detalhes adicionais do veículo ou da operação..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-neutral-50 border border-neutral-300 rounded-xl p-3 text-xs font-medium text-neutral-900 focus:bg-white focus:border-amber-600 outline-none resize-none"
              />
            </div>
          </div>

          {/* Foto (Upload Opcional) */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col gap-2.5">
            <h3 className="text-xs font-black text-neutral-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-neutral-600" />
                Foto do Veículo / Placa
              </span>
              <span className="text-[10px] text-neutral-400 font-semibold">(Opcional para Master)</span>
            </h3>

            <div className="flex items-center gap-3">
              {photoDataUrl ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-neutral-300 shrink-0 bg-neutral-100">
                  <img src={photoDataUrl} alt="Veículo" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl('')}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-rose-600 transition"
                    title="Remover foto"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : null}

              <label className="flex-1 border-2 border-dashed border-neutral-300 hover:border-amber-500 rounded-2xl p-3 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1 bg-neutral-50 hover:bg-amber-50/50">
                <Upload className="w-4 h-4 text-neutral-500" />
                <span className="text-xs font-bold text-neutral-700">
                  {photoDataUrl ? 'Substituir Foto' : 'Carregar Imagem do Dispositivo'}
                </span>
                <span className="text-[10px] text-neutral-400">JPG, PNG ou WebP</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 bg-neutral-100 border-t border-neutral-200 flex items-center justify-between gap-2 shrink-0">
          <div>
            {mode === 'edit' && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Excluindo...' : 'Excluir Registro'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 font-bold text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs flex items-center gap-2 shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Salvando...' : mode === 'edit' ? 'Salvar Alterações' : 'Criar Registro'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
