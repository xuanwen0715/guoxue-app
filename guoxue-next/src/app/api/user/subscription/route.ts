import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 检查订阅是否仍然有效
function isSubscriptionActive(profile: {
  is_premium: boolean;
  subscription_status: string | null;
  current_period_end: string | null;
}): boolean {
  // 如果是活跃订阅，直接返回 true
  if (profile.subscription_status === 'active') return true;

  // 试用期订阅，仅在有效期内允许访问
  if (profile.subscription_status === 'trialing') {
    if (!profile.current_period_end) return true;
    const periodEnd = new Date(profile.current_period_end);
    return periodEnd > new Date();
  }

  // 兼容历史数据：旧字段仍标记为 premium 时允许访问
  if (!profile.subscription_status && profile.is_premium) return true;

  return false;
}

export async function GET(request: NextRequest) {
  try {
    // 从 Authorization header 获取 token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // 使用 anon key 验证用户 token
    const supabaseAnon = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 使用 service role 获取用户订阅信息
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_premium, subscription_status, current_period_end, credits_remaining')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[User Subscription] Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
    }

    // 如果没有 profile 记录，返回默认值
    if (!profile) {
      return NextResponse.json({
        is_premium: false,
        subscription_status: null,
        current_period_end: null,
        credits_remaining: 5, // 默认免费额度
      });
    }

    // 检查订阅是否仍然有效
    const isPremiumActive = isSubscriptionActive(profile);

    // 如果订阅已过期，更新数据库
    if (profile.is_premium && !isPremiumActive) {
      await supabaseAdmin
        .from('profiles')
        .update({
          is_premium: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    return NextResponse.json({
      is_premium: isPremiumActive,
      subscription_status: profile.subscription_status,
      current_period_end: profile.current_period_end,
      credits_remaining: profile.credits_remaining ?? 5,
    });
  } catch (error) {
    console.error('[User Subscription] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
