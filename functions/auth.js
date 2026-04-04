/**
 * Cloudflare Pages Functions - 代理 Supabase 请求
 * 解决 Cloudflare Pages 到 Supabase 的连接问题
 */

const SUPABASE_URL = 'https://dckeajeazaxbxlqlkicl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja2VhamVhemF4YnhscWxraWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTI3NjUsImV4cCI6MjA3OTg2ODc2NX0.kv1oVXsO9gnB3XLCFGlJiX2I9PAbn80XD1irzCDNRfI';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // 路由 /auth/* 到 Supabase
  if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/rest/')) {
    const targetPath = url.pathname;
    const targetUrl = `${SUPABASE_URL}${targetPath}`;
    
    console.log(`[Proxy] ${url.pathname} -> ${targetUrl}`);
    
    // 复制请求头
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('apikey', SUPABASE_ANON_KEY);
    
    // 如果有授权头，也传递
    const authHeader = context.request.headers.get('Authorization');
    if (authHeader) {
      headers.set('Authorization', authHeader);
    }
    
    const response = await fetch(targetUrl, {
      method: context.request.method,
      headers: headers,
      body: context.request.body,
      redirect: 'follow'
    });
    
    // 复制响应
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization');
    responseHeaders.set('Content-Type', 'application/json');
    
    // 复制其他必要的头
    for (const [key, value] of response.headers) {
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        try { responseHeaders.set(key, value); } catch(e) {}
      }
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  }
  
  // 其他请求按正常流程处理
  return context.next();
}
