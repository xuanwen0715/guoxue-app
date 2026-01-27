const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const MAX_TIMESTAMP_DRIFT_SECONDS = 300;

function verifyPaddleWebhook(rawBody, signature) {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return false;
  }

  try {
    const parts = signature.split(';');
    const timestampPart = parts.find((part) => part.startsWith('ts='));
    const signaturePart = parts.find((part) => part.startsWith('h1='));

    if (!timestampPart || !signaturePart) {
      return false;
    }

    const timestamp = timestampPart.split('=')[1];
    const receivedSignature = signaturePart.split('=')[1];

    const timestampNum = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (Number.isNaN(timestampNum) || Math.abs(currentTime - timestampNum) > MAX_TIMESTAMP_DRIFT_SECONDS) {
      return false;
    }

    const signedPayload = `${timestamp}:${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    if (receivedSignature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[Paddle Webhook] Signature verification error:', error);
    return false;
  }
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

let supabaseAdmin = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Supabase configuration is missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      );
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAdmin;
}

async function updateUserToPremium(
  userId,
  paddleCustomerId,
  paddleSubscriptionId,
  currentPeriodEnd,
  status = 'active'
) {
  const { error } = await getSupabaseAdmin()
    .from('profiles')
    .upsert({
      id: userId,
      paddle_customer_id: paddleCustomerId,
      paddle_subscription_id: paddleSubscriptionId,
      is_premium: status === 'active' || status === 'trialing',
      subscription_status: status,
      current_period_end: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[Supabase] Error updating user to premium:', error);
    throw error;
  }
}

async function cancelUserSubscription(paddleSubscriptionId) {
  const { error } = await getSupabaseAdmin()
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      is_premium: false,
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', paddleSubscriptionId);

  if (error) {
    console.error('[Supabase] Error canceling subscription:', error);
    throw error;
  }
}

async function getUserByPaddleCustomerId(paddleCustomerId) {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('*')
    .eq('paddle_customer_id', paddleCustomerId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Error fetching user by paddle customer id:', error);
    return null;
  }

  return data;
}

async function getUserByPaddleSubscriptionId(paddleSubscriptionId) {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('*')
    .eq('paddle_subscription_id', paddleSubscriptionId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Error fetching user by paddle subscription id:', error);
    return null;
  }

  return data;
}

async function updateSubscriptionStatus(
  paddleSubscriptionId,
  status,
  currentPeriodEnd
) {
  const updateData = {
    subscription_status: status,
    is_premium: status === 'active' || status === 'trialing',
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['paddle-signature'] || '';

    if (!verifyPaddleWebhook(rawBody, signature)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (error) {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }

    const eventType = event.event_type;

    switch (eventType) {
      case 'subscription.created':
      case 'subscription.activated': {
        const subscriptionId = event.data.id;
        const customerId = event.data.customer_id;
        const customData = event.data.custom_data || {};
        const userId = customData.userId;
        const rawStatus = event.data.status;
        const mappedStatus = rawStatus === 'trialing' ? 'trialing' : 'active';
        const fallbackDays = mappedStatus === 'trialing' ? 7 : 30;
        const currentPeriodEnd = event.data.current_billing_period?.ends_at
          ? new Date(event.data.current_billing_period.ends_at)
          : new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000);

        if (userId) {
          await updateUserToPremium(userId, customerId, subscriptionId, currentPeriodEnd, mappedStatus);
        } else if (customerId) {
          const user = await getUserByPaddleCustomerId(customerId);
          if (user?.id) {
            await updateUserToPremium(user.id, customerId, subscriptionId, currentPeriodEnd, mappedStatus);
          }
        }
        break;
      }

      case 'subscription.updated': {
        const subscriptionId = event.data.id;
        const status = event.data.status;
        const periodEndRaw = event.data.current_billing_period?.ends_at;
        const currentPeriodEnd = periodEndRaw ? new Date(periodEndRaw) : undefined;

        let mappedStatus;
        switch (status) {
          case 'active':
            mappedStatus = 'active';
            break;
          case 'trialing':
            mappedStatus = 'trialing';
            break;
          case 'canceled':
            mappedStatus = 'canceled';
            break;
          case 'past_due':
            mappedStatus = 'past_due';
            break;
          case 'paused':
            mappedStatus = 'paused';
            break;
          case 'inactive':
            mappedStatus = 'canceled';
            break;
          default:
            res.status(200).json({ received: true });
            return;
        }

        await updateSubscriptionStatus(subscriptionId, mappedStatus, currentPeriodEnd);
        break;
      }

      case 'subscription.canceled': {
        const subscriptionId = event.data.id;
        await cancelUserSubscription(subscriptionId);
        break;
      }

      case 'subscription.paused': {
        const subscriptionId = event.data.id;
        await updateSubscriptionStatus(subscriptionId, 'paused');
        break;
      }

      case 'subscription.resumed': {
        const subscriptionId = event.data.id;
        const periodEndRaw = event.data.current_billing_period?.ends_at;
        const currentPeriodEnd = periodEndRaw ? new Date(periodEndRaw) : undefined;
        await updateSubscriptionStatus(subscriptionId, 'active', currentPeriodEnd);
        break;
      }

      case 'transaction.completed': {
        const subscriptionId = event.data.subscription_id;
        const customData = event.data.custom_data || {};
        const userId = customData.userId;
        const customerId = event.data.customer_id;

        if (userId && subscriptionId) {
          let currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          if (event.data.billing_period?.ends_at) {
            currentPeriodEnd = new Date(event.data.billing_period.ends_at);
          }
          await updateUserToPremium(userId, customerId, subscriptionId, currentPeriodEnd, 'active');
        } else if (subscriptionId) {
          const user = await getUserByPaddleSubscriptionId(subscriptionId);
          if (user) {
            let currentPeriodEnd;
            if (event.data.billing_period?.ends_at) {
              currentPeriodEnd = new Date(event.data.billing_period.ends_at);
            }
            await updateSubscriptionStatus(subscriptionId, 'active', currentPeriodEnd);
          } else if (customerId) {
            const customerUser = await getUserByPaddleCustomerId(customerId);
            if (customerUser?.id) {
              let currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              if (event.data.billing_period?.ends_at) {
                currentPeriodEnd = new Date(event.data.billing_period.ends_at);
              }
              await updateUserToPremium(customerUser.id, customerId, subscriptionId, currentPeriodEnd, 'active');
            }
          }
        }
        break;
      }

      case 'transaction.payment_failed': {
        const subscriptionId = event.data.subscription_id;
        if (subscriptionId) {
          await updateSubscriptionStatus(subscriptionId, 'past_due');
        }
        break;
      }

      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Paddle Webhook] Error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};
