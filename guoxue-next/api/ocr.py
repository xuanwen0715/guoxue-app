import os
import json
import base64
import traceback
import requests
from http.server import BaseHTTPRequestHandler

# 导入认证工具
from .auth_utils import (
    verify_token, check_user_quota, deduct_credit,
    AuthError, QuotaError
)

# 阿里云 OCR SDK
try:
    from alibabacloud_ocr_api20210707.client import Client as OcrClient
    from alibabacloud_tea_openapi import models as open_api_models
    from alibabacloud_ocr_api20210707 import models as ocr_models
    from alibabacloud_tea_util import models as util_models
    ALIYUN_SDK_AVAILABLE = True
except ImportError:
    ALIYUN_SDK_AVAILABLE = False

# 阿里云 OCR 配置
ACCESS_KEY_ID = os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_ID", "")
ACCESS_KEY_SECRET = os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_SECRET", "")

# 备用：DashScope 视觉模型
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
DASHSCOPE_VL_URL = os.environ.get(
    "DASHSCOPE_VL_URL",
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
)
DASHSCOPE_TXT_URL = os.environ.get(
    "DASHSCOPE_TXT_URL",
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
)

# 阿里云 OCR 客户端（单例）
_ocr_client = None

def _get_ocr_client():
    """获取阿里云 OCR 客户端"""
    global _ocr_client
    if _ocr_client is None and ALIYUN_SDK_AVAILABLE and ACCESS_KEY_ID and ACCESS_KEY_SECRET:
        config = open_api_models.Config(
            access_key_id=ACCESS_KEY_ID,
            access_key_secret=ACCESS_KEY_SECRET
        )
        config.endpoint = "ocr-api.cn-hangzhou.aliyuncs.com"
        _ocr_client = OcrClient(config)
    return _ocr_client


def _call_aliyun_ocr(image_base64: str) -> str:
    """调用阿里云高精 OCR API (RecognizeAdvanced)"""
    client = _get_ocr_client()
    if not client:
        raise Exception("Aliyun OCR client not available")

    # 解析 base64 图片数据
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]

    # 使用 body 方式传递图片
    from io import BytesIO
    image_bytes = base64.b64decode(image_base64)
    body_stream = BytesIO(image_bytes)

    # 使用 RecognizeAdvanced（全文高精识别）
    # 支持生僻字、自动旋转、去印章等功能
    request = ocr_models.RecognizeAdvancedRequest(
        body=body_stream,
        need_rotate=True,      # 自动旋转校正
        output_char_info=False, # 不需要单字信息
        no_stamp=True,         # 去除印章干扰
    )
    runtime = util_models.RuntimeOptions()
    runtime.read_timeout = 30000
    runtime.connect_timeout = 10000

    response = client.recognize_advanced_with_options(request, runtime)

    if response.body and response.body.data:
        data = response.body.data
        if isinstance(data, str):
            data = json.loads(data)
        return data.get("content", "")

    return ""


def _call_dashscope_ocr(image_data: str) -> str:
    """调用 DashScope 视觉模型进行 OCR（备用方案）"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
    }

    # 确保图片是完整的 data URI 格式
    if not image_data.startswith("data:"):
        # 尝试检测图片类型并添加前缀
        if image_data.startswith("/9j/"):
            image_data = f"data:image/jpeg;base64,{image_data}"
        elif image_data.startswith("iVBOR"):
            image_data = f"data:image/png;base64,{image_data}"
        else:
            image_data = f"data:image/png;base64,{image_data}"

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
    except (KeyError, IndexError, TypeError) as e:
        print(f"[OCR] DashScope parse error: {e}, response: {data}")
        return ""


def _get_ai_suggestions(ocr_text: str) -> dict:
    """调用 AI 大模型对 OCR 结果进行纠错建议"""
    if not DASHSCOPE_API_KEY or not ocr_text.strip():
        return {"corrected": "", "suggestions": []}

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
    }

    payload = {
        "model": "qwen-max",
        "input": {
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是一位精通古汉语、训诂学和版本学的资深专家。"
                        "你的任务是审校OCR识别的古籍文本，找出可能的识别错误并给出纠正建议。"
                    )
                },
                {
                    "role": "user",
                    "content": f"""以下是OCR识别的古籍文本，请审校并给出纠错建议：

