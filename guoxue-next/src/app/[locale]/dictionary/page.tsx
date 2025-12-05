'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';

// Search types
type SearchType = 'char' | 'idiom' | 'word';
type SearchBy = 'text' | 'pinyin' | 'radical' | 'strokes';

// Data types
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

// Common radicals list (Kangxi radicals)
const COMMON_RADICALS = [
  '\u4e00', '\u4e28', '\u4e36', '\u4e3f', '\u4e59', '\u4e85', '\u4e8c', '\u4ea0', '\u4eba', '\u513f',
  '\u5165', '\u516b', '\u5182', '\u5196', '\u51ab', '\u5200', '\u529b', '\u52f9', '\u5315', '\u5341',
  '\u535c', '\u5369', '\u5382', '\u53b6', '\u53c8', '\u53e3', '\u56d7', '\u571f', '\u58eb', '\u5902',
  '\u5915', '\u5927', '\u5973', '\u5b50', '\u5b80', '\u5bf8', '\u5c0f', '\u5c22', '\u5c38', '\u5c71',
  '\u5ddb', '\u5de5', '\u5df1', '\u5dfe', '\u5e72', '\u5e7a', '\u5e7f', '\u5ef4', '\u5f13', '\u5f50',
  '\u5f61', '\u5f73', '\u5fc3', '\u6208', '\u6236', '\u624b', '\u652f', '\u6534', '\u6587', '\u6597',
  '\u65a4', '\u65b9', '\u65e0', '\u65e5', '\u66f0', '\u6708', '\u6728', '\u6b20', '\u6b62', '\u6b79',
  '\u6bb3', '\u6bcd', '\u6bd4', '\u6bdb', '\u6c0f', '\u6c14', '\u6c34', '\u706b', '\u722a', '\u7236',
  '\u723b', '\u723f', '\u7247', '\u7259', '\u725b', '\u72ac', '\u7384', '\u7389', '\u74dc', '\u74e6',
  '\u7518', '\u751f', '\u7528', '\u7530', '\u758b', '\u7592', '\u7676', '\u767d', '\u76ae', '\u76bf',
  '\u76ee', '\u77db', '\u77e2', '\u77f3', '\u793a', '\u79b8', '\u79be', '\u7a74', '\u7acb', '\u7af9',
  '\u7c73', '\u7cf8', '\u7f36', '\u7f51', '\u7f8a', '\u7fbd', '\u8001', '\u800c', '\u8012', '\u8033',
  '\u807f', '\u8089', '\u81e3', '\u81ea', '\u81f3', '\u81fc', '\u820c', '\u821b', '\u821f', '\u826e',
  '\u8272', '\u8278', '\u864d', '\u866b', '\u8840', '\u884c', '\u8863', '\u897f', '\u898b', '\u89d2',
  '\u8a00', '\u8c37', '\u8c46', '\u8c55', '\u8c9d', '\u8d64', '\u8d70', '\u8db3', '\u8eab', '\u8eca',
  '\u8f9b', '\u8fb0', '\u8fb5', '\u9091', '\u9149', '\u91c6', '\u91cc', '\u91d1', '\u9577', '\u9580',
  '\u961c', '\u96b6', '\u96b9', '\u96e8', '\u9752', '\u975e', '\u9762', '\u9769', '\u97cb', '\u97ed',
  '\u97f3', '\u9801', '\u98a8', '\u98db', '\u98df', '\u9996', '\u9999', '\u99ac', '\u9aa8', '\u9ad8',
  '\u9adf', '\u9b25', '\u9b2f', '\u9b3c', '\u9b5a', '\u9ce5', '\u9e75', '\u9e7f', '\u9ea5', '\u9ebb',
  '\u9ec3', '\u9ecd', '\u9ed2', '\u9ef9', '\u9f0e', '\u9f13', '\u9f20', '\u9f3b', '\u9f50', '\u9f52'
];

