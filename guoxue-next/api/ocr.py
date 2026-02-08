import os
import json
import base64
import traceback
import requests
import re
from io import BytesIO
from http.server import BaseHTTPRequestHandler

# 古籍常用字表（用于识别校验）
# 包含常见古籍用字、异体字、避讳字等
CLASSICAL_COMMON_CHARS = set(
    "一二三四五六七八九十百千万亿零壹贰叁肆伍陆柒捌玖拾佰仟萬億" +
    "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥" +
    "春夏秋冬東西南北中上下左右前后内外"
)

# 古籍常见形近字对照表（用于纠错提示）
CLASSICAL_SIMILAR_CHARS = {
    # 原字: [可能的误识字列表]
    "未": ["末", "朱"],
    "末": ["未", "朱"],
    "己": ["已", "巳"],
    "已": ["己", "巳"],
    "巳": ["己", "已"],
    "人": ["入", "八", "乂"],
    "入": ["人", "八"],
    "八": ["人", "入"],
    "土": ["士", "干", "千"],
    "士": ["土", "干"],
    "日": ["曰", "白", "目"],
    "曰": ["日", "白"],
    "干": ["千", "于", "土", "士"],
    "千": ["干", "于"],
    "后": ["後", "后"],
    "後": ["后"],
    "爲": ["為", "馬", "焉"],
    "為": ["爲", "馬"],
    "无": ["無"],
    "無": ["无", "舞"],
    "几": ["幾"],
    "幾": ["几", "機"],
    "云": ["雲", "曰"],
    "雲": ["云"],
    "里": ["裡", "裏"],
    "裡": ["里", "裏"],
    "面": ["靣", "麵"],
    "靣": ["面"],
    "与": ["與"],
    "與": ["与"],
    "万": ["萬"],
    "萬": ["万"],
    "系": ["係", "繫"],
    "係": ["系", "繫"],
    "繫": ["系", "係"],
    "只": ["隻", "祇", "衹"],
    "隻": ["只", "祇"],
    "祇": ["只", "隻"],
    "冲": ["沖", "衝"],
    "沖": ["冲"],
    "御": ["禦"],
    "禦": ["御"],
    "台": ["臺", "檯", "颱"],
    "臺": ["台"],
    "才": ["纔"],
    "纔": ["才"],
    "合": ["郃"],
    "郃": ["合"],
}


def _classical_text_validation(text: str) -> str:
    """
    古籍文本字典校验
    检查识别结果中的可疑字，并尝试修正
    """
    if not text:
        return text
    
    # 检查是否包含可疑的简体字（古籍应该用繁体）
    simplified_indicators = {
        '为': '為/爲', '无': '無', '见': '見', '贝': '貝',
        '长': '長', '门': '門', '书': '書', '头': '頭',
        '东': '東', '车': '車', '马': '馬', '鸟': '鳥',
        '鱼': '魚', '龙': '龍', '风': '風', '云': '雲',
    }
    
    corrections = []
    for char in text:
        if char in simplified_indicators:
            corrections.append(f"'{char}'→'{simplified_indicators[char]}'")
    
    if corrections:
        print(f"[OCR Validation] Found simplified chars: {corrections}")
    
    return text

# 导入认证工具
from .auth_utils import (
    verify_token, check_user_quota, deduct_credit,
    AuthError, QuotaError
)

# 导入缓存模块
from .ocr_cache import (
    get_cache, set_cache, get_image_hash,
    CACHE_ENABLED
)

# 导入古籍优化模块
try:
    from .classical_book_utils import (
        enhance_classical_book,
        enhance_text_with_variants,
        analyze_image_quality
    )
    CLASSICAL_BOOK_AVAILABLE = True
except ImportError:
    CLASSICAL_BOOK_AVAILABLE = False

# 导入高级图像增强模块
try:
    from .ocr_enhancement import (
        apply_full_enhancement_pipeline,
        deskew_image,
        detect_skew_angle,
        post_process_ocr_text
    )
    ENHANCEMENT_AVAILABLE = True
