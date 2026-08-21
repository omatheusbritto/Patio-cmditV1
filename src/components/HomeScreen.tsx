import React from 'react';
import {
  Camera,
  Layers,
  Search,
  MapPin,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Fuel,
  Wrench,
} from 'lucide-react';
import { PatioMetrics } from '../types';

interface HomeScreenProps {
  onStartRegistration: () => void;
  onOpenPatio: () => void;
  onOpenHistory: () => void;
  metrics: PatioMetrics;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartRegistration,
  onOpenPatio,
  onOpenHistory,
  metrics,
}) => {
  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-130px)] max-w-md mx-auto w-full px-4 py-4 pb-20">
      {/* Top Hero Section */}
      <div className="flex flex-col items-center text-center w-full gap-3 pt-1">
        {/* Brand visual emblem */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-800 via-emerald-600 to-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-700/25 border-4 border-white text-white">
          <Camera className="w-10 h-10 text-white drop-shadow" />
        </div>

        <div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight leading-none">
            Registro Veicular CMDIT
          </h1>
          <p className="text-xs font-bold text-emerald-700 mt-1.5 tracking-wide uppercase">
            Fotografe • Escolha a Operação • Compartilhe
          </p>
          <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
            Entrada, Saída, Abastecimento, Fila PDC e 51 (Qualidade) com leitura rápida de placas e compartilhamento via WhatsApp.
          </p>
        </div>
      </div>

      {/* Operations Quick Preview Cards */}
      <div className="w-full grid grid-cols-3 gap-2 my-2.5">
        <div className="p-2 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex flex-col items-center text-center gap-1">
          <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <LogIn className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-black text-emerald-950 block leading-tight">
              Entrada
            </span>
            <span className="text-[8.5px] text-emerald-700 font-medium leading-none">
              Origem & KM
            </span>
          </div>
        </div>

        <div className="p-2 rounded-2xl bg-rose-50 border border-rose-200/80 flex flex-col items-center text-center gap-1">
          <div className="w-7 h-7 rounded-lg bg-rose-700 text-white flex items-center justify-center shrink-0">
            <LogOut className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-black text-rose-950 block leading-tight">
              Saída
            </span>
            <span className="text-[8.5px] text-rose-700 font-medium leading-none">
              Destino & KM
            </span>
          </div>
        </div>

        <div className="p-2 rounded-2xl bg-cyan-50 border border-cyan-200/80 flex flex-col items-center text-center gap-1">
          <div className="w-7 h-7 rounded-lg bg-cyan-700 text-white flex items-center justify-center shrink-0">
            <Fuel className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-black text-cyan-950 block leading-tight">
              Abastecer
            </span>
            <span className="text-[8.5px] text-cyan-700 font-medium leading-none">
              Painel + Odôm.
            </span>
          </div>
        </div>

        <div className="p-2 rounded-2xl bg-amber-50 border border-amber-200/80 flex flex-col items-center text-center gap-1 col-span-1.5">
          <div className="w-7 h-7 rounded-lg bg-amber-700 text-white flex items-center justify-center shrink-0">
            <Wrench className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-black text-amber-950 block leading-tight">
              Fila PDC
            </span>
            <span className="text-[8.5px] text-amber-700 font-medium leading-none">
              Manutenção
            </span>
          </div>
        </div>

        <div className="p-2 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex flex-col items-center text-center gap-1 col-span-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-700 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] font-black text-indigo-950 block leading-tight">
              51 (Qualidade)
            </span>
            <span className="text-[8.5px] text-indigo-700 font-medium leading-none">
              Setores P1, P2, P3, R1
            </span>
          </div>
        </div>
      </div>

      {/* Quick Patio Stats Overview Card */}
      <div className="w-full mb-3">
        {/* Patio Occupancy Card */}
        <button
          type="button"
          onClick={onOpenPatio}
          className="w-full bg-white rounded-2xl p-3.5 border border-neutral-200 shadow-sm text-left hover:border-emerald-400 active:scale-98 transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Pátio & Vagas
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-neutral-900 font-mono leading-none">
                  {metrics.totalParked}
                </span>
                <span className="text-xs text-neutral-500 font-medium">veículos estacionados</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <span>Ver Mapa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* Main Action Button */}
      <div className="w-full flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onStartRegistration}
          className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 active:scale-98 transition group cursor-pointer"
        >
          <Camera className="w-6 h-6 group-hover:rotate-6 transition transform" />
          <span>Fotografar e Registrar</span>
        </button>

        {/* Fast Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenHistory}
            className="py-2.5 px-3 rounded-xl bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-50 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
          >
            <Search className="w-3.5 h-3.5 text-emerald-700" />
            <span>Buscar no Histórico</span>
          </button>

          <button
            type="button"
            onClick={onOpenPatio}
            className="py-2.5 px-3 rounded-xl bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-50 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            <span>Consultar Pátio</span>
          </button>
        </div>
      </div>
    </div>
  );
};
