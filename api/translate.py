"""
Vercel Serverless Function - Translate API
"""
import os
import json
import requests

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://dckeajeazaxbxlqlkicl.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja2VhamVhemF4YnhscWxraWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTI3NjUsImV4cCI6MjA3OTg2ODc2NX0.kv1oVXsO9gnB3XLCFGlJiX2I9PAbn80XD1irzCDNRfI")

DASHSCOPE_TXT_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-gradient/generation"
DEFAULT_TEXT_MODEL = os.environ.get("DASHSCOPE_TEXT_MODEL", "qwen-max")

# Vercel handler - 必须是 app
def app(request):
    """Vercel Python handler"""
    
    # CORS
    if request.method == 'OPTIONS':
        return {'statusCode': 204, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization'}}
    
    # GET 健康检查
    if request.method == 'GET':
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'status': 'ok',
                'message': 'Translate API is working. Use POST.',
                'has_api_key': bool(DASHSCOPE_API_KEY)
            })
        }
    
    # POST 翻译
    if request.method == 'POST':
        try:
            body = json.loads(request.body) if request.body else {}
            term = body.get('word', '').strip()
            context = body.get('context', '').strip()
            
            if not term:
                return {'statusCode': 400, 'headers': {'Content-Type': 'application/json'}, 'body': json.dumps({'error': 'Missing field: word'})}
            
            if not DASHSCOPE_API_KEY:
                return {'statusCode': 503, 'headers': {'Content-Type': 'application/json'}, 'body': json.dumps({'error': 'API key not configured'})}
            
            # 构建提示词
            prompt = f"""你是严谨的国学学者。请根据以下查询提供详细的字词解释。

查询: {term}
上下文: {context}

请以 JSON 格式返回：
{{
  "term": "{term}",
  "pinyin": "拼音",
  "traditional": "繁体",
  "radical": "部首",
  "strokes": 笔画数,
  "explanation_zh": "国学释义"
}}"""
            
            # 调用 DashScope
            resp = requests.post(
                DASHSCOPE_TXT_URL,
                headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {DASHSCOPE_API_KEY}'},
                json={
                    'model': DEFAULT_TEXT_MODEL,
                    'input': {
                        'messages': [
                            {'role': 'system', 'content': [{'text': '你是严谨的国学学者。'}]},
                            {'role': 'user', 'content': [{'text': prompt}]}
                        ]
                    }
                },
                timeout=60
            )
            
            if not resp.ok:
                return {'statusCode': 502, 'headers': {'Content-Type': 'application/json'}, 'body': json.dumps({'error': 'API call failed'})}
            
            data = resp.json()
            content = data.get('output', {}).get('choices', [{}])[0].get('message', {}).get('content', '')
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': content
            }
            
        except Exception as e:
            return {'statusCode': 500, 'headers': {'Content-Type': 'application/json'}, 'body': json.dumps({'error': str(e)})}
    
    return {'statusCode': 405, 'headers': {'Content-Type': 'application/json'}, 'body': json.dumps({'error': 'Method not allowed'})}
