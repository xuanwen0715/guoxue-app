-- ========================================
-- Supabase 安全问题修复脚本
-- 运行方式：Supabase Dashboard → SQL Editor → 粘贴运行
-- ========================================

-- ========================================
-- 1. 修复 RLS (Row Level Security) 问题
-- ========================================

-- 为 idioms 表启用 RLS
ALTER TABLE public.idioms ENABLE ROW LEVEL SECURITY;

-- 为 words 表启用 RLS
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

-- 为 idioms 表添加公开读取策略（字典数据，所有人可读）
DROP POLICY IF EXISTS "Allow public read access" ON public.idioms;
CREATE POLICY "Allow public read access" ON public.idioms
  FOR SELECT
  USING (true);

-- 为 words 表添加公开读取策略（字典数据，所有人可读）
DROP POLICY IF EXISTS "Allow public read access" ON public.words;
CREATE POLICY "Allow public read access" ON public.words
  FOR SELECT
  USING (true);

-- 只允许 service_role 写入（通过后端 API）
DROP POLICY IF EXISTS "Allow service role full access" ON public.idioms;
CREATE POLICY "Allow service role full access" ON public.idioms
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow service role full access" ON public.words;
CREATE POLICY "Allow service role full access" ON public.words
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ========================================
-- 2. 修复 Function Search Path 问题
-- ========================================

-- 修复 handle_new_user 函数的 search_path
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- ========================================
-- 3. 验证修复结果
-- ========================================

-- 检查 RLS 是否已启用
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('idioms', 'words');

-- 检查策略是否已创建
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('idioms', 'words');
