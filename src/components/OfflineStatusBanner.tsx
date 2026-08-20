import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Zap, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const OfflineStatusBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnectedAlert, setShowReconnectedAlert] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedAlert(true);
      const timer = setTimeout(() => setShowReconnectedAlert(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="bg-amber-600 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-2 shadow-inner">
        <Zap className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
        <span>⚡ Modo Offline 100% Ativo • Salvando tudo no aparelho (Android 12+)</span>
      </div>
    );
  }

  if (showReconnectedAlert) {
    return (
      <div className="bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-2 transition-all">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
        <span>Conexão restabelecida • Sincronização e IA ativas</span>
      </div>
    );
  }

  return null;
};
