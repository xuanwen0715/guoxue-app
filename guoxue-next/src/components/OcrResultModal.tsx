'use client';

import { useTranslations } from 'next-intl';

interface OcrSuggestion {
  original: string;
  suggested: string;
  reason: string;
}

interface OcrResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  correctedText: string;
  suggestions: OcrSuggestion[];
  onSelect: (text: string) => void;
}

export default function OcrResultModal({
  isOpen,
  onClose,
  originalText,
  correctedText,
  suggestions,
  onSelect,
}: OcrResultModalProps) {
  const t = useTranslations();

  if (!isOpen) return null;

  const hasCorrected = correctedText && correctedText !== originalText;

  const handleSelect = (text: string) => {
    onSelect(text);
    onClose();
  };

  return (
    <div className="ocr-modal-overlay" onClick={onClose}>
      <div className="ocr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ocr-modal-header">
          <h3>{t('ocr.chooseResult')}</h3>
          <button className="ocr-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="ocr-modal-body">
          {/* 原始OCR结果 */}
          <div className="ocr-result-section">
            <div className="ocr-result-label">
              <span className="ocr-label-icon">📷</span>
              {t('ocr.originalResult')}
            </div>
            <div className="ocr-result-text">{originalText}</div>
            <button
              className="ocr-select-btn"
              onClick={() => handleSelect(originalText)}
            >
              {t('ocr.useResult')}
            </button>
          </div>

          {/* AI纠错结果 */}
          {hasCorrected && (
            <div className="ocr-result-section ocr-corrected">
              <div className="ocr-result-label">
                <span className="ocr-label-icon">✨</span>
                {t('ocr.aiResult')}
              </div>
              <div className="ocr-result-text">{correctedText}</div>

              {/* 纠错建议详情 */}
              {suggestions && suggestions.length > 0 && (
                <div className="ocr-suggestions">
                  <div className="ocr-suggestions-title">{t('ocr.suggestionTitle')}</div>
                  <ul className="ocr-suggestions-list">
                    {suggestions.map((s, idx) => (
                      <li key={idx}>
                        <span className="ocr-original">「{s.original}」</span>
                        <span className="ocr-arrow">→</span>
                        <span className="ocr-suggested">「{s.suggested}」</span>
                        <span className="ocr-reason">（{s.reason}）</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                className="ocr-select-btn ocr-select-corrected"
                onClick={() => handleSelect(correctedText)}
              >
                {t('ocr.useAiResult')}
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .ocr-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .ocr-modal {
          background: white;
          border-radius: 16px;
          max-width: 600px;
          width: 100%;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        }

        .ocr-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(135deg, #f8f6fc 0%, #f0f4f8 100%);
        }

        .ocr-modal-header h3 {
          margin: 0;
          font-family: var(--font-serif);
          font-size: 18px;
          color: var(--ink);
        }

        .ocr-modal-close {
          background: none;
          border: none;
          font-size: 24px;
          color: var(--muted);
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .ocr-modal-close:hover {
          background: rgba(0, 0, 0, 0.1);
          color: var(--ink);
        }

        .ocr-modal-body {
          padding: 20px;
          overflow-y: auto;
          max-height: calc(80vh - 60px);
        }

        .ocr-result-section {
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .ocr-result-section:last-child {
          margin-bottom: 0;
        }

        .ocr-result-section.ocr-corrected {
          border-color: var(--accent);
          background: linear-gradient(135deg, #f8f4ff 0%, #f0f8ff 100%);
        }

        .ocr-result-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-serif);
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 12px;
        }

        .ocr-label-icon {
          font-size: 16px;
        }

        .ocr-result-text {
          font-family: var(--font-serif);
          font-size: 16px;
          line-height: 1.8;
          color: var(--ink);
          padding: 12px;
          background: rgba(255, 255, 255, 0.8);
          border-radius: 8px;
          border: 1px solid var(--border);
          white-space: pre-wrap;
          margin-bottom: 12px;
        }

        .ocr-suggestions {
          margin-bottom: 12px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 8px;
        }

        .ocr-suggestions-title {
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .ocr-suggestions-list {
          list-style: none;
          padding: 0;
          margin: 0;
          font-size: 14px;
        }

        .ocr-suggestions-list li {
          margin-bottom: 6px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
        }

        .ocr-original {
          color: var(--vermilion);
          text-decoration: line-through;
        }

        .ocr-arrow {
          color: var(--muted);
        }

        .ocr-suggested {
          color: var(--accent);
          font-weight: 500;
        }

        .ocr-reason {
          color: var(--muted);
          font-size: 12px;
        }

        .ocr-select-btn {
          display: block;
          width: 100%;
          padding: 10px 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: white;
          font-family: var(--font-serif);
          font-size: 14px;
          color: var(--ink);
          cursor: pointer;
          transition: all 0.2s;
        }

        .ocr-select-btn:hover {
          border-color: var(--accent);
          background: #f8f4ff;
        }

        .ocr-select-btn.ocr-select-corrected {
          background: linear-gradient(135deg, #6a58a0 0%, #5a78a8 100%);
          color: white;
          border: none;
        }

        .ocr-select-btn.ocr-select-corrected:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(106, 88, 160, 0.3);
        }

        @media (max-width: 600px) {
          .ocr-modal {
            max-height: 90vh;
          }

          .ocr-modal-body {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
