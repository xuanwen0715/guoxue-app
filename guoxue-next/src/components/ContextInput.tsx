'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef } from 'react';
import { useQuery } from '@/context/QueryContext';

export default function ContextInput() {
  const t = useTranslations();
  const { context, setContext } = useQuery();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      // TODO: 实现OCR识别逻辑
      console.log('Uploading file:', file.name);
      setTimeout(() => {
        setIsUploading(false);
        alert('OCR功能待实现');
      }, 1000);
    }
  };

  return (
    <>
      <label htmlFor="context-input" className="field-label">
        <span className="label-icon">卷</span>
        {t('input.contextLabel')}
      </label>

      <div className="context-drop" id="context-drop-zone">
        <textarea
          id="context-input"
          className="field"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={t('input.contextPlaceholder')}
          spellCheck="false"
        />
        <div className="drop-overlay" aria-hidden="true">
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
            className="btn-upload"
            type="button"
            disabled={isUploading}
            onClick={handleUploadClick}
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
        <details className="ocr-tips">
          <summary className="ocr-tips-toggle">💡 {t('ocr.tips')}</summary>
          <ul className="ocr-tips-list">
            <li><strong>{t('ocr.tipCropTitle')}</strong>{t('ocr.tipCrop')}</li>
            <li><strong>{t('ocr.tipContrastTitle')}</strong>{t('ocr.tipContrast')}</li>
            <li><strong>{t('ocr.tipShadowTitle')}</strong>{t('ocr.tipShadow')}</li>
            <li><strong>{t('ocr.tipAlignTitle')}</strong>{t('ocr.tipAlign')}</li>
          </ul>
        </details>
        <span id="context-upload-status" className="upload-status" aria-live="polite"></span>
      </div>
    </>
  );
}
