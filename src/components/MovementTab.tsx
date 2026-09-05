import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Search,
  MapPin,
  Car,
  Fuel,
  Gauge,
  User,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Share2,
  RefreshCw,
  FileSpreadsheet,
  X,
  ChevronRight,
  Database,
} from 'lucide-react';
import { VehicleMovement, VehicleRecord, FuelLevel } from '../types';
import { fetchMovements, createMovement } from '../utils/movementService';
import { getCurrentSession } from '../utils/authService';
import { YardLocationPickerModal } from './YardLocationPickerModal';
import { FuelSelector } from './FuelSelector';
import { formatPlateForDisplay } from '../utils/plateNormalizer';

interface MovementTabProps {
  parkedVehicles: VehicleRecord[];
  onMovementCreated?: (movement: VehicleMovement) => void;
  onOpenSpreadsheetOnline?: () => void;
  initialSelectedVehicle?: VehicleRecord | null;
  onClearInitialVehicle?: () => void;
}

export const MovementTab: React.FC<MovementTabProps> = ({
  parkedVehicles,
  onMovementCreated,
  onOpenSpreadsheetOnline,
  initialSelectedVehicle,
  onClearInitialVehicle,
}) => {
  const [movements, setMovements] = useState<VehicleMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [plate, setPlate] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [observation, setObservation] = useState('');
  const [fuelLevel, setFuelLevel] = useState<FuelLevel | undefined>(undefined);
  const [odometer, setOdometer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals for location selection
  const [pickerType, setPickerType] = useState<'origin' | 'destination' | null>(null);

  const session = getCurrentSession();
  const operatorName = session?.user.name || session?.user.username || 'Operador CMDIT';

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await fetchMovements();
      setMovements(list);
    } catch (err) {
      console.warn('Erro ao carregar movimentações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialSelectedVehicle) {
      handleSelectParkedVehicle(initialSelectedVehicle);
      if (onClearInitialVehicle) {
        onClearInitialVehicle();
      }
    }
  }, [initialSelectedVehicle]);

  const handleSelectParkedVehicle = (v: VehicleRecord) => {
    setPlate(v.plate);
    if (v.location) {
      setOrigin(v.location);
    }
    if (v.fuel) {
      setFuelLevel(v.fuel);
    }
    if (v.km) {
      setOdometer(String(v.km));
    }
    setIsFormOpen(true);
  };

  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validação obrigatória estrita
    if (!plate.trim()) {
      setErrorMessage('A Placa do veículo é obrigatória.');
      return;
    }
    if (!origin.trim()) {
      setErrorMessage('O local de Origem é obrigatório.');
      return;
    }
    if (!destination.trim()) {
      setErrorMessage('O local de Destino é obrigatório.');
      return;
    }
    if (!observation.trim()) {
      setErrorMessage('A Observação da movimentação é obrigatória.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createMovement({
        plate: plate.toUpperCase().trim(),
        origin: origin.trim(),
        destination: destination.trim(),
        observation: observation.trim(),
        fuelLevel: fuelLevel || undefined,
        odometer: odometer.trim() ? Number(odometer) : undefined,
        operatorName,
      });

      if (res.success && res.movement) {
        setSuccessMessage(`Movimentação do veículo ${res.movement.plate} registrada com sucesso!`);
        setMovements((prev) => [res.movement!, ...prev]);
        if (onMovementCreated) {
          onMovementCreated(res.movement);
        }
        // Reset form
        setPlate('');
        setOrigin('');
        setDestination('');
        setObservation('');
        setFuelLevel(undefined);
        setOdometer('');
        setIsFormOpen(false);
      } else {
        setErrorMessage(res.message || 'Falha ao salvar movimentação.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de conexão ao salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareWhatsApp = (mov: VehicleMovement) => {
    const text = `🔄 *MOVIMENTAÇÃO DE VEÍCULO - PÁTIO CMDIT*
🚗 *Placa:* ${formatPlateForDisplay(mov.plate)}
📍 *Origem:* ${mov.origin}
🎯 *Destino:* ${mov.destination}
📝 *Observação:* ${mov.observation}
${mov.fuelLevel ? `⛽ *Combustível:* ${mov.fuelLevel}\n` : ''}${mov.odometer ? `⚡ *Odômetro:* ${mov.odometer} km\n` : ''}👤 *Operador:* ${mov.operatorName}
📅 *Data:* ${mov.dateFormatted} às ${mov.timeFormatted}
_Sincronizado automaticamente no Render PostgreSQL e Google Sheets_`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const filteredMovements = movements.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toUpperCase().trim();
    return (
      m.plate.toUpperCase().includes(q) ||
      m.origin.toUpperCase().includes(q) ||
      m.destination.toUpperCase().includes(q) ||
      m.observation.toUpperCase().includes(q) ||
      m.operatorName.toUpperCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto w-full px-4 py-4 pb-24">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-900 text-white rounded-3xl p-5 shadow-lg border border-teal-600/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <ArrowLeftRight className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight leading-none text-white">
                Movimentação
              </h2>
              <p className="text-[11px] text-teal-200 font-medium mt-0.5">
                Origem ➔ Destino no Pátio CMDIT
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer ${
              isFormOpen
                ? 'bg-white text-teal-900'
                : 'bg-emerald-400 hover:bg-emerald-300 text-emerald-950'
            }`}
          >
            {isFormOpen ? (
              <>
                <X className="w-4 h-4" />
                <span>Fechar</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Nova Movimentação</span>
              </>
            )}
          </button>
        </div>

        {/* Database & Sheets status pill */}
        <div className="flex items-center justify-between pt-2 border-t border-teal-600/40 text-[11px] text-teal-100 font-semibold">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-300" />
            <span>PostgreSQL Render Ativo</span>
          </div>
          <div className="flex items-center gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-300" />
            <span>Aba MOVIMENTAÇÃO</span>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-neutral-400 hover:text-neutral-600 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* FORMULÁRIO DE NOVA MOVIMENTAÇÃO */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmitMovement}
          className="bg-white rounded-3xl p-5 border border-teal-200 shadow-xl space-y-4 animate-in slide-in-from-top-4 duration-200"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
              <h3 className="font-black text-sm text-neutral-900">Registrar Movimentação</h3>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
              Obrigatório: Placa, Origem, Destino, Obs
            </span>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick vehicle chips from yard */}
          {parkedVehicles.length > 0 && (
            <div>
              <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                Veículos Estacionados no Pátio (Clique para selecionar):
              </label>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {parkedVehicles.slice(0, 10).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectParkedVehicle(v)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono transition border shrink-0 ${
                      plate.toUpperCase() === v.plate.toUpperCase()
                        ? 'bg-teal-700 text-white border-teal-800 shadow-sm'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-200'
                    }`}
                  >
                    {formatPlateForDisplay(v.plate)}
                    {v.location ? ` (${v.location})` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1. PLACA (OBRIGATÓRIO) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-teal-700" />
                <span>Placa do Veículo</span>
              </span>
              <span className="text-[10px] text-rose-600 font-bold uppercase">* Obrigatório</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: ABC1D23"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={8}
              className="w-full bg-neutral-50 border border-neutral-300 focus:border-teal-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-black tracking-wider font-mono text-neutral-900 outline-none uppercase transition"
            />
          </div>

          {/* 2. ORIGEM E DESTINO (OBRIGATÓRIOS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* ORIGEM */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" />
                  <span>Origem</span>
                </span>
                <span className="text-[10px] text-rose-600 font-bold">* Obrigatório</span>
              </label>
              <button
                type="button"
                onClick={() => setPickerType('origin')}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                  origin
                    ? 'bg-teal-50/70 border-teal-300 text-teal-950 font-bold'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-400 hover:border-teal-400 font-medium'
                }`}
              >
                <span className="text-xs truncate">
                  {origin || 'Selecione a Origem...'}
                </span>
                <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
              </button>
            </div>

            {/* DESTINO */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Destino</span>
                </span>
                <span className="text-[10px] text-rose-600 font-bold">* Obrigatório</span>
              </label>
              <button
                type="button"
                onClick={() => setPickerType('destination')}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                  destination
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-400 hover:border-emerald-400 font-medium'
                }`}
              >
                <span className="text-xs truncate">
                  {destination || 'Selecione o Destino...'}
                </span>
                <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
              </button>
            </div>
          </div>

          {/* 3. OBSERVAÇÃO (OBRIGATÓRIO) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
              <span>Observação / Motivo da Movimentação</span>
              <span className="text-[10px] text-rose-600 font-bold uppercase">* Obrigatório</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="Descreva o motivo ou detalhes da movimentação (ex: liberação para lavagem, remanejamento de quadrante, etc)"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-300 focus:border-teal-600 focus:bg-white rounded-xl p-3 text-xs font-medium text-neutral-900 outline-none transition"
            />
          </div>

          {/* 4. CAMPOS NÃO OBRIGATÓRIOS: COMBUSTÍVEL & KM ODÔMETRO */}
          <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                Campos Opcionais (Não Obrigatórios)
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">opcional</span>
            </div>

            {/* Combustível (Opcional) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-amber-600" />
                  <span>Combustível</span>
                </label>
                {fuelLevel && (
                  <button
                    type="button"
                    onClick={() => setFuelLevel(undefined)}
                    className="text-[10px] text-neutral-500 hover:text-rose-600 font-bold"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <FuelSelector
                selectedLevel={fuelLevel || '4/8'}
                onSelect={(f) => setFuelLevel(f)}
              />
            </div>

            {/* Km Odômetro (Opcional) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-indigo-600" />
                <span>Km Odômetro</span>
              </label>
              <input
                type="number"
                placeholder="Ex: 45280"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                className="w-full bg-white border border-neutral-300 focus:border-teal-600 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-900 outline-none transition"
              />
            </div>
          </div>

          {/* Operador Badge */}
          <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
            <span className="flex items-center gap-1.5 font-medium">
              <User className="w-3.5 h-3.5 text-neutral-400" />
              <span>Operador Responsável:</span>
            </span>
            <span className="font-bold text-neutral-800">{operatorName}</span>
          </div>

          {/* Botão de Gravar */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 active:scale-98 transition disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Gravando Movimentação...' : 'Confirmar e Salvar'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Busca e Lista de Movimentações */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por placa, origem ou destino..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold bg-white border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm uppercase"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          title="Atualizar"
          className="w-10 h-10 rounded-2xl bg-white border border-neutral-200 text-neutral-600 hover:text-teal-700 flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
        </button>
      </div>

      {/* List Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
          Histórico de Movimentações ({filteredMovements.length})
        </span>
        {onOpenSpreadsheetOnline && (
          <button
            type="button"
            onClick={onOpenSpreadsheetOnline}
            className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ver na Planilha</span>
          </button>
        )}
      </div>

      {/* Movimentações Feed */}
      {filteredMovements.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-neutral-200 text-center shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 mx-auto flex items-center justify-center">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-sm text-neutral-900">
            Nenhuma movimentação registrada
          </h4>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto">
            Utilize o botão acima para registrar o deslocamento de veículos entre quadrantes e setores do pátio.
          </p>
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
          >
            Nova Movimentação
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredMovements.map((mov) => (
            <div
              key={mov.id}
              className="bg-white rounded-2xl p-4 border border-neutral-200 hover:border-teal-300 shadow-sm transition space-y-2.5"
            >
              {/* Card Top: Placa e Data */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm font-mono tracking-wider bg-neutral-900 text-white px-2.5 py-0.5 rounded-lg">
                    {formatPlateForDisplay(mov.plate)}
                  </span>
                  <span className="text-[11px] text-neutral-400 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {mov.dateFormatted} {mov.timeFormatted}
                    </span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(mov)}
                  title="Compartilhar via WhatsApp"
                  className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Origem ➔ Destino */}
              <div className="flex items-center gap-2 bg-neutral-50 p-2 rounded-xl border border-neutral-100">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                    Origem
                  </span>
                  <span className="text-xs font-black text-neutral-800 truncate block">
                    {mov.origin}
                  </span>
                </div>

                <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0 text-right">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                    Destino
                  </span>
                  <span className="text-xs font-black text-emerald-950 truncate block">
                    {mov.destination}
                  </span>
                </div>
              </div>

              {/* Observação */}
              <div className="text-xs text-neutral-700 bg-neutral-50/50 p-2 rounded-lg border border-neutral-100">
                <span className="font-bold text-neutral-900">Observação: </span>
                <span>{mov.observation}</span>
              </div>

              {/* Badges: Combustível, Km, Operador */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-100 gap-1.5">
                <div className="flex items-center gap-2">
                  {mov.fuelLevel && (
                    <span className="flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      <Fuel className="w-3 h-3" />
                      <span>{mov.fuelLevel}</span>
                    </span>
                  )}
                  {mov.odometer && (
                    <span className="flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                      <Gauge className="w-3 h-3" />
                      <span>{mov.odometer} km</span>
                    </span>
                  )}
                </div>

                <span className="font-semibold text-neutral-600">
                  Por: <strong className="text-neutral-800">{mov.operatorName}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Location Picker Modal (Origem ou Destino) */}
      <YardLocationPickerModal
        isOpen={pickerType !== null}
        title={pickerType === 'origin' ? 'Selecionar Origem' : 'Selecionar Destino'}
        currentValue={pickerType === 'origin' ? origin : destination}
        onSelect={(loc) => {
          if (pickerType === 'origin') setOrigin(loc);
          if (pickerType === 'destination') setDestination(loc);
        }}
        onClose={() => setPickerType(null)}
      />
    </div>
  );
};
