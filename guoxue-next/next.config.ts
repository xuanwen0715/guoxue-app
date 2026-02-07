import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  async rewrites() {
    // 本地开发时的 API 代理配置
    const apiBaseUrl = process.env.API_BASE_URL || '';
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment && apiBaseUrl) {
      return [
        {
          source: '/api/dictionary',
          destination: `${apiBaseUrl}/api/dictionary`,
        },
        {
          source: '/api/ocr',
          destination: `${apiBaseUrl}/api/ocr`,
        },
        {
          source: '/api/translate',
          destination: `${apiBaseUrl}/api/translate`,
        },
        {
          source: '/api/webhooks/paddle',
          destination: `${apiBaseUrl}/api/webhooks/paddle`,
        },
        {
          source: '/api/user/subscription',
          destination: `${apiBaseUrl}/api/user/subscription`,
        },
      ];
    }
    
    // 生产环境：Next.js API 路由会自动处理
    // Python Functions 由 vercel.json 的 rewrites 配置处理
    return [];
  },
};

export default withNextIntl(nextConfig);
