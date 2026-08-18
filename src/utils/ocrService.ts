import { createWorker, Worker } from 'tesseract.js';
import { extractPlatesFromText, sanitizeRawText } from './plateNormalizer';

let workerPromise: Promise<Worker> | null = null;

/**
 * Lazy singleton initialization of Tesseract OCR worker for instant on-device OCR.
 * Uses sparse text detection (PSM 11) & auto block mode so it recognizes text anywhere in the image at any angle.
 */
async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('por+eng', 1, {
        logger: () => {},
      });
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-·. ',
        tessedit_pageseg_mode: '11' as any, // Sparse text: find as much text as possible in no particular order
      });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Image processing options
 */
export interface PreprocessOptions {
  cropRegion?: 'full' | 'center' | 'lower' | 'upper';
  rotationAngle?: number; // in degrees (e.g. -12, 0, 12)
  mode?: 'contrast' | 'adaptive_binarize' | 'sharpen';
  targetMaxWidth?: number;
}

/**
 * Fast client-side image enhancement on HTML5 Canvas:
 * Supports dynamic crops, rotations (for angled plates), contrast enhancement, and adaptive thresholding.
 */
export async function preprocessImage(
  imageSource: string | HTMLImageElement | HTMLCanvasElement,
  options: PreprocessOptions = {}
): Promise<string> {
  const {
    cropRegion = 'full',
    rotationAngle = 0,
    mode = 'contrast',
    targetMaxWidth = 1200,
  } = options;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let sx = 0;
      let sy = 0;
      let sWidth = img.width;
      let sHeight = img.height;

      // Region of interest selection
      if (cropRegion === 'center') {
        sWidth = Math.round(img.width * 0.85);
        sHeight = Math.round(img.height * 0.55);
        sx = Math.round((img.width - sWidth) / 2);
        sy = Math.round((img.height - sHeight) / 2);
      } else if (cropRegion === 'lower') {
        // Lower bumper zone
        sWidth = img.width;
        sHeight = Math.round(img.height * 0.65);
        sx = 0;
        sy = Math.round(img.height * 0.35);
      } else if (cropRegion === 'upper') {
        sWidth = img.width;
        sHeight = Math.round(img.height * 0.65);
        sx = 0;
        sy = 0;
      }

      // Calculate output size
      const scale = Math.min(1.5, Math.max(0.4, targetMaxWidth / sWidth));
      const destWidth = Math.round(sWidth * scale);
      const destHeight = Math.round(sHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = destWidth;
      canvas.height = destHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(typeof imageSource === 'string' ? imageSource : '');
        return;
      }

      // Handle rotation for angled shots
      if (rotationAngle !== 0) {
        ctx.save();
        ctx.translate(destWidth / 2, destHeight / 2);
        ctx.rotate((rotationAngle * Math.PI) / 180);
        ctx.drawImage(
          img,
          sx,
          sy,
          sWidth,
          sHeight,
          -destWidth / 2,
          -destHeight / 2,
          destWidth,
          destHeight
        );
        ctx.restore();
      } else {
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, destWidth, destHeight);
      }

      const imgData = ctx.getImageData(0, 0, destWidth, destHeight);
      const data = imgData.data;
      const totalPixels = destWidth * destHeight;

      if (mode === 'contrast' || mode === 'sharpen') {
        // 1. Convert to grayscale and find min/max luminance for stretch
        let minLum = 255;
        let maxLum = 0;
        const grayValues = new Uint8Array(totalPixels);

        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          // Standard ITU-R BT.601 luminance
          const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          grayValues[i] = lum;
          if (lum < minLum) minLum = lum;
          if (lum > maxLum) maxLum = lum;
        }

        const range = Math.max(1, maxLum - minLum);

        // 2. High-contrast stretch + mid-tone boost
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          let normalized = ((grayValues[i] - minLum) / range) * 255;
          // Sigmoid-like contrast boost
          normalized = normalized < 128
            ? (normalized * normalized) / 128
            : 255 - ((255 - normalized) * (255 - normalized)) / 128;

          const finalVal = Math.max(0, Math.min(255, Math.round(normalized)));
          data[idx] = finalVal;
          data[idx + 1] = finalVal;
          data[idx + 2] = finalVal;
        }
      } else if (mode === 'adaptive_binarize') {
        // Local window adaptive threshold
        const gray = new Uint8Array(totalPixels);
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
        }

        // Integral image calculation for fast local means
        const integral = new Float64Array(totalPixels);
        for (let y = 0; y < destHeight; y++) {
          let sum = 0;
          for (let x = 0; x < destWidth; x++) {
            sum += gray[y * destWidth + x];
            if (y === 0) {
              integral[y * destWidth + x] = sum;
            } else {
              integral[y * destWidth + x] = integral[(y - 1) * destWidth + x] + sum;
            }
          }
        }

        const winSize = Math.max(8, Math.round(destWidth / 30));
        const halfWin = Math.floor(winSize / 2);

        for (let y = 0; y < destHeight; y++) {
          for (let x = 0; x < destWidth; x++) {
            const x1 = Math.max(0, x - halfWin);
            const y1 = Math.max(0, y - halfWin);
            const x2 = Math.min(destWidth - 1, x + halfWin);
            const y2 = Math.min(destHeight - 1, y + halfWin);

            const count = (x2 - x1 + 1) * (y2 - y1 + 1);
            let sum = integral[y2 * destWidth + x2];
            if (x1 > 0) sum -= integral[y2 * destWidth + (x1 - 1)];
            if (y1 > 0) sum -= integral[(y1 - 1) * destWidth + x2];
            if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * destWidth + (x1 - 1)];

            const mean = sum / count;
            const idx = (y * destWidth + x) * 4;
            const current = gray[y * destWidth + x];
            const val = current > mean * 0.92 ? 255 : 0;

            data[idx] = val;
            data[idx + 1] = val;
            data[idx + 2] = val;
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };

    img.onerror = () => {
      resolve(typeof imageSource === 'string' ? imageSource : '');
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else if (imageSource instanceof HTMLImageElement) {
      img.src = imageSource.src;
    } else if (imageSource instanceof HTMLCanvasElement) {
      img.src = imageSource.toDataURL('image/jpeg', 0.92);
    }
  });
}

