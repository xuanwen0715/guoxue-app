import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// 禁用 body 解析，确保获取原始 body
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 最大允许的时间偏移（5分钟），防止重放攻击
const MAX_TIMESTAMP_DRIFT_SECONDS = 300;

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
      console.error('[Paddle Webhook] Invalid signature format');
      return false;
    }

    const timestamp = timestampPart.split('=')[1];
    const receivedSignature = signaturePart.split('=')[1];

    // 验证时间戳，防止重放攻击
    const timestampNum = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestampNum) > MAX_TIMESTAMP_DRIFT_SECONDS) {
      console.error('[Paddle Webhook] Timestamp too old or too far in future');
      return false;
    }

    // 创建签名数据：timestamp:rawBody
    const signedPayload = `${timestamp}:${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

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

    // 验证 webhook 签名
    if (!verifyPaddleWebhook(rawBody, signature)) {
      console.error('[Paddle Webhook] Invalid signature');
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
      getUserByPaddleCustomerId,
    } = await import('@/lib/supabase-admin');

    switch (eventType) {
      case 'subscription.created':
      case 'subscription.activated': {
        // 订阅创建/激活
        const subscriptionId = event.data.id;
        const customerId = event.data.customer_id;
        const customData = event.data.custom_data || {};
        const userId = customData.userId;
        const rawStatus = event.data.status;
        const mappedStatus: 'active' | 'trialing' = rawStatus === 'trialing' ? 'trialing' : 'active';
        const fallbackDays = mappedStatus === 'trialing' ? 7 : 30;
        const currentPeriodEnd = event.data.current_billing_period?.ends_at
          ? new Date(event.data.current_billing_period.ends_at)
          : new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000);

        console.log('[Paddle Webhook] subscription.created data:', {
          subscriptionId,
          customerId,
          customData,
          userId,
          status: rawStatus,
          currentPeriodEnd: currentPeriodEnd.toISOString(),
        });

        if (userId) {
          await updateUserToPremium(userId, customerId, subscriptionId, currentPeriodEnd, mappedStatus);
          console.log(`[Paddle Webhook] User ${userId} upgraded to premium`);
        } else if (customerId) {
          const user = await getUserByPaddleCustomerId(customerId);
          if (user?.id) {
            await updateUserToPremium(user.id, customerId, subscriptionId, currentPeriodEnd, mappedStatus);
            console.log(`[Paddle Webhook] User ${user.id} upgraded to premium via customerId fallback`);
          } else {
            console.warn('[Paddle Webhook] No user found for customerId:', customerId);
          }
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

        let mappedStatus: 'active' | 'trialing' | 'canceled' | 'past_due' | 'paused';
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
            console.warn('[Paddle Webhook] Unrecognized subscription status:', status);
            return NextResponse.json({ received: true });
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
        const customerId = event.data.customer_id;

        console.log('[Paddle Webhook] transaction.completed data:', {
          subscriptionId,
          customData,
          userId,
          hasSubscriptionId: !!subscriptionId,
        });

        // 如果有 userId（首次支付），直接通过 userId 处理
        if (userId && subscriptionId) {
          // 获取订阅结束时间，如果没有则默认30天
          let currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          // 尝试从 billing_period 获取
          if (event.data.billing_period?.ends_at) {
            currentPeriodEnd = new Date(event.data.billing_period.ends_at);
          }

          await updateUserToPremium(userId, customerId, subscriptionId, currentPeriodEnd, 'active');
          console.log(`[Paddle Webhook] User ${userId} upgraded to premium via transaction.completed`);
        } else if (subscriptionId) {
          // 续费场景：通过 subscriptionId 查找用户并更新订阅期
          const user = await getUserByPaddleSubscriptionId(subscriptionId);
          if (user) {
            // 获取新的订阅结束时间
            let currentPeriodEnd: Date | undefined;
            if (event.data.billing_period?.ends_at) {
              currentPeriodEnd = new Date(event.data.billing_period.ends_at);
            }

            // 续费成功，更新状态为 active 并延长订阅期
            await updateSubscriptionStatus(subscriptionId, 'active', currentPeriodEnd);
            console.log(`[Paddle Webhook] Subscription renewed for user ${user.id}, new period end: ${currentPeriodEnd?.toISOString()}`);
          } else if (customerId) {
            const customerUser = await getUserByPaddleCustomerId(customerId);
            if (customerUser?.id) {
              let currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              if (event.data.billing_period?.ends_at) {
                currentPeriodEnd = new Date(event.data.billing_period.ends_at);
              }
              await updateUserToPremium(customerUser.id, customerId, subscriptionId, currentPeriodEnd, 'active');
              console.log(`[Paddle Webhook] User ${customerUser.id} upgraded to premium via customerId fallback`);
            } else {
              console.log(`[Paddle Webhook] No user found for customer ${customerId}`);
            }
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
