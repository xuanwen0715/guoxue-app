'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

const HISTORY_KEY = 'gx_dict_history_v1';
const PREFS_KEY = 'gx_dict_prefs';
const HISTORY_LIMIT = 100;

export interface HistoryItem {
  id: string;
  ts: number;
  word: string;
  context: string;
  contextLen: number;
  data: any;
  favorite: boolean;
}

interface HistoryContextType {
  history: HistoryItem[];
  favsOnly: boolean;
  setFavsOnly: (value: boolean) => void;
  pushHistory: (entry: { word: string; context: string; data: any }) => void;
  toggleFavorite: (id: string) => void;
  clearHistory: () => void;
  exportHistory: () => void;
  backupHistory: () => void;
  importHistory: (file: File) => Promise<void>;
  loadHistoryItem: (item: HistoryItem) => { word: string; context: string; data: any };
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favsOnly, setFavsOnlyState] = useState(false);

  // 从 localStorage 加载历史
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      let items: HistoryItem[] = raw ? JSON.parse(raw) : [];

      // 补全旧数据的字段
      let mutated = false;
      items.forEach(h => {
        if (!h.id) {
          h.id = `${h.ts || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          mutated = true;
        }
        if (typeof h.favorite !== 'boolean') { h.favorite = false; mutated = true; }
        if (typeof h.context !== 'string') { h.context = ''; mutated = true; }
      });

      if (mutated) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
      }

      setHistory(items);
    } catch {
      setHistory([]);
    }

    // 加载偏好设置
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      const prefs = raw ? JSON.parse(raw) : {};
      setFavsOnlyState(!!prefs.favsOnly);
    } catch {
      setFavsOnlyState(false);
    }
  }, []);

  // 保存偏好设置
  const setFavsOnly = useCallback((value: boolean) => {
    setFavsOnlyState(value);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ favsOnly: value }));
    } catch {}
  }, []);

  // 添加历史记录
  const pushHistory = useCallback((entry: { word: string; context: string; data: any }) => {
    try {
      const item: HistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        word: String(entry.word || ''),
        context: String(entry.context || ''),
        contextLen: (entry.context || '').length,
        data: entry.data || {},
        favorite: false,
      };

      setHistory(prev => {
        const newHistory = [item, ...prev].slice(0, HISTORY_LIMIT);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
        return newHistory;
      });
    } catch {}
  }, []);

  // 切换收藏状态
  const toggleFavorite = useCallback((id: string) => {
    setHistory(prev => {
      const newHistory = prev.map(h =>
        h.id === id ? { ...h, favorite: !h.favorite } : h
      );
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      } catch {}
      return newHistory;
    });
  }, []);

  // 清空历史
  const clearHistory = useCallback(() => {
    if (confirm('确定清空所有历史记录？')) {
      setHistory([]);
      try {
        localStorage.removeItem(HISTORY_KEY);
      } catch {}
    }
  }, []);

  // 导出历史（可读文本格式）
  const exportHistory = useCallback(() => {
    try {
      const exportItems = history.map(item => {
        const data = item.data || {};
        const result: Record<string, string> = {};

        result['【查询词】'] = item.word || '';
        result['【时间】'] = new Date(item.ts).toLocaleString('zh-CN');

        if (item.favorite) result['【收藏】'] = '★';
        if (item.context) result['【古文原文】'] = item.context;
        if (data.pinyin) result['【拼音】'] = data.pinyin;
        if (data.traditional && data.traditional !== item.word) result['【繁体】'] = data.traditional;
        if (data.radical) result['【部首】'] = data.radical;
        if (data.strokes) result['【笔画】'] = String(data.strokes);

        const zhExp = data.explanation_zh || data.explanation || '';
        if (zhExp) result['【释义】'] = zhExp.replace(/\[b\]/g, '').replace(/\[\/b\]/g, '');

        const sources = Array.isArray(data.sources_zh) ? data.sources_zh : [];
        if (sources.length) {
          result['【出处】'] = sources.map((s: string) => s.replace(/\[b\]/g, '').replace(/\[\/b\]/g, '')).join('\n');
        }

        const examples = Array.isArray(data.examples_zh) ? data.examples_zh : [];
        if (examples.length) {
          result['【例句】'] = examples.map((s: string) => s.replace(/\[b\]/g, '').replace(/\[\/b\]/g, '')).join('\n');
        }

        return result;
      });

      let textContent = `═══════════════════════════════════════\n`;
      textContent += `        国学智能词典 · 查询记录\n`;
      textContent += `═══════════════════════════════════════\n`;
      textContent += `导出时间：${new Date().toLocaleString('zh-CN')}\n`;
      textContent += `记录数量：${exportItems.length} 条\n`;
      textContent += `═══════════════════════════════════════\n\n`;

      exportItems.forEach((item, index) => {
        textContent += `┌─────── 第 ${index + 1} 条 ───────┐\n`;
        for (const [key, value] of Object.entries(item)) {
          if (value) {
            const lines = String(value).split('\n');
            if (lines.length === 1) {
              textContent += `${key} ${value}\n`;
            } else {
              textContent += `${key}\n`;
              lines.forEach(line => {
                textContent += `  · ${line}\n`;
              });
            }
          }
        }
        textContent += `└────────────────────────┘\n\n`;
      });

      textContent += `═══════════════════════════════════════\n`;
      textContent += `        ~ 以简驭繁 · 智解文义 ~\n`;
      textContent += `═══════════════════════════════════════\n`;

      const blob = new Blob([textContent], { type: 'text/plain; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const name = `国学词典-查询记录-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.txt`;
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      alert('导出失败');
    }
  }, [history]);

  // 完整备份（JSON格式，可导入恢复）
  const backupHistory = useCallback(() => {
    try {
      const backupData = {
        version: 2,
        backupTime: new Date().toISOString(),
        items: history
      };
      const data = JSON.stringify(backupData, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const name = `国学词典-备份-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.json`;
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Backup failed:', e);
      alert('备份失败');
    }
  }, [history]);

  // 导入历史
  const importHistory = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const items: HistoryItem[] = Array.isArray(payload) ? payload : (Array.isArray(payload.items) ? payload.items : []);

      if (!items.length) throw new Error('empty');

      const byId = new Map(history.map(h => [h.id, h]));

      items.forEach(it => {
        if (!it || typeof it !== 'object') return;
        if (!it.id) it.id = `${it.ts || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (!byId.has(it.id)) {
          byId.set(it.id, {
            id: it.id,
            ts: it.ts || Date.now(),
            word: String(it.word || ''),
            context: String(it.context || ''),
            contextLen: typeof it.contextLen === 'number' ? it.contextLen : String(it.context || '').length,
            data: it.data || {},
            favorite: !!it.favorite,
          });
        }
      });

      const newHistory = Array.from(byId.values())
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .slice(0, HISTORY_LIMIT);

      setHistory(newHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      alert('导入成功！');
    } catch (e) {
      console.error('Import failed:', e);
      alert('导入失败');
    }
  }, [history]);

  // 加载历史项
  const loadHistoryItem = useCallback((item: HistoryItem) => {
    return {
      word: item.word,
      context: item.context,
      data: item.data
    };
  }, []);

  return (
    <HistoryContext.Provider
      value={{
        history,
        favsOnly,
        setFavsOnly,
        pushHistory,
        toggleFavorite,
        clearHistory,
        exportHistory,
        backupHistory,
        importHistory,
        loadHistoryItem,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
}
