import { isValidBrazilianPlate, sanitizeRawText, isMercosulFormat, tryFixPlateCandidates } from './plateNormalizer';
import { performLocalOcr } from './ocrService';
import { optimizeImageForOcr, enhanceImageForPlateOcr } from './imageOptimizer';

export interface RecognizedCharacter {
  position: number;
  char: string;
  type: string;
  certainty?: number;
}

export interface PlateRecognitionResult {
  plate: string;
  isMercosul: boolean;
  plateType?: string;
  source: 'gemini_ai' | 'local_ocr' | 'none';
  confidence: number;
  isCertain?: boolean;
  boundingBox?: [number, number, number, number] | null;
  croppedPlateUrl?: string | null;
  characters?: RecognizedCharacter[];
  analysisNotes?: string;
  rawText?: string;
  processingTimeMs?: number;
  success: boolean;
}

/**
 * Crops a bounding box [ymin, xmin, ymax, xmax] (normalized 0-1000) from an image data URL
 */
export async function cropPlateFromBoundingBox(
  photoDataUrl: string,
  box: [number, number, number, number]
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const [ymin, xmin, ymax, xmax] = box;
      if (ymin === undefined || xmin === undefined || ymax === undefined || xmax === undefined) {
        return resolve(null);
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        // Add 6% padding around the plate for visual clarity
        const padX = (xmax - xmin) * 0.06;
        const padY = (ymax - ymin) * 0.08;

        const left = Math.max(0, ((xmin - padX) / 1000) * origW);
        const top = Math.max(0, ((ymin - padY) / 1000) * origH);
        const right = Math.min(origW, ((xmax + padX) / 1000) * origW);
        const bottom = Math.min(origH, ((ymax + padY) / 1000) * origH);

        const cropW = Math.max(10, right - left);
        const cropH = Math.max(10, bottom - top);

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        ctx.drawImage(img, left, top, cropW, cropH, 0, 0, cropW, cropH);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => resolve(null);
      img.src = photoDataUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Call server-side High-Speed Vision Engine with streamlined image compression for sub-second recognition
 */
export async function recognizePlateWithGemini(
  photoDataUrl: string
): Promise<PlateRecognitionResult> {
  const clientStart = Date.now();
  try {
    // 1. Single-pass fast hardware-accelerated downscale (768px at 0.80 is crisp, ~35KB, transfers in ~15ms)
    const optimized = await optimizeImageForOcr(photoDataUrl, 768, 0.80);

    const response = await fetch('/api/ocr/gemini-plate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ photoDataUrl: optimized.dataUrl }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    let cleanPlate = sanitizeRawText(data.plate || '');
    const elapsed = Date.now() - clientStart;

    let croppedPlateUrl: string | null = null;
    if (data.boundingBox && Array.isArray(data.boundingBox) && data.boundingBox.length === 4) {
      croppedPlateUrl = await cropPlateFromBoundingBox(
        photoDataUrl,
        data.boundingBox as [number, number, number, number]
      );
    }

    // Mathematical pattern validation / disambiguation
    if (cleanPlate.length === 7 && !isValidBrazilianPlate(cleanPlate)) {
      const candidates = tryFixPlateCandidates(cleanPlate);
      if (candidates.length > 0 && isValidBrazilianPlate(candidates[0])) {
        cleanPlate = candidates[0];
      }
    }

    if (data.found && cleanPlate.length === 7 && isValidBrazilianPlate(cleanPlate)) {
      return {
        plate: cleanPlate,
        isMercosul: isMercosulFormat(cleanPlate),
        plateType: data.plateType,
        source: 'gemini_ai',
        confidence: data.confidence || 0.99,
        isCertain: data.isCertain ?? true,
        boundingBox: data.boundingBox,
        croppedPlateUrl,
        characters: data.characters || [],
        analysisNotes: data.analysisNotes || `Reconhecido em ${elapsed}ms com IA de Alta Precisão`,
        processingTimeMs: elapsed,
        success: true,
      };
    }

    if (cleanPlate.length === 7) {
      return {
        plate: cleanPlate,
        isMercosul: isMercosulFormat(cleanPlate),
        plateType: data.plateType,
        source: 'gemini_ai',
        confidence: data.confidence || 0.85,
        isCertain: data.isCertain ?? false,
        boundingBox: data.boundingBox,
        croppedPlateUrl,
        characters: data.characters || [],
        analysisNotes: data.analysisNotes || `Reconhecido em ${elapsed}ms`,
        processingTimeMs: elapsed,
        success: true,
      };
    }

    return {
      plate: cleanPlate,
      isMercosul: isMercosulFormat(cleanPlate),
      source: 'none',
      confidence: 0,
      isCertain: false,
      croppedPlateUrl,
      analysisNotes: data.analysisNotes || 'Nenhuma placa nítida identificada',
      processingTimeMs: elapsed,
      success: false,
    };
  } catch (err: any) {
    console.warn('High-Speed Plate Recognition client error:', err);
    return {
      plate: '',
      isMercosul: false,
      source: 'none',
      confidence: 0,
      isCertain: false,
      analysisNotes: err.message || 'Erro de comunicação',
      processingTimeMs: Date.now() - clientStart,
      success: false,
    };
  }
}

/**
 * Smart Multi-Layer Plate Recognition Pipeline:
 * 1. Primary: Ultra-Fast Vision AI (Compressed payload, sub-second execution)
 * 2. Fallback: Local OCR if network offline
 */
export async function smartRecognizePlate(
  photoDataUrl: string,
  onProgress?: (msg: string) => void
): Promise<PlateRecognitionResult> {
  if (onProgress) onProgress('⚡ Leitura rápida com IA e visão computacional...');

  // 1. Try Ultra-Fast Vision AI first
  try {
    const aiResult = await recognizePlateWithGemini(photoDataUrl);

    if (aiResult.success && aiResult.plate && isValidBrazilianPlate(aiResult.plate)) {
      return aiResult;
    }

    if (aiResult.plate && aiResult.plate.length === 7) {
      return aiResult;
    }
  } catch (aiErr) {
    console.warn('Fast Vision AI error, checking local fallback:', aiErr);
  }

  // 2. Fallback to Local OCR
  if (onProgress) onProgress('Verificando localmente...');

  try {
    const localResult = await performLocalOcr(photoDataUrl, onProgress);
    const cleanLocalPlate = sanitizeRawText(localResult.plate || '');

    if (localResult.success && isValidBrazilianPlate(cleanLocalPlate)) {
      return {
        plate: cleanLocalPlate,
        isMercosul: isMercosulFormat(cleanLocalPlate),
        source: 'local_ocr',
        confidence: 0.9,
        rawText: localResult.rawText,
        analysisNotes: 'Lido via OCR local',
        success: true,
      };
    }

    if (cleanLocalPlate.length === 7) {
      return {
        plate: cleanLocalPlate,
        isMercosul: isMercosulFormat(cleanLocalPlate),
        source: 'local_ocr',
        confidence: 0.7,
        rawText: localResult.rawText,
        analysisNotes: 'Lido via OCR local',
        success: true,
      };
    }
  } catch (localErr) {
    console.warn('Local OCR fallback error:', localErr);
  }

  return {
    plate: '',
    isMercosul: false,
    source: 'none',
    confidence: 0,
    isCertain: false,
    analysisNotes: 'Placa não identificada automaticamente. Digite os 7 caracteres.',
    success: false,
  };
}
