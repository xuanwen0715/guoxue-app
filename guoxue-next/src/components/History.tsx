'use client';

import { useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useHistory, HistoryItem } from '@/context/HistoryContext';
import { useQuery } from '@/context/QueryContext';

export default function History() {
  const t = useTranslations();
  const locale = useLocale();
  const {
    history,
    favsOnly,
    setFavsOnly,
    toggleFavorite,
    clearHistory,
    exportHistory,
    backupHistory,
    importHistory,
  } = useHistory();
  const { setWord, setContext, setResult, setResultText } = useQuery();
  const importInputRef = useRef<HTMLInputElement>(null);

  // 获取排序后的历史列表
  const getDisplayHistory = () => {
    const source = favsOnly ? history.filter(h => h.favorite) : history;
    return source.sort((a, b) => {
      const fa = Number(!!a.favorite), fb = Number(!!b.favorite);
      if (fb !== fa) return fb - fa; // 收藏优先
      return (b.ts || 0) - (a.ts || 0); // 最新优先
    });
  };

  const displayHistory = getDisplayHistory();

  // 点击历史项，加载到查询框
  const handleItemClick = (item: HistoryItem) => {
    setWord(item.word || '');
    setContext(item.context || '');
    if (item.data) {
      setResult(item.data);
      // 生成简单的文本显示
      const text = item.data.text || item.data.explanation_zh || item.data.explanation || '';
      setResultText(text);
    }
    // 滚动到结果区域
    document.getElementById('result-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 格式化时间
  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 处理导入文件
  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importHistory(file);
      // 清空 input 以便再次选择同一文件
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  return (
    <section className="history" aria-label="查询历史 / History">
      <div className="history-card">
        <div className="history-header">
          <h2 className="history-title" data-locale={locale}>
            <span className="history-icon">册</span>
            {t('history.title')}
          </h2>
        </div>

        <div className="history-toolbar">
          <label className="history-filter" htmlFor="history-favs-only">
            <input
              type="checkbox"
              id="history-favs-only"
              checked={favsOnly}
              onChange={(e) => setFavsOnly(e.target.checked)}
            />
            <span className="filter-icon">★</span>
            <span className="filter-text">{t('history.favsOnly')}</span>
          </label>
          <div className="history-actions">
            <button
              id="export-history"
              className="btn btn-history"
              type="button"
              onClick={exportHistory}
            >
              <span className="btn-icon">↓</span>
              <span className="btn-text">{t('history.export')}</span>
            </button>
            <input
              type="file"
              id="import-history-input"
              ref={importInputRef}
              accept="application/json"
              hidden
              onChange={handleImportChange}
            />
            <button
              id="import-history"
              className="btn btn-history"
              type="button"
              onClick={() => importInputRef.current?.click()}
            >
              <span className="btn-icon">↑</span>
              <span className="btn-text">{t('history.import')}</span>
            </button>
            <button
              id="backup-history"
              className="btn btn-history"
              type="button"
              onClick={backupHistory}
            >
              <span className="btn-icon">💾</span>
              <span className="btn-text">{t('history.backup')}</span>
            </button>
            <button
              id="clear-history"
              className="btn btn-history btn-danger"
              type="button"
              onClick={clearHistory}
            >
              <span className="btn-icon">✕</span>
              <span className="btn-text">{t('history.clear')}</span>
            </button>
          </div>
        </div>

        {displayHistory.length > 0 ? (
          <ul id="history-list" className="history-list" aria-live="polite">
            {displayHistory.map((item) => (
              <li
                key={item.id}
                className="history-item"
                data-id={item.id}
                onClick={() => handleItemClick(item)}
              >
                <div className="history-left">
                  <span className="history-term">{item.word}</span>
                  <span className="history-meta">
                    {formatTime(item.ts)} · 上下文{item.contextLen ? `：${item.contextLen}字` : '：无'}
                  </span>
                </div>
                <button
                  className={`star-btn ${item.favorite ? 'fav' : ''}`}
                  type="button"
                  aria-label="收藏"
                  aria-pressed={item.favorite}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(item.id);
                  }}
                >
                  {item.favorite ? '★' : '☆'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="history-empty" id="history-empty">
            <span className="empty-icon">📜</span>
            <p>{t('history.empty')}</p>
            <p className="empty-hint">{t('history.emptyHint')}</p>
          </div>
        )}
      </div>
    </section>
  );
}
