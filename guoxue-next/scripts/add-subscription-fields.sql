-- ========================================
-- 为 profiles 表添加订阅相关字段
-- 运行方式：Supabase Dashboard → SQL Editor → 粘贴运行
-- ========================================

-- 添加 Paddle 相关字段（如果不存在）
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_profiles_paddle_customer_id
ON public.profiles(paddle_customer_id);

CREATE INDEX IF NOT EXISTS idx_profiles_paddle_subscription_id
ON public.profiles(paddle_subscription_id);

-- 验证字段是否添加成功
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;
