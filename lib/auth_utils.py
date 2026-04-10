"""
Supabase 认证和用户管理工具模块
用于验证 JWT Token、检查用户权限和扣除积分
"""

import os
import json
import requests
from functools import wraps

# Supabase 配置（从环境变量读取）
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://dckeajeazaxbxlqlkicl.supabase.co")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# JWT 密钥（用于验证 token，从 Supabase Dashboard -> Settings -> API -> JWT Secret）
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")


class AuthError(Exception):
    """认证错误"""
    def __init__(self, message, code=401):
        self.message = message
        self.code = code
        super().__init__(self.message)


class QuotaError(Exception):
    """额度不足错误"""
    def __init__(self, message="免费额度已用完，请升级为付费用户", code=403):
        self.message = message
        self.code = code
        super().__init__(self.message)


def verify_token(authorization_header: str) -> dict:
    """
    验证 JWT Token 并返回用户信息

    Args:
        authorization_header: Authorization 请求头，格式为 "Bearer <token>"

    Returns:
        dict: 包含 user_id 等信息的字典

    Raises:
        AuthError: Token 无效或过期
    """
    if not authorization_header:
        raise AuthError("缺少认证信息，请先登录", 401)

    if not authorization_header.startswith("Bearer "):
        raise AuthError("认证格式错误", 401)

    token = authorization_header[7:]  # 去掉 "Bearer " 前缀

    if not token:
        raise AuthError("Token 为空", 401)

    # 使用 Supabase API 验证 token
    try:
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY
            },
            timeout=10
        )

        if response.status_code == 200:
            user_data = response.json()
            return {
                "user_id": user_data.get("id"),
                "email": user_data.get("email"),
                "token": token
            }
        elif response.status_code == 401:
            raise AuthError("登录已过期，请重新登录", 401)
        else:
            raise AuthError(f"认证失败: {response.status_code}", 401)

    except requests.RequestException as e:
        raise AuthError(f"认证服务暂时不可用: {str(e)}", 503)


def get_user_profile(user_id: str) -> dict:
    """
    获取用户档案（积分、会员状态等）

    Args:
        user_id: 用户 ID

    Returns:
        dict: 用户档案信息
    """
    if not SUPABASE_SERVICE_KEY:
        # 如果没有配置 service key，默认放行（开发模式）
        return {
            "id": user_id,
            "is_premium": True,
            "credits_remaining": 999
        }

    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={"id": f"eq.{user_id}", "select": "*"},
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json"
            },
            timeout=10
        )

        if response.status_code == 200:
            profiles = response.json()
            if profiles and len(profiles) > 0:
                return profiles[0]
            else:
                # 用户档案不存在，创建一个
                return create_user_profile(user_id)
        else:
            print(f"[Auth] Failed to get profile: {response.status_code} - {response.text}")
            # 出错时默认放行，避免影响用户体验
            return {"id": user_id, "is_premium": False, "credits_remaining": 10}

    except requests.RequestException as e:
        print(f"[Auth] Request error: {e}")
        return {"id": user_id, "is_premium": False, "credits_remaining": 10}


def create_user_profile(user_id: str, email: str = "") -> dict:
    """
    创建新用户档案
    """
    try:
        profile_data = {
            "id": user_id,
            "email": email,
            "is_premium": False,
            "credits_remaining": 10
        }

        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/profiles",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            json=profile_data,
            timeout=10
        )

        if response.status_code in [200, 201]:
            profiles = response.json()
            return profiles[0] if profiles else profile_data
        else:
            print(f"[Auth] Failed to create profile: {response.status_code}")
            return profile_data

    except Exception as e:
        print(f"[Auth] Create profile error: {e}")
        return {"id": user_id, "is_premium": False, "credits_remaining": 10}


