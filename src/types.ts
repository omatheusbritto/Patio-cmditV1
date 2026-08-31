export type FuelLevel = '1/8' | '2/8' | '3/8' | '4/8' | '5/8' | '6/8' | '7/8' | '8/8';

export type VehicleCharacteristic = '🟣 DT' | '🟠 REVENDA' | '🟢 CONSUMIDOR' | '⚪ OUTROS';

export type LocationCode = 'P1' | 'P2' | 'P3' | 'R1' | 'ADM' | 'PDC';

export type QualityLocationCode = 'P1' | 'P2' | 'P3' | 'R1' | 'ADM';

export type OperationType = 'entrada' | 'saida' | 'abastecimento' | 'pdc' | 'qualidade_51';

export type EntrySubtype = 'bolsao_40' | 'retorno' | 'recusa' | 'remocao_adesivos';

export type VehicleFleetType = 'GF' | 'RAC' | 'OUTROS' | string;

export type VehicleStatus = 'parked' | 'released';

export type NavTab = 'register' | 'patio' | 'history';

export type Step =
  | 'home'
  | 'camera'
  | 'ocr_processing'
  | 'plate_confirm'
  | 'operation_select'
  | 'operation_details'
  | 'dashboard_camera'
  | 'fueling_details'
  | 'fuel'
  | 'characteristic'
  | 'location'
  | 'review';

export interface VehicleRecord {
  id: string;
  createdAt: number;
  photoDataUrl: string;
  photoBlob?: Blob;
  dashboardPhotoUrl?: string;
  dashboardPhotoBlob?: Blob;
  documentPhotoUrl?: string;
  documentPhotoBlob?: Blob;
  plate: string;
  plateSource?: 'local_ocr' | 'gemini_ai' | 'manual';
  rawOcrText?: string;
  aiDetails?: string;
  
  // Operation specifics
  operationType: OperationType;
  driverName?: string;
  origin?: string;
  destination?: string;
  km?: string | number;
  hasSpareKey?: boolean;
  fleetType?: VehicleFleetType;
  entrySubtype?: EntrySubtype;
  entryReason?: string;

  // Fueling specifics
  liters?: string | number;
  fuelType?: string;

  // General fields
  fuel: FuelLevel;
  characteristic?: VehicleCharacteristic | null;
  location?: LocationCode;
  
  description?: string;
  status: VehicleStatus;
  releasedAt?: number;
  notes?: string;
}

export interface SectorConfig {
  code: LocationCode;
  name: string;
  capacity: number;
  description: string;
  color: string;
}

export interface PatioMetrics {
  totalRecords: number;
  totalParked: number;
  totalReleased: number;
  totalEntradas: number;
  totalSaidas: number;
  totalAbastecimento: number;
  totalPdc: number;
  totalQualidade: number;
  averageFuelNumeric: number; // 1 to 8
  averageFuelPercent: number; // 0 to 100%
  criticalFuelCount: number; // <= 2/8
  sectorOccupancy: Record<LocationCode, {
    count: number;
    capacity: number;
    percent: number;
    isFull: boolean;
  }>;
  characteristicCount: Record<string, number>;
}

export interface OcrResult {
  plate: string;
  confidence: number;
  rawText: string;
  isMercosul: boolean;
  isValid: boolean;
}

export type UserRole =
  | 'master'
  | 'patio'
  | 'qualidade_51'
  | 'pdc'
  | 'combustivel'
  | 'entrada_saida'
  | 'operador'
  | 'vistoriador'
  | 'motorista';

export interface UserAccount {
  id: string;
  username: string; // Matrícula ou nome de usuário
  name: string;
  role: UserRole;
  password?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
}

export interface AuthSession {
  user: {
    id: string;
    username: string;
    name: string;
    role: UserRole;
  };
  loginTimestamp: number;
  expiresAt: number; // 9 horas após login
}

/**
 * Retorna a lista de operações permitidas para cada perfil de operador
 */
export function getAllowedOperationsForRole(role?: UserRole): OperationType[] {
  switch (role) {
    case 'master':
    case 'patio':
    case 'operador':
      return ['entrada', 'saida', 'abastecimento', 'pdc', 'qualidade_51'];
    case 'qualidade_51':
    case 'vistoriador':
      return ['qualidade_51'];
    case 'pdc':
      return ['pdc'];
    case 'combustivel':
      return ['abastecimento'];
    case 'entrada_saida':
    case 'motorista':
      return ['entrada', 'saida'];
    default:
      return ['entrada', 'saida', 'abastecimento', 'pdc', 'qualidade_51'];
  }
}

/**
 * Retorna o título legível da função/cargo
 */
export function getRoleDisplayName(role?: UserRole): string {
  switch (role) {
    case 'master':
      return 'Administrador Master';
    case 'patio':
    case 'operador':
      return 'Operador do Pátio';
    case 'qualidade_51':
    case 'vistoriador':
      return 'Operador 51 Qualidade';
    case 'pdc':
      return 'Operador da Fila PDC';
    case 'combustivel':
      return 'Operador do Combustível';
    case 'entrada_saida':
    case 'motorista':
      return 'Operador de Entrada e Saída';
    default:
      return 'Operador de Pátio';
  }
}

/**
 * Retorna a cor e estilo do badge da função
 */
export function getRoleBadgeStyle(role?: UserRole): { label: string; badgeClass: string } {
  switch (role) {
    case 'master':
      return {
        label: 'Master Total',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      };
    case 'patio':
    case 'operador':
      return {
        label: 'Operador Geral do Pátio',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
      };
    case 'qualidade_51':
    case 'vistoriador':
      return {
        label: '51 Qualidade (P1-P3, R1, ADM)',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
      };
    case 'pdc':
      return {
        label: 'Fila PDC',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    case 'combustivel':
      return {
        label: 'Combustível / Abastecimento',
        badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      };
    case 'entrada_saida':
    case 'motorista':
      return {
        label: 'Entrada e Saída',
        badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
      };
    default:
      return {
        label: 'Operador',
        badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-300',
      };
  }
}