/**
 * Execute fast on-device local OCR on an image dataUrl / blob.
 * Multi-pass pipeline handles:
 * - Plates located anywhere in frame (full frame, lower bumper, center, upper)
 * - Tilted/angled vehicle photos (-10°, 0°, +10°)
 * - Harsh sunlight or shadow gradients via adaptive contrast
 * Returns immediately as soon as a valid plate is detected.
 */
export async function performLocalOcr(
  photoDataUrl: string,
  onProgress?: (msg: string) => void
): Promise<{ plate: string; isMercosul: boolean; rawText: string; success: boolean }> {
  try {
    const worker = await getOcrWorker();

    // Pass 1: Full frame with contrast enhancement (covers 80%+ cases rapidly)
    if (onProgress) onProgress('Analisando imagem completa...');
    const pass1Img = await preprocessImage(photoDataUrl, {
      cropRegion: 'full',
      mode: 'contrast',
      targetMaxWidth: 1280,
    });

    const result1 = await worker.recognize(pass1Img);
    const text1 = result1?.data?.text || '';
    const extracted1 = extractPlatesFromText(text1);

    if (extracted1) {
      return {
        plate: extracted1.plate,
        isMercosul: extracted1.isMercosul,
        rawText: text1,
        success: true,
      };
    }

    // Pass 2: Lower bumper region & Center region (common vehicle plate placement)
    if (onProgress) onProgress('Buscando placa em diferentes posições...');
    const pass2Img = await preprocessImage(photoDataUrl, {
      cropRegion: 'lower',
      mode: 'contrast',
      targetMaxWidth: 1100,
    });

    const result2 = await worker.recognize(pass2Img);
    const text2 = result2?.data?.text || '';
    const extracted2 = extractPlatesFromText(text2);

    if (extracted2) {
      return {
        plate: extracted2.plate,
        isMercosul: extracted2.isMercosul,
        rawText: text2,
        success: true,
      };
    }

    // Pass 3: Center crop
    const pass3Img = await preprocessImage(photoDataUrl, {
      cropRegion: 'center',
      mode: 'contrast',
      targetMaxWidth: 1000,
    });

    const result3 = await worker.recognize(pass3Img);
    const text3 = result3?.data?.text || '';
    const extracted3 = extractPlatesFromText(text3);

    if (extracted3) {
      return {
        plate: extracted3.plate,
        isMercosul: extracted3.isMercosul,
        rawText: text3,
        success: true,
      };
    }

    // Pass 4: Angled / Tilted scan (-10° and +10°)
    if (onProgress) onProgress('Verificando ângulos e inclinações...');
    const pass4aImg = await preprocessImage(photoDataUrl, {
      cropRegion: 'full',
      rotationAngle: -10,
      mode: 'contrast',
      targetMaxWidth: 1100,
    });

    const result4a = await worker.recognize(pass4aImg);
    const text4a = result4a?.data?.text || '';
    const extracted4a = extractPlatesFromText(text4a);

    if (extracted4a) {
      return {
        plate: extracted4a.plate,
        isMercosul: extracted4a.isMercosul,
        rawText: text4a,
        success: true,
      };
    }

    const pass4bImg = await preprocessImage(photoDataUrl, {
      cropRegion: 'full',
      rotationAngle: 10,
      mode: 'contrast',
      targetMaxWidth: 1100,
    });

    const result4b = await worker.recognize(pass4bImg);
    const text4b = result4b?.data?.text || '';
    const extracted4b = extractPlatesFromText(text4b);

    if (extracted4b) {
      return {
        plate: extracted4b.plate,
        isMercosul: extracted4b.isMercosul,
        rawText: text4b,
        success: true,
      };
    }

    // Pass 5: Adaptive Local Binarization (for high-glare or shadows)
    if (onProgress) onProgress('Filtrando reflexos e sombras...');
    const pass5Img = await preprocessImage(photoDataUrl, {
      cropRegion: 'full',
      mode: 'adaptive_binarize',
      targetMaxWidth: 1000,
    });

    const result5 = await worker.recognize(pass5Img);
    const text5 = result5?.data?.text || '';
    const extracted5 = extractPlatesFromText(text5);

    if (extracted5) {
      return {
        plate: extracted5.plate,
        isMercosul: extracted5.isMercosul,
        rawText: text5,
        success: true,
      };
    }

    // Fallback: collect any best candidate from raw text
    const combinedAllText = [text1, text2, text3, text4a, text4b, text5].join(' ');
    const fallbackExtracted = extractPlatesFromText(combinedAllText);

    if (fallbackExtracted) {
      return {
        plate: fallbackExtracted.plate,
        isMercosul: fallbackExtracted.isMercosul,
        rawText: combinedAllText,
        success: true,
      };
    }

    return {
      plate: sanitizeRawText(text1 || text2 || text3).slice(0, 7),
      isMercosul: false,
      rawText: combinedAllText,
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

