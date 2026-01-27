const { createClient } = require('@supabase/supabase-js');

function isSubscriptionActive(profile) {
  if (profile.subscription_status === 'active') return true;

  if (profile.subscription_status === 'trialing') {
    if (!profile.current_period_end) return true;
    const periodEnd = new Date(profile.current_period_end);
    return periodEnd > new Date();
  }

  if (!profile.subscription_status && profile.is_premium) return true;

  return false;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      res.status(500).json({ error: 'Supabase configuration missing' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !authData?.user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_premium, subscription_status, current_period_end, credits_remaining')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[User Subscription] Error fetching profile:', profileError);
      res.status(500).json({ error: 'Failed to fetch subscription' });
      return;
    }

    if (!profile) {
      res.status(200).json({
        is_premium: false,
        subscription_status: null,
        current_period_end: null,
        credits_remaining: 5,
      });
      return;
    }

    const isPremiumActive = isSubscriptionActive(profile);

    if (profile.is_premium && !isPremiumActive) {
      await supabaseAdmin
        .from('profiles')
        .update({
          is_premium: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authData.user.id);
    }

    res.status(200).json({
      is_premium: isPremiumActive,
      subscription_status: profile.subscription_status,
      current_period_end: profile.current_period_end,
      credits_remaining: profile.credits_remaining ?? 5,
    });
  } catch (error) {
    console.error('[User Subscription] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
