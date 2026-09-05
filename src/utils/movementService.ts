import { VehicleMovement } from '../types';
import { getCurrentSession } from './authService';

export async function fetchMovements(): Promise<VehicleMovement[]> {
  try {
    const res = await fetch('/api/movements');
    if (!res.ok) throw new Error('Falha ao buscar movimentações');
    const data = await res.json();
    return data.movements || [];
  } catch (err) {
    console.warn('fetchMovements error, loading cached from localStorage:', err);
    try {
      const cached = localStorage.getItem('cached_movements');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  }
}

export async function createMovement(movementData: {
  plate: string;
  origin: string;
  destination: string;
  observation: string;
  fuelLevel?: string;
  odometer?: number | string;
  operatorName?: string;
  photoUrl?: string;
}): Promise<{ success: boolean; movement?: VehicleMovement; message?: string }> {
  try {
    const session = getCurrentSession();
    const operatorName =
      movementData.operatorName || session?.user.name || session?.user.username || 'Operador CMDIT';

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateFormatted = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const timeFormatted = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const payload = {
      ...movementData,
      operatorName,
      dateFormatted,
      timeFormatted,
    };

    const res = await fetch('/api/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || 'Erro ao registrar movimentação' };
    }

    // Cache locally
    try {
      const cachedList: VehicleMovement[] = JSON.parse(
        localStorage.getItem('cached_movements') || '[]'
      );
      cachedList.unshift(data.movement);
      localStorage.setItem('cached_movements', JSON.stringify(cachedList.slice(0, 100)));
    } catch {}

    return { success: true, movement: data.movement };
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro de conexão ao salvar movimentação' };
  }
}

export async function deleteMovement(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/movements/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    console.warn('deleteMovement error:', err);
    return false;
  }
}

// --------------------------------------------------------------------------
// BACKUP E RESTAURAÇÃO DO BANCO DE DADOS (RENDER / POSTGRESQL) - MASTER ONLY
// --------------------------------------------------------------------------

export async function downloadDatabaseBackup(): Promise<void> {
  const session = getCurrentSession();
  const res = await fetch('/api/database/backup', {
    headers: {
      'x-user-role': session?.user.role || '',
      'x-user-name': session?.user.username || '',
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Erro ao gerar backup' }));
    throw new Error(err.message || 'Falha ao baixar backup do banco de dados');
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_patiocmdit_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function restoreDatabaseBackup(backupJsonData: any): Promise<{
  success: boolean;
  message: string;
  restoredCounts?: any;
  errors?: string[];
}> {
  const session = getCurrentSession();
  const res = await fetch('/api/database/restore', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': session?.user.role || '',
      'x-user-name': session?.user.username || '',
    },
    body: JSON.stringify({ backup: backupJsonData }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Falha ao restaurar banco de dados');
  }

  return data;
}
