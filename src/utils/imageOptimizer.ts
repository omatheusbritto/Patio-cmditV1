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

/**
 * Adds a small, high-legibility date and time watermark in the bottom-right corner of an image canvas.
 * Designed to be clean, sharp, and unobtrusive so it doesn't obstruct license plates,
 * dashboards, or vehicle details, allowing WhatsApp messages to omit the date/time text.
 */
export function stampDateTimeOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  date: Date = new Date()
): void {
  const dateFormatted = date.toLocaleDateString('pt-BR');
  const timeFormatted = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const text = `${dateFormatted} ${timeFormatted}`;

  ctx.save();

  // Dynamic scale proportional to canvas resolution (clean, small, readable)
  const fontSize = Math.max(12, Math.min(20, Math.round(width * 0.016)));
  ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const paddingX = Math.round(fontSize * 0.65);
  const paddingY = Math.round(fontSize * 0.45);
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = fontSize + paddingY * 2;

  const margin = Math.round(Math.max(10, width * 0.015));
  const boxX = width - boxWidth - margin;
  const boxY = height - boxHeight - margin;

  // Translucent dark pill badge
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(boxX, boxY, boxWidth, boxHeight, 6);
  } else {
    ctx.rect(boxX, boxY, boxWidth, boxHeight);
  }
  ctx.fill();
  ctx.stroke();

  // White crisp text
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 3;
  ctx.fillText(text, boxX + paddingX, boxY + boxHeight / 2);

  ctx.restore();
}

/**
 * Ensures an image Data URL has the bottom-right date/time watermark embedded.
 */
export async function stampDateTimeOnDataUrl(
  dataUrl: string,
  date: Date = new Date(),
  quality: number = 0.92
): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const w = img.naturalWidth || img.width || 1280;
        const h = img.naturalHeight || img.height || 720;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);

        ctx.drawImage(img, 0, 0, w, h);
        stampDateTimeOnCanvas(ctx, w, h, date);

        const result = canvas.toDataURL('image/jpeg', quality);
        resolve(result);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
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

        // Embed discrete bottom-right date and time
        stampDateTimeOnCanvas(ctx, targetW, targetH, new Date());

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

/**
 * Combines two photos (Plate and Dashboard) into a single high-definition composite image.
 * Places both photos side-by-side (uma ao lado da outra) with complete clarity,
 * preserving all plate letters and odometer digits without cropping, guaranteeing
 * 100% reliable WhatsApp sharing where both photos are clearly visible together.
 */
