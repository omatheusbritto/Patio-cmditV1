/**
 * Android 12+ Offline-First Storage Service
 * Uses IndexedDB for reliable, durable local storage with multi-megabyte capacity,
 * automatic fallback to localStorage, and fast metric calculations.
 */

import { FuelLevel, LocationCode, OperationType, PatioMetrics, SectorConfig, VehicleFleetType, VehicleRecord, VehicleStatus } from '../types';

const DB_NAME = 'cmdit_vehiclereg_db';
const STORE_NAME = 'vehicles';
const DB_VERSION = 3;

export const SECTORS: SectorConfig[] = [
  { code: 'P1', name: 'P1 - Poste 1', capacity: 12, description: 'Área do Poste 1 / Coberta', color: '#10b981' },
  { code: 'P2', name: 'P2 - Poste 2', capacity: 15, description: 'Área do Poste 2 / Triagem', color: '#06b6d4' },
  { code: 'P3', name: 'P3 - Poste 3', capacity: 20, description: 'Área do Poste 3 / Longa permanência', color: '#8b5cf6' },
  { code: 'R1', name: 'R1 - Rua 1', capacity: 8, description: 'Rua 1 / Inspeção e circulação', color: '#f59e0b' },
  { code: 'PDC', name: 'PDC - Desembarque / Carga', capacity: 10, description: 'Pátio de Carga e Guincho', color: '#ec4899' },
  { code: 'ADM', name: 'ADM - Administração', capacity: 6, description: 'Diretoria e Operacional', color: '#3b82f6' },
];

function fuelToNumber(fuel: FuelLevel): number {
  switch (fuel) {
    case '1/8': return 1;
    case '2/8': return 2;
    case '3/8': return 3;
    case '4/8': return 4;
    case '5/8': return 5;
    case '6/8': return 6;
    case '7/8': return 7;
    case '8/8': return 8;
    default: return 4;
  }
}

// Open IndexedDB
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('plate', 'plate', { unique: false });
        store.createIndex('location', 'location', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('operationType', 'operationType', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Initial sample data if storage is completely empty
const INITIAL_SEEDS: VehicleRecord[] = [
  {
    id: 'seed-1',
    createdAt: Date.now() - 1000 * 60 * 25, // 25 min ago
    photoDataUrl: '',
    plate: 'BRA2E19',
    plateSource: 'gemini_ai',
    operationType: 'entrada',
    driverName: 'Carlos Eduardo',
    origin: 'Filial Centro',
    km: '45210',
    hasSpareKey: true,
    fleetType: 'RAC',
    fuel: '6/8',
    location: 'P1',
    status: 'parked',
    notes: 'Entrada registrada sem avarias'
  },
  {
    id: 'seed-2',
    createdAt: Date.now() - 1000 * 60 * 65, // 1h ago
    photoDataUrl: '',
    plate: 'ABC1D23',
    plateSource: 'gemini_ai',
    operationType: 'qualidade_51',
    fuel: '3/8',
    characteristic: '🟠 REVENDA',
    location: 'P2',
    status: 'parked',
    notes: 'Inspeção 51 (Qualidade) realizada'
  },
  {
    id: 'seed-3',
    createdAt: Date.now() - 1000 * 60 * 140, // 2h ago
    photoDataUrl: '',
    plate: 'RIO2A18',
    plateSource: 'gemini_ai',
    operationType: 'pdc',
    fuel: '2/8',
    location: 'PDC',
    status: 'parked',
    notes: 'Desembarque de carreta'
  },
  {
    id: 'seed-4',
    createdAt: Date.now() - 1000 * 60 * 210, // 3.5h ago
    photoDataUrl: '',
    plate: 'ABC1234',
    plateSource: 'local_ocr',
    operationType: 'saida',
    driverName: 'Roberto Silva',
    destination: 'Aeroporto Santos Dumont',
    km: '89120',
    hasSpareKey: false,
    fleetType: 'GF',
    fuel: '7/8',
    location: 'R1',
    status: 'released',
    releasedAt: Date.now() - 1000 * 60 * 30,
    notes: 'Saída liberada para atendimento corporativo'
  },
  {
    id: 'seed-5',
    createdAt: Date.now() - 1000 * 60 * 320, // 5h ago
    photoDataUrl: '',
    plate: 'ABC12D3',
    plateSource: 'gemini_ai',
    operationType: 'qualidade_51',
    fuel: '8/8',
    characteristic: '🟢 CONSUMIDOR',
    location: 'P1',
    status: 'parked',
    notes: 'Liberado na qualidade 51'
  }
];

export async function getAllRecords(): Promise<VehicleRecord[]> {
  // First try to fetch fresh records from server (shared across all devices)
  try {
    const res = await fetch('/api/records');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.records) && data.records.length > 0) {
        // Update local IndexedDB / localStorage cache in background
        data.records.forEach((r: VehicleRecord) => {
          saveRecordToLocalCache(r);
        });
        const sorted = [...data.records].sort((a, b) => b.createdAt - a.createdAt);
        return sorted;
      }
    }
  } catch (netErr) {
    console.warn('Servidor offline para buscar registros, usando cache local:', netErr);
  }

  // Fallback to local IndexedDB / localStorage
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records: VehicleRecord[] = request.result || [];
        if (records.length === 0) {
          // Check localStorage legacy or seed
          try {
            const localLegacy = localStorage.getItem('cmdit_records_v3') || localStorage.getItem('cmdit_records_v2');
            if (localLegacy) {
              const parsed: VehicleRecord[] = JSON.parse(localLegacy);
              if (parsed.length > 0) {
                parsed.forEach(r => saveRecord(r));
                return resolve(parsed);
              }
            }
          } catch {
            // ignore
          }
          // Populate seeds
          INITIAL_SEEDS.forEach(s => saveRecord(s));
          resolve(INITIAL_SEEDS);
        } else {
          // Sort newest first
          records.sort((a, b) => b.createdAt - a.createdAt);
          resolve(records);
        }
      };

      request.onerror = () => {
        resolve(getFallbackLocalStorage());
      };
    });
  } catch {
    return getFallbackLocalStorage();
  }
}

