import { OperationType, VehicleFleetType, VehicleRecord } from '../types';

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

/**
 * Generates formatted Brazilian vehicle caption customized by Operation Type
 */
export function generateWhatsAppMessage(data: FormattedVehicleMessageData): string {
  const time = data.timestamp || new Date();
  const dateFormatted = time.toLocaleDateString('pt-BR');
  const timeFormatted = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const lines: string[] = [];

  switch (data.operationType) {
    case 'entrada':
      lines.push(`🟢 *REGISTRO DE ENTRADA - CMDIT*`);
      lines.push(`📅 *Data/Hora:* ${dateFormatted} às ${timeFormatted}`);
      lines.push(`🏷️ *Placa:* ${data.plate}`);
      lines.push(`👤 *Condutor:* ${data.driverName || 'Não informado'}`);
      lines.push(`📍 *Origem:* ${data.origin || 'Não informado'}`);
      lines.push(`🛣️ *KM:* ${data.km ? `${data.km} km` : 'Não informado'}`);
      lines.push(`⛽ *Combustível:* ${data.fuel}`);
      lines.push(`🔑 *Chave Reserva:* ${data.hasSpareKey ? 'SIM' : 'NÃO'}`);
      lines.push(`🏷️ *Tipo de Veículo:* ${data.fleetType || 'RAC'}`);
      break;

    case 'saida':
      lines.push(`🔴 *REGISTRO DE SAÍDA - CMDIT*`);
      lines.push(`📅 *Data/Hora:* ${dateFormatted} às ${timeFormatted}`);
      lines.push(`🏷️ *Placa:* ${data.plate}`);
      lines.push(`👤 *Condutor:* ${data.driverName || 'Não informado'}`);
      lines.push(`📍 *Destino:* ${data.destination || 'Não informado'}`);
      lines.push(`🛣️ *KM:* ${data.km ? `${data.km} km` : 'Não informado'}`);
      lines.push(`⛽ *Combustível:* ${data.fuel}`);
      lines.push(`🔑 *Chave Reserva:* ${data.hasSpareKey ? 'SIM' : 'NÃO'}`);
      lines.push(`🏷️ *Tipo de Veículo:* ${data.fleetType || 'RAC'}`);
      break;

    case 'pdc':
      lines.push(`📦 *REGISTRO PDC (DESEMBARQUE/CARGA) - CMDIT*`);
      lines.push(`📅 *Data/Hora:* ${dateFormatted} às ${timeFormatted}`);
      lines.push(`🏷️ *Placa:* ${data.plate}`);
      lines.push(`⛽ *Combustível:* ${data.fuel}`);
      break;

    case 'qualidade_51':
      lines.push(`🔍 *REGISTRO 51 (QUALIDADE) - CMDIT*`);
      lines.push(`📅 *Data/Hora:* ${dateFormatted} às ${timeFormatted}`);
      lines.push(`🏷️ *Placa:* ${data.plate}`);
      lines.push(`📍 *Local:* ${getLocationMeaning(data.location)}`);
      lines.push(`⛽ *Combustível:* ${data.fuel}`);
      if (data.characteristic) {
        lines.push(`🔖 *Característica:* ${data.characteristic}`);
      }
      break;

    default:
      lines.push(`🚗 *REGISTRO VEICULAR CMDIT*`);
      lines.push(`📅 *Data/Hora:* ${dateFormatted} às ${timeFormatted}`);
      lines.push(`🏷️ *Placa:* ${data.plate}`);
      lines.push(`⛽ *Combustível:* ${data.fuel}`);
      if (data.location) lines.push(`📍 *Local:* ${getLocationMeaning(data.location)}`);
      if (data.characteristic) lines.push(`🔖 *Característica:* ${data.characteristic}`);
      break;
  }

  if (data.notes) {
    lines.push(`📝 *Observação:* ${data.notes}`);
  }

  lines.push(`\n_Registrado via Registro Veicular CMDIT • @omatheusbritto_`);

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