【OCR识别结果】
{ocr_text}

【任务要求】
1. 仔细检查是否有OCR误识的字（如形近字混淆：道/遺、已/己、末/未等）
2. 检查是否有因图片模糊导致的错字或漏字
3. 根据古籍文义和上下文判断可能的正确字
4. 注意：异体字、通假字、古字形不算错误，请保留

【输出格式】请严格按以下JSON格式返回：
{{
  "corrected": "纠正后的完整文本（如无错误则与原文相同）",
  "suggestions": [
    {{
      "original": "原字/词",
      "suggested": "建议改为",
      "reason": "简短理由"
    }}
  ]
}}

如果没有发现明显错误，suggestions 返回空数组 []。
只返回JSON，不要其他文字。"""
                }
            ]
        }
    }

    try:
        resp = requests.post(DASHSCOPE_TXT_URL, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        content = data.get("output", {}).get("text", "")
        if not content:
            choices = data.get("output", {}).get("choices", [])
            if choices:
                content = choices[0].get("message", {}).get("content", "")

        # 尝试解析 JSON
        if content:
            # 清理可能的 markdown 代码块
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[-1]
            if content.endswith("```"):
                content = content.rsplit("```", 1)[0]
            content = content.strip()

            result = json.loads(content)
            return {
                "corrected": result.get("corrected", ocr_text),
                "suggestions": result.get("suggestions", [])
            }
    except Exception as e:
        print(f"[OCR] AI suggestion failed: {e}")

    return {"corrected": ocr_text, "suggestions": []}


class handler(BaseHTTPRequestHandler):
    """Vercel Serverless Function handler with authentication"""

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        try:
            # ========== 第一步：检查"门票"（验证 Token） ==========
            auth_header = self.headers.get("Authorization", "")
            try:
                user_info = verify_token(auth_header)
                user_id = user_info["user_id"]
            except AuthError as e:
                self._send_json(e.code, {"error": e.message, "code": "AUTH_ERROR"})
                return

            # ========== 第二步：检查"余额"（用户额度） ==========
            try:
                quota_info = check_user_quota(user_id)
            except QuotaError as e:
                self._send_json(e.code, {"error": e.message, "code": "QUOTA_EXCEEDED"})
                return

            # ========== 开始处理业务逻辑 ==========
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
            ocr_error = None

            # 优先使用阿里云专业 OCR
            if ALIYUN_SDK_AVAILABLE and ACCESS_KEY_ID and ACCESS_KEY_SECRET:
                try:
                    text = _call_aliyun_ocr(final_image)
                    ocr_method = "aliyun_ocr"
                except Exception as e:
                    ocr_error = f"Aliyun: {str(e)}"
                    print(f"[OCR] Aliyun OCR failed: {e}, falling back to DashScope")
                    # 回退到 DashScope
                    if DASHSCOPE_API_KEY:
                        try:
                            text = _call_dashscope_ocr(final_image)
                            ocr_method = "dashscope_fallback"
                            ocr_error = None
                        except Exception as e2:
                            ocr_error = f"Aliyun: {ocr_error}, DashScope: {str(e2)}"
                            raise Exception(ocr_error)
                    else:
                        raise e
            # 否则使用 DashScope
            elif DASHSCOPE_API_KEY:
                try:
                    text = _call_dashscope_ocr(final_image)
                    ocr_method = "dashscope"
                except Exception as e:
                    ocr_error = f"DashScope: {str(e)}"
                    raise Exception(ocr_error)
            else:
                self._send_json(503, {"error": "No OCR API configured (missing ALIBABA_CLOUD or DASHSCOPE keys)"})
                return

            # 获取 AI 纠错建议
            ai_result = _get_ai_suggestions(text.strip())

            # ========== 第三步：扣除积分（仅在 API 调用成功后） ==========
            if quota_info.get("should_deduct"):
                deduct_credit(user_id)

            self._send_json(200, {
                "text": text.strip(),
                "method": ocr_method,
                "ai_corrected": ai_result.get("corrected", ""),
                "ai_suggestions": ai_result.get("suggestions", []),
                "_quota": {
                    "is_premium": quota_info.get("is_premium", False),
                    "credits_remaining": quota_info.get("credits_remaining", 0) - (1 if quota_info.get("should_deduct") else 0)
                }
            })

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