function getFallbackLocalStorage(): VehicleRecord[] {
  try {
    const saved = localStorage.getItem('cmdit_records_v3') || localStorage.getItem('cmdit_records_v2');
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return INITIAL_SEEDS;
}

async function saveRecordToLocalCache(record: VehicleRecord): Promise<void> {
  const normalized: VehicleRecord = {
    ...record,
    plate: (record.plate || '').toUpperCase().trim(),
    driverName: record.driverName ? record.driverName.toUpperCase().trim() : undefined,
    origin: record.origin ? record.origin.toUpperCase().trim() : undefined,
    destination: record.destination ? record.destination.toUpperCase().trim() : undefined,
    km: record.km ? String(record.km).toUpperCase().trim() : undefined,
    fleetType: record.fleetType ? String(record.fleetType).toUpperCase().trim() : undefined,
    entryReason: record.entryReason ? record.entryReason.toUpperCase().trim() : undefined,
    liters: record.liters ? String(record.liters).toUpperCase().trim() : undefined,
    fuelType: record.fuelType ? record.fuelType.toUpperCase().trim() : undefined,
    characteristic: record.characteristic ? (String(record.characteristic).toUpperCase().trim() as any) : undefined,
    notes: record.notes ? record.notes.toUpperCase().trim() : undefined,
    status: record.status || 'parked',
    operationType: record.operationType || 'entrada',
  };

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(normalized);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // ignore
  }

  try {
    const current = getFallbackLocalStorage();
    const existingIdx = current.findIndex(r => r.id === normalized.id);
    if (existingIdx >= 0) {
      current[existingIdx] = normalized;
    } else {
      current.unshift(normalized);
    }
    localStorage.setItem('cmdit_records_v3', JSON.stringify(current));
  } catch {
    // ignore
  }
}

export async function saveRecord(record: VehicleRecord): Promise<void> {
  const normalized: VehicleRecord = {
    ...record,
    plate: (record.plate || '').toUpperCase().trim(),
    driverName: record.driverName ? record.driverName.toUpperCase().trim() : undefined,
    origin: record.origin ? record.origin.toUpperCase().trim() : undefined,
    destination: record.destination ? record.destination.toUpperCase().trim() : undefined,
    km: record.km ? String(record.km).toUpperCase().trim() : undefined,
    fleetType: record.fleetType ? String(record.fleetType).toUpperCase().trim() : undefined,
    entryReason: record.entryReason ? record.entryReason.toUpperCase().trim() : undefined,
    liters: record.liters ? String(record.liters).toUpperCase().trim() : undefined,
    fuelType: record.fuelType ? record.fuelType.toUpperCase().trim() : undefined,
    characteristic: record.characteristic ? (String(record.characteristic).toUpperCase().trim() as any) : undefined,
    notes: record.notes ? record.notes.toUpperCase().trim() : undefined,
    status: record.status || 'parked',
    operationType: record.operationType || 'entrada',
  };

  // 1. Save to local cache first
  await saveRecordToLocalCache(normalized);

  // 2. Sync to central server so other devices see it
  try {
    await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });
  } catch (err) {
    console.warn('Não foi possível sincronizar registro com o servidor:', err);
  }
}

