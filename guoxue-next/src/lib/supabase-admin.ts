import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 延迟初始化，避免构建时报错
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    // 在函数内部读取环境变量，确保运行时才获取
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Supabase configuration is missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
      );
    }

    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabaseAdmin;
}

// 用户订阅状态
export interface UserSubscription {
  id: string;
  user_id: string;
  paddle_customer_id: string | null;
  paddle_subscription_id: string | null;
  is_premium: boolean;
  credits_remaining: number;
  subscription_status: 'active' | 'canceled' | 'past_due' | 'paused' | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

// 获取用户订阅信息
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Supabase] Error fetching user subscription:', error);
    return null;
  }

  return data as UserSubscription;
}

// 更新用户为付费用户
export async function updateUserToPremium(
  userId: string,
  paddleCustomerId: string,
  paddleSubscriptionId: string,
  currentPeriodEnd: Date
) {
  const { error } = await getSupabaseAdmin()
    .from('profiles')
    .upsert({
      id: userId,
      paddle_customer_id: paddleCustomerId,
      paddle_subscription_id: paddleSubscriptionId,
      is_premium: true,
      subscription_status: 'active',
      current_period_end: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[Supabase] Error updating user to premium:', error);
    throw error;
  }
}

// 取消用户订阅
export async function cancelUserSubscription(paddleSubscriptionId: string) {
  const { error } = await getSupabaseAdmin()
    .from('profiles')
    .update({
      is_premium: false,
      subscription_status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', paddleSubscriptionId);

  if (error) {
    console.error('[Supabase] Error canceling subscription:', error);
    throw error;
  }
}

// 根据 Paddle Customer ID 获取用户
export async function getUserByPaddleCustomerId(paddleCustomerId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('*')
    .eq('paddle_customer_id', paddleCustomerId)
    .single();

  if (error) {
    console.error('[Supabase] Error fetching user by paddle customer id:', error);
    return null;
  }

  return data;
}

// 根据 Paddle Subscription ID 获取用户
export async function getUserByPaddleSubscriptionId(paddleSubscriptionId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('*')
    .eq('paddle_subscription_id', paddleSubscriptionId)
    .single();

  if (error) {
    console.error('[Supabase] Error fetching user by paddle subscription id:', error);
    return null;
  }

  return data;
}

// 更新订阅状态
export async function updateSubscriptionStatus(
  paddleSubscriptionId: string,
  status: 'active' | 'canceled' | 'past_due' | 'paused',
  currentPeriodEnd?: Date
) {
  const updateData: Record<string, unknown> = {
    subscription_status: status,
    is_premium: status === 'active',
    updated_at: new Date().toISOString(),
  };

  if (currentPeriodEnd) {
    updateData.current_period_end = currentPeriodEnd.toISOString();
  }

  const { error } = await getSupabaseAdmin()
    .from('profiles')
    .update(updateData)
    .eq('paddle_subscription_id', paddleSubscriptionId);

  if (error) {
    console.error('[Supabase] Error updating subscription status:', error);
    throw error;
  }
}
