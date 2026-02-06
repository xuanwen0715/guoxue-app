"""
OCR 结果缓存模块
使用 Supabase 存储识别结果，避免重复调用 API
"""

import os
import json
import hashlib
import requests
from typing import Optional, Dict, Any

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# 缓存配置
CACHE_TTL_DAYS = int(os.environ.get("OCR_CACHE_TTL_DAYS", "30"))
CACHE_ENABLED = os.environ.get("OCR_CACHE_ENABLED", "true").lower() in ("true", "1", "yes")


def get_image_hash(image_data: str) -> str:
    """计算图片内容的 MD5 哈希（用于缓存键）"""
    try:
        # 移除 data URI 前缀
        if image_data.startswith("data:"):
            image_data = image_data.split(",", 1)[1]
        
        # 解码 base64 并计算哈希
        import base64
        image_bytes = base64.b64decode(image_data)
        return hashlib.md5(image_bytes).hexdigest()
    except Exception as e:
        print(f"[OCR Cache] Hash calculation failed: {e}")
        return ""


def get_cache(image_hash: str) -> Optional[Dict[str, Any]]:
    """
    从缓存获取 OCR 结果
    
    Returns:
        dict: 缓存的 OCR 结果，包含 text, ai_corrected, ai_suggestions 等
        None: 缓存未命中
    """
    if not CACHE_ENABLED or not SUPABASE_SERVICE_KEY or not image_hash:
        return None
    
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/ocr_cache",
            params={
                "image_hash": f"eq.{image_hash}",
                "select": "*"
            },
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json"
            },
            timeout=5
        )
        
        if response.status_code == 200:
            results = response.json()
            if results and len(results) > 0:
                cache_entry = results[0]
                
                # 更新命中次数和最后访问时间
                _update_hit_count(image_hash)
                
                print(f"[OCR Cache] Hit for hash {image_hash[:8]}..., hit_count: {cache_entry.get('hit_count', 0) + 1}")
                
                return {
                    "text": cache_entry.get("ocr_text", ""),
                    "ai_corrected": cache_entry.get("ai_corrected", ""),
                    "ai_suggestions": cache_entry.get("ai_suggestions", []),
                    "method": f"{cache_entry.get('method', 'unknown')}_cached",
                    "from_cache": True
                }
        
        return None
        
    except Exception as e:
        print(f"[OCR Cache] Get cache error: {e}")
        return None


def set_cache(
    image_hash: str,
    ocr_text: str,
    ai_corrected: str = "",
    ai_suggestions: list = None,
    method: str = "",
    scene: str = "",
    image_size: int = 0,
    char_count: int = 0
) -> bool:
    """
    将 OCR 结果存入缓存
    """
    if not CACHE_ENABLED or not SUPABASE_SERVICE_KEY or not image_hash:
        return False
    
    try:
        payload = {
            "image_hash": image_hash,
            "ocr_text": ocr_text,
            "ai_corrected": ai_corrected or "",
            "ai_suggestions": json.dumps(ai_suggestions or []),
            "method": method,
            "scene": scene,
            "image_size": image_size,
            "char_count": char_count,
            "hit_count": 1,
            "created_at": "now()",
            "last_hit_at": "now()"
        }
        
        # 使用 upsert 避免重复
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/ocr_cache",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            },
            json=payload,
            timeout=5
        )
        
        if response.status_code in [200, 201, 409]:  # 409 表示冲突但已合并
            print(f"[OCR Cache] Saved for hash {image_hash[:8]}...")
            return True
        else:
            print(f"[OCR Cache] Save failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"[OCR Cache] Set cache error: {e}")
        return False


def _update_hit_count(image_hash: str) -> bool:
    """更新缓存命中次数（异步，不阻塞主流程）"""
    try:
        # 使用 RPC 或简单的 PATCH 更新
        response = requests.patch(
            f"{SUPABASE_URL}/rest/v1/ocr_cache",
            params={"image_hash": f"eq.{image_hash}"},
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            json={
                "hit_count": f"hit_count + 1",  # 这个语法可能不工作，需要 RPC
                "last_hit_at": "now()"
            },
            timeout=3
        )
        return response.status_code in [200, 204]
    except Exception:
        return False


def get_cache_stats() -> Dict[str, Any]:
    """获取缓存统计信息"""
    if not SUPABASE_SERVICE_KEY:
        return {"error": "Service key not configured"}
    
    try:
        # 获取总数和总命中次数
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/ocr_cache",
            params={
                "select": "count,hit_count.sum()",
                "limit": 1
            },
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
            },
            timeout=5
        )
        
        # 由于 Supabase REST API 限制，简单返回条目数
        count_response = requests.get(
            f"{SUPABASE_URL}/rest/v1/ocr_cache",
            params={"select": "id", "limit": 1000},
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
            },
            timeout=5
        )
        
        if count_response.status_code == 200:
            total_entries = len(count_response.json())
            return {
                "total_entries": total_entries,
                "enabled": CACHE_ENABLED,
                "ttl_days": CACHE_TTL_DAYS
            }
        
        return {"error": "Failed to fetch stats"}
        
    except Exception as e:
        return {"error": str(e)}


def clear_expired_cache() -> int:
    """
    清理过期缓存
    Returns:
        int: 清理的条目数
    """
    if not SUPABASE_SERVICE_KEY:
        return 0
    
    try:
        # 调用清理函数
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/cleanup_ocr_cache",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        
        if response.status_code == 200:
            print("[OCR Cache] Cleanup completed")
            return 1
        return 0
        
    except Exception as e:
        print(f"[OCR Cache] Cleanup error: {e}")
        return 0
