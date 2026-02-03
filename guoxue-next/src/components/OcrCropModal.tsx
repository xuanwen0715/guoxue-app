'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

interface OcrCropModalProps {
  isOpen: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (file: File) => void;
  onUseOriginal: (file: File) => void;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RenderInfo {
  offsetX: number;
  offsetY: number;
  drawW: number;
  drawH: number;
  scale: number;
  rotatedW: number;
  rotatedH: number;
}

const PREVIEW_WIDTH = 520;
const PREVIEW_HEIGHT = 360;
const MIN_CROP_SIZE = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function OcrCropModal({
  isOpen,
  file,
  onCancel,
  onConfirm,
  onUseOriginal,
}: OcrCropModalProps) {
  const t = useTranslations();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotatedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderRef = useRef<RenderInfo | null>(null);
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const controlsDisabled = loading || !!loadError;

  useEffect(() => {
    if (!isOpen || !file) {
      return;
    }
    setLoading(true);
    setLoadError('');
    setRotation(0);
    setCrop(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setLoading(false);
      };
      img.onerror = () => {
        setLoadError(t('ocr.cropLoadFailed'));
        setLoading(false);
      };
      img.src = reader.result as string;
    };
    reader.onerror = () => {
      setLoadError(t('ocr.cropLoadFailed'));
      setLoading(false);
    };
    reader.readAsDataURL(file);
  }, [file, isOpen, t]);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    canvas.width = PREVIEW_WIDTH;
    canvas.height = PREVIEW_HEIGHT;
    ctx.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    ctx.fillStyle = '#f6f6f8';
    ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

    const rotatedCanvas = document.createElement('canvas');
    const isOdd = rotation % 180 !== 0;
    rotatedCanvas.width = isOdd ? image.naturalHeight : image.naturalWidth;
    rotatedCanvas.height = isOdd ? image.naturalWidth : image.naturalHeight;
    const rctx = rotatedCanvas.getContext('2d');
    if (!rctx) {
      return;
    }
    rctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    rctx.rotate((rotation * Math.PI) / 180);
    rctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    rotatedCanvasRef.current = rotatedCanvas;

    const scale = Math.min(
      PREVIEW_WIDTH / rotatedCanvas.width,
      PREVIEW_HEIGHT / rotatedCanvas.height
    );
    const drawW = rotatedCanvas.width * scale;
    const drawH = rotatedCanvas.height * scale;
    const offsetX = (PREVIEW_WIDTH - drawW) / 2;
    const offsetY = (PREVIEW_HEIGHT - drawH) / 2;

    ctx.drawImage(rotatedCanvas, offsetX, offsetY, drawW, drawH);
    renderRef.current = {
      offsetX,
      offsetY,
      drawW,
      drawH,
      scale,
      rotatedW: rotatedCanvas.width,
      rotatedH: rotatedCanvas.height,
    };

