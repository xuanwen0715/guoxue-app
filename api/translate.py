"""
Vercel Serverless Function - Translate API
"""
import json

def app(request):
    """Vercel Python handler - minimal test"""
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'status': 'ok', 'message': 'Hello from translate!'})
    }
