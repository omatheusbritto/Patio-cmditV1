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
  photoDataUrl: string;
  description: string;
  plate: string;
}

export interface ShareResult {
  success: boolean;
  method: 'web_share_files' | 'whatsapp_intent' | 'whatsapp_link' | 'clipboard_fallback';
  message: string;
}

/**
 * Execute native WhatsApp share with Image file + Text Caption
 */
export async function shareToWhatsApp(options: ShareOptions): Promise<ShareResult> {
  const { photoDataUrl, description, plate } = options;
  const safeFilename = `registro_${plate || 'veiculo'}_${Date.now()}.jpg`;

  try {
    const file = dataUrlToFile(photoDataUrl, safeFilename);

    // 1. Try Native Web Share API with files (Supported in modern Android Chrome / WebViews)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        text: description,
        title: 'Redigistro Veicular CMDIT',
      });

      return {
        success: true,
        method: 'web_share_files',
        message: 'Compartilhado com sucesso via seletor nativo!',
      };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      // User cancelled share dialog
      return {
        success: false,
        method: 'web_share_files',
        message: 'Compartilhamento cancelado pelo usuário.',
      };
    }
    console.warn('Native file share error, trying WhatsApp URI fallback:', error);
  }

  // 2. Fallback: Direct WhatsApp Android Protocol URI
  try {
    const encodedText = encodeURIComponent(description);
    const whatsappUri = `whatsapp://send?text=${encodedText}`;

    // Try triggering WhatsApp URI
    const link = document.createElement('a');
    link.href = whatsappUri;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return {
      success: true,
      method: 'whatsapp_intent',
      message: 'Abrindo WhatsApp normal com a legenda...',
    };
  } catch (error) {
    console.warn('WhatsApp protocol error:', error);
  }

  // 3. Fallback: Standard WhatsApp API link
  try {
    const encodedText = encodeURIComponent(description);
    const webUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(webUrl, '_blank');

    return {
      success: true,
      method: 'whatsapp_link',
      message: 'Redirecionado para o WhatsApp!',
    };
  } catch {
    // 4. Clipboard fallback
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
}