except ImportError:
    ENHANCEMENT_AVAILABLE = False

# 阿里云 OCR SDK
try:
    from alibabacloud_ocr_api20210707.client import Client as OcrClient
    from alibabacloud_tea_openapi import models as open_api_models
    from alibabacloud_ocr_api20210707 import models as ocr_models
    from alibabacloud_tea_util import models as util_models
    ALIYUN_SDK_AVAILABLE = True
except ImportError:
    ALIYUN_SDK_AVAILABLE = False

# Pillow 图像处理（用于预处理增强）
try:
    from PIL import Image, ImageOps, ImageFilter
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

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


def _get_dashscope_prompt(scene: str, layout: str) -> str:
    layout_hint = ""
    if layout == "vertical":
        layout_hint = "排版为竖排（从右到左），请按正确顺序输出。"
    elif layout == "horizontal":
        layout_hint = "排版为横排（从左到右），请按正确顺序输出。"

    direction_rule = "古籍通常是竖排、从右到左阅读，请按正确的阅读顺序输出"
    if layout == "vertical":
        direction_rule = "文本为竖排、从右到左阅读，请按正确顺序输出"
    elif layout == "horizontal":
        direction_rule = "文本为横排、从左到右阅读，请按正确顺序输出"

    # 古籍OCR专项 Few-shot 示例（包含更多古籍常见形近字）
    few_shot_examples = """
【识别示例】
示例1 - 标准楷书：
输入图片：清晰的"子曰學而時習之"
正确输出：子曰學而時習之

示例2 - 碑帖拓片（有残缺）：
输入图片："道而□遠人"
正确输出：道而□遠人（□表示无法识别的字）

示例3 - 异体字/古字形：
输入图片："衆"的异体写法（衆的上半部分不同）
正确输出：衆（输出标准字形，不输出描述）

示例4 - 竖排版式：
输入图片：三列竖排文字，从右到左为"天地人"
正确输出：天地人（按正确阅读顺序）

示例5 - 古籍常见字辨析：
- "爲" vs "為"：两者都是"为"的繁体，古籍常见"爲"（爪字头）
- "眾" vs "衆"：都是"众"的繁体，注意区分
- "無" vs "无"：古籍用"無"，注意"灬"下面是"林"
- "爲"（爪+灬+丶）注意与"馬"区分

示例6 - 篆书/隶书识别：
输入图片：篆书"禮記"
正确输出：禮記（隶定字形）
"""

    if scene == "word":
        prompt = (
            "你是一位精通古汉语、训诂学和金石学的顶级专家，擅长辨认古籍善本、碑帖拓片、金石文字。\n\n"
            "【任务】请识别图片中最清晰的 1-6 个汉字（或一个短词）。\n\n"
            "【核心规则 - 严格遵守】\n"
            "1. 只输出识别到的汉字，绝对不要添加任何解释、编号、说明或标点\n"
            "2. 不要补字、不要猜测扩写，模糊不清的字用□表示\n"
            "3. 必须保留繁体字原貌，严禁转换为简体字\n"
            "4. 识别异体字、古字形、俗字，输出对应的现代标准字形\n"
            "5. 按自然阅读顺序输出（考虑版式方向）\n"
            "6. 遇到形近字（如 未/末、己/已/巳、人/入/八），仔细辨认偏旁部首\n"
        )
        if layout_hint:
            prompt += f"7. {layout_hint}\n"
        prompt += few_shot_examples
        return prompt
    
    # 段落/上下文识别模式
    prompt = (
        "你是一位精通古汉语、训诂学和金石学的顶级专家，擅长辨认古籍善本、碑帖拓片、金石文字。\n\n"
        "【任务】请仔细辨认并转录图片中的所有汉字。\n\n"
        "【核心规则 - 严格遵守】\n"
        f"1. 版式方向：{direction_rule}\n"
        "2. 文字转录必须保留繁体字原貌，严禁转换为简体字\n"
        "3. 识别所有异体字、古字形、俗字，输出对应的现代标准字形\n"
        "4. 遇到模糊或残损的字，根据上下文和字形结构推断最可能的字；实在无法识别时用□表示\n"
        "5. 保留原文的句读标点（圈点、顿号等），但不要添加现代标点\n"
        "6. 只输出识别到的文字，绝对不要添加任何解释、编号或说明\n"
        "7. 古籍常见易混字辨析（特别注意）：\n"
        "   - 未(上短下长) vs 末(上长下短)\n"
        "   - 己(开口) vs 已(半开) vs 巳(闭口)\n"
        "   - 人(撇长捺短) vs 入(撇短捺长) vs 八(撇捺分开)\n"
        "   - 土(上横短下横长) vs 士(上横长下横短)\n"
        "   - 日(瘦长) vs 曰(扁宽，表示'说')\n"
        "   - 幷(並的异体) vs 并(简体)\n"
        "   - 爲(爪+灬) vs 為(爪+灬+丶) - 两者通用\n"
        "   - 禮(示字旁) vs 醴(酉字旁) - 注意偏旁\n"
        "   - 後(表示'后面') vs 后(表示'皇后')\n"
        "   - 乾(qián/干) vs 幹(gàn/幹) vs 干(gān/干)\n"
    )
    if layout_hint:
        prompt += f"8. {layout_hint}\n"
    prompt += few_shot_examples
    return prompt


