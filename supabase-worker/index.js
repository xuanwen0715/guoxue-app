export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
        }
      });
    }
    
    // 只处理 auth 和 rest 路径
    if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/rest/')) {
      const targetUrl = `https://dckeajeazaxbxlqlkicl.supabase.co${url.pathname}`;
      
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja2VhamVhemF4YnhscWxraWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTI3NjUsImV4cCI6MjA3OTg2ODc2NX0.kv1oVXsO9gnB3XLCFGlJiX2I9PAbn80XD1irzCDNRfI');
      
      const authHeader = request.headers.get('Authorization');
      if (authHeader) headers.set('Authorization', authHeader);
      
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.body
      });
      
      const responseText = await response.text();
      
      return new Response(responseText, {
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
          'Content-Type': 'application/json',
        }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
