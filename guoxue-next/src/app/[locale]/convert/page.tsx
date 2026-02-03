'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const MAX_TEXT_LENGTH = 20000;

type ConvertDirection = 's2t' | 't2s';

export default function ConvertPage() {
  const locale = useLocale();
  const t = useTranslations('convert');
  const searchParams = useSearchParams();
  const [direction, setDirection] = useState<ConvertDirection>('s2t');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const hasAppliedParams = useRef(false);

  useEffect(() => {
    if (hasAppliedParams.current) return;
    const textParam = searchParams?.get('text');
    const directionParam = searchParams?.get('direction');
    if (directionParam === 's2t' || directionParam === 't2s') {
      setDirection(directionParam);
    }
    if (textParam) {
      setInput(textParam);
    }
    hasAppliedParams.current = true;
  }, [searchParams]);

  const handleConvert = async () => {
    if (!input.trim()) {
      setError(t('emptyHint'));
      return;
    }
    if (input.length > MAX_TEXT_LENGTH) {
      setError(t('tooLong'));
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const resp = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, direction })
      });
      const data = await resp.json();
      if (resp.ok) {
        setOutput(data.result || '');
      } else {
        setError(data.error || t('error'));
      }
    } catch (err) {
      console.error('[Convert] Failed:', err);
      setError(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = () => {
    setDirection((prev) => (prev === 's2t' ? 't2s' : 's2t'));
    if (output) {
      setInput(output);
      setOutput('');
    }
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setError('');
  };

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('[Convert] Copy failed:', err);
    }
  };

  return (
    <>
      <div className="paper-texture" aria-hidden="true" />

      <div className="convert-container">
        <header className="convert-header">
          <Link href={`/${locale}/dictionary`} className="back-link">
            &larr; {t('backToDict')}
          </Link>
          <h1 className="convert-title">{t('title')}</h1>
          <p className="convert-subtitle">{t('subtitle')}</p>
        </header>

        <section className="convert-panel">
          <div className="direction-row">
            <span className="direction-label">{t('direction')}</span>
            <div className="direction-toggle">
              <button
                type="button"
                className={`direction-btn ${direction === 's2t' ? 'active' : ''}`}
                onClick={() => setDirection('s2t')}
              >
                {t('s2t')}
              </button>
              <button
                type="button"
                className={`direction-btn ${direction === 't2s' ? 'active' : ''}`}
                onClick={() => setDirection('t2s')}
              >
                {t('t2s')}
              </button>
              <button type="button" className="direction-swap" onClick={handleSwap}>
                {t('swap')}
              </button>
            </div>
          </div>

          <div className="convert-areas">
            <div className="convert-block">
              <div className="block-header">
                <span className="block-label">{t('inputLabel')}</span>
                <span className="block-count">
                  {t('count')}: {input.length}/{MAX_TEXT_LENGTH}
                </span>
              </div>
              <textarea
                className="convert-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('inputPlaceholder')}
                rows={8}
              />
            </div>

            <div className="convert-block">
              <div className="block-header">
                <span className="block-label">{t('outputLabel')}</span>
              </div>
              <textarea
                className="convert-textarea output"
                value={output}
                readOnly
                rows={8}
              />
            </div>
          </div>

          {error && <div className="convert-error">{error}</div>}

          <div className="convert-actions">
            <button className="btn-primary" onClick={handleConvert} disabled={isLoading}>
              {isLoading ? t('converting') : t('convert')}
            </button>
            <button className="btn-secondary" onClick={handleCopy} disabled={!output}>
              {copied ? t('copied') : t('copy')}
            </button>
            <button className="btn-ghost" onClick={handleClear}>
              {t('clear')}
            </button>
          </div>

          <div className="convert-note">{t('privacy')}</div>
        </section>
      </div>

      <style jsx>{`
        .convert-container {
          max-width: 960px;
          margin: 0 auto;
          padding: 24px 20px 64px;
          position: relative;
          z-index: 1;
        }

        .convert-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .back-link {
          display: inline-block;
          margin-bottom: 16px;
          color: var(--accent);
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
        }

        .back-link:hover {
          color: var(--ink);
        }

        .convert-title {
          margin: 0;
          font-family: var(--font-serif);
          font-size: clamp(26px, 4vw, 36px);
          font-weight: 700;
          letter-spacing: 2px;
          background: linear-gradient(135deg, #6a50a0 0%, #8668c0 50%, #5a80b0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .convert-subtitle {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 14px;
          letter-spacing: 1px;
        }

        .convert-panel {
          background: linear-gradient(145deg, rgba(255,255,255,0.95), rgba(252,250,255,0.9));
          border: 1.5px solid var(--border);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(122, 104, 166, 0.1);
        }

        .direction-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .direction-label {
          font-size: 14px;
          color: var(--muted);
        }

        .direction-toggle {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .direction-btn {
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: white;
          font-size: 13px;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.2s;
        }

        .direction-btn.active {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }

        .direction-swap {
          padding: 8px 14px;
          border-radius: 20px;
          border: 1px dashed var(--accent);
          background: transparent;
          font-size: 13px;
          color: var(--accent);
          cursor: pointer;
          transition: all 0.2s;
        }

        .direction-swap:hover {
          background: rgba(122, 104, 166, 0.1);
        }

        .convert-areas {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px;
        }

        .convert-block {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .block-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          color: var(--muted);
        }

        .block-label {
          font-weight: 600;
          color: var(--ink);
        }

        .block-count {
          font-size: 12px;
        }

        .convert-textarea {
          width: 100%;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1.5px solid var(--border);
          font-size: 15px;
          font-family: var(--font-serif);
          resize: vertical;
          min-height: 180px;
          background: rgba(255,255,255,0.9);
        }

        .convert-textarea:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 4px rgba(122, 104, 166, 0.15);
        }

        .convert-textarea.output {
          background: rgba(248, 245, 252, 0.8);
        }

        .convert-error {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(220, 38, 38, 0.08);
          color: #b42318;
          font-size: 13px;
        }

        .convert-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .btn-primary {
          padding: 10px 20px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--secondary));
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-secondary {
          padding: 10px 18px;
          border-radius: 12px;
          border: 1px solid var(--accent);
          background: white;
          color: var(--accent);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-ghost {
          padding: 10px 16px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--muted);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .convert-note {
          margin-top: 16px;
          font-size: 12px;
          color: var(--muted);
        }

        @media (max-width: 640px) {
          .convert-panel {
            padding: 18px;
          }

          .convert-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}
