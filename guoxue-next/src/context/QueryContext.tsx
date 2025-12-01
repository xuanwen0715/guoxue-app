'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface QueryResult {
  term?: string;
  pinyin?: string;
  traditional?: string;
  radical?: string;
  strokes?: number;
  explanation_zh?: string;
  explanation_en?: string;
  sources_zh?: string[];
  sources_en?: string[];
  examples_zh?: string[];
  examples_en?: string[];
  variants?: string[];
  evolution_zh?: string;
  evolution_en?: string;
  glyph_oracle?: string;
  glyph_bronze?: string;
  glyph_seal?: string;
  text?: string;
}

interface QueryContextType {
  context: string;
  setContext: (value: string) => void;
  word: string;
  setWord: (value: string) => void;
  result: QueryResult | null;
  setResult: (value: QueryResult | null) => void;
  resultText: string;
  setResultText: (value: string) => void;
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
  handleQuery: () => Promise<void>;
  handleClear: () => void;
  handleCopy: () => void;
}

const QueryContext = createContext<QueryContextType | undefined>(undefined);

// 格式化结果为显示文本
function formatResultText(result: QueryResult, locale: string = 'zh'): string {
  const isZh = locale === 'zh';
  const lines: string[] = [];

  if (result.term) {
    lines.push(`【${result.term}】`);
  }

  if (result.pinyin) {
    lines.push(`${isZh ? '拼音' : 'Pinyin'}: ${result.pinyin}`);
  }

  if (result.traditional) {
    lines.push(`${isZh ? '繁体' : 'Traditional'}: ${result.traditional}`);
  }

  if (result.radical) {
    lines.push(`${isZh ? '部首' : 'Radical'}: ${result.radical}`);
  }

  if (result.strokes) {
    lines.push(`${isZh ? '笔画' : 'Strokes'}: ${result.strokes}`);
  }

  lines.push('');

  const explanation = isZh ? result.explanation_zh : result.explanation_en;
  if (explanation) {
    lines.push(`${isZh ? '【释义】' : '【Explanation】'}`);
    lines.push(explanation);
    lines.push('');
  }

  const sources = isZh ? result.sources_zh : result.sources_en;
  if (sources && sources.length > 0) {
    lines.push(`${isZh ? '【出处】' : '【Sources】'}`);
    sources.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('');
  }

  const examples = isZh ? result.examples_zh : result.examples_en;
  if (examples && examples.length > 0) {
    lines.push(`${isZh ? '【例句】' : '【Examples】'}`);
    examples.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
    lines.push('');
  }

  const evolution = isZh ? result.evolution_zh : result.evolution_en;
  if (evolution) {
    lines.push(`${isZh ? '【字形演变】' : '【Character Evolution】'}`);
    lines.push(evolution);
    lines.push('');
  }

  if (result.glyph_oracle || result.glyph_bronze || result.glyph_seal) {
    lines.push(`${isZh ? '【古字形】' : '【Ancient Glyphs】'}`);
    if (result.glyph_oracle) lines.push(`${isZh ? '甲骨文' : 'Oracle'}: ${result.glyph_oracle}`);
    if (result.glyph_bronze) lines.push(`${isZh ? '金文' : 'Bronze'}: ${result.glyph_bronze}`);
    if (result.glyph_seal) lines.push(`${isZh ? '小篆' : 'Seal'}: ${result.glyph_seal}`);
  }

  // 如果只有纯文本
  if (lines.length === 0 && result.text) {
    return result.text;
  }

  return lines.join('\n').trim();
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState('');
  const [word, setWord] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [resultText, setResultText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { getAuthHeader } = useAuth();

  const handleQuery = async () => {
    if (!word.trim()) {
      setResultText('请输入要查询的字或词 / Please enter a character or word');
      return;
    }

    setIsLoading(true);
    setResultText('查询中... / Querying...');

    try {
      // 获取认证 token
      const authHeaders = getAuthHeader();

      // 调用真实 API，使用流式输出
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          context,
          word,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.code === 'AUTH_ERROR') {
          setResultText('请先登录 / Please login first');
          return;
        }
        if (errorData.code === 'QUOTA_EXCEEDED') {
          setResultText('查询额度已用完 / Query quota exceeded');
          return;
        }
        throw new Error(errorData.error || `查询失败: ${response.status}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let fullText = '';
      let finalResult: QueryResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);

                if (data.error) {
                  setResultText(`错误: ${data.error}`);
                  return;
                }

                if (data.chunk) {
                  fullText = data.full || fullText + data.chunk;
                  setResultText(fullText);
                }

                if (data.done && data.result) {
                  finalResult = data.result;
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }

      // 处理最终结果 - 直接使用流式输出的原始文本，不做格式化
      if (finalResult) {
        setResult(finalResult);
      }
      // 保持 fullText 作为最终显示（流式输出已经在过程中更新了 resultText）
      if (fullText) {
        setResultText(fullText);
      }

    } catch (error) {
      console.error('Query error:', error);
      setResultText(`查询失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setContext('');
    setWord('');
    setResult(null);
    setResultText('');
  };

  const handleCopy = async () => {
    if (resultText) {
      try {
        await navigator.clipboard.writeText(resultText);
        alert('已复制到剪贴板 / Copied to clipboard');
      } catch (error) {
        console.error('Copy failed:', error);
      }
    }
  };

  return (
    <QueryContext.Provider
      value={{
        context,
        setContext,
        word,
        setWord,
        result,
        setResult,
        resultText,
        setResultText,
        isLoading,
        setIsLoading,
        handleQuery,
        handleClear,
        handleCopy,
      }}
    >
      {children}
    </QueryContext.Provider>
  );
}

export function useQuery() {
  const ctx = useContext(QueryContext);
  if (ctx === undefined) {
    throw new Error('useQuery must be used within a QueryProvider');
  }
  return ctx;
}
