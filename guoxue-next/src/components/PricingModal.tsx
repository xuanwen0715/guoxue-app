'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePaddle } from '@/hooks/usePaddle';
import { useAuth } from '@/context/AuthContext';
import { SUBSCRIPTION_PLANS, PlanType, PADDLE_CONFIG } from '@/lib/paddle';

interface PricingProps {
  onClose?: () => void;
}

export default function PricingModal({ onClose }: PricingProps) {
  const locale = useLocale();
  const { paddle, isLoading: paddleLoading } = usePaddle();
  const { user, isLoggedIn } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const isZh = locale === 'zh';

  // 调试：检查配置
  useEffect(() => {
    const info = [
      `Paddle loaded: ${!!paddle}`,
      `Paddle loading: ${paddleLoading}`,
      `Client token: ${PADDLE_CONFIG.clientToken ? 'set' : 'NOT SET'}`,
      `Environment: ${PADDLE_CONFIG.environment}`,
      `Monthly price ID: ${SUBSCRIPTION_PLANS.monthly.priceId || 'NOT SET'}`,
      `Yearly price ID: ${SUBSCRIPTION_PLANS.yearly.priceId || 'NOT SET'}`,
      `User logged in: ${isLoggedIn}`,
      `User email: ${user?.email || 'N/A'}`,
    ];
    setDebugInfo(info.join('\n'));
    console.log('[PricingModal] Debug info:', info);
  }, [paddle, paddleLoading, isLoggedIn, user]);

  const handleSubscribe = async (planType: PlanType) => {
    console.log('[PricingModal] handleSubscribe called with:', planType);
    console.log('[PricingModal] paddle:', paddle);
    console.log('[PricingModal] isLoggedIn:', isLoggedIn);
    console.log('[PricingModal] user:', user);

    if (!paddle) {
      const msg = isZh ? '支付系统加载中，请稍后重试' : 'Payment system loading, please try again';
      console.error('[PricingModal] Paddle not loaded');
      alert(msg);
      return;
    }

    if (!isLoggedIn || !user) {
      const msg = isZh ? '请先登录再订阅' : 'Please login before subscribing';
      console.error('[PricingModal] User not logged in');
      alert(msg);
      return;
    }

    const plan = SUBSCRIPTION_PLANS[planType];

    if (!plan.priceId) {
      const msg = isZh ? '价格配置错误，请联系管理员' : 'Price configuration error, please contact admin';
      console.error('[PricingModal] Price ID not set for plan:', planType);
      alert(msg);
      return;
    }

    setIsProcessing(true);
    setSelectedPlan(planType);

    try {
      console.log('[PricingModal] Opening checkout with:', {
        priceId: plan.priceId,
        email: user.email,
        userId: user.id,
      });

      await paddle.Checkout.open({
        items: [{ priceId: plan.priceId, quantity: 1 }],
        customer: {
          email: user.email,
        },
        customData: {
          userId: user.id,
          planType: planType,
        },
        settings: {
          displayMode: 'overlay',
          theme: 'light',
          locale: isZh ? 'zh' : 'en',
          successUrl: `${window.location.origin}/${locale}?subscription=success`,
        },
      });
      console.log('[PricingModal] Checkout opened successfully');
    } catch (error) {
      console.error('[PricingModal] Checkout error:', error);
      alert(isZh ? '打开支付页面失败，请重试' : 'Failed to open checkout, please try again');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="pricing-modal-overlay" onClick={onClose}>
      <div className="pricing-modal" onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button className="pricing-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}

        <div className="pricing-header">
          <h2 className="pricing-title">
            {isZh ? '升级会员' : 'Upgrade to Premium'}
          </h2>
          <p className="pricing-subtitle">
            {isZh
              ? '解锁无限翻译和 OCR 识别功能'
              : 'Unlock unlimited translations and OCR recognition'}
          </p>
        </div>

        {/* 调试信息 - 生产环境可删除 */}
        {process.env.NODE_ENV !== 'production' && (
          <pre style={{ fontSize: '10px', background: '#f0f0f0', padding: '8px', margin: '8px', whiteSpace: 'pre-wrap', borderRadius: '4px' }}>
            {debugInfo}
          </pre>
        )}

        <div className="pricing-plans">
          {/* 月度计划 */}
          <div
            className={`pricing-card ${selectedPlan === 'monthly' ? 'selected' : ''}`}
            onClick={() => setSelectedPlan('monthly')}
          >
            <div className="plan-header">
              <h3 className="plan-name">
                {isZh ? SUBSCRIPTION_PLANS.monthly.name : SUBSCRIPTION_PLANS.monthly.nameEn}
              </h3>
              <div className="plan-price">
                <span className="price-currency">$</span>
                <span className="price-amount">{SUBSCRIPTION_PLANS.monthly.price}</span>
                <span className="price-period">/{isZh ? '月' : 'mo'}</span>
              </div>
            </div>

            <ul className="plan-features">
              {(isZh ? SUBSCRIPTION_PLANS.monthly.features : SUBSCRIPTION_PLANS.monthly.featuresEn).map((feature, index) => (
                <li key={index}>
                  <span className="feature-check">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              className="btn-subscribe"
              onClick={(e) => {
                e.stopPropagation();
                handleSubscribe('monthly');
              }}
              disabled={isProcessing || paddleLoading}
            >
              {paddleLoading
                ? (isZh ? '加载中...' : 'Loading...')
                : isProcessing && selectedPlan === 'monthly'
                  ? (isZh ? '处理中...' : 'Processing...')
                  : (isZh ? '立即订阅' : 'Subscribe Now')}
            </button>
          </div>

          {/* 年度计划 */}
          <div
            className={`pricing-card recommended ${selectedPlan === 'yearly' ? 'selected' : ''}`}
            onClick={() => setSelectedPlan('yearly')}
          >
            <div className="plan-badge">
              {isZh ? '最受欢迎' : 'Most Popular'}
            </div>

            <div className="plan-header">
              <h3 className="plan-name">
                {isZh ? SUBSCRIPTION_PLANS.yearly.name : SUBSCRIPTION_PLANS.yearly.nameEn}
              </h3>
              <div className="plan-price">
                <span className="price-currency">$</span>
                <span className="price-amount">{SUBSCRIPTION_PLANS.yearly.price}</span>
                <span className="price-period">/{isZh ? '年' : 'yr'}</span>
              </div>
              <div className="plan-savings">
                {isZh ? '相当于 $4.08/月' : 'Only $4.08/month'}
              </div>
            </div>

            <ul className="plan-features">
              {(isZh ? SUBSCRIPTION_PLANS.yearly.features : SUBSCRIPTION_PLANS.yearly.featuresEn).map((feature, index) => (
                <li key={index}>
                  <span className="feature-check">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              className="btn-subscribe btn-subscribe-primary"
              onClick={(e) => {
                e.stopPropagation();
                handleSubscribe('yearly');
              }}
              disabled={isProcessing || paddleLoading}
            >
              {paddleLoading
                ? (isZh ? '加载中...' : 'Loading...')
                : isProcessing && selectedPlan === 'yearly'
                  ? (isZh ? '处理中...' : 'Processing...')
                  : (isZh ? '立即订阅' : 'Subscribe Now')}
            </button>
          </div>
        </div>

        <div className="pricing-footer">
          <p className="pricing-guarantee">
            {isZh
              ? '🔒 安全支付 · 支持信用卡、PayPal、支付宝等'
              : '🔒 Secure payment · Credit Card, PayPal, Alipay supported'}
          </p>
          <p className="pricing-terms">
            {isZh
              ? '订阅后可随时取消，下个计费周期生效'
              : 'Cancel anytime, effective next billing cycle'}
          </p>
        </div>
      </div>
    </div>
  );
}