export async function updateRecordStatus(id: string, status: VehicleStatus): Promise<void> {
  try {
    const records = await getAllRecords();
    const target = records.find(r => r.id === id);
    if (target) {
      target.status = status;
      if (status === 'released') {
        target.releasedAt = Date.now();
      } else {
        target.releasedAt = undefined;
      }
      await saveRecord(target);
    }
  } catch (err) {
    console.warn('Update status error:', err);
  }
}

export async function deleteRecord(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete error:', err);
  }

  try {
    const current = getFallbackLocalStorage().filter(r => r.id !== id);
    localStorage.setItem('cmdit_records_v3', JSON.stringify(current));
  } catch {
    // ignore
  }

  try {
    await fetch(`/api/records/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Não foi possível sincronizar exclusão com o servidor:', err);
  }
}

export async function clearAllRecords(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Clear error:', err);
  }

  try {
    localStorage.removeItem('cmdit_records_v3');
    localStorage.removeItem('cmdit_records_v2');
  } catch {
    // ignore
  }

  try {
    await fetch('/api/records/clear', { method: 'POST' });
  } catch (err) {
    console.warn('Não foi possível sincronizar limpeza com o servidor:', err);
  }
}

/**
 * Calculates real-time patio occupancy and fleet fuel statistics
 */
export function calculatePatioMetrics(records: VehicleRecord[]): PatioMetrics {
  const parkedVehicles = records.filter(r => r.status === 'parked');
  const releasedVehicles = records.filter(r => r.status === 'released');

  let totalEntradas = 0;
  let totalSaidas = 0;
  let totalAbastecimento = 0;
  let totalPdc = 0;
  let totalQualidade = 0;

  records.forEach(r => {
    if (r.operationType === 'entrada') totalEntradas++;
    else if (r.operationType === 'saida') totalSaidas++;
    else if (r.operationType === 'abastecimento') totalAbastecimento++;
    else if (r.operationType === 'pdc') totalPdc++;
    else if (r.operationType === 'qualidade_51') totalQualidade++;
  });

  const sectorOccupancy: Record<LocationCode, { count: number; capacity: number; percent: number; isFull: boolean }> = {
    P1: { count: 0, capacity: 12, percent: 0, isFull: false },
    P2: { count: 0, capacity: 15, percent: 0, isFull: false },
    P3: { count: 0, capacity: 20, percent: 0, isFull: false },
    R1: { count: 0, capacity: 8, percent: 0, isFull: false },
    PDC: { count: 0, capacity: 10, percent: 0, isFull: false },
    ADM: { count: 0, capacity: 6, percent: 0, isFull: false },
  };

  SECTORS.forEach(sec => {
    const count = parkedVehicles.filter(v => v.location === sec.code).length;
    const percent = Math.min(100, Math.round((count / sec.capacity) * 100));
    sectorOccupancy[sec.code] = {
      count,
      capacity: sec.capacity,
      percent,
      isFull: count >= sec.capacity
    };
  });

  // Calculate Fleet Fuel Average for currently parked vehicles
  let totalFuelSum = 0;
  let criticalFuelCount = 0;

  if (parkedVehicles.length > 0) {
    parkedVehicles.forEach(v => {
      const val = fuelToNumber(v.fuel);
      totalFuelSum += val;
      if (val <= 2) {
        criticalFuelCount++;
      }
    });
  }

  const averageFuelNumeric = parkedVehicles.length > 0
    ? Number((totalFuelSum / parkedVehicles.length).toFixed(1))
    : 0;

  const averageFuelPercent = Math.round((averageFuelNumeric / 8) * 100);

  // Characteristic count
  const characteristicCount: Record<string, number> = {
    'REVENDA': 0,
    'CONSUMIDOR': 0,
    'DT': 0,
    'OUTROS': 0,
  };

  parkedVehicles.forEach(v => {
    if (v.characteristic?.includes('REVENDA')) characteristicCount['REVENDA']++;
    else if (v.characteristic?.includes('CONSUMIDOR')) characteristicCount['CONSUMIDOR']++;
    else if (v.characteristic?.includes('DT')) characteristicCount['DT']++;
    else characteristicCount['OUTROS']++;
  });

  return {
    totalRecords: records.length,
    totalParked: parkedVehicles.length,
    totalReleased: releasedVehicles.length,
    totalEntradas,
    totalSaidas,
    totalAbastecimento,
    totalPdc,
    totalQualidade,
    averageFuelNumeric,
    averageFuelPercent,
    criticalFuelCount,
    sectorOccupancy,
    characteristicCount,
  };
}

/**
 * Export records as CSV spreadsheet for Excel / Google Sheets
 * 11 colunas fiéis requisitadas:
 * Data | Hora | Condutor | Placa | Origem | Destino | KM (Odômetro) | Nível do Combustível | Litros Abastecidos | Tipo de Combustível | Observações
 */
export function exportRecordsToCsv(records: VehicleRecord[]): void {
  const headers = [
    'Data',
    'Hora',
    'Condutor',
    'Placa',
    'Origem',
    'Destino',
    'KM (Odômetro)',
    'Nível do Combustível',
    'Litros Abastecidos',
    'Tipo de Combustível',
    'Observações',
  ];

  const rows = records.map((r) => {
    const d = new Date(r.createdAt || Date.now());
    const dateStr = d.toLocaleDateString('pt-BR');
    const timeStr = d.toLocaleTimeString('pt-BR');
    const condutor = String(r.driverName || 'OPERADOR').toUpperCase().trim();
    const placa = (r.plate || '').toUpperCase().trim();
    const origem = String(r.origin || (r.operationType === 'entrada' ? 'PÁTIO PRINCIPAL' : '-')).toUpperCase().trim();
    const destino = String(
      r.destination ||
      (r.operationType === 'pdc'
        ? 'FILA PDC (LAVAGEM/OFICINA)'
        : r.operationType === 'qualidade_51' && r.location
        ? `PÁTIO ${r.location}`
        : '-')
    ).toUpperCase().trim();

    const kmStr = r.km ? `${String(r.km).replace(/\s*km/i, '').toUpperCase().trim()} KM` : '-';
    
    let fuelStr = r.fuel || '-';
    if (fuelStr === '1/8') fuelStr = '1/8 (RESERVA)';
    else if (fuelStr === '2/8') fuelStr = '2/8 (1/4)';
    else if (fuelStr === '3/8') fuelStr = '3/8';
    else if (fuelStr === '4/8' || fuelStr === '4/8 • 1/2' || fuelStr === 'Meio Tanque (1/2)') fuelStr = '4/8 (1/2)';
    else if (fuelStr === '5/8') fuelStr = '5/8';
    else if (fuelStr === '6/8') fuelStr = '6/8 (3/4)';
    else if (fuelStr === '7/8') fuelStr = '7/8';
    else if (fuelStr === '8/8' || fuelStr === '8/8 • Cheio' || fuelStr === 'Tanque Cheio') fuelStr = '8/8 (CHEIO)';
    else fuelStr = fuelStr.toUpperCase();

    const litersStr = r.liters ? `${String(r.liters).toUpperCase().trim()} L` : '-';
    const fuelTypeStr = String(r.fuelType || (r.operationType === 'abastecimento' ? 'DIESEL S10' : '-')).toUpperCase().trim();

    const extras: string[] = [];
    if (r.hasSpareKey !== undefined) extras.push(`CHAVE: ${r.hasSpareKey ? 'SIM' : 'NÃO'}`);
    if (r.fleetType) extras.push(`FROTA: ${String(r.fleetType).toUpperCase().trim()}`);
    if (r.entrySubtype) extras.push(`SUBTIPO: ${String(r.entrySubtype).toUpperCase().trim()}`);
    if (r.entryReason) extras.push(`MOTIVO: ${String(r.entryReason).toUpperCase().trim()}`);
    if (r.characteristic) extras.push(`CARACT: ${String(r.characteristic).toUpperCase().trim()}`);
    if (r.location) extras.push(`LOCAL: ${String(r.location).toUpperCase().trim()}`);

    let obsFull = r.notes || r.description || '';
    if (extras.length > 0) {
      const extraStr = `[${extras.join(' | ')}]`;
      obsFull = obsFull ? `${extraStr} ${obsFull.toUpperCase().trim()}` : extraStr;
    }
    if (!obsFull) obsFull = '-';
    obsFull = obsFull.toUpperCase().trim();

    return [
      dateStr,
      timeStr,
      condutor,
      placa,
      origem,
      destino,
      kmStr,
      fuelStr,
      litersStr,
      fuelTypeStr,
      obsFull.replace(/"/g, '""'),
    ];
  });

  const csvContent =
    '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.map((v) => `"${v}"`).join(';'))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `registro_veicular_cmdit_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
