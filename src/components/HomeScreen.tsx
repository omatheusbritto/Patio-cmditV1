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
import { GoogleSheetsIntegration } from './GoogleSheetsIntegration';

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
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-130px)] max-w-md mx-auto w-full px-4 py-4 pb-20 gap-3">
      {/* Top Hero Section */}
      <div className="flex flex-col items-center text-center w-full gap-2 pt-1">
        {/* Brand visual emblem */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-800 via-emerald-600 to-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-700/25 border-4 border-white text-white">
          <Camera className="w-8 h-8 text-white drop-shadow" />
        </div>

        <div>
          <h1 className="text-xl font-black text-neutral-900 tracking-tight leading-none">
            Registro Veicular CMDIT
          </h1>
          <p className="text-[11px] font-bold text-emerald-700 mt-1 tracking-wide uppercase">
            Fotografe • Escolha a Operação • Compartilhe
          </p>
        </div>
      </div>

      {/* Main Action Button */}
      <div className="w-full flex flex-col gap-2">
        <button
          type="button"
          onClick={onStartRegistration}
          className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 active:scale-98 transition group cursor-pointer"
        >
          <Camera className="w-6 h-6 group-hover:rotate-6 transition transform" />
          <span>Fotografar e Registrar</span>
        </button>
      </div>

      {/* Google Sheets / Drive Integration Card */}
      <div className="w-full">
        <GoogleSheetsIntegration />
      </div>

      {/* Quick Patio Stats Overview Card */}
      <div className="w-full">
        {/* Patio Occupancy Card */}
        <button
          type="button"
          onClick={onOpenPatio}
          className="w-full bg-white rounded-2xl p-3 border border-neutral-200 shadow-sm text-left hover:border-emerald-400 active:scale-98 transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Pátio & Vagas
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-neutral-900 font-mono leading-none">
                  {metrics.totalParked}
                </span>
                <span className="text-[11px] text-neutral-500 font-medium">veículos no pátio</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            <span>Ver Mapa</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </button>
      </div>

      {/* Fast Navigation Buttons */}
      <div className="w-full grid grid-cols-2 gap-2">
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
  );
};
