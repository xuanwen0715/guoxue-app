/**
 * Cloudflare Pages _worker.js
 * - Supabase 代理
 * - Translate API
 */

const SUPABASE_URL = 'https://dckeajeazaxbxlqlkicl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja2VhamVhemF4YnhscWxraWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTI3NjUsImV4cCI6MjA3OTg2ODc2NX0.kv1oVXsO9gnB3XLCFGlJiX2I9PAbn80XD1irzCDNRfI';

// 测试：直接硬编码 API Key
const DASHSCOPE_API_KEY = 'sk-b31dc0587f124237976856eb0dd865cb';
const DASHSCOPE_TXT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const DEFAULT_TEXT_MODEL = 'qwen-max';

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

async function handleTranslate(request) {
  if (request.method === 'GET') {
    return jsonResponse({
      status: 'ok',
      message: 'Translate API working',
      has_api_key: !!DASHSCOPE_API_KEY
    });
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const term = body.word?.trim();
      const contextText = body.context?.trim() || '';

      if (!term) {
        return jsonResponse({ error: 'Missing field: word' }, 400);
      }

      const prompt = `你是严谨的国学学者。请根据以下查询提供详细的字词解释。

查询: ${term}
上下文: ${contextText}

请以 JSON 格式返回：
{
  "term": "查询字/词",
  "pinyin": "拼音",
  "traditional": "繁体",
  "radical": "部首",
  "strokes": 笔画数,
  "explanation_zh": "国学释义"
}`;

      const resp = await fetch(DASHSCOPE_TXT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
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
      
      let result;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { result: content };
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

export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  
  if (context.request.method === 'OPTIONS') {
    return corsResponse();
  }
  
  if (path === '/api/translate') {
    return handleTranslate(context.request);
  }
  
  if (path === '/api/ocr') {
    return jsonResponse({ error: 'OCR not implemented' }, 501);
  }
  
  // Supabase 代理
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
    
    return new Response(await resp.text(), {
      status: resp.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization'
      }
    });
  }
  
  return jsonResponse({ error: 'Not found' }, 404);
}
