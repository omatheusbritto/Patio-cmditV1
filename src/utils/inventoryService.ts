import { VehicleMovement, VehicleInventory } from '../types';
import { getCurrentSession } from './authService';
import { getStoredDriveConfig } from './googleDriveClient';

export async function fetchInventories(): Promise<VehicleInventory[]> {
  try {
    const res = await fetch('/api/inventories');
    if (!res.ok) throw new Error('Falha ao buscar inventários');
    const data = await res.json();
    return data.inventories || [];
  } catch (err) {
    console.warn('fetchInventories error, loading cached from localStorage:', err);
    try {
      const cached = localStorage.getItem('cached_inventories');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  }
}

export async function createInventory(inventoryData: {
  plate: string;
  location: string;
  observation?: string;
  fuelLevel?: string;
  odometer?: number | string;
  operatorName?: string;
  photoUrl?: string;
}): Promise<{ success: boolean; inventory?: VehicleInventory; message?: string }> {
  try {
    const session = getCurrentSession();
    const operatorName =
      inventoryData.operatorName || session?.user.name || session?.user.username || 'Operador CMDIT';

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateFormatted = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const timeFormatted = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const driveConfig = getStoredDriveConfig();

    const payload = {
      ...inventoryData,
      operatorName,
      dateFormatted,
      timeFormatted,
      webhookUrl: driveConfig.webhookUrl || undefined,
      spreadsheetId: driveConfig.spreadsheetId || undefined,
    };

    const res = await fetch('/api/inventories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, message: data.message || 'Erro ao registrar inventário' };
    }

    // Cache locally
    try {
      const cachedList: VehicleInventory[] = JSON.parse(
        localStorage.getItem('cached_inventories') || '[]'
      );
      cachedList.unshift(data.inventory);
      localStorage.setItem('cached_inventories', JSON.stringify(cachedList.slice(0, 100)));
    } catch {}

    return { success: true, inventory: data.inventory };
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro de conexão ao salvar inventário' };
  }
}

export async function updateInventory(
  id: string,
  updateData: Partial<VehicleInventory>
): Promise<{ success: boolean; inventory?: VehicleInventory; message?: string }> {
  try {
    const session = getCurrentSession();
    const res = await fetch(`/api/inventories/${id}`, {
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
      return { success: false, message: data.message || 'Falha ao atualizar inventário' };
    }

    // Atualiza cache local
    try {
      const cachedList: VehicleInventory[] = JSON.parse(
        localStorage.getItem('cached_inventories') || '[]'
      );
      const idx = cachedList.findIndex((i) => i.id === id);
      if (idx !== -1) {
        cachedList[idx] = data.inventory;
        localStorage.setItem('cached_inventories', JSON.stringify(cachedList));
      }
    } catch {}

    return { success: true, inventory: data.inventory, message: data.message };
  } catch (err: any) {
    console.warn('updateInventory error:', err);
    return { success: false, message: err.message || 'Erro de conexão ao atualizar inventário' };
  }
}

export async function deleteInventory(id: string): Promise<{ success: boolean; message?: string }> {
  try {
    const session = getCurrentSession();
    const res = await fetch(`/api/inventories/${id}`, {
      method: 'DELETE',
      headers: {
        'x-user-role': session?.user.role || 'master',
        'x-user-username': session?.user.username || '',
      },
    });
    const data = await res.json();

    if (data.success) {
      try {
        const cachedList: VehicleInventory[] = JSON.parse(
          localStorage.getItem('cached_inventories') || '[]'
        );
        const filtered = cachedList.filter((i) => i.id !== id);
        localStorage.setItem('cached_inventories', JSON.stringify(filtered));
      } catch {}
    }

    return { success: Boolean(data.success), message: data.message };
  } catch (err) {
    console.warn('deleteInventory error:', err);
    return { success: false };
  }
}
