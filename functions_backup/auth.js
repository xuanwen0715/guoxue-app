/**
 * Cloudflare Pages Functions - 代理 Supabase 请求
 */

const SUPABASE_URL = 'https://dckeajeazaxbxlqlkicl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja2VhamVhemF4YnhscWxraWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTI3NjUsImV4cCI6MjA3OTg2ODc2NX0.kv1oVXsO9gnB3XLCFGlJiX2I9PAbn80XD1irzCDNRfI';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const method = context.request.method;
  
  console.log(`[Debug] ${method} ${path}`);
  
  // 处理 CORS 预检请求
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
      }
    });
  }
  
  // 路由 /auth/* 和 /rest/* 到 Supabase
  if (path.startsWith('/auth/') || path.startsWith('/rest/')) {
    const targetUrl = `${SUPABASE_URL}${path}`;
    
    // 构建请求头
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('apikey', SUPABASE_ANON_KEY);
    
    const authHeader = context.request.headers.get('Authorization');
    if (authHeader) {
      headers.set('Authorization', authHeader);
    }
    
    // 复制其他必要头
    const copyHeaders = ['accept', 'if-match', 'if-none-match', 'if-modified-since', 'if-unmodified-since'];
    for (const h of copyHeaders) {
      const val = context.request.headers.get(h);
      if (val) headers.set(h, val);
    }
    
    let body = null;
    if (method !== 'GET' && method !== 'HEAD') {
      body = context.request.body;
    }
    
    try {
      const response = await fetch(targetUrl, {
        method: method,
        headers: headers,
        body: body,
        redirect: 'follow'
      });
      
      // 获取响应文本
      const responseText = await response.text();
      console.log(`[Debug] Response status: ${response.status}, body length: ${responseText.length}`);
      
      // 解析 JSON 以验证
      let jsonBody;
      try {
        jsonBody = JSON.parse(responseText);
      } catch (e) {
        // 如果不是 JSON，直接返回文本
        console.log(`[Debug] Not JSON, returning as text`);
        return new Response(responseText, {
          status: response.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/plain',
          }
        });
      }
      
      // 返回 JSON
      return new Response(JSON.stringify(jsonBody), {
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }
      });
      
    } catch (error) {
      console.error('[Proxy Error]', error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
  }
  
  return context.next();
}
