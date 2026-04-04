/**
 * Cloudflare Pages _worker.js - Supabase 代理
 */
const SUPABASE_URL = 'https://dckeajeazaxbxlqlkicl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja2VhamVhemF4YnhscWxraWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTI3NjUsImV4cCI6MjA3OTg2ODc2NX0.kv1oVXsO9gnB3XLCFGlJiX2I9PAbn80XD1irzCDNRfI';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  
  // 处理 CORS
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
  
  // 路由 /auth/* 和 /rest/*
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
        'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
        'Content-Type': 'application/json',
      }
    });
  }
  
  return context.next();
}
