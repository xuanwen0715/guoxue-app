'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';

interface CharInfo {
  char: string;
  traditional: string | null;
  pinyin: string | null;
  radical: string | null;
  total_strokes: number;
  explanation: string | null;
}

interface DictQuickCardProps {
  word: string;
}

export default function DictQuickCard({ word }: DictQuickCardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [charInfos, setCharInfos] = useState<CharInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // 提取单个汉字进行查询
  const chars = word.split('').filter((c) => /[\u4e00-\u9fff]/.test(c)).slice(0, 5);

  useEffect(() => {
    if (chars.length === 0) return;

    const fetchCharInfos = async () => {
      setIsLoading(true);
      try {
        const resp = await fetch('/api/dictionary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batch_lookup',
            chars: chars
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          setCharInfos(data.results || []);
        }
      } catch (err) {
        console.error('Dict lookup failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCharInfos();
  }, [word]);

  if (chars.length === 0 || (charInfos.length === 0 && !isLoading)) {
    return null;
  }

  return (
    <div className="dict-quick-card">
      <div className="card-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-left">
          <span className="card-icon">📖</span>
          <span className="card-title">{t('dictionary.quickLookup')}</span>
        </div>
        <div className="header-right">
          <Link
            href={`/${locale}/dictionary?q=${encodeURIComponent(word)}`}
            className="more-link"
            onClick={(e) => e.stopPropagation()}
          >
            {t('dictionary.viewMore')} →
          </Link>
          <button className="expand-btn">
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="card-content">
          {isLoading ? (
            <div className="loading">{t('dictionary.loading')}</div>
          ) : (
            <div className="char-list">
              {charInfos.map((info, idx) => (
                <div key={idx} className="char-item">
                  <div className="char-main-row">
                    <span className="char-display">{info.char}</span>
                    {info.traditional && info.traditional !== info.char && (
                      <span className="char-trad">{info.traditional}</span>
                    )}
                    <span className="char-pinyin">{info.pinyin}</span>
                  </div>
                  <div className="char-meta-row">
                    {info.radical && (
                      <span className="meta-item">
                        {t('dictionary.radical')}: {info.radical}
                      </span>
                    )}
                    {info.total_strokes > 0 && (
                      <span className="meta-item">
                        {t('dictionary.strokes')}: {info.total_strokes}
                      </span>
                    )}
                  </div>
                  {info.explanation && (
                    <p className="char-explanation">
                      {info.explanation.length > 100
                        ? info.explanation.slice(0, 100) + '...'
                        : info.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .dict-quick-card {
          margin-top: 16px;
          background: linear-gradient(145deg,
            rgba(248, 245, 252, 0.9) 0%,
            rgba(252, 250, 255, 0.85) 100%
          );
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: linear-gradient(135deg,
            rgba(122, 104, 166, 0.08) 0%,
            rgba(90, 128, 176, 0.05) 100%
          );
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          user-select: none;
        }

        .card-header:hover {
          background: linear-gradient(135deg,
            rgba(122, 104, 166, 0.12) 0%,
            rgba(90, 128, 176, 0.08) 100%
          );
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .card-icon {
          font-size: 16px;
        }

        .card-title {
          font-family: var(--font-serif);
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .more-link {
          font-size: 12px;
          color: var(--accent);
          text-decoration: none;
          transition: color 0.2s;
        }

        .more-link:hover {
          color: var(--ink);
          text-decoration: underline;
        }

        .expand-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 50%;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }

        .expand-btn:hover {
          transform: scale(1.1);
        }

        .card-content {
          padding: 16px;
        }

        .loading {
          text-align: center;
          color: var(--muted);
          font-size: 14px;
          padding: 20px;
        }

        .char-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .char-item {
          padding-bottom: 16px;
          border-bottom: 1px dashed var(--border);
        }

        .char-item:last-child {
          padding-bottom: 0;
          border-bottom: none;
        }

        .char-main-row {
          display: flex;
          align-items: baseline;
          gap: 10px;
          margin-bottom: 6px;
        }

        .char-display {
          font-size: 28px;
          font-family: var(--font-calligraphy);
          color: var(--ink);
        }

        .char-trad {
          font-size: 20px;
          color: var(--accent);
        }

        .char-pinyin {
          font-size: 14px;
          color: var(--muted);
        }

        .char-meta-row {
          display: flex;
          gap: 16px;
          margin-bottom: 8px;
        }

        .meta-item {
          font-size: 12px;
          color: var(--muted);
          background: rgba(122, 104, 166, 0.08);
          padding: 2px 8px;
          border-radius: 10px;
        }

        .char-explanation {
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
          color: var(--text);
        }

        @media (max-width: 640px) {
          .card-header {
            padding: 10px 12px;
          }

          .more-link {
            display: none;
          }

          .char-display {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}
