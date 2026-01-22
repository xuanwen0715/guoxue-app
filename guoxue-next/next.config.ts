import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  async rewrites() {
    // 本地开发时代理到 Vercel 部署的 API
    // 生产环境部署到同域名时不需要代理
    const apiBaseUrl = process.env.API_BASE_URL || '';

    if (apiBaseUrl) {
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
      ];
    }
    return [];
  },
};

export default withNextIntl(nextConfig);
