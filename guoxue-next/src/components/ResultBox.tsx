'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@/context/QueryContext';
import DictQuickCard from './DictQuickCard';
import dynamic from 'next/dynamic';

// Lazy load StrokeOrderLearning to improve initial performance
const StrokeOrderLearning = dynamic(() => import('./StrokeOrderLearning'), {
  ssr: false,
  loading: () => <div>加载中...</div>,
});

// 转换 [b]...[/b] 为 <strong>
function toHtmlWithBB(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[b\]/gi, '<strong>')
    .replace(/\[\/b\]/gi, '</strong>')
    .replace(/\n/g, '<br/>');
}

// 结构化结果渲染组件
function StructuredResult({ result, word }: { result: any; word: string }) {
  const [strokeLearningChar, setStrokeLearningChar] = useState<string | null>(null);

  const firstChar = (result.term || word || '').charAt(0);
  const etymologyUrl = firstChar ? `https://hanziyuan.net/#${encodeURIComponent(firstChar)}` : '';

  const pinyin = result.pinyin;
  const traditional = result.traditional;
  const exZh = result.explanation_zh || result.explanation || result.text || '';
  const exEn = result.explanation_en || '';
  const sourcesZh = Array.isArray(result.sources_zh) ? result.sources_zh : (Array.isArray(result.sources) ? result.sources : []);
  const sourcesEn = Array.isArray(result.sources_en) ? result.sources_en : [];
  const examplesZh = Array.isArray(result.examples_zh) ? result.examples_zh : (Array.isArray(result.examples) ? result.examples : []);
  const examplesEn = Array.isArray(result.examples_en) ? result.examples_en : [];
  const glyphOracle = result.glyph_oracle;
  const glyphBronze = result.glyph_bronze;
  const glyphSeal = result.glyph_seal;
  const hasGlyphs = glyphOracle || glyphBronze || glyphSeal || result.evolution_zh;

  return (
    <div className="result-structured">
      {/* 标题 */}
      {result.term && (
        <div className="result-header">
          <h3 className="result-term">【{result.term}】</h3>
        </div>
      )}

      {/* 读音与字形 */}
      {(pinyin || traditional || result.radical || result.strokes || (Array.isArray(result.variants) && result.variants.length > 0)) && (
        <div className="result-section" data-kind="reading">
          <h3>读音与字形 · Pronunciation & Form</h3>
          <div className="grid-2">
            {pinyin && (
              <div className="column">
                <h4>拼音</h4>
                <div className="para">{pinyin}</div>
              </div>
            )}
            {traditional && (
              <div className="column">
                <h4>繁体</h4>
                <div className="para">{traditional}</div>
              </div>
            )}
            {result.radical && (
              <div className="column">
                <h4>部首 · Radical</h4>
                <div className="para">{result.radical}</div>
              </div>
            )}
            {result.strokes && (
              <div className="column">
                <h4>笔画 · Strokes</h4>
                <div className="para">{result.strokes}</div>
              </div>
            )}
            {Array.isArray(result.variants) && result.variants.length > 0 && (
              <div className="column">
                <h4>异体 · Variants</h4>
                <div className="chips">
                  {result.variants.map((v: string, i: number) => (
                    <span key={i} className="chip" role="button" tabIndex={0}>{v}</span>
                  ))}
                </div>
              </div>
            )}
            {firstChar && (
              <div className="column">
                <h4>笔画学习 · Stroke Order</h4>
                <button
                  className="stroke-order-btn"
                  onClick={() => setStrokeLearningChar(firstChar)}
                  title={`学习 "${firstChar}" 的笔画顺序`}
                >
                  <span className="btn-icon">✍️</span>
                  <span className="btn-text">学习书写</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 字形演变 */}
      {hasGlyphs && (
        <div className="result-section" data-kind="glyphs">
          <h3>字形演变 · Character Evolution</h3>
          <div className="glyph-cards">
            {glyphOracle && (
              <div className="glyph-card">
                <div className="glyph-label">甲骨文<span className="glyph-en">Oracle</span></div>
                <div className="glyph-desc" dangerouslySetInnerHTML={{ __html: toHtmlWithBB(glyphOracle) }} />
              </div>
            )}
            {glyphBronze && (
              <div className="glyph-card">
                <div className="glyph-label">金文<span className="glyph-en">Bronze</span></div>
                <div className="glyph-desc" dangerouslySetInnerHTML={{ __html: toHtmlWithBB(glyphBronze) }} />
              </div>
            )}
            {glyphSeal && (
              <div className="glyph-card">
                <div className="glyph-label">小篆<span className="glyph-en">Seal</span></div>
                <div className="glyph-desc" dangerouslySetInnerHTML={{ __html: toHtmlWithBB(glyphSeal) }} />
              </div>
            )}
          </div>
          {result.evolution_zh && (
            <div className="evolution-summary">
              <div className="para" dangerouslySetInnerHTML={{ __html: toHtmlWithBB(result.evolution_zh) }} />
            </div>
          )}
          {etymologyUrl && (
            <div className="glyph-link">
              <a href={etymologyUrl} target="_blank" rel="noopener noreferrer" className="btn-etymology">
                🔍 查看「{firstChar}」古字形图片 · View Ancient Glyphs
              </a>
            </div>
          )}
        </div>
      )}

      {/* 释义 - 中英双列 */}
      {(exZh || exEn) && (
        <div className="result-section" data-kind="explanation">
          <div className="grid-2">
            {exZh && (
              <div className="column">
                <h4>释义</h4>
                <div className="para" dangerouslySetInnerHTML={{ __html: toHtmlWithBB(exZh) }} />
              </div>
            )}
            {exEn && (
              <div className="column">
                <h4>Explanation</h4>
                <div className="para" dangerouslySetInnerHTML={{ __html: toHtmlWithBB(exEn) }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 出处 - 中英双列 */}
      {(sourcesZh.length > 0 || sourcesEn.length > 0) && (
        <div className="result-section" data-kind="sources">
          <div className="grid-2">
            {sourcesZh.length > 0 && (
              <div className="column">
                <h4>出处</h4>
                <ul>
                  {sourcesZh.map((s: string, i: number) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: toHtmlWithBB(s) }} />
                  ))}
                </ul>
              </div>
            )}
            {sourcesEn.length > 0 && (
              <div className="column">
                <h4>Sources</h4>
                <ul>
                  {sourcesEn.map((s: string, i: number) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: toHtmlWithBB(s) }} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 例句 - 中英双列 */}
      {(examplesZh.length > 0 || examplesEn.length > 0) && (
        <div className="result-section" data-kind="examples">
          <div className="grid-2">
            {examplesZh.length > 0 && (
              <div className="column">
                <h4>例句</h4>
                <ul>
                  {examplesZh.map((s: string, i: number) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: toHtmlWithBB(s) }} />
                  ))}
                </ul>
              </div>
            )}
            {examplesEn.length > 0 && (
              <div className="column">
                <h4>Examples</h4>
                <ul>
                  {examplesEn.map((s: string, i: number) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: toHtmlWithBB(s) }} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stroke Order Learning Modal */}
      {strokeLearningChar && (
        <StrokeOrderLearning
          character={strokeLearningChar}
          isOpen={true}
          onClose={() => setStrokeLearningChar(null)}
        />
      )}
    </div>
  );
}

export default function ResultBox() {
  const t = useTranslations();
  const { resultText, result, word, isLoading } = useQuery();

  // 判断是否有结构化结果 (与原版 script.js 保持一致)
  const hasStructuredResult = result && (
    result.explanation || result.sources || result.examples || result.term || result.title ||
    result.explanation_zh || result.explanation_en || result.pinyin || result.traditional
  );

  return (
    <section
      id="result-container"
      className="result-box scroll-style"
      aria-live="polite"
      aria-busy={isLoading}
    >
      {hasStructuredResult ? (
        <StructuredResult result={result} word={word} />
      ) : (
        <p id="result-text" style={{ whiteSpace: 'pre-wrap' }}>
          {resultText || t('result.placeholder')}
        </p>
      )}

      {/* 字典速查卡片 - 当有查询词时显示 */}
      {word && !isLoading && <DictQuickCard word={word} />}

      <div className="scroll-corner top-left" aria-hidden="true"></div>
      <div className="scroll-corner top-right" aria-hidden="true"></div>
      <div className="scroll-corner bottom-left" aria-hidden="true"></div>
      <div className="scroll-corner bottom-right" aria-hidden="true"></div>
    </section>
  );
}
