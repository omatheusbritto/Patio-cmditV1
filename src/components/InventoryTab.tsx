import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
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
  Trash2,
} from 'lucide-react';
import { VehicleInventory, VehicleRecord, FuelLevel } from '../types';
import { fetchInventories, createInventory, deleteInventory } from '../utils/inventoryService';
import { getCurrentSession } from '../utils/authService';
import { YardLocationPickerModal } from './YardLocationPickerModal';
import { FuelSelector } from './FuelSelector';
import { formatPlateForDisplay } from '../utils/plateNormalizer';

interface InventoryTabProps {
  parkedVehicles: VehicleRecord[];
  onInventoryCreated?: (inventory: VehicleInventory) => void;
  onOpenSpreadsheetOnline?: () => void;
  initialSelectedVehicle?: VehicleRecord | null;
  onClearInitialVehicle?: () => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  parkedVehicles,
  onInventoryCreated,
  onOpenSpreadsheetOnline,
  initialSelectedVehicle,
  onClearInitialVehicle,
}) => {
  const [inventories, setInventories] = useState<VehicleInventory[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states (conforme especificação do usuário: Placa e Local obrigatórios, Observação, Combustível e KM opcionais)
  const [plate, setPlate] = useState('');
  const [location, setLocation] = useState('');
  const [observation, setObservation] = useState('');
  const [fuelLevel, setFuelLevel] = useState<FuelLevel | undefined>(undefined);
  const [odometer, setOdometer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal para escolher local do pátio
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

  const session = getCurrentSession();
  const operatorName = session?.user.name || session?.user.username || 'Operador CMDIT';
  const isMaster = session?.user.role === 'master';

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await fetchInventories();
      setInventories(list);
    } catch (err) {
      console.warn('Erro ao carregar inventários:', err);
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
      setLocation(v.location);
    }
    if (v.fuel) {
      setFuelLevel(v.fuel);
    }
    if (v.km) {
      setOdometer(String(v.km));
    }
    setIsFormOpen(true);
    setErrorMessage(null);
  };

  const handleOpenNewForm = () => {
    setPlate('');
    setLocation('');
    setObservation('');
    setFuelLevel(undefined);
    setOdometer('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanPlate = plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleanPlate || cleanPlate.length < 5) {
      setErrorMessage('Informe uma placa de veículo válida (ex: ABC1D23).');
      return;
    }

    if (!location.trim()) {
      setErrorMessage('O local onde o veículo está é obrigatório.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createInventory({
        plate: cleanPlate,
        location: location.trim().toUpperCase(),
        observation: observation.trim() || undefined,
        fuelLevel: fuelLevel,
        odometer: odometer.trim() ? odometer.trim().toUpperCase() : undefined,
        operatorName,
      });

      if (!res.success || !res.inventory) {
        setErrorMessage(res.message || 'Falha ao registrar inventário.');
        return;
      }

      setInventories((prev) => [res.inventory!, ...prev]);
      if (onInventoryCreated) {
        onInventoryCreated(res.inventory);
      }

      setSuccessMessage(`Inventário da placa ${formatPlateForDisplay(cleanPlate)} registrado com sucesso!`);
      setTimeout(() => {
        setIsFormOpen(false);
        setPlate('');
        setLocation('');
        setObservation('');
        setFuelLevel(undefined);
        setOdometer('');
        setSuccessMessage(null);
      }, 1400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao salvar inventário.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, invPlate: string) => {
    if (!confirm(`Deseja excluir o registro de inventário da placa ${invPlate}?`)) return;
    const ok = await deleteInventory(id);
    if (ok) {
      setInventories((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const handleShareWhatsApp = (inv: VehicleInventory) => {
    let text = `📋 *INVENTÁRIO DE VEÍCULO - CMDIT*\n`;
    text += `🚗 *Placa:* ${formatPlateForDisplay(inv.plate)}\n`;
    text += `📍 *Local:* ${inv.location}\n`;
    if (inv.observation) text += `📝 *Observação:* ${inv.observation}\n`;
    if (inv.fuelLevel) text += `⛽ *Combustível:* ${inv.fuelLevel}\n`;
    if (inv.odometer) text += `⏱️ *KM Odômetro:* ${inv.odometer}\n`;
    text += `👤 *Operador:* ${inv.operatorName}\n`;
    text += `📅 *Data/Hora:* ${inv.dateFormatted} às ${inv.timeFormatted}\n`;
    text += `📊 *Planilha Oficial:* Aba Inventário`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const filteredList = inventories.filter((i) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      i.plate.toLowerCase().includes(q) ||
      i.location.toLowerCase().includes(q) ||
      (i.observation && i.observation.toLowerCase().includes(q)) ||
      (i.operatorName && i.operatorName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-2xl p-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight leading-none text-white">
                Inventário de Pátio
              </h2>
              <p className="text-xs text-emerald-200 mt-1">
                Conferência rápida de veículos: apenas Placa e Local
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
              title="Atualizar registros"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {onOpenSpreadsheetOnline && (
              <button
                type="button"
                onClick={onOpenSpreadsheetOnline}
                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs px-3 py-2 rounded-xl shadow-xs transition active:scale-95"
                title="Abrir aba inventario na planilha"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Aba Inventário</span>
              </button>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-3 pt-3 border-t border-emerald-700/40 flex items-center justify-between text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Aba: <strong>inventario</strong> (Colunas A a E)</span>
          </div>
          <span>Total: <strong>{inventories.length}</strong> conferências</span>
        </div>
      </div>

      {/* Action CTA Button */}
      {!isFormOpen && (
        <button
          type="button"
          onClick={handleOpenNewForm}
          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 active:scale-98 transition cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>Fazer Novo Inventário (Placa + Local)</span>
        </button>
      )}

      {/* Form Modal / Inline */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-300 relative animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h3 className="font-black text-base text-neutral-900">
                Registrar Inventário de Veículo
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* 1. Placa (Obrigatório) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Placa do Veículo *</span>
                </label>
                <span className="text-[10px] text-emerald-700 font-bold uppercase bg-emerald-50 px-2 py-0.5 rounded">
                  Obrigatório
                </span>
              </div>
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="Ex: ABC1D23"
                maxLength={8}
                className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 font-mono text-lg font-bold uppercase text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-neutral-50/50"
                required
              />

              {/* Veículos presentes no pátio para seleção rápida */}
              {parkedVehicles.length > 0 && (
                <div className="mt-1">
                  <span className="text-[10px] text-neutral-500 font-medium block mb-1">
                    Ou selecione um veículo no pátio:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {parkedVehicles.slice(0, 10).map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectParkedVehicle(v)}
                        className={`text-[11px] font-mono font-bold px-2 py-1 rounded-lg border transition ${
                          plate.toUpperCase() === v.plate.toUpperCase()
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50'
                        }`}
                      >
                        {formatPlateForDisplay(v.plate)}
                        {v.location && (
                          <span className="ml-1 text-[9px] opacity-75">({v.location})</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Local (Obrigatório) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Local Atual no Pátio *</span>
                </label>
                <span className="text-[10px] text-emerald-700 font-bold uppercase bg-emerald-50 px-2 py-0.5 rounded">
                  Obrigatório
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value.toUpperCase())}
                  placeholder="Ex: P1, P2, BOLSÃO 40, OFICINA, VAGA 12"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-neutral-300 font-bold uppercase text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-neutral-50/50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setIsLocationPickerOpen(true)}
                  className="px-3 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center gap-1 shrink-0 transition"
                  title="Selecionar setor ou vaga do pátio"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Vagas</span>
                </button>
              </div>

              {/* Botões rápidos de locais frequentes */}
              <div className="flex flex-wrap gap-1 mt-1">
                {['P1', 'P2', 'P3', 'BOLSÃO 40', 'BOLSÃO 51', 'R1', 'OFICINA', 'LAVAGEM', 'ADM'].map(
                  (loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocation(loc)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition ${
                        location.toUpperCase() === loc
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
                      }`}
                    >
                      {loc}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* 3. Observação (Opcional - observação) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-700">
                  Observação
                </label>
                <span className="text-[10px] text-neutral-500 uppercase bg-neutral-100 px-2 py-0.5 rounded">
                  Opcional
                </span>
              </div>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ex: Aguardando lavagem, chave no contato, sem avarias..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-neutral-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* 4. Combustível (Opcional) & 5. KM Odômetro (Opcional) */}
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex flex-col gap-3">
              <span className="text-[11px] font-black uppercase text-neutral-500 tracking-wider">
                Dados Complementares (Opcionais)
              </span>

              {/* Combustível */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                  <Fuel className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Nível de Combustível</span>
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 pt-1">
                  {(['1/8', '2/8', '3/8', '4/8', '5/8', '6/8', '7/8', '8/8'] as FuelLevel[]).map(
                    (level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() =>
                          setFuelLevel(fuelLevel === level ? undefined : level)
                        }
                        className={`py-1.5 px-1 rounded-lg text-xs font-bold border text-center transition ${
                          fuelLevel === level
                            ? 'bg-cyan-700 text-white border-cyan-800 ring-2 ring-cyan-400'
                            : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        {level}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* KM Odômetro */}
              <div className="flex flex-col gap-1 pt-1 border-t border-neutral-200/60">
                <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Km Odômetro</span>
                </label>
                <input
                  type="text"
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Ex: 45200"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-neutral-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                />
              </div>
            </div>

            {/* Botões de Ação do Formulário */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 font-bold text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 transition disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Gravando na Planilha...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salvar Inventário</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Registros de Inventário Realizados */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-black text-sm text-neutral-900 flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-emerald-700" />
            <span>Histórico de Inventário Realizado</span>
          </h3>
          <span className="text-xs font-bold text-neutral-500">
            {filteredList.length} registros
          </span>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por placa, local ou operador..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {loading && inventories.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-500">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold">Carregando inventários...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-2xl bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2">
            <ClipboardCheck className="w-8 h-8 text-neutral-400" />
            <span className="text-sm font-bold text-neutral-700">
              {searchQuery ? 'Nenhum inventário encontrado para a busca' : 'Nenhum inventário registrado ainda'}
            </span>
            <p className="text-xs text-neutral-500 max-w-xs">
              Toque no botão acima para registrar a localização de qualquer veículo no pátio.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredList.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-2xl bg-white border border-neutral-200 shadow-xs hover:border-emerald-300 transition flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white font-mono font-black text-sm tracking-wider shadow-xs">
                      {formatPlateForDisplay(inv.plate)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold text-xs border border-emerald-300 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-700" />
                      {inv.location}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(inv)}
                      className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition"
                      title="Compartilhar no WhatsApp"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    {isMaster && (
                      <button
                        type="button"
                        onClick={() => handleDelete(inv.id, inv.plate)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                        title="Excluir inventário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {inv.observation && (
                  <p className="text-xs text-neutral-700 bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                    <strong className="text-neutral-900">Obs:</strong> {inv.observation}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-100 text-[11px] text-neutral-500">
                  <div className="flex items-center gap-3">
                    {inv.fuelLevel && (
                      <span className="flex items-center gap-0.5 text-cyan-800 font-bold">
                        <Fuel className="w-3 h-3" />
                        {inv.fuelLevel}
                      </span>
                    )}
                    {inv.odometer && (
                      <span className="flex items-center gap-0.5 font-mono text-neutral-700 font-bold">
                        <Gauge className="w-3 h-3" />
                        {inv.odometer} KM
                      </span>
                    )}
                    <span className="flex items-center gap-0.5 text-neutral-600 font-medium">
                      <User className="w-3 h-3" />
                      {inv.operatorName}
                    </span>
                  </div>

                  <span className="flex items-center gap-1 text-[10px] text-neutral-400">
                    <Clock className="w-3 h-3" />
                    {inv.dateFormatted} às {inv.timeFormatted}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de seleção de vagas/setores do pátio */}
      <YardLocationPickerModal
        isOpen={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        onSelectLocation={(selectedLoc) => {
          setLocation(selectedLoc);
          setIsLocationPickerOpen(false);
        }}
        title="Selecionar Local no Pátio"
      />
    </div>
  );
};
