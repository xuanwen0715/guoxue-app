"""
OCR 缓存统计 API
用于查看缓存使用情况和清理过期缓存
"""

import json
from http.server import BaseHTTPRequestHandler

from .auth_utils import verify_token, AuthError
from .ocr_cache import get_cache_stats, clear_expired_cache


class handler(BaseHTTPRequestHandler):
    """OCR 缓存统计和清理 API"""

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        """获取缓存统计信息"""
        try:
            # 验证管理员权限（简单验证，可以扩展）
            auth_header = self.headers.get("Authorization", "")
            try:
                user_info = verify_token(auth_header)
            except AuthError as e:
                self._send_json(e.code, {"error": e.message})
                return

            stats = get_cache_stats()
            self._send_json(200, stats)

        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def do_POST(self):
        """清理过期缓存"""
        try:
            # 验证管理员权限
            auth_header = self.headers.get("Authorization", "")
            try:
                user_info = verify_token(auth_header)
            except AuthError as e:
                self._send_json(e.code, {"error": e.message})
                return

            cleared = clear_expired_cache()
            self._send_json(200, {
                "message": "Cleanup completed",
                "cleared": cleared
            })

        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _send_json(self, status: int, payload: dict):
        """Send JSON response"""
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        response_body = json.dumps(payload, ensure_ascii=False)
        self.wfile.write(response_body.encode("utf-8"))