def check_user_quota(user_id: str) -> dict:
    """
    检查用户是否有使用权限

    Returns:
        dict: {
            "allowed": bool,  # 是否允许使用
            "is_premium": bool,  # 是否付费用户
            "credits_remaining": int,  # 剩余积分
            "should_deduct": bool  # 是否需要扣除积分
        }

    Raises:
        QuotaError: 额度不足
    """
    profile = get_user_profile(user_id)

    is_premium = profile.get("is_premium", False)
    credits_remaining = profile.get("credits_remaining", 0)

    # 付费用户：直接放行
    if is_premium:
        return {
            "allowed": True,
            "is_premium": True,
            "credits_remaining": credits_remaining,
            "should_deduct": False
        }

    # 免费用户：检查积分
    if credits_remaining > 0:
        return {
            "allowed": True,
            "is_premium": False,
            "credits_remaining": credits_remaining,
            "should_deduct": True
        }

    # 积分用完
    raise QuotaError("免费额度已用完，请升级为付费用户")


def deduct_credit(user_id: str) -> bool:
    """
    扣除用户积分（-1）

    Args:
        user_id: 用户 ID

    Returns:
        bool: 是否成功
    """
    if not SUPABASE_SERVICE_KEY:
        return True

    try:
        # 使用 RPC 调用来原子性地扣除积分
        # 或者直接用 PATCH 更新

        # 先获取当前积分
        profile = get_user_profile(user_id)
        current_credits = profile.get("credits_remaining", 0)

        if current_credits <= 0:
            return False

        # 更新积分
        response = requests.patch(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={"id": f"eq.{user_id}"},
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json"
            },
            json={"credits_remaining": current_credits - 1},
            timeout=10
        )

        if response.status_code in [200, 204]:
            print(f"[Auth] Deducted 1 credit from user {user_id}, remaining: {current_credits - 1}")
            return True
        else:
            print(f"[Auth] Failed to deduct credit: {response.status_code}")
            return False

    except Exception as e:
        print(f"[Auth] Deduct credit error: {e}")
        return False


def auth_required(handler_func):
    """
    装饰器：要求用户认证
    用于包装 API handler
    """
    @wraps(handler_func)
    def wrapper(self, *args, **kwargs):
        try:
            # 获取 Authorization header
            auth_header = self.headers.get("Authorization", "")

            # 验证 token
            user_info = verify_token(auth_header)

            # 检查额度
            quota_info = check_user_quota(user_info["user_id"])

            # 将用户信息附加到 handler
            self.user_info = user_info
            self.quota_info = quota_info

            # 调用原始 handler
            return handler_func(self, *args, **kwargs)

        except AuthError as e:
            self._send_json(e.code, {"error": e.message, "code": "AUTH_ERROR"})
            return
        except QuotaError as e:
            self._send_json(e.code, {"error": e.message, "code": "QUOTA_EXCEEDED"})
            return

    return wrapper


# ====== 密码强度验证 ======
def validate_password_strength(password: str) -> tuple:
    """
    验证密码强度
    返回: (is_valid, message)
    """
    if len(password) < 6:
        return False, "密码长度至少6位"
    
    if len(password) > 32:
        return False, "密码长度不能超过32位"
    
    # 检查字符类型
    has_letter = any(c.isalpha() for c in password)
    has_digit = any(c.isdigit() for c in password)
    
    # 建议至少包含字母和数字
    if not (has_letter and has_digit):
        return True, "建议使用字母+数字组合"  # 只是建议，不强制
    
    return True, "密码强度良好"


# ====== Token 管理 ======
def create_token_payload(user_id: str, email: str) -> dict:
    """创建 token payload"""
    import time
    return {
        "user_id": user_id,
        "email": email,
        "iat": int(time.time()),
        "exp": int(time.time()) + 30 * 24 * 60 * 60  # 30天过期
    }


def is_token_expired(token_data: dict) -> bool:
    """检查 token 是否过期"""
    import time
    exp = token_data.get("exp", 0)
    return time.time() > exp


def get_token_remaining_time(token_data: dict) -> int:
    """获取 token 剩余有效时间（秒）"""
    import time
    exp = token_data.get("exp", 0)
    remaining = exp - time.time()
    return max(0, int(remaining))
