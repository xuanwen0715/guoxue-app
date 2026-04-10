/**
 * Cloudflare Pages _worker.js - 最小测试版
 */

export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  
  // CORS
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
  
  // /api/translate - 健康检查
  if (path === '/api/translate') {
    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Worker is working!',
      method: context.request.method
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 其他
  return new Response(JSON.stringify({ error: 'Not found', path }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
