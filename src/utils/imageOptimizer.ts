/**
 * Client-Side Ultra-Fast Image Optimizer for License Plate Vision AI
 * Downscales multi-megabyte camera photos into optimized crisp ~100KB payloads
 * for sub-second network transfer and instant AI processing.
 */

export interface OptimizedImageResult {
  dataUrl: string;
  originalWidth: number;
  originalHeight: number;
  optimizedWidth: number;
  optimizedHeight: number;
}

export async function optimizeImageForOcr(
  sourceDataUrl: string,
  maxDimension: number = 1024,
  quality: number = 0.85
): Promise<OptimizedImageResult> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        let targetW = origW;
        let targetH = origH;

        // Calculate proportional scale
        if (origW > maxDimension || origH > maxDimension) {
          if (origW > origH) {
            targetW = maxDimension;
            targetH = Math.round((origH * maxDimension) / origW);
          } else {
            targetH = maxDimension;
            targetW = Math.round((origW * maxDimension) / origH);
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { alpha: false });

        if (!ctx) {
          return resolve({
            dataUrl: sourceDataUrl,
            originalWidth: origW,
            originalHeight: origH,
            optimizedWidth: origW,
            optimizedHeight: origH,
          });
        }

        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw and compress to optimized JPEG
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);

        resolve({
          dataUrl: optimizedDataUrl,
          originalWidth: origW,
          originalHeight: origH,
          optimizedWidth: targetW,
          optimizedHeight: targetH,
        });
      };

      img.onerror = () => {
        resolve({
          dataUrl: sourceDataUrl,
          originalWidth: 0,
          originalHeight: 0,
          optimizedWidth: 0,
          optimizedHeight: 0,
        });
      };

      img.src = sourceDataUrl;
    } catch {
      resolve({
        dataUrl: sourceDataUrl,
        originalWidth: 0,
        originalHeight: 0,
        optimizedWidth: 0,
        optimizedHeight: 0,
      });
    }
  });
}
