'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@/context/QueryContext';
import { useAuth } from '@/context/AuthContext';
import OcrResultModal from './OcrResultModal';
import Link from 'next/link';

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
}

export default function WordInput() {
  const t = useTranslations();
  const locale = useLocale();
  const { word, setWord, handleQuery } = useQuery();
  const { token, getAuthHeader } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OCR结果弹窗状态
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResponse | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 将图片文件转为base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 调用OCR API
  const callOcrApi = useCallback(async (imageBase64: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    };

    const resp = await fetch('/api/ocr', {
      method: 'POST',
      headers,
      body: JSON.stringify({ image: imageBase64 }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `OCR请求失败: ${resp.status}`);
    }

    return resp.json() as Promise<OcrResponse>;
  }, [getAuthHeader]);

  // 处理OCR识别
  const processOcr = useCallback(async (file: File) => {
    if (!token) {
      setUploadStatus(t('login.errorGeneric'));
      return;
    }

    setIsUploading(true);
    setUploadStatus(t('ocr.recognizing'));

    try {
      const imageBase64 = await fileToBase64(file);
      const result = await callOcrApi(imageBase64);

      if (!result.text) {
        setUploadStatus(t('ocr.failed'));
        return;
      }

      // 如果有AI纠错建议，显示选择弹窗
      if (result.ai_corrected && result.ai_corrected !== result.text) {
        setOcrResult(result);
        setShowOcrModal(true);
        setUploadStatus(t('ocr.success'));
      } else {
        // 没有纠错，直接填入
        setWord(result.text);
        setUploadStatus(t('ocr.success'));
      }
    } catch (err: any) {
      console.error('[OCR] Failed:', err);
      setUploadStatus(err.message || t('ocr.failed'));
    } finally {
      setIsUploading(false);
    }
  }, [token, t, callOcrApi, setWord]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processOcr(file);
    }
    // 清空input以便重复选择同一文件
    e.target.value = '';
  };

  // 处理OCR结果选择
  const handleOcrSelect = (text: string) => {
    setWord(text);
  };

  // 处理Enter键查询
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && word.trim()) {
      e.preventDefault();
      handleQuery();
    }
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
            <input
              type="text"
              id="word-input"
              className="field"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onKeyDown={handleKeyDown}
              inputMode="text"
              placeholder={t('input.wordPlaceholder')}
              aria-describedby="word-hint"
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
            title={!token ? '请先登录' : ''}
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
          gap: 6px;
          padding: 8px 14px;
          background: linear-gradient(145deg,
            rgba(255, 255, 255, 0.98) 0%,
            rgba(248, 245, 252, 0.95) 100%
          );
          border: 1.5px solid rgba(122, 104, 166, 0.25);
          border-radius: 10px;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.3s ease;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(122, 104, 166, 0.08);
        }

        .dict-shortcut:hover {
          background: linear-gradient(135deg, var(--accent), var(--secondary));
          border-color: transparent;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(122, 104, 166, 0.25);
        }

        .dict-shortcut:hover .dict-icon,
        .dict-shortcut:hover .dict-label {
          color: white;
        }

        .dict-icon {
          font-family: 'Noto Serif SC', 'KaiTi', serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--accent);
          transition: color 0.3s ease;
        }

        .dict-label {
          font-family: var(--font-serif);
          font-size: 13px;
          font-weight: 500;
          color: var(--accent);
          transition: color 0.3s ease;
          white-space: nowrap;
        }

        @media (max-width: 480px) {
          .dict-label {
            display: none;
          }
          .dict-shortcut {
            padding: 10px 12px;
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
      `}</style>
    </>
  );
}
