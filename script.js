(() => {
  'use strict';

  // 模拟模式开关 - 当API服务器不可用时启用
  const MOCK_MODE = false; // 改为false以使用真实API

  const $ = (id) => document.getElementById(id);
  const bi = (zh, en) => `${zh} / ${en}`;

  // API base auto-detection with localhost fallback for local testing
  function resolveApiBase() {
    try {
      if (typeof window !== 'undefined' && window.API_BASE) {
        return String(window.API_BASE).trim().replace(/\/$/, '');
      }
      const params = new URLSearchParams(location.search || '');
      const fromQs = params.get('api') || params.get('apiBase');
      if (fromQs) return String(fromQs).trim().replace(/\/$/, '');
      const meta = document.querySelector('meta[name="api-base"]');
      if (meta && meta.getAttribute('content')) {
        return String(meta.getAttribute('content') || '').trim().replace(/\/$/, '');
      }
      if (location.protocol === 'file:') {
        return 'http://localhost:8000';
      }
      return '';
    } catch (_) {
      return '';
    }
  }

  const API_BASE = resolveApiBase();

  // OCR 对比对话框：显示原始识别和 AI 建议供用户选择
  function showOcrCompareDialog(original, corrected, suggestions, onSelect) {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'ocr-dialog-overlay';

    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'ocr-dialog';

    // 构建建议列表 HTML
    let suggestionsHtml = '';
    if (suggestions && suggestions.length > 0) {
      suggestionsHtml = `
        <div class="ocr-suggestions">
          <h4>纠错建议 · Suggestions</h4>
          <ul>
            ${suggestions.map(s => `
              <li>
                <span class="suggestion-original">${escapeHtml(s.original)}</span>
                <span class="suggestion-arrow">→</span>
                <span class="suggestion-new">${escapeHtml(s.suggested)}</span>
                <span class="suggestion-reason">${escapeHtml(s.reason)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    dialog.innerHTML = `
      <div class="ocr-dialog-header">
        <h3>OCR 识别结果对比</h3>
        <p class="ocr-dialog-hint">AI 检测到可能的识别错误，请选择使用哪个版本</p>
      </div>
      <div class="ocr-dialog-content">
        <div class="ocr-compare-panel ocr-original">
          <div class="ocr-panel-header">
            <span class="ocr-panel-icon">📄</span>
            <span class="ocr-panel-title">原始识别结果</span>
          </div>
          <div class="ocr-panel-text">${escapeHtml(original)}</div>
          <button class="btn ocr-select-btn" data-choice="original">使用原始结果</button>
        </div>
        <div class="ocr-compare-panel ocr-corrected">
          <div class="ocr-panel-header">
            <span class="ocr-panel-icon">✨</span>
            <span class="ocr-panel-title">AI 建议版本</span>
          </div>
          <div class="ocr-panel-text">${escapeHtml(corrected)}</div>
          ${suggestionsHtml}
          <button class="btn btn-primary ocr-select-btn" data-choice="corrected">使用 AI 建议</button>
        </div>
      </div>
      <button class="ocr-dialog-close" aria-label="关闭">&times;</button>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 绑定事件
    const closeDialog = () => {
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 200);
    };

    dialog.querySelector('.ocr-dialog-close').addEventListener('click', closeDialog);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog();
    });

    dialog.querySelectorAll('.ocr-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const choice = btn.dataset.choice;
        const text = choice === 'original' ? original : corrected;
        onSelect(text);
        closeDialog();
      });
    });

    // 动画显示
    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  async function fetchApiJson(path, options) {
    const primary = (API_BASE ? API_BASE : '') + path;
    try {
      const resp = await fetch(primary, options);
      if (resp.ok) return resp;
      if (!API_BASE && (location.protocol === 'file:' || (location.hostname === 'localhost' || location.hostname === '127.0.0.1'))) {
        const fallbackUrl = 'http://localhost:8000' + path;
        try { return await fetch(fallbackUrl, options); } catch (e2) { throw e2; }
      }
      return resp;
    } catch (e) {
      if (!API_BASE) {
        try { return await fetch('http://localhost:8000' + path, options); } catch (_) {}
      }
      throw e;
    }
  }
  const ctxInput = $('context-input');
  const ctxDropZone = document.getElementById('context-drop-zone');
  const ctxUploadInput = document.getElementById('context-image-uploader');
  const ctxUploadButton = document.getElementById('context-upload-button');
  const ctxUploadStatus = document.getElementById('context-upload-status');
  const wordInput = $('word-input');
  const imageUploader = $('image-uploader');
  const uploadButton = $('upload-button');
  const uploadStatus = $('upload-status');
  const dropZone = $('drop-zone');
  const submitButton = $('submit-button');
  const resultContainer = $('result-container');
  const resultText = $('result-text');
  const resultStructured = document.getElementById('result-structured');
  const copyButton = $('copy-button');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history');
  const favsOnlyCheckbox = document.getElementById('history-favs-only');
  const exportHistoryBtn = document.getElementById('export-history');
  const importHistoryBtn = document.getElementById('import-history');
  const importHistoryInput = document.getElementById('import-history-input');
  const clearButton = $('clear-button');
  let ocrCache = '';
  const HISTORY_KEY = 'gx_dict_history_v1';
  const PREFS_KEY = 'gx_dict_prefs_v1';
  const HISTORY_LIMIT = 20;
  let history = [];
  let favsOnly = false;

  // 模拟API函数
  function mockTranslateAPI(request) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const word = request.word;
        const mockResponse = {
          term: word,
          pinyin: word === '道' ? 'dào' : 'unknown',
          traditional: word,
          radical: word === '道' ? '辶' : '未知',
          strokes: word === '道' ? 12 : 0,
          explanation_zh: `**${word}** 的中文释义示例：\n1. 基本含义解释\n2. 引申义说明\n3. 在古文中的特殊用法`,
          explanation_en: `**${word}** English explanation example:\n1. Basic meaning\n2. Extended meaning\n3. Special usage in classical texts`,
          sources_zh: [
            `《道德经》中关于[b]${word}[/b]的记载`,
            `《论语》相关篇章`,
            `《庄子》典故出处`
          ],
          sources_en: [
            `Tao Te Ching references about [b]${word}[/b]`,
            `Related Analects chapters`
          ],
          examples_zh: [
            `[b]${word}[/b]可${word}，非常${word}`,
            `君子谋${word}不谋食`
          ],
          examples_en: [
            `Example sentence with [b]${word}[/b]`,
            `Another classical reference`
          ],
          evolution_zh: `[b]${word}[/b]字从古文字演变而来，最初表示...`,
          evolution_en: `The character [b]${word}[/b] evolved from ancient scripts...`
        };
        resolve(mockResponse);
      }, 1000);
    });
  }

  function mockOCRAPI(imageBase64) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockTexts = ["道可道非常道", "学而时习之", "天行健君子以自强不息"];
        const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)];
        resolve({ text: randomText });
      }, 800);
    });
  }
  

  // 允许输入多字：移除 1 字限制，仅保留快捷键提交

  // Keyboard shortcuts
  wordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
  });
  ctxInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
  });
  // Support pasting images into context for OCR
  ctxInput.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items || [];
    const imgItem = Array.from(items).find(it => it.type && it.type.startsWith('image/'));
    if (!imgItem) return; // allow normal paste of text
    const file = imgItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    await handleContextOCR(file);
  });

  // Context OCR via upload button
  ctxUploadButton?.addEventListener('click', () => ctxUploadInput?.click());
  ctxUploadInput?.addEventListener('change', async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    await handleContextOCR(file);
  });

  // Drag & drop on the context drop zone (textarea area)
  ['dragenter','dragover'].forEach(t => ctxDropZone?.addEventListener(t, (e) => {
    e.preventDefault(); e.stopPropagation();
    ctxDropZone.classList.add('dragover');
  }));
  ['dragleave','drop'].forEach(t => ctxDropZone?.addEventListener(t, (e) => {
    e.preventDefault(); e.stopPropagation();
    ctxDropZone.classList.remove('dragover');
  }));
  ctxDropZone?.addEventListener('drop', async (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      await handleContextOCR(files[0]);
    }
  });

  // Drag & drop on the context upload zone (new card)
  const ctxUploadZone = document.getElementById('context-upload-zone');
  ['dragenter','dragover'].forEach(t => ctxUploadZone?.addEventListener(t, (e) => {
    e.preventDefault(); e.stopPropagation();
    ctxUploadZone.classList.add('dragover');
  }));
  ['dragleave','drop'].forEach(t => ctxUploadZone?.addEventListener(t, (e) => {
    e.preventDefault(); e.stopPropagation();
    ctxUploadZone.classList.remove('dragover');
  }));
  ctxUploadZone?.addEventListener('drop', async (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      await handleContextOCR(files[0]);
    }
  });

  // Upload button triggers hidden input
  uploadButton.addEventListener('click', () => imageUploader.click());
  imageUploader.addEventListener('change', async (event) => {
    const file = (event.target.files && event.target.files[0]) || (imageUploader.files && imageUploader.files[0]);
    if (!file) return;
    uploadStatus.textContent = bi('正在识别...', 'Recognizing...');
    uploadButton?.classList.add('loading');
    dropZone?.classList.add('has-file');
    submitButton.disabled = true;
    try {
      const imageBase64 = await fileToDataURL(file);
      let data;

      if (MOCK_MODE) {
        // 使用模拟OCR
        console.log('使用模拟OCR模式');
        data = await mockOCRAPI(imageBase64);
      } else {
        // 使用真实OCR API
        const response = await fetchApiJson('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageBase64 })
        });
        if (!response.ok) throw new Error('识图 API 出错了');
        data = await response.json();
      }

      const recognized = (data.text || '').trim();
      const aiCorrected = (data.ai_corrected || '').trim();
      const aiSuggestions = data.ai_suggestions || [];

      // 如果有 AI 建议且与原文不同，显示对比选择
      if (recognized && aiSuggestions.length > 0 && aiCorrected && aiCorrected !== recognized) {
        showOcrCompareDialog(recognized, aiCorrected, aiSuggestions, (chosen) => {
          wordInput.value = chosen;
          ocrCache = chosen;
        });
        uploadStatus.textContent = bi('请选择识别结果', 'Choose result');
      } else {
        wordInput.value = recognized;
        ocrCache = recognized;
        uploadStatus.textContent = bi('识别成功！', 'Success!');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      uploadStatus.textContent = bi('识别失败', 'Failed');
    } finally {
      submitButton.disabled = false;
      imageUploader.value = '';
      uploadButton?.classList.remove('loading');
      dropZone?.classList.remove('has-file');
    }
  });

  // Drag & drop support on the wrapper
  ['dragenter', 'dragover'].forEach(type => {
    dropZone.addEventListener(type, (e) => {
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });
  ;['dragleave', 'drop'].forEach(type => {
    dropZone.addEventListener(type, (e) => {
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      try { imageUploader.files = files; } catch(_) { /* some UAs disallow assignment */ }
      imageUploader.dispatchEvent(new Event('change'));
    }
  });

  function renderUploadStatus(file) {
    uploadStatus.textContent = bi('正在识别图片...', 'Recognizing image...');
    uploadStatus.innerHTML = '';
    if (!file) return;
    const size = formatBytes(file.size);
    const span = document.createElement('span');
    span.textContent = `已选择：${file.name}（${size}）`;
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'link-button';
    clearBtn.textContent = bi('清除', 'Clear');
    clearBtn.style.marginLeft = '10px';
    clearBtn.addEventListener('click', () => {
      imageUploader.value = '';
      uploadStatus.textContent = bi('', '');
    });
    uploadStatus.append(span, clearBtn);
  }

  async function handleContextOCR(file) {
    ctxUploadStatus.textContent = bi('正在识别图片...', 'Recognizing image...');
    ctxUploadButton?.classList.add('loading');
    submitButton.disabled = true;
    try {
      const imageBase64 = await fileToDataURL(file);
      let data;

      if (MOCK_MODE) {
        // 使用模拟OCR
        console.log('使用模拟上下文OCR模式');
        data = await mockOCRAPI(imageBase64);
      } else {
        // 使用真实OCR API
        const response = await fetchApiJson('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageBase64 })
        });
        if (!response.ok) throw new Error('识图 API 出错了');
        data = await response.json();
      }

      const recognized = (data.text || '').trim();
      const aiCorrected = (data.ai_corrected || '').trim();
      const aiSuggestions = data.ai_suggestions || [];

      if (recognized) {
        // 如果有 AI 建议且与原文不同，显示对比选择
        if (aiSuggestions.length > 0 && aiCorrected && aiCorrected !== recognized) {
          showOcrCompareDialog(recognized, aiCorrected, aiSuggestions, (chosen) => {
            const caret = ctxInput.selectionStart ?? ctxInput.value.length;
            const before = ctxInput.value.slice(0, caret);
            const needsNewline = before.length > 0 && !before.endsWith('\n');
            const insert = (needsNewline ? '\n' : '') + chosen;
            insertAtCursor(ctxInput, insert);
          });
          ctxUploadStatus.textContent = bi('请选择识别结果', 'Choose result');
        } else {
          const caret = ctxInput.selectionStart ?? ctxInput.value.length;
          const before = ctxInput.value.slice(0, caret);
          const needsNewline = before.length > 0 && !before.endsWith('\n');
          const insert = (needsNewline ? '\n' : '') + recognized;
          insertAtCursor(ctxInput, insert);
          ctxUploadStatus.textContent = bi('识别成功！', 'Recognition successful!');
        }
      } else {
        ctxUploadStatus.textContent = bi('未识别到文字', 'No text recognized');
      }
    } catch (err) {
      console.error('Context OCR error', err);
      ctxUploadStatus.textContent = bi('识别失败', 'Recognition failed');
    } finally {
      submitButton.disabled = false;
      if (ctxUploadInput) ctxUploadInput.value = '';
      ctxUploadButton?.classList.remove('loading');
    }
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function insertAtCursor(el, text) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const insert = text;
    el.value = before + insert + after;
    const pos = before.length + insert.length;
    el.setSelectionRange(pos, pos);
    el.focus();
  }

  submitButton.addEventListener('click', handleSubmit);
  copyButton?.addEventListener('click', handleCopy);
  clearButton.addEventListener('click', handleClear);
  clearHistoryBtn.addEventListener('click', handleClearHistory);
  favsOnlyCheckbox?.addEventListener('change', () => { favsOnly = !!favsOnlyCheckbox.checked; savePrefs(); renderHistory(); });
  exportHistoryBtn?.addEventListener('click', handleExportHistory);
  importHistoryBtn?.addEventListener('click', () => importHistoryInput?.click());
  importHistoryInput?.addEventListener('change', handleImportHistory);

  function setLoading(loading, streaming = false) {
    resultContainer.setAttribute('aria-busy', String(!!loading));
    submitButton.disabled = !!loading;
    submitButton.classList.toggle('loading', !!loading);
    if (streaming) {
      submitButton.textContent = '正在输出…';
    } else {
      submitButton.textContent = loading ? '查询中…' : 'AI 智能查询';
    }
  }

  // 显示流式输出的原始文本
  function showStreamingText(text) {
    resultText.innerHTML = text + '<span class="streaming-cursor">|</span>';
    resultText.hidden = false;
    if (resultStructured) {
      resultStructured.innerHTML = '';
      resultStructured.hidden = true;
    }
    resultContainer.dataset.empty = 'false';
  }

  async function handleSubmit() {
    const context = ctxInput.value;
    const word = wordInput.value;

    if (word !== ocrCache) { ocrCache = ''; }
    if (!word) {
      resultText.textContent = '请输入要查询的字或词';
      try { resultContainer.dataset.empty = 'true'; } catch (e) {}
      return;
    }

    setLoading(true);

    try {
      let data;

      if (MOCK_MODE) {
        data = await mockTranslateAPI({
          context,
          word,
          useOcrResult: ocrCache === word
        });
        renderResult(data, { word, context });
        pushHistory({ word, context, data });
      } else {
        // 使用流式输出
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context,
            word,
            useOcrResult: ocrCache === word,
            stream: true
          })
        });

        if (!response.ok) {
          throw new Error(`查询失败: ${response.status}`);
        }

        // 检查是否是流式响应
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/event-stream')) {
          // 处理 SSE 流式响应
          setLoading(true, true);
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr) {
                  try {
                    const eventData = JSON.parse(dataStr);
                    if (eventData.error) {
                      throw new Error(eventData.error);
                    }
                    if (eventData.full) {
                      // 显示流式文本
                      showStreamingText(eventData.full);
                    }
                    if (eventData.done && eventData.result) {
                      // 完成，渲染结构化结果
                      data = eventData.result;
                      renderResult(data, { word, context });
                      pushHistory({ word, context, data });
                    }
                  } catch (e) {
                    if (e.message !== 'Unexpected end of JSON input') {
                      console.error('Parse error:', e);
                    }
                  }
                }
              }
            }
          }
        } else {
          // 非流式响应，使用原有逻辑
          data = await response.json();
          renderResult(data, { word, context });
          pushHistory({ word, context, data });
        }
      }

    } catch (err) {
      console.error('查询失败:', err);
      resultText.textContent = `❌ 查询失败：${err.message}`;
      if (resultStructured) {
        resultStructured.innerHTML = '';
        resultStructured.hidden = true;
      }
      try { resultContainer.dataset.empty = 'false'; } catch (e) {}
    } finally {
      setLoading(false);
    }
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleCopy() {
    const text = (resultContainer.innerText || '').trim();
    if (!text.trim()) return flashButton(copyButton, bi('无内容复制', 'Nothing to copy'));
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      }
      flashButton(copyButton, bi('已复制', 'Copied'));
    } catch (_) {
      flashButton(copyButton, bi('复制失败', 'Copy failed'));
    }
  }

  function handleClear() {
    ctxInput.value = '';
    wordInput.value = '';
    imageUploader.value = '';
    uploadStatus.textContent = bi('', '');
    if (ctxUploadStatus) ctxUploadStatus.textContent = bi('', '');
    // Reset result box
    resultText.textContent = '查询结果将显示在这里...';
    resultText.hidden = false;
    if (resultStructured) { resultStructured.innerHTML = ''; resultStructured.hidden = true; }
    resultContainer.setAttribute('aria-busy', 'false'); try { resultContainer.dataset.empty = 'true'; } catch (e) {}
    wordInput.focus();
    flashButton(clearButton, bi('已清空', 'Cleared'));
  }

  function handleClearHistory() {
    history = [];
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    flashButton(clearHistoryBtn, bi('已清空', 'Cleared'));
  }

  function renderResult(data, ctx) {
    // If structured fields exist, render sections; otherwise fallback to text
    const hasStructured = data && (
      data.explanation || data.sources || data.examples || data.term || data.title ||
      data.explanation_zh || data.explanation_en || data.pinyin || data.traditional
    );
    if (hasStructured && resultStructured) {
      const term = escapeHtml(data.term || ctx?.word || '');
      const pinyin = escapeHtml(data.pinyin || '');
      const traditional = escapeHtml(data.traditional || '');
      const exZh = toHtmlWithBB(data.explanation_zh || data.explanation || data.text || '');
      const exEn = toHtmlWithBB(data.explanation_en || '');

      const sourcesZh = Array.isArray(data.sources_zh) ? data.sources_zh : (Array.isArray(data.sources) ? data.sources : []);
      const sourcesEn = Array.isArray(data.sources_en) ? data.sources_en : [];
      const examplesZh = Array.isArray(data.examples_zh) ? data.examples_zh : (Array.isArray(data.examples) ? data.examples : []);
      const examplesEn = Array.isArray(data.examples_en) ? data.examples_en : [];

      const headerHtml = term ? `<div class="result-header"><div class="term">${term}</div>${(pinyin || traditional || data.radical || data.strokes) ? `<div class="badges">${pinyin ? `<span class="badge"><span class="label">拼音</span><span class="value">${pinyin}</span></span>` : ''}${traditional ? `<span class="badge"><span class="label">繁体</span><span class="value">${traditional}</span></span>` : ''}${data.radical ? `<span class="badge"><span class="label">部首</span><span class="value">${escapeHtml(String(data.radical))}</span></span>` : ''}${(data.strokes||data.strokes===0) ? `<span class="badge"><span class="label">笔画</span><span class="value">${escapeHtml(String(data.strokes))}</span></span>` : ''}</div>` : ''}</div>` : '';
      // 构建古字形显示区域
      const glyphOracle = data.glyph_oracle || '';
      const glyphBronze = data.glyph_bronze || '';
      const glyphSeal = data.glyph_seal || '';
      const hasGlyphs = glyphOracle || glyphBronze || glyphSeal || data.evolution_zh || data.evolution_en;

      // 生成 hanziyuan.net 链接（用于查看真实古字形图片）
      const firstChar = (data.term || ctx?.word || '').charAt(0);
      const etymologyUrl = firstChar ? `https://hanziyuan.net/#${encodeURIComponent(firstChar)}` : '';

      const glyphsHtml = hasGlyphs ? `<div class="result-section" data-kind="glyphs"><h3>字形演变 · Character Evolution</h3><div class="glyph-cards">${glyphOracle ? `<div class="glyph-card"><div class="glyph-label">甲骨文<span class="glyph-en">Oracle</span></div><div class="glyph-desc">${toHtmlWithBB(String(glyphOracle))}</div></div>` : ''}${glyphBronze ? `<div class="glyph-card"><div class="glyph-label">金文<span class="glyph-en">Bronze</span></div><div class="glyph-desc">${toHtmlWithBB(String(glyphBronze))}</div></div>` : ''}${glyphSeal ? `<div class="glyph-card"><div class="glyph-label">小篆<span class="glyph-en">Seal</span></div><div class="glyph-desc">${toHtmlWithBB(String(glyphSeal))}</div></div>` : ''}</div>${data.evolution_zh ? `<div class="evolution-summary"><div class="para">${toHtmlWithBB(String(data.evolution_zh))}</div></div>` : ''}${etymologyUrl ? `<div class="glyph-link"><a href="${etymologyUrl}" target="_blank" rel="noopener noreferrer" class="btn-etymology">🔍 查看「${escapeHtml(firstChar)}」古字形图片 · View Ancient Glyphs</a></div>` : ''}</div>` : '';

      const readingHtml = (pinyin || traditional || data.radical || data.strokes || (Array.isArray(data.variants) && data.variants.length))
        ? `<div class="result-section" data-kind="reading"><h3>读音与字形 · Pronunciation & Glyphs</h3><div class="grid-2">${pinyin ? `<div class="column"><h4>拼音</h4><div class="para">${pinyin}</div></div>` : ''}${traditional ? `<div class="column"><h4>繁体</h4><div class="para">${traditional}</div></div>` : ''}${data.radical ? `<div class="column"><h4>部首 · Radical</h4><div class="para">${escapeHtml(String(data.radical))}</div></div>` : ''}${data.strokes ? `<div class="column"><h4>笔画 · Strokes</h4><div class="para">${escapeHtml(String(data.strokes))}</div></div>` : ''}${(Array.isArray(data.variants) && data.variants.length) ? `<div class="column"><h4>异体 · Variants</h4><div class="chips">${data.variants.map(v=>`<span class="chip" role="button" tabindex="0">${escapeHtml(String(v))}</span>`).join('')}</div></div>` : ''}</div></div>`
        : '';

      const expZhCol = exZh ? `<div class="column"><h4>释义</h4><div class="para">${exZh}</div></div>` : '';
      const expEnCol = exEn ? `<div class="column"><h4>Explanation</h4><div class="para">${exEn}</div></div>` : '';
      const explainHtml = (expZhCol || expEnCol) ? `<div class="result-section" data-kind="explanation"><div class="grid-2">${expZhCol}${expEnCol}</div></div>` : '';

      const srcZh = sourcesZh.length ? `<div class="column"><h4>出处</h4><ul>${sourcesZh.map(s=>`<li>${toHtmlWithBB(String(s))}</li>`).join('')}</ul></div>` : '';
      const srcEn = sourcesEn.length ? `<div class="column"><h4>Sources</h4><ul>${sourcesEn.map(s=>`<li>${toHtmlWithBB(String(s))}</li>`).join('')}</ul></div>` : '';
      const sourcesHtml = (srcZh || srcEn) ? `<div class="result-section" data-kind="sources"><div class="grid-2">${srcZh}${srcEn}</div></div>` : '';

      const exsZh = examplesZh.length ? `<div class="column"><h4>例句</h4><ul>${examplesZh.map(s=>`<li>${toHtmlWithBB(String(s))}</li>`).join('')}</ul></div>` : '';
      const exsEn = examplesEn.length ? `<div class="column"><h4>Examples</h4><ul>${examplesEn.map(s=>`<li>${toHtmlWithBB(String(s))}</li>`).join('')}</ul></div>` : '';
      const examplesHtml = (exsZh || exsEn) ? `<div class="result-section" data-kind="examples"><div class="grid-2">${exsZh}${exsEn}</div></div>` : '';

      resultStructured.innerHTML = `${headerHtml}${readingHtml}${glyphsHtml}${explainHtml}${sourcesHtml}${examplesHtml}`;
      resultStructured.hidden = false;
      resultText.hidden = true;
      resultContainer.dataset.empty = 'false';
      
    } else {
      // Fallback: plain text with [b] support
      const text = String(data?.text || '（无内容）');
      resultText.innerHTML = toHtmlWithBB(text);
      resultText.hidden = false;
      if (resultStructured) { resultStructured.innerHTML = ''; resultStructured.hidden = true; }
      resultContainer.dataset.empty = text.trim() ? 'false' : 'true';
      
    }
  }

  function pushHistory(entry) {
    try {
      const item = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        ts: Date.now(),
        word: String(entry.word || ''),
        context: String(entry.context || ''),
        contextLen: (entry.context || '').length,
        data: entry.data || {},
        favorite: false,
      };
      history.unshift(item);
      if (history.length > HISTORY_LIMIT) history = history.slice(0, HISTORY_LIMIT);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      renderHistory();
    } catch (_) { /* ignore quota errors */ }
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      history = raw ? JSON.parse(raw) : [];
      // backfill id and favorite for older records
      let mutated = false;
      history.forEach(h => {
        if (!h.id) { h.id = `${h.ts || Date.now()}-${Math.random().toString(36).slice(2,8)}`; mutated = true; }
        if (typeof h.favorite !== 'boolean') { h.favorite = false; mutated = true; }
        if (typeof h.context !== 'string') { h.context = ''; mutated = true; }
      });
      if (mutated) localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch { history = []; }
    renderHistory();
  }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      const prefs = raw ? JSON.parse(raw) : {};
      favsOnly = !!prefs.favsOnly;
      if (favsOnlyCheckbox) favsOnlyCheckbox.checked = favsOnly;
    } catch { favsOnly = false; }
  }

  function savePrefs() {
    try {
      const prefs = { favsOnly: !!favsOnly };
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }

  function renderHistory() {
    if (!historyList) return;
    const source = favsOnly ? history.filter(h => !!h.favorite) : history.slice();
    if (!source.length) { historyList.innerHTML = ''; return; }
    const sorted = source.sort((a,b) => {
      const fa = Number(!!a.favorite), fb = Number(!!b.favorite);
      if (fb !== fa) return fb - fa; // favorites first
      return (b.ts || 0) - (a.ts || 0); // newest first
    });
    historyList.innerHTML = sorted.map((item) => {
      const date = new Date(item.ts);
      const time = `${date.getMonth()+1}-${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
      const safeWord = escapeHtml(item.word || '');
      const meta = `上下文${item.contextLen ? `：${item.contextLen}字` : '：无'}`;
      const star = item.favorite ? '★' : '☆';
      const favClass = item.favorite ? 'star-btn fav' : 'star-btn';
      return `<li class="history-item" data-id="${item.id}">
        <div class="history-left"><span class="history-term">${safeWord}</span><span class="history-meta">${time} · ${meta}</span></div>
        <button class="${favClass}" type="button" aria-label="收藏" aria-pressed="${item.favorite}" data-id="${item.id}">${star}</button>
      </li>`;
    }).join('');
  }

  // Delegate click on history list
  historyList?.addEventListener('click', (e) => {
    const star = e.target.closest('.star-btn');
    if (star) {
      const id = star.getAttribute('data-id');
      if (id) toggleFavorite(id);
      e.stopPropagation();
      return;
    }
    const target = e.target.closest('.history-item');
    if (!target) return;
    const id = target.getAttribute('data-id');
    const item = history.find(h => h.id === id);
    if (!item) return;
    wordInput.value = item.word || '';
    ctxInput.value = item.context || '';
    renderResult(item.data, { word: item.word, context: item.context });
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Copy variants chip text on click/Enter/Space
  resultStructured?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip[role="button"]');
    if (!chip) return;
    const text = (chip.textContent || '').trim();
    if (!text) return;
    copyText(text).then(() => flashChip(chip)).catch(() => flashChip(chip));
    e.stopPropagation();
  });
  resultStructured?.addEventListener('keydown', (e) => {
    const chip = e.target.closest('.chip[role="button"]');
    if (!chip) return;
    if (e.key === 'Enter' || e.key === ' ') {
      const text = (chip.textContent || '').trim();
      if (text) { copyText(text).then(() => flashChip(chip)).catch(() => flashChip(chip)); }
      e.preventDefault();
    }
  });

  // No dropdown menu (reverted to explicit buttons)

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        resolve();
      } catch (err) { reject(err); }
    });
  }

  function flashChip(chip) {
    const old = chip.textContent;
    chip.classList.add('copied');
    chip.textContent = bi('已复制', 'Copied');
    setTimeout(() => { chip.textContent = old; chip.classList.remove('copied'); }, 900);
  }

  function handleExportHistory() {
    try {
      const data = JSON.stringify({ version: 1, items: history }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const name = `guoxue-history-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.json`;
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      flashButton(exportHistoryBtn, '已导出');
    } catch {
      flashButton(exportHistoryBtn, '导出失败');
    }
  }

  async function handleImportHistory(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const items = Array.isArray(payload) ? payload : (Array.isArray(payload.items) ? payload.items : []);
      if (!items.length) throw new Error('empty');
      const byId = new Map(history.map(h => [h.id, h]));
      items.forEach(it => {
        if (!it || typeof it !== 'object') return;
        if (!it.id) it.id = `${it.ts || Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        if (!byId.has(it.id)) byId.set(it.id, {
          id: it.id,
          ts: it.ts || Date.now(),
          word: String(it.word || ''),
          context: String(it.context || ''),
          contextLen: typeof it.contextLen === 'number' ? it.contextLen : String(it.context||'').length,
          data: it.data || {},
          favorite: !!it.favorite,
        });
      });
      history = Array.from(byId.values()).sort((a,b) => (b.ts||0)-(a.ts||0)).slice(0, HISTORY_LIMIT);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      renderHistory();
      flashButton(importHistoryBtn, '已导入');
    } catch (err) {
      console.error('Import error', err);
      flashButton(importHistoryBtn, '导入失败');
    } finally {
      if (importHistoryInput) importHistoryInput.value = '';
    }
  }
  function toggleFavorite(id) {
    const item = history.find(h => h.id === id);
    if (!item) return;
    item.favorite = !item.favorite;
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
    renderHistory();
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll('\'', '&#39;');
  }

  function toHtmlWithBB(str) {
    // Escape first, then re-enable [b] tokens only
    return escapeHtml(String(str))
      .replace(/\[b\]/g, '<b>')
      .replace(/\[\/b\]/g, '</b>');
  }

  // 初始化时显示模式提示
  function initializeModeNotice() {
    const notice = document.getElementById('mock-mode-notice');
    if (MOCK_MODE && notice) {
      notice.style.display = 'block';
      console.log('🔧 当前运行在模拟模式，使用演示数据');
    }
  }

  // Initialize on load
  loadPrefs();
  loadHistory();
  initializeModeNotice();

  function flashButton(btn, tempText) {
    const old = btn.textContent;
    btn.textContent = tempText;
    btn.disabled = true;
    setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 900);
  }
})();