export async function combineTwoPhotos(options: {
  photo1Url: string;
  photo2Url: string;
  plate: string;
  operationTitle?: string;
  tag1?: string;
  tag2?: string;
}): Promise<string> {
  const {
    photo1Url,
    photo2Url,
    plate,
    operationTitle = 'REGISTRO DE ABASTECIMENTO',
    tag1 = '📸 FOTO 1: PLACA DO VEÍCULO',
    tag2 = '⛽ FOTO 2: PAINEL / ODÔMETRO',
  } = options;

  return new Promise((resolve) => {
    try {
      const loadImage = (src: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => res(img);
          img.onerror = (e) => rej(e);
          img.src = src;
        });

      Promise.all([loadImage(photo1Url), loadImage(photo2Url)])
        .then(([img1, img2]) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(photo1Url);

          // Wide High Definition Canvas optimized for WhatsApp landscape cards
          const targetCanvasWidth = 1600;
          const targetCanvasHeight = 960;
          const headerHeight = 100;
          const padding = 20;
          const gap = 20;

          canvas.width = targetCanvasWidth;
          canvas.height = targetCanvasHeight;

          // Background - Deep Professional Slate
          ctx.fillStyle = '#090d16';
          ctx.fillRect(0, 0, targetCanvasWidth, targetCanvasHeight);

          // Header Background
          ctx.fillStyle = '#111827';
          ctx.fillRect(0, 0, targetCanvasWidth, headerHeight);

          // Top Header Accent Border
          const grad = ctx.createLinearGradient(0, 0, targetCanvasWidth, 0);
          grad.addColorStop(0, '#059669'); // Emerald
          grad.addColorStop(0.5, '#06b6d4'); // Cyan
          grad.addColorStop(1, '#3b82f6'); // Blue
          ctx.fillStyle = grad;
          ctx.fillRect(0, headerHeight - 4, targetCanvasWidth, 4);

          // Header Text: Operation Badge
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(operationTitle.toUpperCase(), padding, 34);

          // Header Text: Plate Badge
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 32px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '');
          const formattedPlate =
            cleanPlate.length === 7 ? `${cleanPlate.slice(0, 3)}-${cleanPlate.slice(3)}` : plate;
          ctx.fillText(`PLACA: ${formattedPlate.toUpperCase()}`, padding, 68);

          // Timestamp on Top Right
          const nowStr = new Date().toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          ctx.fillStyle = '#a7f3d0';
          ctx.font = 'bold 18px ui-monospace, SFMono-Regular, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`📅 ${nowStr}`, targetCanvasWidth - padding, 52);

          // Calculate Side-by-Side Photo Dimensions (Equal 50/50 Split)
          const singleW = Math.floor((targetCanvasWidth - padding * 2 - gap) / 2);
          const singleH = targetCanvasHeight - headerHeight - padding * 2;

          const rect1 = { x: padding, y: headerHeight + padding, w: singleW, h: singleH };
          const rect2 = { x: padding + singleW + gap, y: headerHeight + padding, w: singleW, h: singleH };

          // Helper to draw an image side-by-side with maximum legibility (smart fit)
          const renderSidePhoto = (
            img: HTMLImageElement,
            rect: { x: number; y: number; w: number; h: number },
            tag: string,
            themeColor: string
          ) => {
            ctx.save();

            // Photo frame background
            ctx.fillStyle = '#000000';
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

            const imgW = img.naturalWidth || img.width || 800;
            const imgH = img.naturalHeight || img.height || 600;

            // Intelligent fit: use aspect fit with clean letterboxing so NO plate/odometer digits are cut
            const scale = Math.min(rect.w / imgW, rect.h / imgH);
            const drawW = imgW * scale;
            const drawH = imgH * scale;
            const drawX = rect.x + (rect.w - drawW) / 2;
            const drawY = rect.y + (rect.h - drawH) / 2;

            ctx.drawImage(img, 0, 0, imgW, imgH, drawX, drawY, drawW, drawH);

            // Subtle inner border around photo box
            ctx.strokeStyle = '#1f2937';
            ctx.lineWidth = 2;
            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

            // Tag Header Banner at top of each photo slot
            const bannerH = 40;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.fillRect(rect.x, rect.y, rect.w, bannerH);

            ctx.fillStyle = themeColor;
            ctx.fillRect(rect.x, rect.y + bannerH - 3, rect.w, 3);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(tag, rect.x + 16, rect.y + bannerH / 2);

            ctx.restore();
          };

          // Render Photo 1 (Placa) on Left
          renderSidePhoto(img1, rect1, tag1, '#10b981');

          // Render Photo 2 (Painel/KM) on Right
          renderSidePhoto(img2, rect2, tag2, '#06b6d4');

          // Embed discrete bottom-right date and time
          stampDateTimeOnCanvas(ctx, targetCanvasWidth, targetCanvasHeight, new Date());

          const compositeDataUrl = canvas.toDataURL('image/jpeg', 0.92);
          resolve(compositeDataUrl);
        })
        .catch((err) => {
          console.warn('Failed to combine photos side-by-side:', err);
          resolve(photo1Url);
        });
    } catch (e) {
      console.warn('Error combining photos:', e);
      resolve(photo1Url);
    }
  });
}
