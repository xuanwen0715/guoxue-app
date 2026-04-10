"""
启动时环境变量检查
"""
import os


def check_environment():
    """检查必要的环境变量"""
    # 必需的环境变量
    required = []
    optional = [
        "DASHSCOPE_API_KEY",
        "ALIBABA_CLOUD_ACCESS_KEY_ID",
        "ALIBABA_CLOUD_ACCESS_KEY_SECRET",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_KEY",
    ]
    
    missing = []
    found = []
    
    for var in required:
        if os.environ.get(var):
            found.append(var)
        else:
            missing.append(var)
    
    print("\n" + "="*50)
    print("📋 环境变量检查")
    print("="*50)
    
    if found:
        print(f"✅ 已配置: {', '.join(found)}")
    
    if missing:
        print(f"❌ 缺失 (必需): {', '.join(missing)}")
    else:
        print("✅ 必填项已全部配置")
    
    # 显示可选环境变量状态
    optional_found = [v for v in optional if os.environ.get(v)]
    if optional_found:
        print(f"🔍 可选: {', '.join(optional_found)}")
    
    print("="*50 + "\n")
    
    return len(missing) == 0


# 可选：导出需要的变量检查函数
def require_keys(*keys):
    """检查指定的环境变量是否存在"""
    missing = [k for k in keys if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f"缺少必要的环境变量: {', '.join(missing)}")
