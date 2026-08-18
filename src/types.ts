export type FuelLevel = '1/8' | '2/8' | '3/8' | '4/8' | '5/8' | '6/8' | '7/8' | '8/8';

export type VehicleCharacteristic = '🟠 REVENDA' | '🟢 CONSUMIDOR' | '🔵 DT';

export type LocationCode = 'P1' | 'P2' | 'P3' | 'R1' | 'ADM' | 'PDC';

export type Step = 'home' | 'camera' | 'ocr_processing' | 'plate_confirm' | 'fuel' | 'characteristic' | 'location' | 'review';

export interface VehicleRecord {
  id: string;
  createdAt: number;
  photoDataUrl: string;
  photoBlob?: Blob;
  plate: string;
  plateSource?: 'local_ocr' | 'gemini_ai' | 'manual';
  rawOcrText?: string;
  aiDetails?: string;
  fuel: FuelLevel;
  characteristic?: VehicleCharacteristic | null;
  location: LocationCode;
  description: string;
}

export interface OcrResult {
  plate: string;
  confidence: number;
  rawText: string;
  isMercosul: boolean;
  isValid: boolean;
}
