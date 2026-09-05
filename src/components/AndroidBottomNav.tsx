import React from 'react';
import { Camera, Layers, History, ShieldCheck, ArrowLeftRight } from 'lucide-react';
import { NavTab } from '../types';

interface AndroidBottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  parkedCount: number;
  historyCount: number;
  isMaster?: boolean;
}

export const AndroidBottomNav: React.FC<AndroidBottomNavProps> = ({
  activeTab,
  onSelectTab,
  parkedCount,
  historyCount,
  isMaster = false,
}) => {
  const allTabs = [
    {
      id: 'register' as NavTab,
      label: 'Registrar',
      icon: Camera,
      badge: null,
      masterOnly: false,
    },
    {
      id: 'patio' as NavTab,
      label: 'Pátio & Vagas',
      icon: Layers,
      badge: parkedCount > 0 ? parkedCount : null,
      masterOnly: false,
    },
    {
      id: 'movimentacao' as NavTab,
      label: 'Movimentação',
      icon: ArrowLeftRight,
      badge: null,
      masterOnly: false,
    },
    {
      id: 'history' as NavTab,
      label: 'Histórico',
      icon: History,
      badge: historyCount > 0 ? historyCount : null,
      masterOnly: false,
    },
    {
      id: 'logs' as NavTab,
      label: 'Logs',
      icon: ShieldCheck,
      badge: null,
      masterOnly: true,
    },
  ];

  const tabs = allTabs.filter((tab) => !tab.masterOnly || isMaster);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200/80 shadow-lg select-none pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto px-3 py-1 flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all duration-200 relative active:scale-95 min-h-[48px] ${
                isActive ? 'text-emerald-800 font-bold' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {/* Android 12 Material You Pill indicator */}
              <div
                className={`w-12 h-7 rounded-full flex items-center justify-center transition-all duration-200 relative ${
                  isActive ? 'bg-emerald-100 text-emerald-900 shadow-sm' : 'bg-transparent text-neutral-500'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />

                {/* Badge indicator */}
                {tab.badge !== null && (
                  <span className="absolute -top-1 -right-1 px-1.5 min-w-[18px] h-[18px] rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center border-2 border-white shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className={`text-[10px] tracking-tight mt-0.5 leading-none ${isActive ? 'font-black text-emerald-900' : 'font-semibold'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
