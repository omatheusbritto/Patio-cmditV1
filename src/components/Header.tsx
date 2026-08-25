import React from 'react';
import { Car, CheckCircle2, RotateCcw, History, FileSpreadsheet } from 'lucide-react';
import { Step } from '../types';
import { getCurrentSession } from '../utils/authService';

interface HeaderProps {
  currentStep: Step;
  onReset: () => void;
  onOpenHistory: () => void;
  onOpenSpreadsheetOnline?: () => void;
  historyCount: number;
}

const STEP_CONFIG: Record<Step, { label: string; number: number }> = {
  home: { label: 'Início', number: 0 },
  camera: { label: 'Fotografar', number: 1 },
  ocr_processing: { label: 'Lendo Placa', number: 1 },
  plate_confirm: { label: 'Placa', number: 1 },
  operation_select: { label: 'Operação', number: 2 },
  operation_details: { label: 'Detalhes', number: 3 },
  dashboard_camera: { label: 'Foto Painel', number: 3 },
  fueling_details: { label: 'Abastecimento', number: 3 },
  fuel: { label: 'Combustível', number: 3 },
  characteristic: { label: 'Característica', number: 4 },
  location: { label: 'Local', number: 4 },
  review: { label: 'Revisão & Envio', number: 5 },
};

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  onReset,
  onOpenHistory,
  onOpenSpreadsheetOnline,
  historyCount,
}) => {
  const stepInfo = STEP_CONFIG[currentStep] || { label: 'Registro', number: 1 };
  const totalSteps = 5;
  const isFlow = currentStep !== 'home';
  const session = getCurrentSession();
  const isMaster = session?.user.role === 'master' || session?.user.username.toLowerCase() === 'mastercmdit';

  return (
    <header className="bg-emerald-800 text-white shadow-md sticky top-0 z-30 select-none border-b border-emerald-700">
      <div className="max-w-md mx-auto px-4 py-3">
        {/* Top bar with branding */}
        <div className="flex items-center justify-between">
          <div
            onClick={onReset}
            className="flex items-center gap-2 cursor-pointer active:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shadow-inner text-white font-black text-lg tracking-tighter">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black tracking-tight text-base leading-none text-white">
                  Registro Veicular
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-emerald-100 border border-emerald-500">
                  CMDIT
                </span>
              </div>
              <p className="text-[11px] text-emerald-200 font-medium leading-none mt-0.5">
                por @omatheusbritto
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {/* Master Spreadsheet Consultation Quick Button */}
            {isMaster && onOpenSpreadsheetOnline && (
              <button
                onClick={onOpenSpreadsheetOnline}
                title="Consultar Planilha Online (5 Abas)"
                className="p-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-700 active:scale-95 text-emerald-200 transition-colors flex items-center gap-1 text-xs border border-emerald-600/50"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                <span className="hidden sm:inline font-bold text-[11px]">Planilha</span>
              </button>
            )}

            <button
              onClick={onOpenHistory}
              title="Histórico de Registros"
              className="p-2 rounded-lg bg-emerald-900/60 hover:bg-emerald-700 active:scale-95 text-emerald-200 transition-colors relative flex items-center gap-1 text-xs"
            >
              <History className="w-4 h-4 text-emerald-300" />
              {historyCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-400 text-emerald-950 font-bold text-[10px] flex items-center justify-center">
                  {historyCount}
                </span>
              )}
            </button>

            {isFlow && (
              <button
                onClick={onReset}
                title="Reiniciar fluxo"
                className="p-2 rounded-lg bg-emerald-900/60 hover:bg-emerald-700 active:scale-95 text-emerald-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-emerald-300" />
              </button>
            )}
          </div>
        </div>

        {/* Step Progress indicator when inside flow */}
        {isFlow && stepInfo.number > 0 && (
          <div className="mt-2.5 pt-2 border-t border-emerald-700/60">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-200 mb-1.5">
              <span>
                Etapa {stepInfo.number} de {totalSteps}:{' '}
                <strong className="text-white">{stepInfo.label}</strong>
              </span>
              <span className="text-[11px] font-bold text-emerald-300">
                {Math.round((stepInfo.number / totalSteps) * 100)}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-emerald-950/60 rounded-full overflow-hidden flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-full flex-1 rounded-full transition-all duration-300 ${
                    s <= stepInfo.number ? 'bg-emerald-400' : 'bg-emerald-900/80'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
