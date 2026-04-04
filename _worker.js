/**
 * Cloudflare Pages - _worker.js 方式
 */

const SUPABASE_URL = 'https://dckeajeazaxbxlqlkicl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja2VhamVhemF4YnhscWxraWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTI3NjUsImV4cCI6MjA3OTg2ODc2NX0.kv1oVXsO9gnB3XLCFGlJiX2I9PAbn80XD1irzCDNRfI';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const method = context.request.method;
  
  console.log(`[Worker] ${method} ${path}`);
  
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
    
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('apikey', SUPABASE_ANON_KEY);
    
    const authHeader = context.request.headers.get('Authorization');
    if (authHeader) {
      headers.set('Authorization', authHeader);
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
      
      const responseText = await response.text();
      console.log(`[Worker] Response: ${response.status}`);
      
      return new Response(responseText, {
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }
      });
      
    } catch (error) {
      console.error('[Worker Error]', error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  return context.next();
}