// Extra simplified/side-form radicals for better discoverability in UI
// These map to their canonical Kangxi radicals when searching.
const RADICAL_ALIAS_MAP: Record<string, string> = {
  '\u8ba0': '\u8a00', // 讠 -> 言
  '\u6c35': '\u6c34', // 氵 -> 水
  '\u624c': '\u624b', // 扌 -> 手
  '\u5fc4': '\u5fc3', // 忄 -> 心
  '\u793b': '\u793a', // 礻 -> 示
  '\u7e9f': '\u7cf8', // 纟 -> 糸
  '\u9485': '\u91d1', // 钅 -> 金
  '\u9963': '\u98df', // 饣 -> 食
  '\u72ad': '\u72ac', // 犭 -> 犬
  '\u5202': '\u5200', // 刂 -> 刀
  '\u95e8': '\u9580', // 门 -> 門
  '\u8f66': '\u8eca', // 车 -> 車
  '\u9a6c': '\u99ac', // 马 -> 馬
  '\u9e1f': '\u9ce5', // 鸟 -> 鳥
  '\u9c7c': '\u9b5a', // 鱼 -> 魚
  '\u9875': '\u9801', // 页 -> 頁
  '\u98ce': '\u98a8', // 风 -> 風
  '\u8279': '\u8278', // 艹 -> 艸
  '\u4eb7': '\u4eba', // 亻 -> 人
  '\u961d': '\u961c', // 阝 -> 阜 (右侧阝常作邑\u9091 按需再扩展)
  '\u706c': '\u706b', // 灬 -> 火
  '\u725c': '\u725b', // 牜 -> 牛
  '\u8864': '\u8863', // 衤 -> 衣
  '\u722b': '\u722a', // 爫 -> 爪
  '\u8fb6': '\u8fb5', // 辶 -> 辵
  '\u91d2': '\u91d1', // 釒 -> 金
  '\u7cf9': '\u7cf8', // 糹 -> 糸
  '\u98e0': '\u98df', // 飠 -> 食
  '\u6c3a': '\u6c34', // 氺 -> 水
  '\u6535': '\u6534'  // 攵 -> 攴
};

// Merge extra radicals into the grid (UI only)
const EXTRA_RADICALS = Object.keys(RADICAL_ALIAS_MAP);
const RADICALS_FOR_GRID = Array.from(new Set([...EXTRA_RADICALS, ...COMMON_RADICALS]));

