import type { VisualElement } from '../types/typography.ts';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image for cropping.'));
    img.src = src;
  });
}

export async function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  const img = await loadImage(dataUrl);
  return {
    width: img.naturalWidth || img.width || 1000,
    height: img.naturalHeight || img.height || 1294,
  };
}

function cropBoxFromImage(
  img: HTMLImageElement,
  box2d: [number, number, number, number],
  maxDimension = 1400,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png'
): string | undefined {
  const [ymin, xmin, ymax, xmax] = box2d;
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  if (!imgW || !imgH) return undefined;

  const sx = Math.max(0, Math.round((xmin / 1000) * imgW));
  const sy = Math.max(0, Math.round((ymin / 1000) * imgH));
  const sw = Math.max(2, Math.min(imgW - sx, Math.round(((xmax - xmin) / 1000) * imgW)));
  const sh = Math.max(2, Math.min(imgH - sy, Math.round(((ymax - ymin) / 1000) * imgH)));

  const scale = Math.min(1, maxDimension / Math.max(sw, sh));
  const dw = Math.max(2, Math.round(sw * scale));
  const dh = Math.max(2, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

  return mimeType === 'image/jpeg'
    ? canvas.toDataURL('image/jpeg', 0.92)
    : canvas.toDataURL('image/png');
}

export async function prepareVisualCrops(
  sourceDataUrl: string,
  pageBounds: [number, number, number, number],
  visualElements: VisualElement[]
): Promise<{
  pageCropDataUrl?: string;
  visualElements: VisualElement[];
}> {
  try {
    const img = await loadImage(sourceDataUrl);
    const pageCropDataUrl = cropBoxFromImage(img, pageBounds, 1400, 'image/jpeg');

    const enriched = visualElements.map((el) => {
      if (el.kind !== 'image') return el;
      const croppedDataUrl = cropBoxFromImage(img, el.box2d, 1200, 'image/png');
      return {
        ...el,
        croppedDataUrl,
      };
    });

    return {
      pageCropDataUrl,
      visualElements: enriched,
    };
  } catch {
    return {
      pageCropDataUrl: sourceDataUrl,
      visualElements,
    };
  }
}