    if (crop && crop.w > 0 && crop.h > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
      ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
      ctx.strokeStyle = '#6a58a0';
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
      ctx.restore();
    }
  }, [image, rotation, crop]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    drawPreview();
  }, [drawPreview, isOpen]);

  const normalizePoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const clampToImage = (x: number, y: number) => {
    const info = renderRef.current;
    if (!info) {
      return { x, y };
    }
    const minX = info.offsetX;
    const minY = info.offsetY;
    const maxX = info.offsetX + info.drawW;
    const maxY = info.offsetY + info.drawH;
    return {
      x: clamp(x, minX, maxX),
      y: clamp(y, minY, maxY),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!renderRef.current) {
      return;
    }
    const point = normalizePoint(e.clientX, e.clientY);
    const { x, y } = clampToImage(point.x, point.y);
    draggingRef.current = true;
    startRef.current = { x, y };
    setCrop({ x, y, w: 0, h: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) {
      return;
    }
    const point = normalizePoint(e.clientX, e.clientY);
    const { x, y } = clampToImage(point.x, point.y);
    const start = startRef.current;
    const rectX = Math.min(start.x, x);
    const rectY = Math.min(start.y, y);
    const rectW = Math.abs(x - start.x);
    const rectH = Math.abs(y - start.y);
    setCrop({ x: rectX, y: rectY, w: rectW, h: rectH });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setCrop((prev) => {
      if (!prev) {
        return null;
      }
      if (prev.w < MIN_CROP_SIZE || prev.h < MIN_CROP_SIZE) {
        return null;
      }
      return prev;
    });
  };

  const handleResetCrop = () => {
    setCrop(null);
  };

  const handleRotate = (delta: number) => {
    setRotation((prev) => (prev + delta + 360) % 360);
    setCrop(null);
  };

  const buildCroppedFile = async (): Promise<File | null> => {
    if (!file) {
      return null;
    }
    if (!crop || crop.w < MIN_CROP_SIZE || crop.h < MIN_CROP_SIZE) {
      return null;
    }
    const info = renderRef.current;
    const rotatedCanvas = rotatedCanvasRef.current;
    if (!info || !rotatedCanvas) {
      return null;
    }
    const sx = clamp((crop.x - info.offsetX) / info.scale, 0, info.rotatedW);
    const sy = clamp((crop.y - info.offsetY) / info.scale, 0, info.rotatedH);
    const sw = clamp(crop.w / info.scale, 1, info.rotatedW - sx);
    const sh = clamp(crop.h / info.scale, 1, info.rotatedH - sy);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = Math.max(1, Math.round(sw));
    outCanvas.height = Math.max(1, Math.round(sh));
    const ctx = outCanvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.drawImage(
      rotatedCanvas,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      outCanvas.width,
      outCanvas.height
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      outCanvas.toBlob(
        (result) => resolve(result),
        'image/jpeg',
        0.95
      );
    });
    if (!blob) {
      return null;
    }
    return new File([blob], `crop-${file.name.replace(/\s+/g, '-')}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
  };

  const handleConfirm = async () => {
    if (!file) {
      return;
    }
    const cropped = await buildCroppedFile();
    if (cropped) {
      onConfirm(cropped);
    } else {
      onUseOriginal(file);
    }
  };

  if (!isOpen || !file) {
    return null;
  }

  return (
    <div className="ocr-crop-overlay" onClick={onCancel}>
      <div className="ocr-crop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ocr-crop-header">
          <h3>{t('ocr.cropTitle')}</h3>
          <button className="ocr-crop-close" onClick={onCancel} aria-label={t('ocr.cropCancel')}>
            ×
          </button>
        </div>
        <div className="ocr-crop-body">
          <div className="ocr-crop-preview">
            {loading && <div className="ocr-crop-loading">{t('ocr.cropLoading')}</div>}
            {loadError && <div className="ocr-crop-error">{loadError}</div>}
            <canvas
              ref={canvasRef}
              className="ocr-crop-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
            <div className="ocr-crop-selection-hint">{t('ocr.cropSelectionHint')}</div>
          </div>
          <div className="ocr-crop-controls">
            <div className="ocr-crop-tip">{t('ocr.cropHint')}</div>
            <div className="ocr-crop-btn-row">
              <button
                className="ocr-crop-btn"
                type="button"
                onClick={() => handleRotate(-90)}
                disabled={controlsDisabled}
              >
                {t('ocr.rotateLeft')}
              </button>
              <button
                className="ocr-crop-btn"
                type="button"
                onClick={() => handleRotate(90)}
                disabled={controlsDisabled}
              >
                {t('ocr.rotateRight')}
              </button>
              <button
                className="ocr-crop-btn"
                type="button"
                onClick={handleResetCrop}
                disabled={controlsDisabled}
              >
                {t('ocr.cropReset')}
              </button>
            </div>
            <div className="ocr-crop-actions">
              <button
                className="ocr-crop-btn secondary"
                type="button"
                onClick={() => onUseOriginal(file)}
              >
                {t('ocr.cropUseOriginal')}
              </button>
              <button
                className="ocr-crop-btn primary"
                type="button"
                onClick={handleConfirm}
                disabled={controlsDisabled}
              >
                {t('ocr.cropConfirm')}
              </button>
            </div>
          </div>
        </div>
        <style jsx>{`
          .ocr-crop-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            padding: 24px;
          }

          .ocr-crop-modal {
            background: white;
            border-radius: 16px;
            width: min(900px, 100%);
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 30px 80px rgba(0, 0, 0, 0.3);
          }

          .ocr-crop-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 18px 24px;
            border-bottom: 1px solid #eee;
          }

          .ocr-crop-header h3 {
            margin: 0;
            font-size: 18px;
          }

          .ocr-crop-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
          }

          .ocr-crop-body {
            display: flex;
            gap: 20px;
            padding: 20px 24px 24px;
            flex-wrap: wrap;
          }

          .ocr-crop-preview {
            flex: 1 1 520px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }

          .ocr-crop-canvas {
            width: 100%;
            max-width: ${PREVIEW_WIDTH}px;
            height: auto;
            border-radius: 12px;
            border: 1px solid #eee;
            background: #f6f6f8;
            touch-action: none;
          }

          .ocr-crop-selection-hint {
            font-size: 12px;
            color: #666;
          }

          .ocr-crop-controls {
            flex: 0 1 260px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .ocr-crop-tip {
            font-size: 14px;
            color: #444;
            line-height: 1.6;
          }

          .ocr-crop-btn-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .ocr-crop-actions {
            margin-top: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .ocr-crop-btn {
            border: 1px solid #ddd;
            background: white;
            border-radius: 10px;
            padding: 8px 12px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .ocr-crop-btn.primary {
            background: var(--accent);
            color: white;
            border-color: var(--accent);
          }

          .ocr-crop-btn.secondary {
            background: #f7f7f7;
          }

          .ocr-crop-btn:hover {
            border-color: var(--accent);
            color: var(--accent);
          }

          .ocr-crop-btn.primary:hover {
            color: white;
          }

          .ocr-crop-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            border-color: #ddd;
            color: #888;
          }

          .ocr-crop-btn.primary:disabled {
            color: white;
          }

          .ocr-crop-loading,
          .ocr-crop-error {
            font-size: 13px;
            color: #666;
          }

          .ocr-crop-error {
            color: #cc3d3d;
          }

          @media (max-width: 720px) {
            .ocr-crop-body {
              flex-direction: column;
            }

            .ocr-crop-controls {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
