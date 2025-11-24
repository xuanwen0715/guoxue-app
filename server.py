#!/usr/bin/env python3
"""
Local dev server for Guoxue Smart Dictionary
Serves static files and proxies API routes to api/*.py handlers.
"""

import os
import sys
import json
import io
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
import importlib.util

# Load environment variables from .env file manually
def load_env_file():
    env_file = '.env'
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

load_env_file()


class LocalDevelopmentHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.getcwd(), **kwargs)

    def end_headers(self):
        try:
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            if not getattr(self, 'path', '/').startswith('/api/'):
                self.send_header('Cache-Control', 'no-store')
        except Exception:
            pass
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()

    def do_POST(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/translate':
            self._proxy_api('api/translate.py')
        elif parsed_path.path == '/api/ocr':
            self._proxy_api('api/ocr.py')
        else:
            self.send_error(404, "API endpoint not found")

    def do_GET(self):
        # Block API GET to avoid confusion
        if self.path.startswith('/api/'):
            self.send_error(405, "Method Not Allowed")
            return
        super().do_GET()

    def _proxy_api(self, module_path: str):
        try:
            spec = importlib.util.spec_from_file_location("api_handler", module_path)
            if spec is None or spec.loader is None:
                raise RuntimeError(f"Cannot load module: {module_path}")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # Create proper mock objects
            class MockSocket:
                def makefile(self, mode, buffering=-1):
                    return io.StringIO()

            mock_request = MockSocket()
            mock_client_address = ('127.0.0.1', 0)
            mock_server = type('MockServer', (), {})()

            # Initialize the handler with required arguments
            api_handler = module.handler(mock_request, mock_client_address, mock_server)

            # Set up the handler with current request context
            api_handler.rfile = self.rfile
            api_handler.wfile = self.wfile
            api_handler.headers = self.headers
            api_handler.path = self.path
            api_handler.send_response = self.send_response
            api_handler.send_header = self.send_header
            api_handler.end_headers = self.end_headers

            api_handler.do_POST()
        except Exception as e:
            print(f"[API error] {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            try:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}, ensure_ascii=False).encode('utf-8'))
            except Exception:
                pass


def main():
    port = int(os.environ.get('PORT', 8000))
    httpd = HTTPServer(('', port), LocalDevelopmentHandler)
    print("Guoxue Smart Dictionary local server running.")
    print(f"Open: http://localhost:{port}")
    print("API routes:")
    print(f"  - POST /api/ocr")
    print(f"  - POST /api/translate")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("Stopping server...")


if __name__ == '__main__':
    main()

