import os
import json
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        # Check environment variables
        has_key = bool(os.environ.get("DASHSCOPE_API_KEY", ""))

        response = {
            "status": "ok",
            "message": "Python function is working!",
            "python_version": __import__('sys').version,
            "has_dashscope_key": has_key
        }

        self.wfile.write(json.dumps(response).encode('utf-8'))
        return
