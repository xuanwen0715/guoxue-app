import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
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

    // 使用 service role 获取用户的 Paddle customer ID
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('paddle_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[User Portal] Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    if (!profile?.paddle_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    // 调用 Paddle API 获取客户门户链接
    const paddleApiKey = process.env.PADDLE_API_KEY;
    if (!paddleApiKey) {
      console.error('[User Portal] Paddle API key not configured');
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
    }

    const paddleEnvironment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || 'sandbox';
    const paddleApiUrl = paddleEnvironment === 'production'
      ? 'https://api.paddle.com'
      : 'https://sandbox-api.paddle.com';

    const response = await fetch(
      `${paddleApiUrl}/customers/${profile.paddle_customer_id}/portal-sessions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paddleApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[User Portal] Paddle API error:', response.status, errorData);
      return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
    }

    const data = await response.json();
    const portalUrl = data.data?.urls?.general?.overview;

    if (!portalUrl) {
      console.error('[User Portal] No portal URL in response:', data);
      return NextResponse.json({ error: 'Failed to get portal URL' }, { status: 500 });
    }

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    console.error('[User Portal] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
