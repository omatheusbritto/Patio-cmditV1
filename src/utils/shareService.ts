import { EntrySubtype, OperationType, VehicleFleetType, VehicleRecord } from '../types';
import { combineTwoPhotos } from './imageOptimizer';

/**
 * Helper to convert Data URL to a Blob/File for native Web Share API
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export interface ShareOptions {
  photoDataUrl?: string;
  dashboardPhotoDataUrl?: string;
  description: string;
  plate: string;
}

export interface ShareResult {
  success: boolean;
  method: 'web_share_files' | 'whatsapp_intent' | 'whatsapp_link' | 'clipboard_fallback';
  message: string;
}

export interface FormattedVehicleMessageData {
  operationType: OperationType;
  plate: string;
  fuel: string;
  driverName?: string;
  origin?: string;
  destination?: string;
  km?: string | number;
  hasSpareKey?: boolean;
  fleetType?: VehicleFleetType;
  entrySubtype?: EntrySubtype;
  entryReason?: string;
  liters?: string | number;
  fuelType?: string;
  location?: string;
  characteristic?: string | null;
  notes?: string;
  timestamp?: Date;
}

export function getLocationMeaning(loc?: string): string {
  if (!loc) return '';
  switch (loc.toUpperCase()) {
    case 'P1':
      return 'P1 (POSTE 1)';
    case 'P2':
      return 'P2 (POSTE 2)';
    case 'P3':
      return 'P3 (POSTE 3)';
    case 'R1':
      return 'R1 (RUA 1)';
    case 'PDC':
      return 'PDC (PÁTIO DESEMBARQUE / CARGA)';
    case 'ADM':
      return 'ADM (ADMINISTRAÇÃO)';
    default:
      return loc.toUpperCase();
  }
}

export function getEntrySubtypeLabel(subtype?: EntrySubtype): string {
  switch (subtype) {
    case 'bolsao_40':
      return 'BOLSÃO 40';
    case 'retorno':
      return 'RETORNO';
    case 'recusa':
      return 'RECUSA';
    case 'remocao_adesivos':
      return 'REMOÇÃO DE ADESIVOS';
    default:
      return subtype ? String(subtype).toUpperCase() : '';
  }
}

/**
 * Format fuel level with uppercase label
 */
export function formatFuelLevelCaption(fuel?: string): string {
  if (!fuel) return '';
  const clean = fuel.trim();
  if (clean === '1/8') return '1/8 (RESERVA)';
  if (clean === '2/8') return '2/8 (1/4)';
  if (clean === '3/8') return '3/8';
  if (clean === '4/8' || clean.includes('1/2')) return '4/8 (1/2)';
  if (clean === '5/8') return '5/8';
  if (clean === '6/8' || clean.includes('3/4')) return '6/8 (3/4)';
  if (clean === '7/8') return '7/8';
  if (clean === '8/8' || clean.toLowerCase().includes('cheio')) return '8/8 (CHEIO)';
  return clean.toUpperCase();
}

/**
 * Strips emoji characters from text
 */
export function stripEmojis(str: string): string {
  return str
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F251}\u{2B50}\u{2B55}\u{FE0F}\u{200D}]/gu, '')
    .trim();
}

/**
 * Generates formatted Brazilian vehicle caption customized by Operation Type.
 * All text fields and values are rendered strictly in UPPERCASE.
 */
