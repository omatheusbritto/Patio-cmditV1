import { createWorker, Worker } from 'tesseract.js';
import { extractPlatesFromText, sanitizeRawText } from './plateNormalizer';

let workerPromise: Promise<Worker> | null = null;

/**
 * Lazy singleton initialization of Tesseract OCR worker for instant on-device OCR
 */
async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('por+eng', 1, {
        // Optimize for speed and minimal download
        logger: () => {},
      });
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ',
        tessedit_pageseg_mode: '7' as any, // Treat the image as a single text line
      });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Preprocess image via Canvas:
 * 1. Focus/Crop Region of Interest (Center 70% width, center 45% height by default where plate guide sits)
 * 2. High contrast & Grayscale filter
 * 3. Binarization to sharpen characters
 */
export async function preprocessImageForOcr(
  imageSource: string | HTMLImageElement | HTMLCanvasElement,
  roiOnly: boolean = true
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof imageSource === 'string' ? imageSource : '');
        return;
      }

      let sx = 0;
      let sy = 0;
      let sWidth = img.width;
      let sHeight = img.height;

      if (roiOnly) {
        // Center crop targeting plate guide (width 70%, height 40% in center)
        sWidth = Math.round(img.width * 0.75);
        sHeight = Math.round(img.height * 0.45);
        sx = Math.round((img.width - sWidth) / 2);
        sy = Math.round((img.height - sHeight) / 2);
      }

      // Target optimal OCR width
      const targetWidth = Math.min(800, sWidth);
      const scale = targetWidth / sWidth;
      const targetHeight = Math.round(sHeight * scale);

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Draw cropped area
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

      // Apply Grayscale + Contrast enhancement filter
      const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const data = imgData.data;

      // Calculate average brightness
      let totalLuminance = 0;
      const count = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLuminance += gray;
      }
      const avgLuminance = totalLuminance / count;
      const threshold = Math.max(80, Math.min(180, avgLuminance * 0.95));

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Luminance calculation
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        // High contrast curve / binarization
        const val = gray > threshold ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };

    img.onerror = () => {
      resolve(typeof imageSource === 'string' ? imageSource : '');
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else if (imageSource instanceof HTMLImageElement) {
      img.src = imageSource.src;
    } else if (imageSource instanceof HTMLCanvasElement) {
      img.src = imageSource.toDataURL('image/jpeg', 0.9);
    }
  });
}

/**
 * Execute on-device local OCR on an image dataUrl / blob.
 * Returns found plate or null (never throws to keep flow seamless).
 */
export async function performLocalOcr(
  photoDataUrl: string,
  onProgress?: (msg: string) => void
): Promise<{ plate: string; isMercosul: boolean; rawText: string; success: boolean }> {
  try {
    if (onProgress) onProgress('Preparando imagem...');

    // Preprocess center region
    const preprocessedUri = await preprocessImageForOcr(photoDataUrl, true);

    if (onProgress) onProgress('Lendo placa no dispositivo...');

    const worker = await getOcrWorker();
    const result = await worker.recognize(preprocessedUri);
    const text = result?.data?.text || '';

    const extracted = extractPlatesFromText(text);

    if (extracted) {
      return {
        plate: extracted.plate,
        isMercosul: extracted.isMercosul,
        rawText: text,
        success: true,
      };
    }

    // If center crop didn't find, try full image
    const fullPreprocessed = await preprocessImageForOcr(photoDataUrl, false);
    const fullResult = await worker.recognize(fullPreprocessed);
    const fullText = fullResult?.data?.text || '';
    const fullExtracted = extractPlatesFromText(fullText);

    if (fullExtracted) {
      return {
        plate: fullExtracted.plate,
        isMercosul: fullExtracted.isMercosul,
        rawText: fullText,
        success: true,
      };
    }

    return {
      plate: sanitizeRawText(text).slice(0, 7),
      isMercosul: false,
      rawText: text,
      success: false,
    };
  } catch (err) {
    console.warn('OCR error or fallback:', err);
    return {
      plate: '',
      isMercosul: false,
      rawText: '',
      success: false,
    };
  }
}
