import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// 禁用 body 解析，确保获取原始 body
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Paddle Webhook 签名验证
function verifyPaddleWebhook(rawBody: string, signature: string): boolean {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('[Paddle Webhook] No webhook secret configured');
    return false;
  }

  try {
    // Paddle Billing 使用 ts=xxx;h1=xxx 格式的签名
    const parts = signature.split(';');
    const timestampPart = parts.find((p) => p.startsWith('ts='));
    const signaturePart = parts.find((p) => p.startsWith('h1='));

    if (!timestampPart || !signaturePart) {
      console.error('[Paddle Webhook] Invalid signature format, signature:', signature);
      return false;
    }

    const timestamp = timestampPart.split('=')[1];
    const receivedSignature = signaturePart.split('=')[1];

    // 调试日志
    console.log('[Paddle Webhook] Signature verification debug:', {
      timestamp,
      receivedSignatureLength: receivedSignature?.length,
      webhookSecretPrefix: webhookSecret.substring(0, 10) + '...',
      rawBodyLength: rawBody.length,
    });

    // 创建签名数据：timestamp:rawBody
    const signedPayload = `${timestamp}:${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    console.log('[Paddle Webhook] Signature comparison:', {
      receivedLength: receivedSignature.length,
      expectedLength: expectedSignature.length,
      match: receivedSignature === expectedSignature,
    });

    // 确保两个签名长度相同才能使用 timingSafeEqual
    if (receivedSignature.length !== expectedSignature.length) {
      console.error('[Paddle Webhook] Signature length mismatch');
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

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('paddle-signature') || '';
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET || '';

    // 详细调试日志 - 全部合并到一条
    console.log('[Paddle Webhook] Debug info:', JSON.stringify({
      hasSignature: !!signature,
      signaturePreview: signature.substring(0, 50),
      hasSecret: !!webhookSecret,
      secretPrefix: webhookSecret.substring(0, 15),
      bodyLength: rawBody.length,
    }));

    // 验证 webhook 签名
    const isValid = verifyPaddleWebhook(rawBody, signature);

    if (!isValid) {
      // 输出更多调试信息帮助定位问题
      const parts = signature.split(';');
      const ts = parts.find((p) => p.startsWith('ts='))?.split('=')[1] || '';
      const h1 = parts.find((p) => p.startsWith('h1='))?.split('=')[1] || '';

      const signedPayload = `${ts}:${rawBody}`;
      const computed = require('crypto')
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      console.error('[Paddle Webhook] Signature mismatch:', JSON.stringify({
        receivedH1: h1.substring(0, 20) + '...',
        computedH1: computed.substring(0, 20) + '...',
        ts,
        secretUsed: webhookSecret.substring(0, 15) + '...',
      }));

      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event_type;

    console.log(`[Paddle Webhook] Received event: ${eventType}`);
    console.log(`[Paddle Webhook] Event data:`, JSON.stringify(event.data, null, 2));

    // 动态导入 supabase-admin，避免构建时初始化
    const {
      updateUserToPremium,
      cancelUserSubscription,
      updateSubscriptionStatus,
      getUserByPaddleSubscriptionId,
    } = await import('@/lib/supabase-admin');

    switch (eventType) {
      case 'subscription.created':
      case 'subscription.activated': {
        // 订阅创建/激活
        const subscriptionId = event.data.id;
        const customerId = event.data.customer_id;
        const customData = event.data.custom_data || {};
        const userId = customData.userId;
        const currentPeriodEnd = event.data.current_billing_period?.ends_at
          ? new Date(event.data.current_billing_period.ends_at)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 默认30天后

        console.log('[Paddle Webhook] subscription.created data:', {
          subscriptionId,
          customerId,
          customData,
          userId,
          currentPeriodEnd: currentPeriodEnd.toISOString(),
        });

        if (userId) {
          await updateUserToPremium(userId, customerId, subscriptionId, currentPeriodEnd);
          console.log(`[Paddle Webhook] User ${userId} upgraded to premium`);
        } else {
          console.warn('[Paddle Webhook] No userId in custom_data, customData:', customData);
        }
        break;
      }

      case 'subscription.updated': {
        // 订阅更新
        const subscriptionId = event.data.id;
        const status = event.data.status;
        const periodEndRaw = event.data.current_billing_period?.ends_at;
        const currentPeriodEnd = periodEndRaw ? new Date(periodEndRaw) : undefined;

        console.log('[Paddle Webhook] subscription.updated data:', {
          subscriptionId,
          status,
          periodEndRaw,
          currentPeriodEnd: currentPeriodEnd?.toISOString(),
        });

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
        const periodEndRaw = event.data.current_billing_period?.ends_at;
        const currentPeriodEnd = periodEndRaw ? new Date(periodEndRaw) : undefined;
        await updateSubscriptionStatus(subscriptionId, 'active', currentPeriodEnd);
        console.log(`[Paddle Webhook] Subscription ${subscriptionId} resumed`);
        break;
      }

      case 'transaction.completed': {
        // 交易完成（首次支付或续费成功）
        const subscriptionId = event.data.subscription_id;
        const customData = event.data.custom_data || {};
        const userId = customData.userId;

        console.log('[Paddle Webhook] transaction.completed data:', {
          subscriptionId,
          customData,
          userId,
          hasSubscriptionId: !!subscriptionId,
        });

        // 如果有 userId（首次支付），直接通过 userId 处理
        if (userId && subscriptionId) {
          const customerId = event.data.customer_id;
          // 获取订阅结束时间，如果没有则默认30天
          let currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          // 尝试从 billing_period 获取
          if (event.data.billing_period?.ends_at) {
            currentPeriodEnd = new Date(event.data.billing_period.ends_at);
          }

          await updateUserToPremium(userId, customerId, subscriptionId, currentPeriodEnd);
          console.log(`[Paddle Webhook] User ${userId} upgraded to premium via transaction.completed`);
        } else if (subscriptionId) {
          // 续费场景：通过 subscriptionId 查找用户
          const user = await getUserByPaddleSubscriptionId(subscriptionId);
          if (user) {
            console.log(`[Paddle Webhook] Payment received for user ${user.id}`);
          } else {
            console.log(`[Paddle Webhook] No user found for subscription ${subscriptionId}`);
          }
        } else {
          console.log('[Paddle Webhook] transaction.completed without subscriptionId or userId');
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
