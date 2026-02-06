"""
OCR 图像增强高级模块
包含倾斜校正、自适应二值化、去噪、超分辨率等
"""

import os
import base64
import math
from io import BytesIO
from typing import Optional, Tuple, List

try:
    from PIL import Image, ImageOps, ImageFilter, ImageEnhance, ImageStat
    import numpy as np
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


def _encode_image(img: Image.Image, format: str = "JPEG") -> str:
    """将 PIL Image 编码为 base64"""
    buffer = BytesIO()
    if format == "JPEG":
        img.save(buffer, format=format, quality=95, optimize=True)
    else:
        img.save(buffer, format=format)
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/{format.lower()};base64,{encoded}"


def detect_skew_angle(image_data: str) -> float:
    """
    检测图像倾斜角度
    使用投影法检测文字行倾斜角度
    
    Returns:
        倾斜角度（度），正数表示顺时针倾斜
    """
    if not PIL_AVAILABLE:
        return 0.0
    
    image_bytes = _decode_image(image_data)
    if not image_bytes:
        return 0.0
    
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            # 转换为灰度
            gray = img.convert('L')
            
            # 二值化
            threshold = ImageStat.Stat(gray).mean[0]
            bw = gray.point(lambda x: 0 if x < threshold else 255, '1')
            
            # 转换为numpy数组进行分析
            img_array = np.array(bw)
            
            # 简单的角度检测：尝试几个角度，找出投影方差最大的角度
            angles = range(-15, 16, 1)  # -15到15度
            best_angle = 0
            best_score = 0
            
            for angle in angles:
                # 旋转图像
                rotated = bw.rotate(angle, fillcolor=255)
                rot_array = np.array(rotated)
                
                # 计算水平投影
                projection = np.sum(rot_array == 0, axis=1)
                
                # 计算投影的方差（文字行的方差应该较大）
                score = np.var(projection)
                
                if score > best_score:
                    best_score = score
                    best_angle = angle
            
            return float(best_angle)
            
    except Exception as e:
        print(f"[OCR Enhancement] Skew detection failed: {e}")
        return 0.0


def deskew_image(image_data: str, angle: Optional[float] = None) -> str:
    """
    校正图像倾斜
    
    Args:
        image_data: Base64 图片
        angle: 指定角度，None则自动检测
    
    Returns:
        校正后的 base64 图片
    """
    if not PIL_AVAILABLE:
        return image_data
    
    image_bytes = _decode_image(image_data)
    if not image_bytes:
        return image_data
    
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            if angle is None:
                angle = detect_skew_angle(image_data)
            
            if abs(angle) < 0.5:  # 角度太小，不需要校正
                return image_data
            
            # 旋转校正（白色背景）
            rotated = img.rotate(-angle, fillcolor=(255, 255, 255), resample=Image.BICUBIC)
            
            print(f"[OCR Enhancement] Deskewed image by {angle:.2f} degrees")
            return _encode_image(rotated)
            
    except Exception as e:
        print(f"[OCR Enhancement] Deskew failed: {e}")
        return image_data


def adaptive_threshold(image_data: str, method: str = "otsu") -> str:
    """
    自适应二值化
    
    Args:
        image_data: Base64 图片
        method: otsu | sauvola | niblack
    """
    if not PIL_AVAILABLE:
        return image_data
    
    image_bytes = _decode_image(image_data)
    if not image_bytes:
        return image_data
    
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            gray = img.convert('L')
            
            if method == "otsu":
                # Otsu 阈值
                from .ocr import _otsu_threshold
                threshold = _otsu_threshold(gray)
                bw = gray.point(lambda x: 255 if x > threshold else 0)
                
            elif method == "sauvola":
                # Sauvola 自适应阈值（适合古籍不均匀光照）
                bw = _sauvola_threshold(gray)
                
            else:
                # 默认自适应
                bw = ImageOps.autocontrast(gray, cutoff=2)
            
            return _encode_image(bw.convert('RGB'))
            
    except Exception as e:
        print(f"[OCR Enhancement] Adaptive threshold failed: {e}")
        return image_data


