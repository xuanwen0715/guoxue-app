'use client';

export interface OcrImageOptions {
  maxDimension?: number;
  quality?: number;
  preferOriginalMaxBytes?: number;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

export async function prepareOcrImage(
  file: File,
  options: OcrImageOptions = {}
): Promise<string> {
  if (typeof window === 'undefined') {
    return fileToBase64(file);
  }

  const maxDimension = options.maxDimension ?? 2000;
  const quality = options.quality ?? 0.85;
  const preferOriginalMaxBytes = options.preferOriginalMaxBytes ?? 1_500_000;

  try {
    const bitmap = 'createImageBitmap' in window
      ? await createImageBitmap(file)
      : await loadImageElement(file);

    const width = 'width' in bitmap ? bitmap.width : (bitmap as HTMLImageElement).naturalWidth;
    const height = 'height' in bitmap ? bitmap.height : (bitmap as HTMLImageElement).naturalHeight;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    if (scale === 1 && file.size <= preferOriginalMaxBytes) {
      return fileToBase64(file);
    }
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return fileToBase64(file);
    }

    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, targetWidth, targetHeight);
    if ('close' in bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }

    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.warn('[OCR] Image optimize failed, fallback to base64:', err);
    return fileToBase64(file);
  }
}
