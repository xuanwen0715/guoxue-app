'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@/context/QueryContext';
import { useAuth } from '@/context/AuthContext';
import { prepareOcrImage } from '@/lib/ocr-image';
import OcrResultModal from './OcrResultModal';
import OcrCropModal from './OcrCropModal';
import OcrProgress from './OcrProgress';
import AutoComplete, { Suggestion } from './AutoComplete';
import Link from 'next/link';

interface OcrSuggestion {
  original: string;
  suggested: string;
  reason: string;
}

interface OcrPostProcess {
  suspicious_chars: {
    index: number;
    char: string;
    alternatives: string[];
    reason: string;
  }[];
  warning?: string;
}

interface OcrResponse {
  text: string;
  method: string;
  ai_corrected: string;
  ai_suggestions: OcrSuggestion[];
  _warning?: string;
  _post_process?: OcrPostProcess;
}

export default function WordInput() {
  const t = useTranslations();
  const locale = useLocale();
  const { word, setWord, handleQuery } = useQuery();
  const { token, getAccessToken } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxFileSize = 4 * 1024 * 1024;
  const lastUploadRef = useRef<string>('');
  const lastUploadAtRef = useRef<number>(0);

  // OCR结果弹窗状态
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResponse | null>(null);
  const [isLowConfidence, setIsLowConfidence] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [pendingOcrFile, setPendingOcrFile] = useState<File | null>(null);
  const [pendingOcrKey, setPendingOcrKey] = useState('');
  
  // OCR 进度状态
  const [ocrStage, setOcrStage] = useState<string>('ocr');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  
  // 形近字警告
  const [suspiciousChars, setSuspiciousChars] = useState<OcrPostProcess['suspicious_chars']>([]);
  const lastOcrFileRef = useRef<File | null>(null);
  const lastOcrKeyRef = useRef<string>('');

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 调用OCR API
  const callOcrApi = useCallback(async (
    imageBase64: string,
    authToken: string,
    scene: 'context' | 'word',
    layout: 'auto' | 'vertical' | 'horizontal',
    enhance = false
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
      body: JSON.stringify({ image: imageBase64, scene, layout, enhance }),
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
    options?: { sourceKey?: string; enhance?: boolean; force?: boolean }
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
    if (!options?.force) {
      if (fileKey === lastUploadRef.current && now - lastUploadAtRef.current < 5000) {
        setUploadStatus(t('ocr.duplicateUpload'));
        return;
      }
    }
    lastUploadRef.current = fileKey;
    lastUploadAtRef.current = now;
    lastOcrFileRef.current = file;
    lastOcrKeyRef.current = fileKey;

    const authToken = await getAccessToken();
    if (!authToken) {
      setUploadStatus(t('ocr.loginRequired'));
      return;
    }

    setIsUploading(true);
    setIsLowConfidence(false);
    setUploadStatus(t('ocr.recognizing'));
    setOcrStage('analysis');
    setOcrProgress(20);

    try {
      const imageBase64 = await prepareOcrImage(file, {
        maxDimension: 2400,
        quality: 0.92,
        preferOriginalMaxBytes: 2_200_000
      });
      setOcrStage('ocr');
      setOcrProgress(40);
      
      const result = await callOcrApi(
        imageBase64,
        authToken,
        'word',
        'auto',
        options?.enhance ?? false
      );
      
      setOcrStage('ai_review');
      setOcrProgress(80);

      if (!result.text) {
        setUploadStatus(t('ocr.failed'));
        setIsLowConfidence(false);
        setSuspiciousChars([]);
        return;
      }
      
      // 检查警告和形近字
      const hasWarning = result._warning?.includes('LOW_CONFIDENCE');
      const hasSuspicious = result._post_process?.suspicious_chars && result._post_process.suspicious_chars.length > 0;
      
      setIsLowConfidence(hasWarning || !!hasSuspicious);
      setSuspiciousChars(result._post_process?.suspicious_chars || []);

      // 如果有AI纠错建议，显示选择弹窗
      if (result.ai_corrected && result.ai_corrected !== result.text) {
        setOcrResult(result);
        setShowOcrModal(true);
        setUploadStatus(hasWarning ? t('ocr.lowConfidence') : t('ocr.success'));
      } else {
        // 没有纠错，直接填入
        setWord(result.text);
        if (hasSuspicious) {
          setUploadStatus(`识别完成，请注意核对形近字`);
        } else {
          setUploadStatus(hasWarning ? t('ocr.lowConfidence') : t('ocr.success'));
        }
      }
    } catch (err: any) {
      console.error('[OCR] Failed:', err);
      setUploadStatus(err.message || t('ocr.failed'));
    } finally {
      setIsUploading(false);
      setOcrStage('complete');
      setOcrProgress(100);
      setTimeout(() => {
        setOcrStage('ocr');
        setOcrProgress(0);
      }, 500);
    }
  }, [getAccessToken, t, callOcrApi, setWord, isUploading]);

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
    setIsLowConfidence(false);
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
    setWord(text);
  };

  // 处理自动完成选择
  const handleAutoCompleteSelect = (suggestion: Suggestion) => {
    setWord(suggestion.text);
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

  const handleEnhanceRetry = async () => {
    const file = lastOcrFileRef.current;
    if (!file) {
      return;
    }
    await processOcr(file, {
      sourceKey: lastOcrKeyRef.current,
      enhance: true,
      force: true,
    });
  };

  return (
    <>
      <div className="word-input-wrapper">
        <div className="inline-field">
          <label htmlFor="word-input" className="field-label">
            <span className="label-icon">字</span>
            {t('input.wordLabel')}
          </label>
          <div className="input-with-dict">
            <AutoComplete
              value={word}
              onChange={setWord}
              onSelect={handleAutoCompleteSelect}
              type="all"
              placeholder={t('input.wordPlaceholder')}
              className="field"
              debounceMs={300}
              minChars={1}
              maxSuggestions={8}
            />
            <Link href={`/${locale}/dictionary`} className="dict-shortcut" title={t('nav.dictionary')}>
              <span className="dict-icon">典</span>
              <span className="dict-label">{t('nav.dictionary')}</span>
            </Link>
          </div>
          <div id="word-hint" className="help">{t('input.wordHint')}</div>
        </div>
      </div>

      <div className="upload-zone" id="drop-zone">
        <div className="upload-zone-content">
          <span className="upload-hint">{t('ocr.rareCharHint')}</span>
          <input
            type="file"
            id="image-uploader"
            accept="image/*"
            hidden
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button
            id="upload-button"
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
              {isUploading ? t('ocr.recognizing') : t('ocr.uploadWord')}
            </span>
            <span className="spinner" aria-hidden="true"></span>
          </button>
        </div>
        <details className="ocr-tips">
          <summary className="ocr-tips-toggle">💡 {t('ocr.tips')}</summary>
          <ul className="ocr-tips-list">
            <li><strong>{t('ocr.tipCropTitle')}</strong>{t('ocr.tipCropShort')}</li>
            <li><strong>{t('ocr.tipContrastTitle')}</strong>{t('ocr.tipContrastShort')}</li>
            <li><strong>{t('ocr.tipAlignTitle')}</strong>{t('ocr.tipAlignShort')}</li>
          </ul>
        </details>
        {uploadStatus && (
          <span id="upload-status" className="upload-status" aria-live="polite">
            {uploadStatus}
          </span>
        )}
        
        {/* 形近字警告 */}
        {suspiciousChars.length > 0 && (
          <div className="suspicious-chars-warning">
            <div className="warning-title">⚠️ 检测到形近字，请核对：</div>
            <div className="suspicious-list">
              {suspiciousChars.map((item, idx) => (
                <span key={idx} className="suspicious-item">
                  「{item.char}」可能是「{item.alternatives.join(' / ')}」
                </span>
              ))}
            </div>
          </div>
        )}
        
        {isLowConfidence && (
          <button
            className="ocr-retry-btn"
            type="button"
            onClick={handleEnhanceRetry}
            disabled={isUploading}
          >
            {t('ocr.retryEnhance')}
          </button>
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

      <OcrProgress 
        isProcessing={isUploading}
        stage={ocrStage}
        progress={ocrProgress}
      />

      <style jsx>{`
        .word-input-wrapper {
          width: 100%;
        }

        .word-input-wrapper :global(.inline-field) {
          flex: 1;
        }

        .input-with-dict {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .input-with-dict :global(.field) {
          flex: 1;
        }

        .dict-shortcut {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 16px;
          background: linear-gradient(135deg,
            rgba(90, 128, 176, 0.32) 0%,
            rgba(110, 165, 211, 0.28) 100%
          );
          border: 1.5px solid rgba(90, 128, 176, 0.55);
          border-radius: 12px;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.25s ease;
          flex-shrink: 0;
          box-shadow: 0 6px 16px rgba(90, 128, 176, 0.22), 0 0 0 2px rgba(90, 128, 176, 0.10);
          backdrop-filter: saturate(120%);
        }

        .dict-shortcut:hover {
          background: linear-gradient(135deg, #5a80b0, #6ea5d3);
          border-color: transparent;
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(90, 128, 176, 0.32);
          color: #fff;
        }

        .dict-shortcut:hover .dict-icon,
        .dict-shortcut:hover .dict-label {
          color: #fff;
          text-shadow: none;
        }

        .dict-icon {
          font-family: var(--font-calligraphy), 'Noto Serif SC', 'KaiTi', serif;
          font-size: 20px;
          font-weight: 700;
          color: #2c4a78;
          transition: color 0.25s ease;
          text-shadow: 0 1px 0 rgba(255,255,255,0.35);
        }

        .dict-label {
          font-family: var(--font-serif);
          font-size: 14px;
          font-weight: 700;
          color: #2c4a78;
          transition: color 0.25s ease;
          white-space: nowrap;
          letter-spacing: 0.2px;
        }

        @media (max-width: 480px) {
          .dict-label {
            display: none;
          }
          .dict-shortcut {
            padding: 10px 14px;
          }
          .dict-icon {
            font-size: 20px;
          }
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

        .suspicious-chars-warning {
          margin-top: 12px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%);
          border: 1px solid #ffc107;
          border-radius: 10px;
          font-size: 13px;
        }

        .warning-title {
          font-weight: 600;
          color: #856404;
          margin-bottom: 8px;
        }

        .suspicious-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .suspicious-item {
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.8);
          border-radius: 6px;
          color: #856404;
          font-family: var(--font-serif);
        }
      `}</style>
    </>
  );
}
