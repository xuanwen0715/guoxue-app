// Paddle 配置
// 文档: https://developer.paddle.com/

// 订阅价格配置
export const SUBSCRIPTION_PLANS = {
  monthly: {
    name: '月度会员',
    nameEn: 'Monthly Premium',
    priceId: process.env.NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID || '',
    price: 9.99,
    currency: 'USD',
    interval: 'month' as const,
    features: [
      '无限次翻译',
      '无限次 OCR 识别',
      '完整字典访问',
      '优先客服支持',
    ],
    featuresEn: [
      'Unlimited translations',
      'Unlimited OCR recognition',
      'Full dictionary access',
      'Priority support',
    ],
  },
  yearly: {
    name: '年度会员',
    nameEn: 'Yearly Premium',
    priceId: process.env.NEXT_PUBLIC_PADDLE_YEARLY_PRICE_ID || '',
    price: 79.99,
    currency: 'USD',
    interval: 'year' as const,
    features: [
      '无限次翻译',
      '无限次 OCR 识别',
      '完整字典访问',
      '优先客服支持',
      '节省 33%',
    ],
    featuresEn: [
      'Unlimited translations',
      'Unlimited OCR recognition',
      'Full dictionary access',
      'Priority support',
      'Save 33%',
    ],
  },
} as const;

export type PlanType = keyof typeof SUBSCRIPTION_PLANS;

// Paddle 环境配置
export const PADDLE_CONFIG = {
  environment: (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
  clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '',
  sellerId: process.env.NEXT_PUBLIC_PADDLE_SELLER_ID || '',
};