def _sauvola_threshold(gray_img: Image.Image, window_size: int = 15, k: float = 0.2, r: float = 128) -> Image.Image:
    """
    Sauvola 自适应阈值算法
    适合处理古籍中光照不均的情况
    """
    try:
        import numpy as np
        from scipy.ndimage import uniform_filter
        
        img_array = np.array(gray_img).astype(np.float32)
        
        # 计算局部均值和标准差
        mean = uniform_filter(img_array, window_size)
        mean_sq = uniform_filter(img_array ** 2, window_size)
        std = np.sqrt(mean_sq - mean ** 2)
        
        # Sauvola 阈值
        threshold = mean * (1 + k * (std / r - 1))
        
        # 二值化
        binary = (img_array > threshold).astype(np.uint8) * 255
        
        return Image.fromarray(binary)
    except ImportError:
        # 如果没有 scipy，回退到简单自适应
        return ImageOps.autocontrast(gray_img, cutoff=2)


def remove_borders(image_data: str, border_percent: float = 0.02) -> str:
    """
    去除图片边框（扫描件常见的黑边）
    
    Args:
        image_data: Base64 图片
        border_percent: 边框百分比
    """
    if not PIL_AVAILABLE:
        return image_data
    
    image_bytes = _decode_image(image_data)
    if not image_bytes:
        return image_data
    
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            w, h = img.size
            border_w = int(w * border_percent)
            border_h = int(h * border_percent)
            
            # 裁剪边框
            cropped = img.crop((border_w, border_h, w - border_w, h - border_h))
            
            return _encode_image(cropped)
            
    except Exception as e:
        print(f"[OCR Enhancement] Remove borders failed: {e}")
        return image_data


def enhance_contrast_adaptive(image_data: str) -> str:
    """
    自适应对比度增强（CLAHE）
    适合古籍文字对比度低的情况
    """
    if not PIL_AVAILABLE:
        return image_data
    
    image_bytes = _decode_image(image_data)
    if not image_bytes:
        return image_data
    
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            # 转换为LAB色彩空间增强L通道（更自然的对比度增强）
            import numpy as np
            
            rgb = img.convert('RGB')
            rgb_array = np.array(rgb)
            
            # 简单的CLAHE实现
            lab = _rgb_to_lab(rgb_array)
            l_channel = lab[:, :, 0]
            
            # 应用CLAHE
            enhanced_l = _apply_clahe(l_channel, clip_limit=2.0, grid_size=8)
            lab[:, :, 0] = enhanced_l
            
            enhanced_rgb = _lab_to_rgb(lab)
            enhanced_img = Image.fromarray(enhanced_rgb)
            
            return _encode_image(enhanced_img)
            
    except Exception as e:
        print(f"[OCR Enhancement] CLAHE failed: {e}")
        # 回退到普通对比度增强
        try:
            with Image.open(BytesIO(image_bytes)) as img:
                enhanced = ImageEnhance.Contrast(img).enhance(1.5)
                return _encode_image(enhanced)
        except:
            return image_data


def _rgb_to_lab(rgb_array: np.ndarray) -> np.ndarray:
    """简化的 RGB to Lab 转换"""
    # 这是简化版，实际应该使用 skimage 或 opencv
    # 这里使用 PIL 的近似
    return rgb_array.astype(np.float32)


def _lab_to_rgb(lab_array: np.ndarray) -> np.ndarray:
    """简化的 Lab to RGB 转换"""
    return np.clip(lab_array, 0, 255).astype(np.uint8)