export function generateWhatsAppMessage(data: FormattedVehicleMessageData): string {
  const lines: string[] = [];

  // Helper to check if a value has meaningful content (not empty, null, undefined, or "Não informado")
  const hasValue = (val: unknown): boolean => {
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return false;
      const lower = trimmed.toLowerCase();
      return lower !== 'não informado' && lower !== 'não informada' && lower !== 'sem característica' && lower !== '-';
    }
    if (typeof val === 'number') return !isNaN(val);
    return true;
  };

  const toUpper = (val: unknown): string => {
    return String(val ?? '').toUpperCase().trim();
  };

  const cleanPlate = toUpper(data.plate);
  const fuelDisplay = formatFuelLevelCaption(data.fuel);

  switch (data.operationType) {
    case 'entrada':
      if (hasValue(data.plate)) lines.push(`*Placa:* ${cleanPlate}`);
      if (hasValue(data.driverName)) lines.push(`*Condutor:* ${toUpper(data.driverName)}`);
      if (hasValue(data.origin)) lines.push(`*Origem:* ${toUpper(data.origin)}`);
      if (hasValue(data.destination)) lines.push(`*Destino:* ${toUpper(data.destination)}`);
      if (hasValue(data.km)) lines.push(`*KM:* ${toUpper(data.km).replace(/\s*KM/i, '')} KM`);
      if (hasValue(data.fuel)) lines.push(`*Combustível:* ${fuelDisplay}`);
      if (data.hasSpareKey !== undefined) {
        lines.push(`*Chave Reserva:* ${data.hasSpareKey ? 'SIM' : 'NÃO'}`);
      }
      if (hasValue(data.fleetType)) {
        lines.push(`*Tipo de Veículo:* ${toUpper(data.fleetType)}`);
      }
      if (data.entrySubtype && data.entrySubtype !== 'bolsao_40' && data.entrySubtype !== 'remocao_adesivos') {
        const subtypeLabel = getEntrySubtypeLabel(data.entrySubtype);
        if (subtypeLabel) lines.push(`*Ocorrência:* ${subtypeLabel}`);
        if ((data.entrySubtype === 'retorno' || data.entrySubtype === 'recusa') && hasValue(data.entryReason)) {
          lines.push(`*Motivo do ${subtypeLabel}:* ${toUpper(data.entryReason)}`);
        }
      } else if (data.entrySubtype === 'retorno' || data.entrySubtype === 'recusa') {
        const subtypeLabel = getEntrySubtypeLabel(data.entrySubtype);
        if ((data.entrySubtype === 'retorno' || data.entrySubtype === 'recusa') && hasValue(data.entryReason)) {
          lines.push(`*Motivo do ${subtypeLabel}:* ${toUpper(data.entryReason)}`);
        }
      }
      break;

    case 'saida':
      if (hasValue(data.plate)) lines.push(`*Placa:* ${cleanPlate}`);
      if (hasValue(data.driverName)) lines.push(`*Condutor:* ${toUpper(data.driverName)}`);
      if (hasValue(data.destination)) lines.push(`*Destino:* ${toUpper(data.destination)}`);
      if (hasValue(data.km)) lines.push(`*KM:* ${toUpper(data.km).replace(/\s*KM/i, '')} KM`);
      if (hasValue(data.fuel)) lines.push(`*Combustível:* ${fuelDisplay}`);
      if (data.hasSpareKey !== undefined) {
        lines.push(`*Chave Reserva:* ${data.hasSpareKey ? 'SIM' : 'NÃO'}`);
      }
      if (hasValue(data.fleetType)) {
        lines.push(`*Tipo de Veículo:* ${toUpper(data.fleetType)}`);
      }
      break;

    case 'abastecimento':
      if (hasValue(data.plate)) lines.push(`*Placa:* ${cleanPlate}`);
      if (hasValue(data.km)) lines.push(`*Odômetro:* ${toUpper(data.km).replace(/\s*KM/i, '')} KM`);
      if (hasValue(data.fuel)) lines.push(`*Nível do combustível:* ${fuelDisplay}`);
      if (hasValue(data.destination)) lines.push(`*Destino:* ${toUpper(data.destination)}`);
      if (hasValue(data.driverName)) lines.push(`*Condutor:* ${toUpper(data.driverName)}`);
      if (hasValue(data.liters)) lines.push(`*Litros:* ${toUpper(data.liters).replace(/\s*L/i, '')} L`);
      if (hasValue(data.fuelType)) lines.push(`*Tipo de Combustível:* ${toUpper(data.fuelType)}`);
      break;

    case 'pdc':
      if (hasValue(data.plate)) lines.push(`*Placa:* ${cleanPlate}`);
      if (hasValue(data.fuel)) lines.push(`*Combustível:* ${fuelDisplay}`);
      if (hasValue(data.driverName)) lines.push(`*Condutor:* ${toUpper(data.driverName)}`);
      if (hasValue(data.km)) lines.push(`*KM:* ${toUpper(data.km).replace(/\s*KM/i, '')} KM`);
      break;

    case 'qualidade_51':
      if (hasValue(data.plate)) lines.push(`*Placa:* ${cleanPlate}`);
      if (hasValue(data.location)) lines.push(`*Local:* ${getLocationMeaning(data.location)}`);
      if (hasValue(data.characteristic)) lines.push(`*Característica:* ${toUpper(data.characteristic)}`);
      if (hasValue(data.fuel)) lines.push(`*Combustível:* ${fuelDisplay}`);
      break;

    default:
      if (hasValue(data.plate)) lines.push(`*Placa:* ${cleanPlate}`);
      if (hasValue(data.location)) lines.push(`*Local:* ${getLocationMeaning(data.location)}`);
      if (hasValue(data.characteristic)) lines.push(`*Característica:* ${toUpper(data.characteristic)}`);
      if (hasValue(data.fuel)) lines.push(`*Combustível:* ${fuelDisplay}`);
      if (hasValue(data.driverName)) lines.push(`*Condutor:* ${toUpper(data.driverName)}`);
      if (hasValue(data.km)) lines.push(`*KM:* ${toUpper(data.km).replace(/\s*KM/i, '')} KM`);
      break;
  }

  if (hasValue(data.notes)) {
    lines.push(`*Observação:* ${toUpper(data.notes)}`);
  }

  return lines.join('\n');
}

/**
 * Open WhatsApp with pre-filled message text
 */
