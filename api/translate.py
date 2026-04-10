"""
Vercel Serverless Function - Translate API
"""
import os
import json
import sys

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
DASHSCOPE_TXT_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
DEFAULT_TEXT_MODEL = "qwen-max"

# Vercel handler
def app(request):
    """Vercel Python handler"""
    
    # 调试：打印环境变量
    print(f"DEBUG: DASHSCOPE_API_KEY exists: {bool(DASHSCOPE_API_KEY)}", file=sys.stderr)
    
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
                'message': 'Translate API is working.',
                'has_api_key': bool(DASHSCOPE_API_KEY)
            })
        }
    
    # POST 翻译
    if request.method == 'POST':
        if not DASHSCOPE_API_KEY:
            return {'statusCode': 503, 'body': json.dumps({'error': 'API key not configured'})}
        
        try:
            body = json.loads(request.body) if request.body else {}
            term = body.get('word', '').strip()
            
            if not term:
                return {'statusCode': 400, 'body': json.dumps({'error': 'Missing word'})}
            
            # 简单返回测试
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'term': term,
                    'pinyin': 'pīnyīn',
                    'explanation_zh': f'测试返回：{term}'
                })
            }
            
        except Exception as e:
            return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
    
    return {'statusCode': 405, 'body': json.dumps({'error': 'Method not allowed'})}