def _decode_image_bytes(image_data: str):
    if not image_data:
        return None
    if image_data.startswith("http://") or image_data.startswith("https://"):
        return None
    try:
        if image_data.startswith("data:"):
            image_data = image_data.split(",", 1)[1]
        return base64.b64decode(image_data)
    except Exception:
        return None


def _otsu_threshold(gray_image) -> int:
    histogram = gray_image.histogram()
    total = sum(histogram)
    sum_total = sum(i * histogram[i] for i in range(256))
    sum_b = 0
    w_b = 0
    max_between = 0
    threshold = 128
    for i in range(256):
        w_b += histogram[i]
        if w_b == 0:
            continue
        w_f = total - w_b
        if w_f == 0:
            break
        sum_b += i * histogram[i]
        m_b = sum_b / w_b
        m_f = (sum_total - sum_b) / w_f
        between = w_b * w_f * (m_b - m_f) ** 2
        if between > max_between:
            max_between = between
            threshold = i
    return threshold


def _preprocess_image_base64(image_data: str) -> str:
    if not PIL_AVAILABLE:
        return ""
    image_bytes = _decode_image_bytes(image_data)
    if not image_bytes:
        return ""
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            gray = img.convert("L")
            gray = ImageOps.autocontrast(gray)
            gray = gray.filter(ImageFilter.MedianFilter(size=3))
            gray = gray.filter(ImageFilter.UnsharpMask(radius=1, percent=160, threshold=3))
            threshold = _otsu_threshold(gray)
            bw = gray.point(lambda p: 255 if p > threshold else 0)
            output = bw.convert("RGB")
            buffer = BytesIO()
            output.save(buffer, format="JPEG", quality=95, optimize=True)
        encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{encoded}"
    except Exception as e:
        print(f"[OCR] Preprocess failed: {e}")
        return ""

def _call_dashscope_ocr(image_data: str, scene: str, layout: str) -> str:
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
        "model": "qwen2.5-vl-72b-instruct",
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"image": image_data},
                        {"text": _get_dashscope_prompt(scene, layout)}
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


def _get_ai_suggestions(ocr_text: str, scene: str) -> dict:
    """调用 AI 大模型对 OCR 结果进行纠错建议"""
    if not DASHSCOPE_API_KEY or not ocr_text.strip():
        return {"corrected": "", "suggestions": []}

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
    }

    if scene == "word":
        user_prompt = f"""以下是OCR识别的文字，请做轻量纠错：

【OCR识别结果】
{ocr_text}

【任务要求】
1. 只纠错明显错字，不要扩写或补字
2. 纠正后请保持尽量简短（1-6 个字）
3. 异体字、通假字、古字形不算错误，请保留

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
    else:
        user_prompt = f"""以下是OCR识别的古籍文本，请审校并给出纠错建议：

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
                    "content": user_prompt
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