export function openWhatsAppShare(text: string): void {
  const encodedText = encodeURIComponent(text);
  const whatsappUri = `whatsapp://send?text=${encodedText}`;
  const webUrl = `https://api.whatsapp.com/send?text=${encodedText}`;

  try {
    const link = document.createElement('a');
    link.href = whatsappUri;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    window.open(webUrl, '_blank');
  }
}

/**
 * Execute native WhatsApp share with Image file(s) + Text Caption.
 * When both Plate and Dashboard photos are present (e.g. Abastecimento),
 * it generates a crisp composite image containing BOTH photos side-by-side / stacked
 * with timestamps and labels, ensuring WhatsApp Mobile receives both photos together with 100% reliability.
 */
export async function shareToWhatsApp(options: ShareOptions): Promise<ShareResult> {
  const { photoDataUrl, dashboardPhotoDataUrl, description, plate } = options;
  const safePlate = plate ? plate.replace(/[^a-zA-Z0-9]/g, '') : 'veiculo';
  const timestamp = Date.now();

  const files: File[] = [];

  // If we have both photos (Plate and Dashboard), create a combined high-res image
  if (photoDataUrl && dashboardPhotoDataUrl) {
    try {
      const combinedDataUrl = await combineTwoPhotos({
        photo1Url: photoDataUrl,
        photo2Url: dashboardPhotoDataUrl,
        plate: safePlate,
        operationTitle: 'COMPROVANTE DE ABASTECIMENTO',
        tag1: '📸 1. PLACA DO VEÍCULO',
        tag2: '⛽ 2. PAINEL / ODÔMETRO',
      });

      const filename = `abastecimento_completo_${safePlate}_${timestamp}.jpg`;
      files.push(dataUrlToFile(combinedDataUrl, filename));
    } catch (e) {
      console.warn('Erro ao gerar imagem combinada das 2 fotos:', e);
      // Fallback: push individual files
      files.push(dataUrlToFile(photoDataUrl, `1_placa_${safePlate}_${timestamp}.jpg`));
      files.push(dataUrlToFile(dashboardPhotoDataUrl, `2_painel_${safePlate}_${timestamp}.jpg`));
    }
  } else if (photoDataUrl) {
    try {
      const filename1 = `registro_${safePlate}_${timestamp}.jpg`;
      files.push(dataUrlToFile(photoDataUrl, filename1));
    } catch (e) {
      console.warn('Erro ao processar foto da placa para compartilhamento:', e);
    }
  } else if (dashboardPhotoDataUrl) {
    try {
      const filename2 = `painel_${safePlate}_${timestamp}.jpg`;
      files.push(dataUrlToFile(dashboardPhotoDataUrl, filename2));
    } catch (e) {
      console.warn('Erro ao processar foto do painel para compartilhamento:', e);
    }
  }

  if (files.length > 0) {
    try {
      // 1. Try Native Web Share API with files (Supported in modern Android Chrome / WebViews)
      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({
          files,
          text: description,
          title: `Registro Veicular ${safePlate}`,
        });

        return {
          success: true,
          method: 'web_share_files',
          message: dashboardPhotoDataUrl
            ? 'Enviando comprovante com as 2 fotos (Placa e Painel) + legenda para o WhatsApp!'
            : 'Compartilhado com sucesso via seletor nativo!',
        };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          method: 'web_share_files',
          message: 'Compartilhamento cancelado pelo usuário.',
        };
      }
      console.warn('Native file share error, trying WhatsApp URI fallback:', error);
    }
  }

  // 2. Fallback: Direct WhatsApp Android Protocol URI
  try {
    openWhatsAppShare(description);
    return {
      success: true,
      method: 'whatsapp_intent',
      message: 'Abrindo WhatsApp com a legenda formatada...',
    };
  } catch (error) {
    console.warn('WhatsApp protocol error:', error);
  }

  // 3. Clipboard fallback
  try {
    await navigator.clipboard.writeText(description);
    return {
      success: true,
      method: 'clipboard_fallback',
      message: 'Legenda copiada para a área de transferência!',
    };
  } catch {
    return {
      success: false,
      method: 'clipboard_fallback',
      message: 'Compartilhamento não concluído.',
    };
  }
}

/**
 * Share single photo directly to WhatsApp (useful when user wants to send photo 2 separately)
 */
export async function shareSinglePhoto(
  dataUrl: string,
  plate: string,
  label: string,
  text: string
): Promise<ShareResult> {
  const safePlate = plate ? plate.replace(/[^a-zA-Z0-9]/g, '') : 'veiculo';
  const timestamp = Date.now();
  const file = dataUrlToFile(dataUrl, `${label}_${safePlate}_${timestamp}.jpg`);

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        text,
        title: `Foto ${label} - ${safePlate}`,
      });
      return { success: true, method: 'web_share_files', message: `Foto enviada!` };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'web_share_files', message: 'Cancelado.' };
      }
    }
  }

  openWhatsAppShare(text);
  return { success: true, method: 'whatsapp_intent', message: 'Abrindo WhatsApp...' };
}
