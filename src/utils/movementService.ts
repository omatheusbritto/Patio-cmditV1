import { VehicleMovement } from '../types';
import { getCurrentSession } from './authService';
import { getStoredDriveConfig } from './googleDriveClient';

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

    const driveConfig = getStoredDriveConfig();

    const payload = {
      ...movementData,
      operatorName,
      dateFormatted,
      timeFormatted,
      webhookUrl: driveConfig.webhookUrl || undefined,
      spreadsheetId: driveConfig.spreadsheetId || undefined,
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

export async function updateMovement(
  id: string,
  updateData: Partial<VehicleMovement>
): Promise<{ success: boolean; movement?: VehicleMovement; message?: string }> {
  try {
    const session = getCurrentSession();
    const res = await fetch(`/api/movements/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': session?.user.role || 'master',
        'x-user-username': session?.user.username || '',
      },
      body: JSON.stringify(updateData),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || 'Falha ao atualizar movimentação' };
    }

    // Atualiza cache local
    try {
      const cachedList: VehicleMovement[] = JSON.parse(
        localStorage.getItem('cached_movements') || '[]'
      );
      const idx = cachedList.findIndex((m) => m.id === id);
      if (idx !== -1) {
        cachedList[idx] = data.movement;
        localStorage.setItem('cached_movements', JSON.stringify(cachedList));
      }
    } catch {}

    return { success: true, movement: data.movement, message: data.message };
  } catch (err: any) {
    console.warn('updateMovement error:', err);
    return { success: false, message: err.message || 'Erro de conexão ao atualizar movimentação' };
  }
}

export async function deleteMovement(id: string): Promise<{ success: boolean; message?: string }> {
  try {
    const session = getCurrentSession();
    const res = await fetch(`/api/movements/${id}`, {
      method: 'DELETE',
      headers: {
        'x-user-role': session?.user.role || 'master',
        'x-user-username': session?.user.username || '',
      },
    });
    const data = await res.json();

    // Remove do cache local se sucesso
    if (data.success) {
      try {
        const cachedList: VehicleMovement[] = JSON.parse(
          localStorage.getItem('cached_movements') || '[]'
        );
        const filtered = cachedList.filter((m) => m.id !== id);
        localStorage.setItem('cached_movements', JSON.stringify(filtered));
      } catch {}
    }

    return { success: Boolean(data.success), message: data.message };
  } catch (err: any) {
    console.warn('deleteMovement error:', err);
    return { success: false, message: err.message };
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
      'Accept': 'application/json',
      'x-user-role': session?.user.role || 'master',
      'x-user-username': session?.user.username || 'mastercmdit',
      'x-user-name': session?.user.name || '',
    },
    body: JSON.stringify({ backup: backupJsonData }),
  });

  const responseText = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error('O servidor retornou uma resposta não-JSON ao restaurar backup.');
  }

  if (!res.ok || !data.success) {
    throw new Error(data?.message || data?.error || 'Falha ao restaurar banco de dados');
  }

  return data;
}
