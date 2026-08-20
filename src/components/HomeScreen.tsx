import React from 'react';
import {
  Camera,
  Layers,
  Search,
  Fuel,
  MapPin,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Package,
} from 'lucide-react';
import { PatioMetrics } from '../types';

interface HomeScreenProps {
  onStartRegistration: () => void;
  onOpenPatio: () => void;
  onOpenHistory: () => void;
  onOpenTests: () => void;
  metrics: PatioMetrics;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartRegistration,
  onOpenPatio,
  onOpenHistory,
  onOpenTests,
  metrics,
}) => {
  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-130px)] max-w-md mx-auto w-full px-4 py-4 pb-20">
      {/* Top Hero Section */}
      <div className="flex flex-col items-center text-center w-full gap-3 pt-1">
        {/* Brand visual emblem */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-800 via-emerald-600 to-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-700/25 border-4 border-white text-white">
            <Camera className="w-10 h-10 text-white drop-shadow" />
          </div>
          <div className="absolute -bottom-1 -right-2 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[9px] font-black uppercase tracking-wider">
            Android 12+
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight leading-none">
            Registro Veicular CMDIT
          </h1>
          <p className="text-xs font-bold text-emerald-700 mt-1.5 tracking-wide uppercase">
            Fotografe • Escolha a Operação • Compartilhe
          </p>
          <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
            Entrada, Saída, PDC e 51 (Qualidade) com leitura ultrarrápida de placas e WhatsApp 100% offline.
          </p>
        </div>
      </div>

      {/* 4 Operations Quick Preview Cards */}
      <div className="w-full grid grid-cols-2 gap-2 my-2.5">
        <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <LogIn className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="text-[11px] font-black text-emerald-950 block leading-tight">
              Entrada
            </span>
            <span className="text-[9px] text-emerald-700 font-medium leading-none">
              Origem, Condutor, KM
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-700 text-white flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="text-[11px] font-black text-rose-950 block leading-tight">
              Saída
            </span>
            <span className="text-[9px] text-rose-700 font-medium leading-none">
              Destino, Condutor, KM
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-700 text-white flex items-center justify-center shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="text-[11px] font-black text-amber-950 block leading-tight">
              PDC
            </span>
            <span className="text-[9px] text-amber-700 font-medium leading-none">
              Placa + Combustível
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-700 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="text-[11px] font-black text-indigo-950 block leading-tight">
              51 (Qualidade)
            </span>
            <span className="text-[9px] text-indigo-700 font-medium leading-none">
              P1/P2/P3/R1 + Tag
            </span>
          </div>
        </div>
      </div>

      {/* Quick Patio Stats Overview Cards */}
      <div className="w-full grid grid-cols-2 gap-2 mb-3">
        {/* Patio Occupancy Card */}
        <button
          type="button"
          onClick={onOpenPatio}
          className="bg-white rounded-2xl p-3.5 border border-neutral-200 shadow-sm text-left hover:border-emerald-400 active:scale-95 transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Pátio & Vagas
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <span className="text-2xl font-black text-neutral-900 font-mono leading-none">
              {metrics.totalParked}
            </span>
            <span className="text-xs text-neutral-500 font-medium ml-1">veículos</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-emerald-700 font-bold mt-2 pt-2 border-t border-neutral-100">
            <span>Ver mapa de vagas</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </button>

        {/* Fleet Fuel Card */}
        <button
          type="button"
          onClick={onOpenPatio}
          className="bg-white rounded-2xl p-3.5 border border-neutral-200 shadow-sm text-left hover:border-emerald-400 active:scale-95 transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Combustível Frota
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Fuel className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <span className="text-2xl font-black text-neutral-900 font-mono leading-none">
              {metrics.averageFuelNumeric}
            </span>
            <span className="text-xs text-neutral-500 font-medium ml-1">/ 8 médio</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-emerald-700 font-bold mt-2 pt-2 border-t border-neutral-100">
            <span>{metrics.averageFuelPercent}% do tanque</span>
            <ArrowRight className="w-3 h-3" />
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
            <span>Buscar Placas</span>
          </button>

          <button
            type="button"
            onClick={onOpenTests}
            className="py-2.5 px-3 rounded-xl bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-50 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Testes OCR</span>
          </button>
        </div>

        {/* Offline & Architecture Reassurance */}
        <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-neutral-500">
          <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            100% Offline e Persistente
          </div>

          <span className="text-[10px] text-neutral-400 font-medium">
            Android 12+ Ready
          </span>
        </div>

        {/* Developer Signature */}
        <div className="pt-1 text-center text-[11px] text-neutral-400 font-medium">
          Desenvolvido por <span className="font-bold text-neutral-700">@omatheusbritto</span>
        </div>
      </div>
    </div>
  );
};
