"""
古籍善本图像处理工具
针对古籍泛黄、污渍、墨迹褪色等问题的专用优化
"""

import os
import base64
from io import BytesIO
from typing import Optional, Dict, Any, Tuple

try:
    from PIL import Image, ImageOps, ImageFilter, ImageEnhance, ImageStat
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


def _decode_image(image_data: str) -> Optional[bytes]:
    """解码 base64 图片数据"""
    try:
        if image_data.startswith("data:"):
            image_data = image_data.split(",", 1)[1]
        return base64.b64decode(image_data)
    except Exception:
        return None


def analyze_image_quality(image_data: str) -> Dict[str, Any]:
    """
    分析古籍图像质量
    
    Returns:
        {
            "brightness": float,      # 亮度 (0-255)
            "contrast": float,        # 对比度
            "is_yellowed": bool,      # 是否泛黄
            "is_faded": bool,         # 是否褪色
            "noise_level": float,     # 噪点水平
            "suggested_enhance": str  # 建议的增强方式
        }
    """
    if not PIL_AVAILABLE:
        return {"error": "PIL not available"}
    
    image_bytes = _decode_image(image_data)
    if not image_bytes:
        return {"error": "Invalid image data"}
    
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            # 转换为灰度图分析
            gray = img.convert('L')
            stat = ImageStat.Stat(gray)
            
            # 亮度分析
            brightness = stat.mean[0]
            
            # 对比度分析（使用标准差）
            contrast = stat.stddev[0]
            
            # 检测泛黄（分析 RGB 比例）
            rgb_img = img.convert('RGB')
            rgb_stat = ImageStat.Stat(rgb_img)
            r, g, b = rgb_stat.mean
            # 泛黄：R 和 G 较高，B 较低
            is_yellowed = (r > 180 and g > 170 and b < 150 and r > b + 30)
            
            # 检测褪色（对比度低且亮度高）
            is_faded = contrast < 30 and brightness > 180
            
            # 估算噪点水平
            edges = gray.filter(ImageFilter.FIND_EDGES)
            edge_stat = ImageStat.Stat(edges)
            noise_level = edge_stat.stddev[0]
            
            # 建议增强方式
            suggested = "normal"
            if is_yellowed:
                suggested = "remove_yellow"
            elif is_faded:
                suggested = "enhance_ink"
            elif contrast < 40:
                suggested = "enhance_contrast"
            elif noise_level > 50:
                suggested = "denoise"
            
            return {
                "brightness": round(brightness, 2),
                "contrast": round(contrast, 2),
                "is_yellowed": is_yellowed,
                "is_faded": is_faded,
                "noise_level": round(noise_level, 2),
                "suggested_enhance": suggested,
                "color_balance": {"r": round(r, 2), "g": round(g, 2), "b": round(b, 2)}
            }
            
    except Exception as e:
        return {"error": str(e)}


def remove_yellow_background(image_data: str, strength: float = 1.0) -> str:
    """
    去除泛黄背景
    
    Args:
        image_data: Base64 图片数据
        strength: 去黄强度 (0.0-2.0)
    
    Returns:
        处理后的 base64 图片
    """
    if not PIL_AVAILABLE:
        return ""
    
    image_bytes = _decode_image(image_data)
    if not image_bytes:
        return ""
    
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            # 转换为 RGB
            img = img.convert('RGB')
            
            # 分离通道
            r, g, b = img.split()
            
            # 降低黄色成分（红色和绿色通道）
            if strength > 0:
                # 计算黄色区域掩码
                yellow_mask = ImageChops.subtract(r, b).point(lambda x: 255 if x > 20 else 0)
                
                # 降低红绿通道亮度
                r = r.point(lambda x: int(x * (1 - 0.1 * strength)) if x > 180 else x)
                g = g.point(lambda x: int(x * (1 - 0.08 * strength)) if x > 170 else x)
                
                # 合并通道
                img = Image.merge('RGB', (r, g, b))
            
            # 自动对比度增强
            img = ImageOps.autocontrast(img, cutoff=1)
            
            # 转换为 base64
            buffer = BytesIO()
            img.save(buffer, format='JPEG', quality=95, optimize=True)
            encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return f"data:image/jpeg;base64,{encoded}"
            
    except Exception as e:
        print(f"[ClassicalBook] Remove yellow failed: {e}")
        return ""


