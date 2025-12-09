import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  updateUserToPremium,
  cancelUserSubscription,
  updateSubscriptionStatus,
  getUserByPaddleSubscriptionId,
} from '@/lib/supabase-admin';

// Paddle Webhook 签名验证
function verifyPaddleWebhook(rawBody: string, signature: string): boolean {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('[Paddle Webhook] No webhook secret configured');
    return false;
  }

  try {
    // Paddle 使用 ts;h1= 格式的签名
    const parts = signature.split(';');
    const timestampPart = parts.find((p) => p.startsWith('ts='));
    const signaturePart = parts.find((p) => p.startsWith('h1='));

    if (!timestampPart || !signaturePart) {
      console.error('[Paddle Webhook] Invalid signature format');
      return false;
    }

    const timestamp = timestampPart.split('=')[1];
    const receivedSignature = signaturePart.split('=')[1];

    // 创建签名数据
    const signedPayload = `${timestamp}:${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[Paddle Webhook] Signature verification error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('paddle-signature') || '';

    // 验证签名（生产环境必须验证）
    if (process.env.NODE_ENV === 'production') {
      if (!verifyPaddleWebhook(rawBody, signature)) {
        console.error('[Paddle Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event_type;

    console.log(`[Paddle Webhook] Received event: ${eventType}`);

    switch (eventType) {
      case 'subscription.created':
      case 'subscription.activated': {
        // 订阅创建/激活
        const subscriptionId = event.data.id;
        const customerId = event.data.customer_id;
        const customData = event.data.custom_data || {};
        const userId = customData.userId;
        const currentPeriodEnd = new Date(event.data.current_billing_period?.ends_at);

        if (userId) {
          await updateUserToPremium(userId, customerId, subscriptionId, currentPeriodEnd);
          console.log(`[Paddle Webhook] User ${userId} upgraded to premium`);
        } else {
          console.warn('[Paddle Webhook] No userId in custom_data');
        }
        break;
      }

      case 'subscription.updated': {
        // 订阅更新
        const subscriptionId = event.data.id;
        const status = event.data.status;
        const currentPeriodEnd = new Date(event.data.current_billing_period?.ends_at);

        let mappedStatus: 'active' | 'canceled' | 'past_due' | 'paused';
        switch (status) {
          case 'active':
            mappedStatus = 'active';
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
          default:
            mappedStatus = 'active';
        }

        await updateSubscriptionStatus(subscriptionId, mappedStatus, currentPeriodEnd);
        console.log(`[Paddle Webhook] Subscription ${subscriptionId} updated to ${status}`);
        break;
      }

      case 'subscription.canceled': {
        // 订阅取消
        const subscriptionId = event.data.id;
        await cancelUserSubscription(subscriptionId);
        console.log(`[Paddle Webhook] Subscription ${subscriptionId} canceled`);
        break;
      }

      case 'subscription.paused': {
        // 订阅暂停
        const subscriptionId = event.data.id;
        await updateSubscriptionStatus(subscriptionId, 'paused');
        console.log(`[Paddle Webhook] Subscription ${subscriptionId} paused`);
        break;
      }

      case 'subscription.resumed': {
        // 订阅恢复
        const subscriptionId = event.data.id;
        const currentPeriodEnd = new Date(event.data.current_billing_period?.ends_at);
        await updateSubscriptionStatus(subscriptionId, 'active', currentPeriodEnd);
        console.log(`[Paddle Webhook] Subscription ${subscriptionId} resumed`);
        break;
      }

      case 'transaction.completed': {
        // 交易完成（首次支付或续费成功）
        const subscriptionId = event.data.subscription_id;
        if (subscriptionId) {
          const user = await getUserByPaddleSubscriptionId(subscriptionId);
          if (user) {
            console.log(`[Paddle Webhook] Payment received for user ${user.id}`);
          }
        }
        break;
      }

      case 'transaction.payment_failed': {
        // 支付失败
        const subscriptionId = event.data.subscription_id;
        if (subscriptionId) {
          await updateSubscriptionStatus(subscriptionId, 'past_due');
          console.log(`[Paddle Webhook] Payment failed for subscription ${subscriptionId}`);
        }
        break;
      }

      default:
        console.log(`[Paddle Webhook] Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Paddle Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
