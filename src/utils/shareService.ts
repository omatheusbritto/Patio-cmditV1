import { EntrySubtype, OperationType, VehicleFleetType, VehicleRecord } from '../types';

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
  switch (loc) {
    case 'P1':
      return 'P1 (Poste 1)';
    case 'P2':
      return 'P2 (Poste 2)';
    case 'P3':
      return 'P3 (Poste 3)';
    case 'R1':
      return 'R1 (Rua 1)';
    case 'PDC':
      return 'PDC (Pátio Desembarque / Carga)';
    case 'ADM':
      return 'ADM (Administração)';
    default:
      return loc;
  }
}

export function getEntrySubtypeLabel(subtype?: EntrySubtype): string {
  switch (subtype) {
    case 'bolsao_40':
      return 'Bolsão 40';
    case 'retorno':
      return 'Retorno';
    case 'recusa':
      return 'Recusa';
    default:
      return '';
  }
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
 * Generates formatted Brazilian vehicle caption customized by Operation Type without emojis
 */
export function generateWhatsAppMessage(data: FormattedVehicleMessageData): string {
  const time = data.timestamp || new Date();
  const dateFormatted = time.toLocaleDateString('pt-BR');
  const timeFormatted = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const lines: string[] = [];
  const cleanChar = data.characteristic ? stripEmojis(data.characteristic) : undefined;

  switch (data.operationType) {
    case 'entrada':
      lines.push(`*Placa:* ${data.plate}`);
      lines.push(`*Condutor:* ${data.driverName || 'Não informado'}`);
      lines.push(`*Origem:* ${data.origin || 'Não informado'}`);
      lines.push(`*KM:* ${data.km ? `${data.km} km` : 'Não informado'}`);
      lines.push(`*Combustível:* ${data.fuel}`);
      lines.push(`*Chave Reserva:* ${data.hasSpareKey ? 'SIM' : 'NÃO'}`);
      if (data.fleetType && data.fleetType.trim()) {
        lines.push(`*Tipo de Veículo:* ${data.fleetType.trim()}`);
      }
      if (data.entrySubtype) {
        const subtypeLabel = getEntrySubtypeLabel(data.entrySubtype);
        lines.push(`*Local:* ${subtypeLabel}`);
        if ((data.entrySubtype === 'retorno' || data.entrySubtype === 'recusa') && data.entryReason?.trim()) {
          lines.push(`*Motivo do ${subtypeLabel}:* ${data.entryReason.trim()}`);
        }
      }
      break;

    case 'saida':
      lines.push(`*Placa:* ${data.plate}`);
      lines.push(`*Condutor:* ${data.driverName || 'Não informado'}`);
      lines.push(`*Destino:* ${data.destination || 'Não informado'}`);
      lines.push(`*KM:* ${data.km ? `${data.km} km` : 'Não informado'}`);
      lines.push(`*Combustível:* ${data.fuel}`);
      lines.push(`*Chave Reserva:* ${data.hasSpareKey ? 'SIM' : 'NÃO'}`);
      if (data.fleetType && data.fleetType.trim()) {
        lines.push(`*Tipo de Veículo:* ${data.fleetType.trim()}`);
      }
      break;

    case 'abastecimento':
      lines.push(`*Placa:* ${data.plate}`);
      lines.push(`*Odômetro / KM:* ${data.km ? `${data.km} km` : 'Não informado'}`);
      lines.push(`*Nível do Tanque:* ${data.fuel}`);
      if (data.liters && String(data.liters).trim()) {
        lines.push(`*Litros Abastecidos:* ${String(data.liters).trim()} L`);
      }
      if (data.fuelType && data.fuelType.trim()) {
        lines.push(`*Tipo de Combustível:* ${data.fuelType.trim()}`);
      }
      if (data.driverName && data.driverName.trim()) {
        lines.push(`*Responsável:* ${data.driverName.trim()}`);
      }
      break;

    case 'pdc':
      lines.push(`*Placa:* ${data.plate}`);
      lines.push(`*Combustível:* ${data.fuel}`);
      break;

    case 'qualidade_51':
      lines.push(`*Placa:* ${data.plate}`);
      lines.push(`*Local:* ${getLocationMeaning(data.location)}`);
      lines.push(`*Combustível:* ${data.fuel}`);
      if (cleanChar) {
        lines.push(`*Característica:* ${cleanChar}`);
      }
      break;

    default:
      lines.push(`*Placa:* ${data.plate}`);
      lines.push(`*Combustível:* ${data.fuel}`);
      if (data.location) lines.push(`*Local:* ${getLocationMeaning(data.location)}`);
      if (cleanChar) lines.push(`*Característica:* ${cleanChar}`);
      break;
  }

  if (data.notes) {
    lines.push(`*Observação:* ${data.notes}`);
  }

  lines.push(`*Data/Hora:* ${dateFormatted} às ${timeFormatted}`);

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
 * Execute native WhatsApp share with Image file + Text Caption
 */
export async function shareToWhatsApp(options: ShareOptions): Promise<ShareResult> {
  const { photoDataUrl, description, plate } = options;
  const safeFilename = `registro_${plate || 'veiculo'}_${Date.now()}.jpg`;

  if (photoDataUrl) {
    try {
      const file = dataUrlToFile(photoDataUrl, safeFilename);

      // 1. Try Native Web Share API with files (Supported in modern Android Chrome / WebViews)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: description,
          title: 'Registro Veicular CMDIT',
        });

        return {
          success: true,
          method: 'web_share_files',
          message: 'Compartilhado com sucesso via seletor nativo!',
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
      message: 'Abrindo WhatsApp normal com a legenda...',
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