def enhance_faded_ink(image_data: str, strength: float = 1.5) -> str:
    """
    增强褪色的墨迹
    
    Args:
        image_data: Base64 图片数据
        strength: 增强强度
    
    Returns:
        处理后的 base64 图片
    """
    if not PIL_AVAILABLE:
        return ""
    
    image_bytes = _decode_image(image_data)
    if not image_bytes:
        return ""
    
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            img = img.convert('RGB')
            
            # 自动对比度
            img = ImageOps.autocontrast(img, cutoff=2)
            
            # 增强对比度
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(strength)
            
            # 增强锐度（让模糊的字迹更清晰）
            sharp_enhancer = ImageEnhance.Sharpness(img)
            img = sharp_enhancer.enhance(1.3)
            
            # 轻微去噪
            img = img.filter(ImageFilter.MedianFilter(size=3))
            
            # 二值化边缘增强
            gray = img.convert('L')
            
            # 使用自适应阈值
            from PIL import ImageFilter
            blurred = gray.filter(ImageFilter.GaussianBlur(radius=2))
            
            # 增强黑色区域（墨迹）
            img = ImageEnhance.Brightness(img).enhance(0.95)
            img = ImageEnhance.Contrast(img).enhance(1.2)
            
            buffer = BytesIO()
            img.save(buffer, format='JPEG', quality=95, optimize=True)
            encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return f"data:image/jpeg;base64,{encoded}"
            
    except Exception as e:
        print(f"[ClassicalBook] Enhance ink failed: {e}")
        return ""


def remove_stains(image_data: str, stain_size: int = 3) -> str:
    """
    去除污渍斑点
    
    Args:
        image_data: Base64 图片数据
        stain_size: 污渍大小估计
    
    Returns:
        处理后的 base64 图片
    """
    if not PIL_AVAILABLE:
        return ""
    
    image_bytes = _decode_image(image_data)
    if not image_bytes:
        return ""
    
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            img = img.convert('RGB')
            
            # 中值滤波去除小斑点
            img = img.filter(ImageFilter.MedianFilter(size=stain_size * 2 + 1))
            
            # 轻微模糊后再锐化，平滑污渍区域
            img = img.filter(ImageFilter.SMOOTH_MORE)
            
            buffer = BytesIO()
            img.save(buffer, format='JPEG', quality=95, optimize=True)
            encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return f"data:image/jpeg;base64,{encoded}"
            
    except Exception as e:
        print(f"[ClassicalBook] Remove stains failed: {e}")
        return ""


