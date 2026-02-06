"""
古籍图像质量分析 API
用于在 OCR 前分析古籍图像质量，给出优化建议
"""

import json
from http.server import BaseHTTPRequestHandler

from .classical_book_utils import analyze_image_quality


class handler(BaseHTTPRequestHandler):
    """古籍图像分析 API"""

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        """分析上传的图片"""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            body = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}

            image_data = body.get("image", "").strip()
            
            if not image_data:
                self._send_json(400, {"error": "Missing image field"})
                return

            # 分析图像质量
            analysis = analyze_image_quality(image_data)
            
            if "error" in analysis:
                self._send_json(500, {"error": analysis["error"]})
                return

            # 构建建议
            suggestions = []
            if analysis.get("is_yellowed"):
                suggestions.append({
                    "type": "remove_yellow",
                    "message": "检测到泛黄背景，建议启用去黄优化",
                    "priority": "high"
                })
            
            if analysis.get("is_faded"):
                suggestions.append({
                    "type": "enhance_ink",
                    "message": "检测到墨迹褪色，建议启用墨迹增强",
                    "priority": "high"
                })
            
            if analysis.get("contrast", 50) < 40:
                suggestions.append({
                    "type": "enhance_contrast",
                    "message": "对比度较低，建议增强",
                    "priority": "medium"
                })
            
            if analysis.get("noise_level", 0) > 50:
                suggestions.append({
                    "type": "denoise",
                    "message": "检测到较多噪点，建议降噪处理",
                    "priority": "medium"
                })

            self._send_json(200, {
                "analysis": analysis,
                "suggestions": suggestions,
                "recommended_mode": analysis.get("suggested_enhance", "normal"),
                "needs_enhancement": len(suggestions) > 0
            })

        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _send_json(self, status: int, payload: dict):
        """Send JSON response"""
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        response_body = json.dumps(payload, ensure_ascii=False)
        self.wfile.write(response_body.encode("utf-8"))
