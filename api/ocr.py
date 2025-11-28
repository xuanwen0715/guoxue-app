import os
import json
import traceback
import requests
from http.server import BaseHTTPRequestHandler


DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
DASHSCOPE_VL_URL = os.environ.get(
    "DASHSCOPE_VL_URL",
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
)


def _extract_text_from_msg(resp_json: dict) -> str:
    try:
        content = resp_json["output"]["choices"][0]["message"]["content"]
        if isinstance(content, list):
            texts = []
            for part in content:
                if isinstance(part, dict) and "text" in part:
                    texts.append(part["text"])
            return "".join(texts)
        return content or ""
    except (KeyError, IndexError, TypeError):
        return ""


class handler(BaseHTTPRequestHandler):
    """Vercel Serverless Function handler using BaseHTTPRequestHandler"""

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            body = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}

            if not DASHSCOPE_API_KEY:
                self._send_json(503, {"error": "API key not configured"})
                return

            # Support both image (base64 data URL) and image_url
            image_data = body.get("image", "").strip()
            image_url = body.get("image_url", "").strip()

            # Use image data URL if provided, otherwise fall back to image_url
            final_image = image_data if image_data else image_url

            if not final_image:
                self._send_json(400, {"error": "Missing image or image_url field"})
                return

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
            }

            payload = {
                "model": "qwen-vl-max",
                "input": {
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"image": final_image},
                                {"text": (
                                    "你是一位精通古汉语、训诂学和金石学的专家。"
                                    "请转录这张图片中的所有汉字，包括罕见字、异体字或残缺的文字。"
                                    "按照图片中的原始布局（如从右到左的竖排）返回纯文本内容。"
                                    "准确保留所有标点符号和数字。"
                                    "不要添加任何额外的解释、拼音、编号或标点修改。"
                                )}
                            ]
                        }
                    ]
                }
            }

            resp = requests.post(DASHSCOPE_VL_URL, headers=headers, json=payload, timeout=45)
            resp.raise_for_status()
            data = resp.json()
            text = _extract_text_from_msg(data)

            self._send_json(200, {"text": text.strip()})

        except requests.HTTPError as http_err:
            detail = ""
            if hasattr(http_err, 'response') and http_err.response:
                try:
                    detail = http_err.response.text
                except Exception:
                    pass
            self._send_json(502, {"error": str(http_err), "detail": detail})
        except Exception as e:
            self._send_json(500, {"error": str(e), "trace": traceback.format_exc()})

    def _send_json(self, status: int, payload: dict):
        """Send JSON response with proper headers"""
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        response_body = json.dumps(payload, ensure_ascii=False)
        self.wfile.write(response_body.encode("utf-8"))
