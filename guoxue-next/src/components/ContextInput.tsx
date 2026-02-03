'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@/context/QueryContext';
import { useAuth } from '@/context/AuthContext';
import { prepareOcrImage } from '@/lib/ocr-image';
import OcrResultModal from './OcrResultModal';
import OcrCropModal from './OcrCropModal';

interface OcrSuggestion {
  original: string;
  suggested: string;
  reason: string;
}

interface OcrResponse {
  text: string;
  method: string;
  ai_corrected: string;
  ai_suggestions: OcrSuggestion[];
  _warning?: string;
}

export default function ContextInput() {
  const t = useTranslations();
  const { context, setContext } = useQuery();
  const { token, getAccessToken } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxFileSize = 4 * 1024 * 1024;
  const maxDimension = 2000;
  const [ocrLayout, setOcrLayout] = useState<'auto' | 'vertical' | 'horizontal'>('vertical');
  const lastUploadRef = useRef<string>('');
  const lastUploadAtRef = useRef<number>(0);

  // OCR结果弹窗状态
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResponse | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [pendingOcrFile, setPendingOcrFile] = useState<File | null>(null);
  const [pendingOcrKey, setPendingOcrKey] = useState('');

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 调用OCR API
  const callOcrApi = useCallback(async (
    imageBase64: string,
    authToken: string,
    scene: 'context' | 'word',
    layout: 'auto' | 'vertical' | 'horizontal'
  ) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const resp = await fetch('/api/ocr', {
      method: 'POST',
      headers,
      body: JSON.stringify({ image: imageBase64, scene, layout }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `OCR请求失败: ${resp.status}`);
    }

    return resp.json() as Promise<OcrResponse>;
  }, []);

  const validateOcrFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return t('ocr.fileNotImage');
    }
    if (file.size > maxFileSize) {
      return t('ocr.fileTooLarge');
    }
    return '';
  };

  // 处理OCR识别
  const processOcr = useCallback(async (
    file: File,
    options?: { sourceKey?: string }
  ) => {
    if (isUploading) {
      setUploadStatus(t('ocr.uploadingWait'));
      return;
    }

    const validationError = validateOcrFile(file);
    if (validationError) {
      setUploadStatus(validationError);
      return;
    }

    const fileKey = options?.sourceKey ?? `${file.name}-${file.size}-${file.lastModified}`;
    const now = Date.now();
    if (fileKey === lastUploadRef.current && now - lastUploadAtRef.current < 5000) {
      setUploadStatus(t('ocr.duplicateUpload'));
      return;
    }
    lastUploadRef.current = fileKey;
    lastUploadAtRef.current = now;

    const authToken = await getAccessToken();
    if (!authToken) {
      setUploadStatus(t('ocr.loginRequired'));
      return;
    }

    setIsUploading(true);
    setUploadStatus(t('ocr.recognizing'));

    try {
      const imageBase64 = await prepareOcrImage(file, {
        maxDimension,
        quality: 0.9,
        preferOriginalMaxBytes: 1_800_000
      });
      const result = await callOcrApi(imageBase64, authToken, 'context', ocrLayout);

      if (!result.text) {
        setUploadStatus(t('ocr.failed'));
        return;
      }

      // 如果有AI纠错建议，显示选择弹窗
      if (result.ai_corrected && result.ai_corrected !== result.text) {
        setOcrResult(result);
        setShowOcrModal(true);
        setUploadStatus(result._warning ? t('ocr.lowConfidence') : t('ocr.success'));
      } else {
        // 没有纠错，直接填入
        setContext(result.text);
        setUploadStatus(result._warning ? t('ocr.lowConfidence') : t('ocr.success'));
      }
    } catch (err: any) {
      console.error('[OCR] Failed:', err);
      setUploadStatus(err.message || t('ocr.failed'));
    } finally {
      setIsUploading(false);
    }
  }, [getAccessToken, t, callOcrApi, ocrLayout, setContext, isUploading]);

  const openCropper = useCallback((file: File) => {
    if (isUploading) {
      setUploadStatus(t('ocr.uploadingWait'));
      return;
    }
    const validationError = validateOcrFile(file);
    if (validationError) {
      setUploadStatus(validationError);
      return;
    }
    if (!token) {
      setUploadStatus(t('ocr.loginRequired'));
      return;
    }
    const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
    setPendingOcrFile(file);
    setPendingOcrKey(fileKey);
    setUploadStatus('');
    setShowCropper(true);
  }, [isUploading, t, token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      openCropper(file);
    }
    // 清空input以便重复选择同一文件
    e.target.value = '';
  };

  // 处理OCR结果选择
  const handleOcrSelect = (text: string) => {
    setContext(text);
  };

  // 拖拽处理
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        openCropper(file);
      }
    }
  };

  // 粘贴处理
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          openCropper(file);
        }
        return;
      }
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setPendingOcrFile(null);
    setPendingOcrKey('');
  };

  const handleCropConfirm = async (file: File) => {
    const sourceKey = pendingOcrKey;
    setShowCropper(false);
    setPendingOcrFile(null);
    setPendingOcrKey('');
    await processOcr(file, { sourceKey });
  };

  const handleUseOriginal = async (file: File) => {
    const sourceKey = pendingOcrKey;
    setShowCropper(false);
    setPendingOcrFile(null);
    setPendingOcrKey('');
    await processOcr(file, { sourceKey });
  };

  return (
    <>
      <label htmlFor="context-input" className="field-label">
        <span className="label-icon">卷</span>
        {t('input.contextLabel')}
      </label>

      <div
        className={`context-drop ${isDragging ? 'dragging' : ''}`}
        id="context-drop-zone"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <textarea
          id="context-input"
          className="field"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          onPaste={handlePaste}
          placeholder={t('input.contextPlaceholder')}
          spellCheck="false"
        />
        <div className={`drop-overlay ${isDragging ? 'visible' : ''}`} aria-hidden="true">
          <span className="drop-overlay-icon">📷</span>
          <span className="drop-overlay-text">{t('ocr.dropHint')}</span>
        </div>
      </div>

      <div className="upload-zone" id="context-upload-zone">
        <div className="upload-zone-content">
          <span className="upload-hint">{t('ocr.uploadHint')}</span>
          <input
            type="file"
            id="context-image-uploader"
            accept="image/*"
            hidden
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button
            id="context-upload-button"
            className={`btn-upload ${isUploading ? 'uploading' : ''}`}
            type="button"
            disabled={isUploading || !token}
            onClick={handleUploadClick}
            title={!token ? t('ocr.loginRequired') : ''}
          >
            <svg className="upload-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 5a2 2 0 0 0-2-2h-3.2l-.6-1.2A1 1 0 0 0 14.3 1h-4.6a1 1 0 0 0-.9.8L8.2 3H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5Zm-9 10 2.03-2.71a1 1 0 0 1 1.58-.03L17 14h2l-3.23-4.3a2 2 0 0 0-3.16.05L9 14l-2-2-3 4h8Zm6-7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
            </svg>
            <span className="upload-text">
              {isUploading ? t('ocr.recognizing') : t('ocr.uploadContext')}
            </span>
            <span className="spinner" aria-hidden="true"></span>
          </button>
        </div>
        <div className="ocr-layout">
          <span className="ocr-layout-label">{t('ocr.layoutLabel')}</span>
          <div className="ocr-layout-options">
            <button
              type="button"
              className={`ocr-layout-btn ${ocrLayout === 'vertical' ? 'active' : ''}`}
              onClick={() => setOcrLayout('vertical')}
            >
              {t('ocr.layoutVertical')}
            </button>
            <button
              type="button"
              className={`ocr-layout-btn ${ocrLayout === 'horizontal' ? 'active' : ''}`}
              onClick={() => setOcrLayout('horizontal')}
            >
              {t('ocr.layoutHorizontal')}
            </button>
            <button
              type="button"
              className={`ocr-layout-btn ${ocrLayout === 'auto' ? 'active' : ''}`}
              onClick={() => setOcrLayout('auto')}
            >
              {t('ocr.layoutAuto')}
            </button>
          </div>
        </div>
        <details className="ocr-tips">
          <summary className="ocr-tips-toggle">💡 {t('ocr.tips')}</summary>
          <ul className="ocr-tips-list">
            <li><strong>{t('ocr.tipCropTitle')}</strong>{t('ocr.tipCrop')}</li>
            <li><strong>{t('ocr.tipContrastTitle')}</strong>{t('ocr.tipContrast')}</li>
            <li><strong>{t('ocr.tipShadowTitle')}</strong>{t('ocr.tipShadow')}</li>
            <li><strong>{t('ocr.tipAlignTitle')}</strong>{t('ocr.tipAlign')}</li>
          </ul>
        </details>
        {uploadStatus && (
          <span id="context-upload-status" className="upload-status" aria-live="polite">
            {uploadStatus}
          </span>
        )}
      </div>

      {/* OCR结果选择弹窗 */}
      {ocrResult && (
        <OcrResultModal
          isOpen={showOcrModal}
          onClose={() => setShowOcrModal(false)}
          originalText={ocrResult.text}
          correctedText={ocrResult.ai_corrected}
          suggestions={ocrResult.ai_suggestions}
          onSelect={handleOcrSelect}
        />
      )}

      <OcrCropModal
        isOpen={showCropper}
        file={pendingOcrFile}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
        onUseOriginal={handleUseOriginal}
      />

      <style jsx>{`
        .context-drop.dragging {
          position: relative;
        }

        .drop-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(106, 88, 160, 0.9);
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          color: white;
          z-index: 10;
        }

        .drop-overlay.visible {
          display: flex;
        }

        .drop-overlay-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .drop-overlay-text {
          font-family: var(--font-serif);
          font-size: 16px;
        }

        .btn-upload.uploading .spinner {
          display: inline-block;
        }

        .btn-upload:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .upload-status {
          display: block;
          margin-top: 8px;
          font-size: 13px;
          color: var(--accent);
        }

        .ocr-layout {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          margin-top: 10px;
        }

        .ocr-layout-label {
          font-size: 12px;
          color: var(--muted);
        }

        .ocr-layout-options {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ocr-layout-btn {
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: white;
          font-size: 12px;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.2s;
        }

        .ocr-layout-btn.active {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }
      `}</style>
    </>
  );
}