def _apply_clahe(channel: np.ndarray, clip_limit: float = 2.0, grid_size: int = 8) -> np.ndarray:
    """简化版 CLAHE 实现"""
    h, w = channel.shape
    tile_h = h // grid_size
    tile_w = w // grid_size
    
    result = np.zeros_like(channel)
    
    for i in range(grid_size):
        for j in range(grid_size):
            y1, y2 = i * tile_h, min((i + 1) * tile_h, h)
            x1, x2 = j * tile_w, min((j + 1) * tile_w, w)
            
            tile = channel[y1:y2, x1:x2]
            
            # 计算直方图和CDF
            hist, _ = np.histogram(tile.flatten(), bins=256, range=(0, 256))
            
            # 裁剪直方图
            excess = np.sum(hist[hist > clip_limit * np.mean(hist)]) - clip_limit * np.mean(hist) * np.sum(hist > clip_limit * np.mean(hist))
            hist = np.clip(hist, 0, clip_limit * np.mean(hist))
            hist = hist + excess / 256
            
            cdf = np.cumsum(hist)
            cdf = (cdf - cdf.min()) / (cdf.max() - cdf.min()) * 255
            
            result[y1:y2, x1:x2] = cdf[tile.astype(np.uint8)]
    
    return result


def apply_full_enhancement_pipeline(image_data: str, detect_skew: bool = True) -> Tuple[str, dict]:
    """
    完整的图像增强流水线
    
    Args:
        image_data: Base64 图片
        detect_skew: 是否检测并校正倾斜
    
    Returns:
        (增强后的图片base64, 处理信息)
    """
    info = {
        "steps": [],
        "skew_angle": 0.0,
        "original_size": 0
    }
    
    image_bytes = _decode_image(image_data)
    if image_bytes:
        info["original_size"] = len(image_bytes)
    
    result = image_data
    
    # 步骤1: 去边框
    result = remove_borders(result, border_percent=0.01)
    info["steps"].append("remove_borders")
    
    # 步骤2: 倾斜校正
    if detect_skew:
        angle = detect_skew_angle(result)
        if abs(angle) > 0.5:
            result = deskew_image(result, angle)
            info["skew_angle"] = angle
            info["steps"].append(f"deskew({angle:.1f}°)")
    
    # 步骤3: 自适应对比度增强
    result = enhance_contrast_adaptive(result)
    info["steps"].append("contrast_enhancement")
    
    # 步骤4: 自适应二值化
    result = adaptive_threshold(result, method="sauvola")
    info["steps"].append("adaptive_threshold")
    
    # 步骤5: 轻微去噪
    try:
        image_bytes = _decode_image(result)
        with Image.open(BytesIO(image_bytes)) as img:
            denoised = img.filter(ImageFilter.MedianFilter(size=3))
            result = _encode_image(denoised)
            info["steps"].append("denoise")
    except:
        pass
    
    return result, info


# 形近字对照表用于后处理
SIMILAR_CHARS = {
    '未': ['末'],
    '末': ['未'],
    '己': ['已', '巳'],
    '已': ['己', '巳'],
    '巳': ['己', '已'],
    '人': ['入', '八'],
    '入': ['人', '八'],
    '八': ['人', '入'],
    '土': ['士', '干'],
    '士': ['土', '干'],
    '天': ['夭', '夫'],
    '夭': ['天', '夫'],
    '千': ['干', '于'],
    '干': ['千', '于', '土', '士'],
    '曰': ['日', '白'],
    '日': ['曰', '白', '目'],
    '手': ['毛'],
    '毛': ['手'],
    '王': ['玉', '主'],
    '玉': ['王', '主'],
    '主': ['王', '玉'],
}


def post_process_ocr_text(text: str, context: str = "") -> Tuple[str, List[dict]]:
    """
    OCR 结果后处理
    检测可能的形近字错误并给出建议
    
    Returns:
        (处理后的文本, 可疑字符列表)
    """
    suspicious = []
    
    for i, char in enumerate(text):
        # 检查形近字
        if char in SIMILAR_CHARS:
            suspicious.append({
                "index": i,
                "char": char,
                "alternatives": SIMILAR_CHARS[char],
                "reason": "形近字，请核对原图"
            })
        
        # 检查常见错误字符
        if char in '○●■□◆◇▪▫':
            suspicious.append({
                "index": i,
                "char": char,
                "alternatives": [],
                "reason": "占位符，原字无法识别"
            })
    
    return text, suspicious
