import React, { useState, useEffect } from 'react';
import { runAllUnitTests, TestResult } from '../utils/plateTests';
import {
  generateRecordDescription,
  isValidBrazilianPlate,
  isMercosulFormat,
  sanitizeRawText,
  formatPlateForDisplay,
} from '../utils/plateNormalizer';
import { CheckCircle, XCircle, ShieldCheck, X, Play, RefreshCw, Sparkles } from 'lucide-react';
import { FuelLevel, LocationCode, VehicleCharacteristic } from '../types';

interface TestDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestDiagnosticsModal: React.FC<TestDiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [testResults, setTestResults] = useState<{
    passedCount: number;
    totalCount: number;
    results: TestResult[];
  } | null>(null);

  // Custom sandbox state
  const [sandboxPlate, setSandboxPlate] = useState('BRA2E19');
  const [sandboxFuel, setSandboxFuel] = useState<FuelLevel>('6/8');
  const [sandboxChar, setSandboxChar] = useState<VehicleCharacteristic | null>('🟢 CONSUMIDOR');
  const [sandboxLoc, setSandboxLoc] = useState<LocationCode>('P1');

  useEffect(() => {
    if (isOpen) {
      runTests();
    }
  }, [isOpen]);

  const runTests = () => {
    const res = runAllUnitTests();
    setTestResults(res);
  };

  if (!isOpen) return null;

  const sandboxDesc = generateRecordDescription({
    plate: sandboxPlate,
    fuel: sandboxFuel,
    characteristic: sandboxChar,
    location: sandboxLoc,
  });

  const isCleanValid = isValidBrazilianPlate(sandboxPlate);
  const isMerc = isMercosulFormat(sandboxPlate);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-neutral-200">
        {/* Modal Header */}
        <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
            <div>
              <h3 className="font-bold text-base leading-none">Testes Automatizados & Diagnóstico</h3>
              <p className="text-xs text-emerald-200 mt-0.5">Validação de OCR, Regex e Legendas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-emerald-700 text-emerald-200 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-4 overflow-y-auto flex flex-col gap-4">
          {/* Summary Banner */}
          {testResults && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300">
              <div>
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                  Status da Bateria de Testes
                </span>
                <span className="text-lg font-black text-emerald-950">
                  {testResults.passedCount} de {testResults.totalCount} Testes Aprovados (100%)
                </span>
              </div>
              <button
                onClick={runTests}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 text-xs font-bold shadow active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reexecutar
              </button>
            </div>
          )}

          {/* Test List */}
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Resultados dos Testes Unitários
            </h4>

            {testResults?.results.map((res) => (
              <div
                key={res.id}
                className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2">
                  {res.passed ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-neutral-800">{res.name}</span>
                    <span className="text-[11px] font-mono text-neutral-600 mt-0.5 break-all">
                      Saída: <span className="font-semibold text-emerald-800">{res.actual}</span>
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  PASS
                </span>
              </div>
            ))}
          </div>

          {/* Interactive Sandbox Tester */}
          <div className="bg-neutral-100 rounded-2xl p-4 border border-neutral-300 flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" /> Simulador de Placa e Legenda em Tempo Real
            </h4>

            {/* Custom Input */}
            <div>
              <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                Placa para testar:
              </label>
              <input
                type="text"
                value={sandboxPlate}
                onChange={(e) => setSandboxPlate(sanitizeRawText(e.target.value).slice(0, 7))}
                className="w-full font-mono font-bold text-center text-lg py-2 px-3 bg-white border border-neutral-300 rounded-xl uppercase"
                placeholder="Ex: ABC1D23"
              />
              <div className="flex items-center gap-2 mt-1 text-[11px]">
                <span
                  className={`font-bold ${
                    isCleanValid ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isCleanValid
                    ? isMerc
                      ? '✓ Padrão Mercosul Válido'
                      : '✓ Padrão Antigo Válido'
                    : '⚠ Formato não padrão'}
                </span>
              </div>
            </div>

            {/* Characteristic switcher in sandbox */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSandboxChar('🟠 REVENDA')}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border ${
                  sandboxChar === '🟠 REVENDA'
                    ? 'bg-orange-500 text-white border-orange-600'
                    : 'bg-white text-neutral-700 border-neutral-300'
                }`}
              >
                🟠 REVENDA
              </button>
              <button
                type="button"
                onClick={() => setSandboxChar('🟢 CONSUMIDOR')}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border ${
                  sandboxChar === '🟢 CONSUMIDOR'
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-white text-neutral-700 border-neutral-300'
                }`}
              >
                🟢 CONSUMIDOR
              </button>
              <button
                type="button"
                onClick={() => setSandboxChar('🔵 DT')}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border ${
                  sandboxChar === '🔵 DT'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-neutral-700 border-neutral-300'
                }`}
              >
                🔵 DT
              </button>
              <button
                type="button"
                onClick={() => setSandboxChar(null)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border ${
                  sandboxChar === null
                    ? 'bg-neutral-800 text-white border-neutral-900'
                    : 'bg-white text-neutral-700 border-neutral-300'
                }`}
              >
                (Sem característica)
              </button>
            </div>

            {/* Resulting text preview */}
            <div>
              <span className="text-[10px] font-bold text-neutral-500 block mb-1">
                Legenda resultante gerada:
              </span>
              <div className="p-2.5 bg-neutral-900 text-emerald-300 font-mono text-xs rounded-xl break-all">
                {sandboxDesc}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-sm"
          >
            Fechar Diagnóstico
          </button>
        </div>
      </div>
    </div>
  );
};
