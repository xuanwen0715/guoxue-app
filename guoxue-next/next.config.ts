import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  async rewrites() {
    // 仅在本地开发时代理到远端 API，避免生产环境误代理
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
    return [];
  },
};

export default withNextIntl(nextConfig);