export default function DictionaryPage() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [initializedFromURL, setInitializedFromURL] = useState(false);

  useEffect(() => {
    if (initializedFromURL) return;
    const qParam = (searchParams.get('q') || '').trim();
    const rawType = (searchParams.get('type') || '').trim();
    const rawBy = (searchParams.get('by') || '').trim();

    const nextType: SearchType =
      rawType === 'char' || rawType === 'idiom' || rawType === 'word'
        ? (rawType as SearchType)
        : qParam
        ? (qParam.length >= 2 ? 'word' : 'char')
        : 'char';

    const nextBy: SearchBy =
      rawBy === 'text' || rawBy === 'pinyin' || rawBy === 'radical' || rawBy === 'strokes'
        ? (rawBy as SearchBy)
        : 'text';

    if (qParam) setQuery(qParam);
    setSearchType(nextType);
    setSearchBy(nextBy);

    const doFetch = async () => {
      if (!qParam && nextBy !== 'radical') {
        setInitializedFromURL(true);
        return;
      }

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: qParam,
          type: nextType,
          by: nextBy,
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
        console.error('Initial search failed:', err);
      } finally {
        setIsLoading(false);
        setInitializedFromURL(true);
      }
    };

    doFetch();
  }, [initializedFromURL, searchParams]);

  // State
  const [searchType, setSearchType] = useState<SearchType>('char');
  const [searchBy, setSearchBy] = useState<SearchBy>('text');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Results
  const [charResults, setCharResults] = useState<CharResult[]>([]);
  const [idiomResults, setIdiomResults] = useState<IdiomResult[]>([]);
  const [wordResults, setWordResults] = useState<WordResult[]>([]);

  // Selected char detail
  const [selectedChar, setSelectedChar] = useState<CharResult | null>(null);

  // Radical picker
  const [showRadicalPicker, setShowRadicalPicker] = useState(false);

  // Search function
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

  // Enter key search
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Select radical
  const handleRadicalSelect = async (radical: string) => {
    // Map side-form/simplified radical to canonical Kangxi radical for searching
    const canonical = RADICAL_ALIAS_MAP[radical] || radical;
    setQuery(canonical);
    setSearchBy('radical');
    setShowRadicalPicker(false);

    // 直接执行搜索，不依赖状态更新
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: canonical,
        type: searchType,
        by: 'radical',
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
      console.error('Radical search failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Click char for details
  const handleCharClick = (char: CharResult) => {
    setSelectedChar(char);
  };

  // Jump to home page for AI query
  const handleAiQuery = (term: string) => {
    window.location.href = `/${locale}?word=${encodeURIComponent(term)}`;
  };

  return (
    <>
      {/* Background */}
      <div className="paper-texture" aria-hidden="true" />

      <div className="dictionary-container">
        {/* Header */}
        <header className="dict-header">
          <Link href={`/${locale}`} className="back-link">
            &larr; {t('dictionary.backToHome')}
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

        {/* Search Section */}
        <div className="search-section">
          {/* Tab bar */}
          <div className="tab-bar">
            <button
              className={`tab-btn ${searchType === 'char' ? 'active' : ''}`}
              onClick={() => setSearchType('char')}
            >
              <span className="tab-icon">&#23383;</span>
              {t('dictionary.tabChar')}
            </button>
            <button
              className={`tab-btn ${searchType === 'idiom' ? 'active' : ''}`}
              onClick={() => setSearchType('idiom')}
            >
              <span className="tab-icon">&#25104;</span>
              {t('dictionary.tabIdiom')}
            </button>
            <button
              className={`tab-btn ${searchType === 'word' ? 'active' : ''}`}
              onClick={() => setSearchType('word')}
            >
              <span className="tab-icon">&#35789;</span>
              {t('dictionary.tabWord')}
            </button>
          </div>

          {/* Search method (char mode only) */}
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

          {/* Search input */}
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

          {/* Radical picker */}
          {showRadicalPicker && searchBy === 'radical' && (
            <div className="radical-picker">
              <div className="radical-picker-header">
                <h4>{t('dictionary.selectRadical')}</h4>
                <button
                  className="radical-picker-close"
                  onClick={() => setShowRadicalPicker(false)}
                >
                  &times;
                </button>
              </div>
              <div className="radical-grid">
                {RADICALS_FOR_GRID.map((r) => (
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

        {/* Results Section */}
        <div className="results-section">
          {/* Char results */}
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
                    <div className="char-traditional">{t('dictionary.trad')}: {char.traditional}</div>
                  )}
                  <div className="char-pinyin">{char.pinyin}</div>
                  <div className="char-meta">
                    {char.radical && <span>{char.radical}{t('dictionary.bu')}</span>}
                    {char.total_strokes > 0 && <span>{char.total_strokes}{t('dictionary.hua')}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Idiom results */}
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

          {/* Word results */}
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

          {/* No results */}
          {!isLoading &&
            query &&
            charResults.length === 0 &&
            idiomResults.length === 0 &&
            wordResults.length === 0 && (
              <div className="no-results">
                <p>{t('dictionary.noResults')}</p>
              </div>
            )}

          {/* Initial hint */}
          {!query && charResults.length === 0 && (
            <div className="search-hint">
              <div className="hint-icon">&#128218;</div>
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

        {/* Char detail sidebar */}
        {selectedChar && (
          <div className="char-detail-overlay" onClick={() => setSelectedChar(null)}>
            <div className="char-detail-panel" onClick={(e) => e.stopPropagation()}>
              <button
                className="detail-close"
                onClick={() => setSelectedChar(null)}
              >
                &times;
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

        /* Header */
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

        /* Search section */
        .search-section {
          background: linear-gradient(145deg, rgba(255,255,255,0.95), rgba(252,250,255,0.9));
          border: 1.5px solid var(--border);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 8px 32px rgba(122, 104, 166, 0.1);
        }

        /* Tab bar */
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

        /* Search method */
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

        /* Search input */
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

        /* Radical picker */
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

        /* Results section */
        .results-section {
          min-height: 300px;
        }

        /* Char grid */
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

        /* Idiom/word list */
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

        /* No results / hint */
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
          content: '\u2713';
          color: var(--accent);
          margin-right: 8px;
        }

        /* Char detail panel */
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

        /* Mobile */
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
