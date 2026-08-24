export type FuelLevel = '1/8' | '2/8' | '3/8' | '4/8' | '5/8' | '6/8' | '7/8' | '8/8';

export type VehicleCharacteristic = '🟣 DT' | '🟠 REVENDA' | '🟢 CONSUMIDOR' | '⚪ OUTROS';

export type LocationCode = 'P1' | 'P2' | 'P3' | 'R1' | 'ADM' | 'PDC';

export type QualityLocationCode = 'P1' | 'P2' | 'P3' | 'R1';

export type OperationType = 'entrada' | 'saida' | 'abastecimento' | 'pdc' | 'qualidade_51';

export type EntrySubtype = 'bolsao_40' | 'retorno' | 'recusa' | 'remocao_adesivos';

export type VehicleFleetType = 'RAC' | 'GF' | 'OUTROS' | string;

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

export type UserRole = 'master' | 'operador' | 'vistoriador' | 'motorista';

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
  expiresAt: number; // 8 horas após login
}
