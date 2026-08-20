import React from 'react';
import { OperationType } from '../types';
import {
  LogIn,
  LogOut,
  Package,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Check,
} from 'lucide-react';

interface OperationSelectorProps {
  plate: string;
  selectedOperation: OperationType | null;
  onSelectOperation: (operation: OperationType) => void;
  onBack: () => void;
}

interface OperationOption {
  id: OperationType;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  fieldsText: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  borderColor: string;
  selectedBg: string;
}

const OPERATIONS: OperationOption[] = [
  {
    id: 'entrada',
    title: 'Entrada',
    badge: 'Condutor + KM + Chave',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Registro de chegada de veículo na unidade',
    fieldsText: 'Condutor • Origem • KM • Combustível • Chave Reserva • RAC/GF',
    icon: LogIn,
    accentColor: 'text-emerald-700',
    borderColor: 'hover:border-emerald-500',
    selectedBg: 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500',
  },
  {
    id: 'saida',
    title: 'Saída',
    badge: 'Condutor + Destino',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'Liberação ou saída de veículo do pátio',
    fieldsText: 'Condutor • Destino • KM • Combustível • Chave Reserva • RAC/GF',
    icon: LogOut,
    accentColor: 'text-rose-700',
    borderColor: 'hover:border-rose-500',
    selectedBg: 'border-rose-600 bg-rose-50/50 ring-2 ring-rose-500',
  },
  {
    id: 'pdc',
    title: 'PDC (Desembarque)',
    badge: 'Rápido • 2 Campos',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Pátio de desembarque, guincho ou carga',
    fieldsText: 'Placa • Nível de Combustível',
    icon: Package,
    accentColor: 'text-amber-700',
    borderColor: 'hover:border-amber-500',
    selectedBg: 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-500',
  },
  {
    id: 'qualidade_51',
    title: '51 (Qualidade)',
    badge: 'Inspeção & Setores',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'Vistoria de qualidade e endereçamento nos postes/rua',
    fieldsText: 'Placa • Local (P1, P2, P3, R1) • Combustível • Característica',
    icon: ShieldCheck,
    accentColor: 'text-indigo-700',
    borderColor: 'hover:border-indigo-500',
    selectedBg: 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500',
  },
];

export const OperationSelector: React.FC<OperationSelectorProps> = ({
  plate,
  selectedOperation,
  onSelectOperation,
  onBack,
}) => {
  return (
    <div className="flex flex-col gap-3.5 max-w-md mx-auto w-full pb-10">
      {/* Header Info */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
            Etapa 2 • Tipo de Registro
          </span>
          <span className="text-xs font-mono font-bold bg-neutral-900 text-white px-2.5 py-1 rounded-lg">
            {plate}
          </span>
        </div>

        <h2 className="text-xl font-black text-neutral-900 leading-tight">
          Selecione a Operação
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Escolha a finalidade do registro deste veículo
        </p>
      </div>

      {/* Operation Cards */}
      <div className="flex flex-col gap-2.5">
        {OPERATIONS.map((op) => {
          const Icon = op.icon;
          const isSelected = selectedOperation === op.id;

          return (
            <button
              key={op.id}
              type="button"
              onClick={() => onSelectOperation(op.id)}
              className={`w-full p-4 rounded-2xl border text-left transition active:scale-[0.98] shadow-sm flex flex-col gap-2 relative bg-white ${
                isSelected ? op.selectedBg : `border-neutral-200 ${op.borderColor} hover:bg-neutral-50`
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      isSelected
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-neutral-900 leading-none">
                      {op.title}
                    </h3>
                    <span className="text-[11px] text-neutral-500 mt-0.5 block">
                      {op.description}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${op.badgeColor}`}
                  >
                    {op.badge}
                  </span>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-500 font-medium">
                <span className="truncate pr-2 font-mono text-neutral-600">
                  {op.fieldsText}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Back Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onBack}
          className="w-full py-3.5 px-4 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Placa
        </button>
      </div>
    </div>
  );
};
