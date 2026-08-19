import React from 'react';
import { Camera, CheckCircle2, Fuel, MapPin, Tag, Share2, Sparkles, ShieldCheck, Zap } from 'lucide-react';

interface HomeScreenProps {
  onStartRegistration: () => void;
  onOpenTests: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onStartRegistration, onOpenTests }) => {
  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-80px)] max-w-md mx-auto w-full px-4 py-6">
      {/* Top Hero Section */}
      <div className="flex flex-col items-center text-center w-full gap-4 pt-2">
        {/* Brand visual emblem */}
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-700/25 border-4 border-white text-white">
            <Camera className="w-12 h-12 text-white drop-shadow" />
          </div>
          <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[10px] font-black uppercase tracking-wider">
            OCR Local
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight leading-none">
            Registro Veicular CMDIT
          </h1>
          <p className="text-xs font-bold text-emerald-700 mt-2 tracking-wide uppercase">
            Fotografe • Confira • Compartilhe
          </p>
          <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
            Leitura ultrarrápida e precisa de placas, nível de combustível, características e envio direto para WhatsApp.
          </p>
        </div>
      </div>

      {/* Visual Step Guide (Indicador das etapas do registro) */}
      <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 my-4 flex flex-col gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          Fluxo de Registro Rápido
        </span>

        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="flex flex-col items-center p-2 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold mb-1">
              1
            </div>
            <span className="text-[11px] font-bold text-emerald-900 leading-tight">Foto & Placa</span>
            <span className="text-[9px] text-emerald-700">OCR on-device</span>
          </div>

          <div className="flex flex-col items-center p-2 rounded-xl bg-neutral-50 border border-neutral-200">
            <div className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-xs font-bold mb-1">
              2
            </div>
            <span className="text-[11px] font-bold text-neutral-800 leading-tight">Combustível</span>
            <span className="text-[9px] text-neutral-500">1/8 a 8/8</span>
          </div>

          <div className="flex flex-col items-center p-2 rounded-xl bg-neutral-50 border border-neutral-200">
            <div className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-xs font-bold mb-1">
              3
            </div>
            <span className="text-[11px] font-bold text-neutral-800 leading-tight">Característica</span>
            <span className="text-[9px] text-neutral-500">Opcional</span>
          </div>

          <div className="flex flex-col items-center p-2 rounded-xl bg-neutral-50 border border-neutral-200">
            <div className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-xs font-bold mb-1">
              4
            </div>
            <span className="text-[11px] font-bold text-neutral-800 leading-tight">Local</span>
            <span className="text-[9px] text-neutral-500">P1 a PDC</span>
          </div>
        </div>
      </div>

      {/* Main Action Button */}
      <div className="w-full flex flex-col gap-3 pb-4">
        <button
          type="button"
          onClick={onStartRegistration}
          className="w-full py-5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 active:scale-98 transition group"
        >
          <Camera className="w-7 h-7 group-hover:rotate-6 transition transform" />
          <span>Fotografar veículo</span>
        </button>

        {/* Diagnostic & Offline reassurance */}
        <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-neutral-500">
          <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            Visão Computacional & OCR
          </div>

          <button
            onClick={onOpenTests}
            className="text-emerald-700 hover:underline font-bold flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Testes
          </button>
        </div>

        {/* Developer signature */}
        <div className="pt-2 text-center text-xs text-neutral-400 font-medium">
          Desenvolvido por <span className="font-bold text-neutral-700">@omatheusbritto</span>
        </div>
      </div>
    </div>
  );
};
