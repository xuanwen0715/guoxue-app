/**
 * Cloudflare Pages Functions - 代理 Supabase 请求
 */

const SUPABASE_URL = 'https://dckeajeazaxbxlqlkicl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja2VhamVhemF4YnhscWxraWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTI3NjUsImV4cCI6MjA3OTg2ODc2NX0.kv1oVXsO9gnB3XLCFGlJiX2I9PAbn80XD1irzCDNRfI';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  
  // 处理 CORS 预检请求
  if (context.request.method === 'OPTIONS') {
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
    const method = context.request.method;
    
    console.log(`[Proxy] ${method} ${path} -> ${targetUrl}`);
    
    // 构建请求头
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('apikey', SUPABASE_ANON_KEY);
    
    const authHeader = context.request.headers.get('Authorization');
    if (authHeader) {
      headers.set('Authorization', authHeader);
    }
    
    // 复制其他必要头
    for (const [key, value] of context.request.headers) {
      if (['accept', 'if-match', 'if-none-match', 'if-modified-since', 'if-unmodified-since'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
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
      
      // 获取响应体
      const responseText = await response.text();
      
      // 构建响应头
      const responseHeaders = new Headers();
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization');
      
      // 从原始响应复制头
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        responseHeaders.set('Content-Type', 'application/json');
      }
      
      return new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
      
    } catch (error) {
      console.error('[Proxy Error]', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
  }
  
  // 其他请求按正常流程处理
  return context.next();
}
