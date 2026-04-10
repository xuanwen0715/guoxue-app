/**
 * Cloudflare Workers - Translate API
 */

// 常量
const SUPABASE_URL = 'https://dckeajeazaxbxlqlkicl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja2VhamVhemF4YnhscWxraWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTI3NjUsImV4cCI6MjA3OTg2ODc2NX0.kv1oVXsO9gnB3XLCFGlJiX2I9PAbn80XD1irzCDNRfI';
const DASHSCOPE_API_KEY = DASHSCOPE_API_KEY_FROM_ENV;
const DASHSCOPE_TXT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const DEFAULT_TEXT_MODEL = 'qwen-max';

// 辅助函数：验证 Token
async function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid token format');
  }
  const token = authHeader.replace('Bearer ', '');
  
  // 调用 Supabase 进行验证
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/auth/user`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!resp.ok) {
    throw new Error('Invalid token');
  }
  
  return { user_id: 'user_id_from_token' };
}

// 辅助函数：检查用户额度
async function checkUserQuota(userId) {
  // TODO: 实现额度检查
  return { quota: 100, used: 0 };
}

// 响应构造
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

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // CORS 预检
  if (context.request.method === 'OPTIONS') {
    return corsResponse();
  }

  // 只处理 /api/translate
  if (path !== '/api/translate') {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  // GET 健康检查
  if (context.request.method === 'GET') {
    return jsonResponse({
      status: 'ok',
      message: 'Translate API is working. Use POST to query.',
      has_api_key: !!DASHSCOPE_API_KEY,
      auth_required: true
    });
  }

  // POST 处理翻译请求
  if (context.request.method === 'POST') {
    try {
      // ========== 第一步：验证 Token ==========
      const authHeader = context.request.headers.get('Authorization') || '';
      let userInfo;
      try {
        userInfo = await verifyToken(authHeader);
      } catch (e) {
        return jsonResponse({ error: e.message, code: 'AUTH_ERROR' }, 401);
      }

      // ========== 第二步：检查额度 ==========
      try {
        await checkUserQuota(userInfo.user_id);
      } catch (e) {
        return jsonResponse({ error: e.message, code: 'QUOTA_EXCEEDED' }, 403);
      }

      // ========== 解析请求体 ==========
      const body = await context.request.json();
      const term = body.word?.trim();
      const contextText = body.context?.trim() || '';

      if (!term) {
        return jsonResponse({ error: 'Missing field: word' }, 400);
      }

      if (!DASHSCOPE_API_KEY) {
        return jsonResponse({ error: 'API key not configured' }, 503);
      }

      // ========== 调用 DashScope API ==========
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
