'use client';

import { useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';

// 搜索类型
type SearchType = 'char' | 'idiom' | 'word';
type SearchBy = 'text' | 'pinyin' | 'radical' | 'strokes';

// 数据类型
interface CharResult {
  char: string;
  traditional: string | null;
  pinyin: string | null;
  radical: string | null;
  total_strokes: number;
  explanation: string | null;
}

interface IdiomResult {
  word: string;
  pinyin: string | null;
  explanation: string | null;
  derivation: string | null;
  example: string | null;
}

interface WordResult {
  word: string;
  explanation: string | null;
}

// 常用部首列表
const COMMON_RADICALS = [
  '一', '丨', '丿', '丶', '乙', '二', '人', '儿', '入', '八',
  '冂', '冖', '冫', '几', '凵', '刀', '力', '勹', '匕', '十',
  '卜', '厂', '又', '口', '囗', '土', '士', '夂', '夕', '大',
  '女', '子', '宀', '寸', '小', '尸', '山', '巛', '工', '己',
  '巾', '干', '广', '廴', '弋', '弓', '彡', '彳', '心', '戈',
  '手', '支', '文', '斗', '斤', '方', '日', '曰', '月', '木',
  '欠', '止', '歹', '殳', '比', '毛', '氏', '气', '水', '火',
  '爪', '父', '爻', '片', '牙', '牛', '犬', '玉', '瓜', '瓦',
  '甘', '生', '用', '田', '疋', '疒', '白', '皮', '皿', '目',
  '矛', '矢', '石', '示', '禾', '穴', '立', '竹', '米', '糸',
  '缶', '网', '羊', '羽', '老', '耒', '耳', '肉', '臣', '自',
  '至', '臼', '舌', '舟', '艮', '色', '艸', '虍', '虫', '血',
  '行', '衣', '見', '角', '言', '谷', '豆', '豕', '貝', '赤',
  '走', '足', '身', '車', '辛', '辰', '邑', '酉', '金', '長',
  '門', '阜', '隹', '雨', '青', '非', '面', '革', '韋', '音',
  '頁', '風', '飛', '食', '首', '香', '馬', '骨', '高', '魚',
  '鳥', '鹿', '麥', '黃', '黑', '鼠', '鼻', '齒', '龍', '龜'
];

export default function DictionaryPage() {
  const t = useTranslations();
  const locale = useLocale();

  // 状态
  const [searchType, setSearchType] = useState<SearchType>('char');
  const [searchBy, setSearchBy] = useState<SearchBy>('text');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 结果
  const [charResults, setCharResults] = useState<CharResult[]>([]);
  const [idiomResults, setIdiomResults] = useState<IdiomResult[]>([]);
  const [wordResults, setWordResults] = useState<WordResult[]>([]);

  // 选中的汉字详情
  const [selectedChar, setSelectedChar] = useState<CharResult | null>(null);

  // 部首选择器
  const [showRadicalPicker, setShowRadicalPicker] = useState(false);

  // 搜索函数
  const handleSearch = useCallback(async () => {
    if (!query.trim() && searchBy !== 'radical') return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        type: searchType,
        by: searchBy,
        limit: '50'
      });

      const resp = await fetch(`/api/dictionary?${params}`);
      const data = await resp.json();

      if (resp.ok) {
        setCharResults(data.chars || []);
        setIdiomResults(data.idioms || []);
        setWordResults(data.words || []);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [query, searchType, searchBy]);

  // 回车搜索
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 选择部首
  const handleRadicalSelect = (radical: string) => {
    setQuery(radical);
    setSearchBy('radical');
    setShowRadicalPicker(false);
    // 自动搜索
    setTimeout(() => handleSearch(), 100);
  };

  // 点击汉字查看详情
  const handleCharClick = (char: CharResult) => {
    setSelectedChar(char);
  };

  // 从详情跳转到主页查询
  const handleAiQuery = (term: string) => {
    window.location.href = `/${locale}?word=${encodeURIComponent(term)}`;
  };

  return (
    <>
      {/* 背景层 */}
      <div className="paper-texture" aria-hidden="true" />

      <div className="dictionary-container">
        {/* 头部 */}
        <header className="dict-header">
          <Link href={`/${locale}`} className="back-link">
            ← {t('dictionary.backToHome')}
          </Link>

          <div className="dict-title-wrapper">
            <Image
              className="dict-phoenix"
              src="/assets/phoenix-colorful.png"
              alt=""
              width={60}
              height={60}
              aria-hidden="true"
            />
            <h1 className="dict-title" data-locale={locale}>
              {t('dictionary.title')}
            </h1>
          </div>
          <p className="dict-subtitle">{t('dictionary.subtitle')}</p>
        </header>

        {/* 搜索区域 */}
        <div className="search-section">
          {/* 标签页切换 */}
          <div className="tab-bar">
            <button
              className={`tab-btn ${searchType === 'char' ? 'active' : ''}`}
              onClick={() => setSearchType('char')}
            >
              <span className="tab-icon">字</span>
              {t('dictionary.tabChar')}
            </button>
            <button
              className={`tab-btn ${searchType === 'idiom' ? 'active' : ''}`}
              onClick={() => setSearchType('idiom')}
            >
              <span className="tab-icon">成</span>
              {t('dictionary.tabIdiom')}
            </button>
            <button
              className={`tab-btn ${searchType === 'word' ? 'active' : ''}`}
              onClick={() => setSearchType('word')}
            >
              <span className="tab-icon">词</span>
              {t('dictionary.tabWord')}
            </button>
          </div>

          {/* 搜索方式（仅汉字模式显示） */}
          {searchType === 'char' && (
            <div className="search-by-bar">
              <button
                className={`search-by-btn ${searchBy === 'text' ? 'active' : ''}`}
                onClick={() => setSearchBy('text')}
              >
                {t('dictionary.byText')}
              </button>
              <button
                className={`search-by-btn ${searchBy === 'pinyin' ? 'active' : ''}`}
                onClick={() => setSearchBy('pinyin')}
              >
                {t('dictionary.byPinyin')}
              </button>
              <button
                className={`search-by-btn ${searchBy === 'radical' ? 'active' : ''}`}
                onClick={() => {
                  setSearchBy('radical');
                  setShowRadicalPicker(true);
                }}
              >
                {t('dictionary.byRadical')}
              </button>
              <button
                className={`search-by-btn ${searchBy === 'strokes' ? 'active' : ''}`}
                onClick={() => setSearchBy('strokes')}
              >
                {t('dictionary.byStrokes')}
              </button>
            </div>
          )}

          {/* 搜索输入框 */}
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                searchBy === 'pinyin'
                  ? t('dictionary.placeholderPinyin')
                  : searchBy === 'strokes'
                  ? t('dictionary.placeholderStrokes')
                  : searchBy === 'radical'
                  ? t('dictionary.placeholderRadical')
                  : searchType === 'idiom'
                  ? t('dictionary.placeholderIdiom')
                  : searchType === 'word'
                  ? t('dictionary.placeholderWord')
                  : t('dictionary.placeholderChar')
              }
            />
            <button
              className="search-btn"
              onClick={handleSearch}
              disabled={isLoading}
            >
              {isLoading ? t('dictionary.searching') : t('dictionary.search')}
            </button>
          </div>

          {/* 部首选择器 */}
          {showRadicalPicker && searchBy === 'radical' && (
            <div className="radical-picker">
              <div className="radical-picker-header">
                <h4>{t('dictionary.selectRadical')}</h4>
                <button
                  className="radical-picker-close"
                  onClick={() => setShowRadicalPicker(false)}
                >
                  ×
                </button>
              </div>
              <div className="radical-grid">
                {COMMON_RADICALS.map((r) => (
                  <button
                    key={r}
                    className="radical-item"
                    onClick={() => handleRadicalSelect(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 结果区域 */}
        <div className="results-section">
          {/* 汉字结果 */}
          {searchType === 'char' && charResults.length > 0 && (
            <div className="result-grid char-grid">
              {charResults.map((char, idx) => (
                <div
                  key={idx}
                  className={`char-card ${selectedChar?.char === char.char ? 'selected' : ''}`}
                  onClick={() => handleCharClick(char)}
                >
                  <div className="char-main">{char.char}</div>
                  {char.traditional && char.traditional !== char.char && (
                    <div className="char-traditional">繁: {char.traditional}</div>
                  )}
                  <div className="char-pinyin">{char.pinyin}</div>
                  <div className="char-meta">
                    {char.radical && <span>{char.radical}部</span>}
                    {char.total_strokes > 0 && <span>{char.total_strokes}画</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 成语结果 */}
          {searchType === 'idiom' && idiomResults.length > 0 && (
            <div className="result-list">
              {idiomResults.map((idiom, idx) => (
                <div key={idx} className="idiom-card">
                  <div className="idiom-header">
                    <h3 className="idiom-word">{idiom.word}</h3>
                    <span className="idiom-pinyin">{idiom.pinyin}</span>
                  </div>
                  <p className="idiom-explanation">{idiom.explanation}</p>
                  {idiom.derivation && (
                    <p className="idiom-derivation">
                      <strong>{t('dictionary.derivation')}:</strong> {idiom.derivation}
                    </p>
                  )}
                  {idiom.example && (
                    <p className="idiom-example">
                      <strong>{t('dictionary.example')}:</strong> {idiom.example}
                    </p>
                  )}
                  <button
                    className="ai-query-btn"
                    onClick={() => handleAiQuery(idiom.word)}
                  >
                    AI {t('dictionary.deepAnalysis')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 词语结果 */}
          {searchType === 'word' && wordResults.length > 0 && (
            <div className="result-list">
              {wordResults.map((word, idx) => (
                <div key={idx} className="word-card">
                  <h3 className="word-term">{word.word}</h3>
                  <p className="word-explanation">{word.explanation}</p>
                  <button
                    className="ai-query-btn"
                    onClick={() => handleAiQuery(word.word)}
                  >
                    AI {t('dictionary.deepAnalysis')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 无结果提示 */}
          {!isLoading &&
            query &&
            charResults.length === 0 &&
            idiomResults.length === 0 &&
            wordResults.length === 0 && (
              <div className="no-results">
                <p>{t('dictionary.noResults')}</p>
              </div>
            )}

          {/* 初始提示 */}
          {!query && charResults.length === 0 && (
            <div className="search-hint">
              <div className="hint-icon">📚</div>
              <p>{t('dictionary.searchHint')}</p>
              <ul className="hint-list">
                <li>{t('dictionary.hintChar')}</li>
                <li>{t('dictionary.hintPinyin')}</li>
                <li>{t('dictionary.hintRadical')}</li>
                <li>{t('dictionary.hintIdiom')}</li>
              </ul>
            </div>
          )}
        </div>

        {/* 汉字详情侧边栏 */}
        {selectedChar && (
          <div className="char-detail-overlay" onClick={() => setSelectedChar(null)}>
            <div className="char-detail-panel" onClick={(e) => e.stopPropagation()}>
              <button
                className="detail-close"
                onClick={() => setSelectedChar(null)}
              >
                ×
              </button>

              <div className="detail-header">
                <div className="detail-char">{selectedChar.char}</div>
                {selectedChar.traditional &&
                  selectedChar.traditional !== selectedChar.char && (
                    <div className="detail-traditional">
                      {t('dictionary.traditional')}: {selectedChar.traditional}
                    </div>
                  )}
              </div>

              <div className="detail-info">
                <div className="info-row">
                  <span className="info-label">{t('dictionary.pinyin')}</span>
                  <span className="info-value">{selectedChar.pinyin || '-'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{t('dictionary.radical')}</span>
                  <span className="info-value">{selectedChar.radical || '-'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">{t('dictionary.strokes')}</span>
                  <span className="info-value">{selectedChar.total_strokes || '-'}</span>
                </div>
              </div>

              <div className="detail-explanation">
                <h4>{t('dictionary.explanation')}</h4>
                <p>{selectedChar.explanation || t('dictionary.noExplanation')}</p>
              </div>

              <button
                className="btn-primary detail-ai-btn"
                onClick={() => handleAiQuery(selectedChar.char)}
              >
                AI {t('dictionary.deepAnalysis')}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .dictionary-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 20px 64px;
          position: relative;
          z-index: 1;
        }

        /* 头部 */
        .dict-header {
          text-align: center;
          margin-bottom: 32px;
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

        .dict-title-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .dict-phoenix {
          opacity: 0.7;
          filter: saturate(0.6) brightness(1.1);
        }

        .dict-title {
          margin: 0;
          font-family: 'Noto Serif SC', serif;
          font-size: clamp(28px, 5vw, 40px);
          font-weight: 700;
          letter-spacing: 4px;
          background: linear-gradient(135deg, #6a50a0 0%, #8668c0 50%, #5a80b0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .dict-title[data-locale="en"] {
          font-family: 'Playfair Display', Georgia, serif;
          letter-spacing: 1px;
        }

        .dict-subtitle {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 15px;
          letter-spacing: 2px;
        }

        /* 搜索区域 */
        .search-section {
          background: linear-gradient(145deg, rgba(255,255,255,0.95), rgba(252,250,255,0.9));
          border: 1.5px solid var(--border);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 8px 32px rgba(122, 104, 166, 0.1);
        }

        /* 标签页 */
        .tab-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          justify-content: center;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: transparent;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          font-family: var(--font-serif);
          font-size: 15px;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .tab-btn:hover {
          border-color: var(--secondary);
          color: var(--accent);
        }

        .tab-btn.active {
          background: linear-gradient(135deg, var(--accent), var(--secondary));
          border-color: transparent;
          color: white;
        }

        .tab-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: rgba(255,255,255,0.2);
          border-radius: 6px;
          font-size: 14px;
        }

        .tab-btn.active .tab-icon {
          background: rgba(255,255,255,0.3);
        }

        /* 搜索方式 */
        .search-by-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .search-by-btn {
          padding: 8px 16px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 20px;
          font-size: 13px;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.2s;
        }

        .search-by-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .search-by-btn.active {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }

        /* 搜索输入框 */
        .search-input-wrapper {
          display: flex;
          gap: 12px;
        }

        .search-input {
          flex: 1;
          padding: 14px 20px;
          border: 1.5px solid var(--border);
          border-radius: 14px;
          font-size: 16px;
          font-family: var(--font-serif);
          background: rgba(255,255,255,0.8);
          transition: all 0.3s;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 4px rgba(122, 104, 166, 0.15);
        }

        .search-btn {
          padding: 14px 28px;
          background: linear-gradient(135deg, var(--accent), var(--secondary));
          border: none;
          border-radius: 14px;
          color: white;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          white-space: nowrap;
        }

        .search-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(122, 104, 166, 0.3);
        }

        .search-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        /* 部首选择器 */
        .radical-picker {
          margin-top: 16px;
          padding: 16px;
          background: rgba(248, 245, 252, 0.8);
          border: 1px solid var(--border);
          border-radius: 12px;
        }

        .radical-picker-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .radical-picker-header h4 {
          margin: 0;
          font-size: 14px;
          color: var(--ink);
        }

        .radical-picker-close {
          width: 28px;
          height: 28px;
          background: transparent;
          border: none;
          font-size: 20px;
          color: var(--muted);
          cursor: pointer;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .radical-picker-close:hover {
          background: var(--border);
          color: var(--text);
        }

        .radical-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
          gap: 6px;
          max-height: 200px;
          overflow-y: auto;
        }

        .radical-item {
          padding: 8px;
          background: white;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .radical-item:hover {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        /* 结果区域 */
        .results-section {
          min-height: 300px;
        }

        /* 汉字网格 */
        .char-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 12px;
        }

        .char-card {
          background: linear-gradient(145deg, rgba(255,255,255,0.98), rgba(252,250,255,0.95));
          border: 1.5px solid var(--border);
          border-radius: 14px;
          padding: 16px 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .char-card:hover {
          border-color: var(--accent);
          box-shadow: 0 6px 20px rgba(122, 104, 166, 0.15);
          transform: translateY(-2px);
        }

        .char-card.selected {
          border-color: var(--accent);
          background: linear-gradient(145deg, rgba(122, 104, 166, 0.08), rgba(154, 136, 192, 0.05));
        }

        .char-main {
          font-size: 36px;
          font-family: var(--font-calligraphy);
          color: var(--ink);
          line-height: 1.2;
        }

        .char-traditional {
          font-size: 12px;
          color: var(--accent);
          margin-top: 4px;
        }

        .char-pinyin {
          font-size: 13px;
          color: var(--muted);
          margin-top: 6px;
        }

        .char-meta {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin-top: 8px;
          font-size: 11px;
          color: var(--muted);
        }

        /* 成语/词语列表 */
        .result-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .idiom-card,
        .word-card {
          background: linear-gradient(145deg, rgba(255,255,255,0.98), rgba(252,250,255,0.95));
          border: 1.5px solid var(--border);
          border-left: 4px solid var(--secondary);
          border-radius: 0 14px 14px 0;
          padding: 20px;
          transition: all 0.3s;
        }

        .idiom-card:hover,
        .word-card:hover {
          border-left-color: var(--accent);
          box-shadow: 0 4px 16px rgba(122, 104, 166, 0.1);
        }

        .idiom-header {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 10px;
        }

        .idiom-word,
        .word-term {
          margin: 0;
          font-family: var(--font-calligraphy);
          font-size: 22px;
          color: var(--ink);
        }

        .idiom-pinyin {
          font-size: 14px;
          color: var(--muted);
        }

        .idiom-explanation,
        .word-explanation {
          margin: 0 0 10px;
          font-size: 15px;
          line-height: 1.7;
          color: var(--text);
        }

        .idiom-derivation,
        .idiom-example {
          margin: 8px 0 0;
          font-size: 13px;
          color: var(--muted);
          line-height: 1.6;
        }

        .ai-query-btn {
          margin-top: 12px;
          padding: 8px 16px;
          background: linear-gradient(135deg, rgba(122, 104, 166, 0.1), rgba(90, 128, 176, 0.08));
          border: 1px solid var(--secondary);
          border-radius: 20px;
          color: var(--accent);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .ai-query-btn:hover {
          background: linear-gradient(135deg, var(--accent), var(--secondary));
          color: white;
          border-color: transparent;
        }

        /* 无结果/提示 */
        .no-results,
        .search-hint {
          text-align: center;
          padding: 48px 24px;
          color: var(--muted);
        }

        .hint-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.6;
        }

        .hint-list {
          list-style: none;
          padding: 0;
          margin: 16px 0 0;
          text-align: left;
          display: inline-block;
        }

        .hint-list li {
          padding: 6px 0;
          font-size: 14px;
        }

        .hint-list li::before {
          content: '•';
          color: var(--accent);
          margin-right: 8px;
        }

        /* 汉字详情面板 */
        .char-detail-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }

        .char-detail-panel {
          position: relative;
          background: linear-gradient(145deg, rgba(255,255,255,0.98), rgba(252,250,255,0.95));
          border: 1.5px solid var(--border);
          border-radius: 20px;
          padding: 32px;
          max-width: 400px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        }

        .detail-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          font-size: 24px;
          color: var(--muted);
          cursor: pointer;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .detail-close:hover {
          background: var(--border);
          color: var(--text);
        }

        .detail-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .detail-char {
          font-size: 72px;
          font-family: var(--font-calligraphy);
          color: var(--ink);
          line-height: 1;
        }

        .detail-traditional {
          margin-top: 8px;
          font-size: 16px;
          color: var(--accent);
        }

        .detail-info {
          background: rgba(248, 245, 252, 0.6);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px dashed var(--border);
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-label {
          color: var(--muted);
          font-size: 14px;
        }

        .info-value {
          color: var(--text);
          font-weight: 500;
        }

        .detail-explanation h4 {
          margin: 0 0 10px;
          font-size: 14px;
          color: var(--muted);
        }

        .detail-explanation p {
          margin: 0;
          font-size: 15px;
          line-height: 1.8;
          color: var(--text);
          max-height: 200px;
          overflow-y: auto;
        }

        .detail-ai-btn {
          width: 100%;
          margin-top: 20px;
        }

        /* 移动端适配 */
        @media (max-width: 640px) {
          .tab-bar {
            flex-direction: column;
          }

          .tab-btn {
            width: 100%;
            justify-content: center;
          }

          .search-input-wrapper {
            flex-direction: column;
          }

          .search-btn {
            width: 100%;
          }

          .char-grid {
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          }

          .char-main {
            font-size: 28px;
          }
        }
      `}</style>
    </>
  );
}
