import { isValidBrazilianPlate, sanitizeRawText, isMercosulFormat } from './plateNormalizer';
import { performLocalOcr } from './ocrService';

export interface PlateRecognitionResult {
  plate: string;
  isMercosul: boolean;
  source: 'local_ocr' | 'gemini_ai' | 'none';
  confidence: number;
  rawText?: string;
  details?: string;
  success: boolean;
}

/**
 * Call server-side Gemini AI Vision API to recognize the Brazilian vehicle license plate
 */
export async function recognizePlateWithGemini(
  photoDataUrl: string
): Promise<PlateRecognitionResult> {
  try {
    const response = await fetch('/api/ocr/gemini-plate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ photoDataUrl }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const cleanPlate = sanitizeRawText(data.plate || '');

    if (data.found && cleanPlate.length === 7 && isValidBrazilianPlate(cleanPlate)) {
      return {
        plate: cleanPlate,
        isMercosul: isMercosulFormat(cleanPlate),
        source: 'gemini_ai',
        confidence: data.confidence || 0.98,
        details: data.details || 'Identificado por IA Gemini',
        success: true,
      };
    }

    if (cleanPlate.length === 7) {
      return {
        plate: cleanPlate,
        isMercosul: isMercosulFormat(cleanPlate),
        source: 'gemini_ai',
        confidence: data.confidence || 0.85,
        details: data.details || '',
        success: true,
      };
    }

    return {
      plate: cleanPlate,
      isMercosul: isMercosulFormat(cleanPlate),
      source: 'none',
      confidence: 0,
      details: data.details || '',
      success: false,
    };
  } catch (err: any) {
    console.warn('Gemini Plate Recognition client error:', err);
    return {
      plate: '',
      isMercosul: false,
      source: 'none',
      confidence: 0,
      details: err.message || 'Erro na comunicação com a IA Gemini',
      success: false,
    };
  }
}

/**
 * Smart Multi-Layer Plate Recognition Pipeline:
 * 1. Fast On-Device Local OCR
 * 2. If local OCR finds a valid Brazilian plate (Mercosul or Old), returns immediately for high speed
 * 3. If local OCR is incomplete, uncertain, or fails -> Automatically falls back to Gemini AI Vision!
 */
export async function smartRecognizePlate(
  photoDataUrl: string,
  onProgress?: (msg: string) => void
): Promise<PlateRecognitionResult> {
  // Step 1: Try Local Device OCR first
  if (onProgress) onProgress('Lendo placa no dispositivo (OCR local)...');

  try {
    const localResult = await performLocalOcr(photoDataUrl, onProgress);

    const cleanLocalPlate = sanitizeRawText(localResult.plate || '');

    // If local OCR found a 100% valid Brazilian plate, return it
    if (localResult.success && isValidBrazilianPlate(cleanLocalPlate)) {
      return {
        plate: cleanLocalPlate,
        isMercosul: isMercosulFormat(cleanLocalPlate),
        source: 'local_ocr',
        confidence: 0.95,
        rawText: localResult.rawText,
        success: true,
      };
    }

    // Step 2: Fallback to Gemini AI Vision
    if (onProgress) onProgress('✨ OCR local incerto. Consultando IA Gemini...');

    const geminiResult = await recognizePlateWithGemini(photoDataUrl);

    if (geminiResult.success && geminiResult.plate) {
      return geminiResult;
    }

    // If Gemini didn't find but local had a 7-character candidate, return local as fallback
    if (cleanLocalPlate.length === 7) {
      return {
        plate: cleanLocalPlate,
        isMercosul: isMercosulFormat(cleanLocalPlate),
        source: 'local_ocr',
        confidence: 0.7,
        rawText: localResult.rawText,
        success: true,
      };
    }

    return {
      plate: geminiResult.plate || cleanLocalPlate,
      isMercosul: false,
      source: 'none',
      confidence: 0,
      details: 'Placa não identificada com clareza. Você pode digitar manualmente.',
      success: false,
    };
  } catch (err: any) {
    console.warn('Pipeline error, falling back to Gemini:', err);
    if (onProgress) onProgress('✨ Analisando imagem com IA Gemini...');
    return await recognizePlateWithGemini(photoDataUrl);
  }
}
