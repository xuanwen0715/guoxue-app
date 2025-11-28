import os
import json
import base64
import traceback
import requests
import hmac
import hashlib
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import quote, urlencode
from http.server import BaseHTTPRequestHandler


# 阿里云 OCR 配置
ACCESS_KEY_ID = os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_ID", "")
ACCESS_KEY_SECRET = os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_SECRET", "")

# 备用：DashScope 视觉模型（如果专业OCR不可用则回退）
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
DASHSCOPE_VL_URL = os.environ.get(
    "DASHSCOPE_VL_URL",
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
)


def _sign_request(params: dict, access_key_secret: str) -> str:
    """生成阿里云 API 签名"""
    # 1. 按参数名排序
    sorted_params = sorted(params.items())
    # 2. 构造待签名字符串
    query_string = urlencode(sorted_params, quote_via=quote)
    string_to_sign = f"POST&%2F&{quote(query_string, safe='')}"
    # 3. HMAC-SHA1 签名
    key = (access_key_secret + "&").encode("utf-8")
    signature = hmac.new(key, string_to_sign.encode("utf-8"), hashlib.sha1).digest()
    return base64.b64encode(signature).decode("utf-8")


def _call_aliyun_ocr(image_base64: str) -> str:
    """调用阿里云专业 OCR API"""
    endpoint = "ocr-api.cn-hangzhou.aliyuncs.com"

    # 公共参数
    params = {
        "Action": "RecognizeGeneral",
        "Version": "2021-07-07",
        "Format": "JSON",
        "AccessKeyId": ACCESS_KEY_ID,
        "SignatureMethod": "HMAC-SHA1",
        "Timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "SignatureVersion": "1.0",
        "SignatureNonce": str(uuid.uuid4()),
    }

    # 生成签名
    params["Signature"] = _sign_request(params, ACCESS_KEY_SECRET)

    # 构造请求 URL
    url = f"https://{endpoint}/"

    # 解析 base64 图片数据
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]

    image_bytes = base64.b64decode(image_base64)

    # 发送请求（使用 body 传输图片二进制）
    headers = {
        "Content-Type": "application/octet-stream",
    }

    response = requests.post(
        url,
        params=params,
        data=image_bytes,
        headers=headers,
        timeout=30
    )
    response.raise_for_status()

    result = response.json()

    if "Data" in result:
        data = result["Data"]
        if isinstance(data, str):
            data = json.loads(data)
        return data.get("content", "")
    elif "Code" in result:
        raise Exception(f"OCR Error: {result.get('Code')} - {result.get('Message', '')}")

    return ""


def _call_dashscope_ocr(image_data: str) -> str:
    """调用 DashScope 视觉模型进行 OCR（备用方案）"""
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
                        {"image": image_data},
                        {"text": (
                            "你是一位精通古汉语、训诂学和金石学的资深专家，擅长辨认古籍善本、碑帖拓片中的文字。\n\n"
                            "【任务】请仔细辨认并转录图片中的所有汉字。\n\n"
                            "【重要规则】\n"
                            "1. 古籍通常是竖排、从右到左阅读，请按正确的阅读顺序输出\n"
                            "2. 保留繁体字原貌，不要转换为简体字\n"
                            "3. 识别所有异体字、古字形、俗字，尽量还原原文\n"
                            "4. 遇到模糊或残损的字，根据上下文和字形结构推断最可能的字\n"
                            "5. 保留原文的句读标点（如有），不要添加现代标点\n"
                            "6. 只输出识别到的文字，不要添加任何解释、编号或说明"
                        )}
                    ]
                }
            ]
        }
    }

    resp = requests.post(DASHSCOPE_VL_URL, headers=headers, json=payload, timeout=45)
    resp.raise_for_status()
    data = resp.json()

    try:
        content = data["output"]["choices"][0]["message"]["content"]
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
    """Vercel Serverless Function handler"""

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

            # 获取图片数据
            image_data = body.get("image", "").strip()
            image_url = body.get("image_url", "").strip()
            final_image = image_data if image_data else image_url

            if not final_image:
                self._send_json(400, {"error": "Missing image or image_url field"})
                return

            text = ""
            ocr_method = "unknown"

            # 优先使用阿里云专业 OCR
            if ACCESS_KEY_ID and ACCESS_KEY_SECRET:
                try:
                    text = _call_aliyun_ocr(final_image)
                    ocr_method = "aliyun_ocr"
                except Exception as e:
                    print(f"[OCR] Aliyun OCR failed: {e}, falling back to DashScope")
                    # 回退到 DashScope
                    if DASHSCOPE_API_KEY:
                        text = _call_dashscope_ocr(final_image)
                        ocr_method = "dashscope_fallback"
                    else:
                        raise e
            # 否则使用 DashScope
            elif DASHSCOPE_API_KEY:
                text = _call_dashscope_ocr(final_image)
                ocr_method = "dashscope"
            else:
                self._send_json(503, {"error": "No OCR API configured"})
                return

            self._send_json(200, {"text": text.strip(), "method": ocr_method})

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
