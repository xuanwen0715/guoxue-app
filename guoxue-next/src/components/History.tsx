'use client';

import { useTranslations } from 'next-intl';

export default function History() {
  const t = useTranslations();

  return (
    <section className="history" aria-label="查询历史 / History">
      <div className="history-card">
        <div className="history-header">
          <h2 className="history-title">
            <span className="history-icon">册</span>
            {t('history.title')}
            <span className="history-subtitle">History</span>
          </h2>
        </div>

        <div className="history-toolbar">
          <label className="history-filter" htmlFor="history-favs-only">
            <input type="checkbox" id="history-favs-only" />
            <span className="filter-icon">★</span>
            <span className="filter-text">{t('history.favsOnly')}</span>
          </label>
          <div className="history-actions">
            <button id="export-history" className="btn btn-history" type="button">
              <span className="btn-icon">↓</span>
              <span className="btn-text">{t('history.export')}</span>
            </button>
            <input type="file" id="import-history-input" accept="application/json" hidden />
            <button id="import-history" className="btn btn-history" type="button">
              <span className="btn-icon">↑</span>
              <span className="btn-text">{t('history.import')}</span>
            </button>
            <button id="backup-history" className="btn btn-history" type="button">
              <span className="btn-icon">💾</span>
              <span className="btn-text">{t('history.backup')}</span>
            </button>
            <button id="clear-history" className="btn btn-history btn-danger" type="button">
              <span className="btn-icon">✕</span>
              <span className="btn-text">{t('history.clear')}</span>
            </button>
          </div>
        </div>

        <ul id="history-list" className="history-list" aria-live="polite">
          {/* 历史记录项会在这里动态生成 */}
        </ul>

        <div className="history-empty" id="history-empty">
          <span className="empty-icon">📜</span>
          <p>{t('history.empty')}</p>
          <p className="empty-hint">{t('history.emptyHint')}</p>
        </div>
      </div>
    </section>
  );
}