def _count_cjk(text: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", text))


def _score_text(text: str, scene: str) -> int:
    cleaned = text.strip().replace("\n", "")
    if not cleaned:
        return -10
    cjk_count = _count_cjk(cleaned)
    non_cjk = max(len(cleaned) - cjk_count, 0)
    score = cjk_count * 2 - non_cjk
    if scene == "word":
        if 1 <= cjk_count <= 6 and non_cjk == 0:
            score += 5
        if cjk_count == 0:
            score -= 10
    return score


def _fuse_results(candidates: list, scene: str) -> tuple:
    """
    智能融合多个OCR结果
    
    策略：
    1. 首先选择分数最高的
    2. 如果分数相近，优先选择包含更多合理中文词汇的
    3. 检测一致性：如果多个引擎结果相似，提高置信度
    
    Returns:
        (best_text, best_method, best_score)
    """
    if not candidates:
        return "", "none", -100
    
    if len(candidates) == 1:
        return candidates[0]
    
    # 按分数排序
    sorted_candidates = sorted(candidates, key=lambda x: x[2], reverse=True)
    
    # 检查前两名是否分数相近（差距在5分内）
    if len(sorted_candidates) >= 2:
        top1_text, top1_method, top1_score = sorted_candidates[0]
        top2_text, top2_method, top2_score = sorted_candidates[1]
        
        if top1_score - top2_score <= 5:
            # 分数相近，检查内容相似度
            similarity = _text_similarity(top1_text, top2_text)
            
            if similarity > 0.8:
                # 结果高度相似，使用更可靠的方法
                if "enhanced" in top1_method or "dashscope" in top1_method:
                    return sorted_candidates[0]
                else:
                    return sorted_candidates[1]
            
            # 检查哪个结果包含更多合理词汇（简单启发式）
            top1_valid = _count_valid_chars(top1_text)
            top2_valid = _count_valid_chars(top2_text)
            
            if top2_valid > top1_valid and top2_score >= top1_score - 3:
                return sorted_candidates[1]
    
    return sorted_candidates[0]


def _text_similarity(text1: str, text2: str) -> float:
    """计算两个文本的相似度（0-1）"""
    if not text1 or not text2:
        return 0.0
    
    # 使用简单的字符集合Jaccard相似度
    set1 = set(text1)
    set2 = set(text2)
    
    if not set1 or not set2:
        return 0.0
    
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    
    return intersection / union if union > 0 else 0.0


def _count_valid_chars(text: str) -> int:
    """计算有效字符数（中文、常用标点）"""
    import re
    # 匹配CJK字符和常用标点
    valid_pattern = re.compile(r'[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]')
    return len(valid_pattern.findall(text))


def _is_low_confidence(text: str, scene: str) -> bool:
    cleaned = text.strip().replace("\n", "")
    if not cleaned:
        return True
    cjk_count = _count_cjk(cleaned)
    if scene == "word":
        return cjk_count == 0 or cjk_count > 6
    ratio = cjk_count / max(len(cleaned), 1)
    return cjk_count < 6 or ratio < 0.35


class handler(BaseHTTPRequestHandler):
    """Vercel Serverless Function handler with authentication"""
    
    # 阶段定义用于进度跟踪
    STAGES = {
        "auth": "身份验证",
        "quota": "额度检查",
        "cache": "缓存检查",
        "analysis": "图像分析",
        "classical": "古籍优化",
        "ocr": "文字识别",
        "enhance": "结果增强",
        "ai_review": "AI审校",
        "cache_save": "保存缓存",
        "complete": "完成"
    }

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
            scene = body.get("scene", "context").strip().lower()
            if scene not in ("context", "word"):
                scene = "context"
            layout = body.get("layout", "auto").strip().lower()
            if layout not in ("auto", "vertical", "horizontal"):
                layout = "auto"
            enhance = body.get("enhance", False)
            if isinstance(enhance, str):
                enhance = enhance.lower() in ("1", "true", "yes")
            
            # 古籍优化模式
            classical_mode = body.get("classical_mode", "auto").strip().lower()
            if classical_mode not in ("auto", "none", "remove_yellow", "enhance_ink", "denoise", "high_contrast", "super_res"):
                classical_mode = "auto"
            
            # 超分辨率放大（提升小字识别率）
            upscale = body.get("upscale", False)
            if isinstance(upscale, str):
                upscale = upscale.lower() in ("1", "true", "yes")
            
            final_image = image_data if image_data else image_url

            if not final_image:
                self._send_json(400, {"error": "Missing image or image_url field"})
                return

            # ========== 第三步：检查缓存 ==========
            image_hash = get_image_hash(final_image) if final_image.startswith("data:") else ""
            cached_result = None
            
            if image_hash and not enhance:  # 主动增强模式跳过缓存
                cached_result = get_cache(image_hash)
                if cached_result:
                    # 缓存命中，直接返回（不扣除积分）
                    print(f"[OCR] Cache hit for user {user_id}, saved API call")
                    self._send_json(200, {
                        "text": cached_result["text"],
                        "method": cached_result["method"],
                        "ai_corrected": cached_result.get("ai_corrected", ""),
                        "ai_suggestions": cached_result.get("ai_suggestions", []),
                        "_cached": True,
                        "_quota": {
                            "is_premium": quota_info.get("is_premium", False),
                            "credits_remaining": quota_info.get("credits_remaining", 0)
                        }
                    })
                    return

            text = ""
            ocr_method = "unknown"
            ocr_error = None
            
            print(f"[OCR] Stage: ocr - Starting OCR recognition, scene={scene}, layout={layout}")

            # 对于古籍和生僻字，优先使用 DashScope qwen-vl-max（视觉语言模型更擅长复杂文字）
            # 阿里云 OCR 作为备用
            if DASHSCOPE_API_KEY:
                try:
                    print(f"[OCR] Calling DashScope VL API...")
                    text = _call_dashscope_ocr(final_image, scene, layout)
                    ocr_method = "dashscope"
                    print(f"[OCR] DashScope success, got {len(text)} chars")
                except Exception as e:
                    ocr_error = f"DashScope: {str(e)}"
                    print(f"[OCR] DashScope failed: {e}, trying Aliyun OCR")
                    # 回退到阿里云 OCR
                    if ALIYUN_SDK_AVAILABLE and ACCESS_KEY_ID and ACCESS_KEY_SECRET:
                        try:
                            text = _call_aliyun_ocr(final_image)
                            ocr_method = "aliyun_fallback"
                            ocr_error = None
                        except Exception as e2:
                            ocr_error = f"DashScope: {ocr_error}, Aliyun: {str(e2)}"
                            raise Exception(ocr_error)
                    else:
                        raise e
            # 如果没有 DashScope，使用阿里云
            elif ALIYUN_SDK_AVAILABLE and ACCESS_KEY_ID and ACCESS_KEY_SECRET:
                try:
                    text = _call_aliyun_ocr(final_image)
                    ocr_method = "aliyun_ocr"
                except Exception as e:
                    ocr_error = f"Aliyun: {str(e)}"
                    raise Exception(ocr_error)
            else:
                self._send_json(503, {"error": "No OCR API configured (missing DASHSCOPE or ALIBABA_CLOUD keys)"})
                return

            # 超分辨率放大（如果需要）
            upscaled_info = None
            if CLASSICAL_BOOK_AVAILABLE and upscale:
                print(f"[OCR] Stage: upscale - Applying super resolution")
                try:
                    from .classical_book_utils import upscale_for_ocr
                    upscaled_image = upscale_for_ocr(final_image, scale_factor=2)
                    if upscaled_image and upscaled_image != final_image:
                        final_image = upscaled_image
                        upscaled_info = {"applied": True, "scale": 2}
                        print(f"[OCR] Image upscaled 2x for better recognition")
                except Exception as e:
                    print(f"[OCR] Upscale failed: {e}")
            
            # 古籍优化处理
            classical_info = None
            if CLASSICAL_BOOK_AVAILABLE and classical_mode != "none":
                print(f"[OCR] Stage: classical - Applying classical book enhancement, mode={classical_mode}")
                try:
                    processed_image, classical_info = enhance_classical_book(
                        final_image, 
                        mode=classical_mode
                    )
                    if processed_image and processed_image != final_image:
                        # 使用古籍优化后的图片重新识别
                        print(f"[OCR] Applied classical book enhancement: {classical_info}")
                        try:
                            enhanced_text = _call_dashscope_ocr(processed_image, scene, layout)
                            if enhanced_text and _score_text(enhanced_text, scene) > _score_text(text, scene):
                                text = enhanced_text
                                ocr_method = f"{ocr_method}_classical"
                        except Exception as e:
                            print(f"[OCR] Classical enhancement recognition failed: {e}")
                except Exception as e:
                    print(f"[OCR] Classical enhancement failed: {e}")

            # 高级图像预处理 + 多引擎智能融合
            warning = None
            is_low_conf = _is_low_confidence(text, scene)
            should_enhance = enhance or is_low_conf
            
            if is_low_conf:
                warning = "LOW_CONFIDENCE"
            
            # 收集所有候选结果
            candidates = [(text, ocr_method, _score_text(text, scene))]
            
            if should_enhance:
                print(f"[OCR] Stage: enhance - Running advanced enhancement pipeline")
                
                # 1. 高级预处理流水线
                if ENHANCEMENT_AVAILABLE:
                    try:
                        enhanced_image, enhance_info = apply_full_enhancement_pipeline(
                            final_image, 
                            detect_skew=True
                        )
                        print(f"[OCR] Enhancement pipeline: {enhance_info}")
                        
                        if enhanced_image and enhanced_image != final_image:
                            # 用增强后的图像进行OCR
                            if DASHSCOPE_API_KEY:
                                try:
                                    enhanced_text = _call_dashscope_ocr(enhanced_image, scene, layout)
                                    enhanced_score = _score_text(enhanced_text, scene)
                                    candidates.append((enhanced_text, f"{ocr_method}_enhanced", enhanced_score))
                                    print(f"[OCR] Enhanced image OCR: score={enhanced_score}")
                                except Exception as e:
                                    print(f"[OCR] Enhanced OCR failed: {e}")
                    except Exception as e:
                        print(f"[OCR] Enhancement pipeline failed: {e}")
                
                # 2. 传统预处理（作为备选）
                processed_image = _preprocess_image_base64(final_image)
                if processed_image:
                    if DASHSCOPE_API_KEY:
                        try:
                            pre_text = _call_dashscope_ocr(processed_image, scene, layout)
                            pre_score = _score_text(pre_text, scene)
                            candidates.append((pre_text, "dashscope_preprocess", pre_score))
                        except Exception as e:
                            print(f"[OCR] Preprocess DashScope failed: {e}")
                    if ALIYUN_SDK_AVAILABLE and ACCESS_KEY_ID and ACCESS_KEY_SECRET:
                        try:
                            pre_text = _call_aliyun_ocr(processed_image)
                            pre_score = _score_text(pre_text, scene)
                            candidates.append((pre_text, "aliyun_preprocess", pre_score))
                        except Exception as e:
                            print(f"[OCR] Preprocess Aliyun failed: {e}")
                
                # 3. 阿里云OCR作为对比
                if (
                    ALIYUN_SDK_AVAILABLE
                    and ACCESS_KEY_ID
                    and ACCESS_KEY_SECRET
                    and not ocr_method.startswith("aliyun")
                ):
                    try:
                        alt_text = _call_aliyun_ocr(final_image)
                        alt_score = _score_text(alt_text, scene)
                        candidates.append((alt_text, "aliyun_compare", alt_score))
                    except Exception as e:
                        print(f"[OCR] Low confidence Aliyun failed: {e}")
            
            # 智能融合：选择最佳结果
            print(f"[OCR] Candidates: {len(candidates)}")
            best_text, best_method, best_score = _fuse_results(candidates, scene)
            text = best_text
            ocr_method = best_method
            
            print(f"[OCR] Best result: method={best_method}, score={best_score}")

            # 文本清理（按场景）
            def _normalize_text(value: str, ocr_scene: str) -> str:
                cleaned = value.strip()
                if ocr_scene == "word":
                    cleaned = "".join(cleaned.split())
                    if len(cleaned) > 6:
                        cleaned = cleaned[:6]
                    return cleaned
                lines = [line.strip() for line in cleaned.splitlines()]
                lines = [line for line in lines if line]
                return "\n".join(lines)

            text = _normalize_text(text, scene)

            # 古籍字典辅助校验（验证识别结果中的字是否在字典中）
            if scene == "context":
                text = _classical_text_validation(text)

            # 获取 AI 纠错建议
            print(f"[OCR] Stage: ai_review - Getting AI suggestions...")
            ai_result = _get_ai_suggestions(text, scene)
            print(f"[OCR] AI review complete, suggestions: {len(ai_result.get('suggestions', []))}")
            
            # 古籍文本增强（异体字检测）
            text_enhancement = None
            if scene == "word" and CLASSICAL_BOOK_AVAILABLE:
                try:
                    text_enhancement = enhance_text_with_variants(text)
                except Exception as e:
                    print(f"[OCR] Text enhancement failed: {e}")
            
            # 后处理：形近字检测
            post_process_info = None
            if ENHANCEMENT_AVAILABLE:
                try:
                    _, suspicious_chars = post_process_ocr_text(text)
                    if suspicious_chars:
                        post_process_info = {
                            "suspicious_chars": suspicious_chars,
                            "warning": "检测到可能的形近字错误，请核对原图"
                        }
                        print(f"[OCR] Post-process found {len(suspicious_chars)} suspicious chars")
                except Exception as e:
                    print(f"[OCR] Post-process failed: {e}")

            # ========== 第四步：存入缓存 ==========
            if image_hash and text.strip():
                print(f"[OCR] Stage: cache_save - Saving to cache...")
                try:
                    image_bytes = _decode_image_bytes(final_image)
                    image_size = len(image_bytes) if image_bytes else 0
                    
                    set_cache(
                        image_hash=image_hash,
                        ocr_text=text.strip(),
                        ai_corrected=ai_result.get("corrected", ""),
                        ai_suggestions=ai_result.get("suggestions", []),
                        method=ocr_method,
                        scene=scene,
                        image_size=image_size,
                        char_count=_count_cjk(text)
                    )
                except Exception as cache_err:
                    print(f"[OCR] Cache save error: {cache_err}")

            # ========== 第五步：扣除积分（仅在 API 调用成功后） ==========
            if quota_info.get("should_deduct"):
                deduct_credit(user_id)

            # 构建响应
            print(f"[OCR] Stage: complete - Sending response")
            
            # 合并警告信息
            final_warning = warning
            if post_process_info and post_process_info.get("warning"):
                if final_warning:
                    final_warning += "; " + post_process_info["warning"]
                else:
                    final_warning = post_process_info["warning"]
            
            response_data = {
                "text": text.strip(),
                "method": ocr_method,
                "ai_corrected": ai_result.get("corrected", ""),
                "ai_suggestions": ai_result.get("suggestions", []),
                "_classical_info": classical_info,
                "_text_enhancement": text_enhancement,
                "_post_process": post_process_info,
                "_warning": final_warning,
                "_quota": {
                    "is_premium": quota_info.get("is_premium", False),
                    "credits_remaining": quota_info.get("credits_remaining", 0) - (1 if quota_info.get("should_deduct") else 0)
                }
            }
            
            self._send_json(200, response_data)

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
