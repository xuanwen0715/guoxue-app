/**
 * Cloudflare Pages _worker.js
 * - Supabase 代理
 * - Translate API
 */

// Supabase 配置
const SUPABASE_URL = 'https://dckeajeazaxbxlqlkicl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja2VhamVhemF4YnhscWxraWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTI3NjUsImV4cCI6MjA3OTg2ODc2NX0.kv1oVXsO9gnB3XLCFGlJiX2I9PAbn80XD1irzCDNRfI';

// DashScope 配置 - 通过 context.env 获取
const DASHSCOPE_TXT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const DEFAULT_TEXT_MODEL = 'qwen-max';

// 辅助函数
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// ========== Translate API ==========
async function handleTranslate(request, env) {
  // GET 健康检查
  if (request.method === 'GET') {
    const apiKey = env?.DASHSCOPE_API_KEY || '';
    return jsonResponse({
      status: 'ok',
      message: 'Translate API is working. Use POST to query.',
      has_api_key: !!apiKey,
      auth_required: true
    });
  }

  // POST 处理翻译请求
  if (request.method === 'POST') {
    try {
      const apiKey = env?.DASHSCOPE_API_KEY || '';
      const body = await request.json();
      const term = body.word?.trim();
      const contextText = body.context?.trim() || '';

      if (!term) {
        return jsonResponse({ error: 'Missing field: word' }, 400);
      }

      if (!apiKey) {
        return jsonResponse({ error: 'API key not configured' }, 503);
      }

      // 构建提示词
      const prompt = `你是严谨的国学学者。请根据以下查询提供详细的字词解释。

查询: ${term}
上下文: ${contextText}

请以 JSON 格式返回，包含以下字段：
{
  "term": "查询字/词",
  "pinyin": "拼音",
  "traditional": "繁体",
  "radical": "部首",
  "strokes": 笔画数,
  "explanation_zh": "国学释义",
  "explanation_en": "English explanation"
}`;

      // 调用 DashScope API
      const resp = await fetch(DASHSCOPE_TXT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: DEFAULT_TEXT_MODEL,
          input: {
            messages: [
              { role: 'system', content: [{ text: '你是严谨的国学学者。' }] },
              { role: 'user', content: [{ text: prompt }] }
            ]
          }
        })
      });

      if (!resp.ok) {
        return jsonResponse({ error: 'API call failed', detail: await resp.text() }, 502);
      }

      const data = await resp.json();
      const content = data.output?.choices?.[0]?.message?.content || '';
      
      // 尝试解析 JSON
      let result;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          result = { result: content };
        }
      } catch {
        result = { result: content };
      }

      return jsonResponse(result);

    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// ========== 主处理函数 ==========
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const env = context.env;
  
  // CORS 预检
  if (context.request.method === 'OPTIONS') {
    return corsResponse();
  }
  
  // 路由 /api/translate
  if (path === '/api/translate') {
    return handleTranslate(context.request, env);
  }
  
  // 路由 /api/ocr
  if (path === '/api/ocr') {
    return jsonResponse({ error: 'OCR API not implemented yet' }, 501);
  }
  
  // 路由 /auth/* 和 /rest/* - Supabase 代理
  if (path.startsWith('/auth/') || path.startsWith('/rest/')) {
    const target = `${SUPABASE_URL}${path}`;
    
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('apikey', SUPABASE_KEY);
    
    const auth = context.request.headers.get('Authorization');
    if (auth) headers.set('Authorization', auth);
    
    let body = null;
    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
      body = context.request.body;
    }
    
    const resp = await fetch(target, {
      method: context.request.method,
      headers: headers,
      body: body
    });
    
    const text = await resp.text();
    
    return new Response(text, {
      status: resp.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization'
      }
    });
  }
  
  // 其他路由 - 返回 404
  return jsonResponse({ error: 'Not found' }, 404);
}