def enhance_classical_book(image_data: str, mode: str = "auto") -> Tuple[str, Dict[str, Any]]:
    """
    古籍综合增强处理
    
    Args:
        image_data: Base64 图片数据
        mode: 处理模式 (auto, remove_yellow, enhance_ink, denoise, high_contrast)
    
    Returns:
        (处理后的图片base64, 处理信息)
    """
    if not PIL_AVAILABLE:
        return image_data, {"error": "PIL not available"}
    
    # 分析图像质量
    analysis = analyze_image_quality(image_data)
    
    if "error" in analysis:
        return image_data, analysis
    
    # 自动模式：根据分析结果选择处理方式
    if mode == "auto":
        mode = analysis.get("suggested_enhance", "normal")
    
    processed = ""
    info = {
        "mode": mode,
        "analysis": analysis,
        "applied": []
    }
    
    if mode == "remove_yellow" and analysis.get("is_yellowed"):
        processed = remove_yellow_background(image_data, strength=1.2)
        info["applied"].append("remove_yellow")
    
    elif mode == "enhance_ink" and analysis.get("is_faded"):
        processed = enhance_faded_ink(image_data, strength=1.6)
        info["applied"].append("enhance_ink")
    
    elif mode == "denoise":
        processed = remove_stains(image_data, stain_size=2)
        info["applied"].append("denoise")
    
    elif mode == "enhance_contrast":
        # 通用对比度增强
        try:
            image_bytes = _decode_image(image_data)
            with Image.open(BytesIO(image_bytes)) as img:
                img = img.convert('RGB')
                img = ImageOps.autocontrast(img, cutoff=2)
                enhancer = ImageEnhance.Contrast(img)
                img = enhancer.enhance(1.5)
                
                buffer = BytesIO()
                img.save(buffer, format='JPEG', quality=95, optimize=True)
                encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')
                processed = f"data:image/jpeg;base64,{encoded}"
                info["applied"].append("enhance_contrast")
        except Exception as e:
            info["error"] = str(e)
    
    # 如果没有应用任何处理，返回原图
    if not processed:
        processed = image_data
        info["applied"].append("none")
    
    return processed, info


# 导入 ImageChops 用于通道操作
try:
    from PIL import ImageChops
except ImportError:
    pass


def detect_defective_chars(text: str) -> list:
    """
    检测可能的残缺字（用于 OCR 结果后处理）
    
    Returns:
        残缺字位置列表
    """
    defective = []
    
    # 检测常见残缺字模式
    for i, char in enumerate(text):
        # 检测占位符
        if char in '□■◆◇▪●○':
            defective.append({
                "index": i,
                "char": char,
                "type": "placeholder",
                "suggestion": "无法识别的字"
            })
        # 检测异常字符
        elif ord(char) > 0x9FFF or ord(char) < 0x4E00:
            if not char.isalnum() and char not in '，。、；：？！「」『』（）【】…—～· ':
                defective.append({
                    "index": i,
                    "char": char,
                    "type": "abnormal",
                    "suggestion": "非标准字符"
                })
    
    return defective


# 异体字对照表（常见古籍异体字）
VARIANT_CHARS = {
    '衆': ['眾'],
    '為': ['爲'],
    '無': ['无'],
    '國': ['国'],
    '會': ['会'],
    '來': ['来'],
    '時': ['时'],
    '從': ['从'],
    '書': ['书'],
    '東': ['东'],
    '車': ['车'],
    '馬': ['马'],
    '魚': ['鱼'],
    '門': ['门'],
    '見': ['见'],
    '貝': ['贝'],
    '頁': ['页'],
    '風': ['风'],
    '飛': ['飞'],
    '食': ['饣'],
    '金': ['钅'],
    '言': ['讠'],
    '糸': ['纟'],
}


def get_char_variants(char: str) -> list:
    """获取字符的异体字列表"""
    # 检查正字到异体字
    if char in VARIANT_CHARS:
        return VARIANT_CHARS[char]
    
    # 检查异体字到正字
    for standard, variants in VARIANT_CHARS.items():
        if char in variants:
            return [standard] + [v for v in variants if v != char]
    
    return []


def enhance_text_with_variants(text: str) -> Dict[str, Any]:
    """
    增强 OCR 文本，添加异体字信息
    
    Returns:
        {
            "text": str,
            "variants": [{"index": int, "char": str, "variants": [...]}],
            "defective": [...]
        }
    """
    variants_info = []
    defective_info = detect_defective_chars(text)
    
    for i, char in enumerate(text):
        variants = get_char_variants(char)
        if variants:
            variants_info.append({
                "index": i,
                "char": char,
                "variants": variants
            })
    
    return {
        "text": text,
        "variants": variants_info,
        "defective": defective_info,
        "has_variants": len(variants_info) > 0,
        "has_defective": len(defective_info) > 0
    }
