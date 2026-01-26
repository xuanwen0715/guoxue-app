#!/usr/bin/env node

/**
 * Paddle Webhook 调试工具
 * 用于诊断 webhook 400 错误的具体原因
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

// 检查环境变量
function checkEnvironmentVariables() {
  console.log('🔍 检查环境变量配置...\n');

  const requiredEnvs = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'PADDLE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN',
    'PADDLE_API_KEY'
  ];

  requiredEnvs.forEach(env => {
    const value = process.env[env];
    if (value) {
      console.log(`✅ ${env}: ${value.substring(0, 20)}...`);

      // 检查常见的配置错误
      if (env === 'PADDLE_WEBHOOK_SECRET' && value.startsWith('pdl_ntfset_')) {
        console.log(`❌ 错误：${env} 使用的是 Notification ID，不是 Secret Key！`);
      }
    } else {
      console.log(`❌ ${env}: 未设置`);
    }
  });
}

// 验证 Paddle Webhook 签名逻辑
function testWebhookSignature() {
  console.log('\n🔐 测试 Webhook 签名验证逻辑...\n');

  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.log('❌ PADDLE_WEBHOOK_SECRET 未设置');
    return;
  }

  // 模拟 webhook 数据
  const testBody = JSON.stringify({
    event_type: 'test.event',
    data: { test: true }
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}:${testBody}`;

  // 生成正确的签名
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex');

  const paddleSignature = `ts=${timestamp};h1=${expectedSignature}`;

  console.log(`测试数据:`);
  console.log(`- Body: ${testBody}`);
  console.log(`- Timestamp: ${timestamp}`);
  console.log(`- Expected Signature: ${expectedSignature}`);
  console.log(`- Paddle Signature Header: ${paddleSignature}`);

  // 验证签名
  try {
    const parts = paddleSignature.split(';');
    const timestampPart = parts.find((p) => p.startsWith('ts='));
    const signaturePart = parts.find((p) => p.startsWith('h1='));

    if (!timestampPart || !signaturePart) {
      console.log('❌ 签名格式错误');
      return;
    }

    const extractedTimestamp = timestampPart.split('=')[1];
    const receivedSignature = signaturePart.split('=')[1];

    const testSignedPayload = `${extractedTimestamp}:${testBody}`;
    const testExpectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(testSignedPayload)
      .digest('hex');

    if (receivedSignature === testExpectedSignature) {
      console.log('✅ 签名验证逻辑正确');
    } else {
      console.log('❌ 签名验证失败');
      console.log(`预期签名: ${testExpectedSignature}`);
      console.log(`收到签名: ${receivedSignature}`);
    }
  } catch (error) {
    console.log('❌ 签名验证过程出错:', error.message);
  }
}

// 测试本地 webhook 端点
function testLocalWebhook() {
  console.log('\n🌐 测试本地 webhook 端点...\n');

  const testPayload = JSON.stringify({
    event_type: 'test.event',
    data: { test: true }
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}:${testPayload}`;
  const signature = crypto
    .createHmac('sha256', process.env.PADDLE_WEBHOOK_SECRET || 'test')
    .update(signedPayload)
    .digest('hex');

  const paddleSignature = `ts=${timestamp};h1=${signature}`;

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/webhooks/paddle',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': paddleSignature,
      'Content-Length': Buffer.byteLength(testPayload)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    console.log(`响应头:`, res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`响应内容: ${data}`);
      if (res.statusCode === 200) {
        console.log('✅ 本地 webhook 测试成功');
      } else {
        console.log('❌ 本地 webhook 测试失败');
      }
    });
  });

  req.on('error', (error) => {
    console.log('❌ 请求失败:', error.message);
    console.log('提示: 请确保本地服务器正在运行 (npm run dev)');
  });

  req.write(testPayload);
  req.end();
}

// 测试生产环境 webhook
function testProductionWebhook() {
  console.log('\n🚀 测试生产环境 webhook...\n');

  const testPayload = JSON.stringify({
    event_type: 'test.event',
    data: { test: true }
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}:${testPayload}`;
  const signature = crypto
    .createHmac('sha256', process.env.PADDLE_WEBHOOK_SECRET || 'test')
    .update(signedPayload)
    .digest('hex');

  const paddleSignature = `ts=${timestamp};h1=${signature}`;

  const options = {
    hostname: 'dict.gsw277.today',
    path: '/api/webhooks/paddle',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': paddleSignature,
      'Content-Length': Buffer.byteLength(testPayload)
    }
  };

  const req = https.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    console.log(`响应头:`, res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`响应内容: ${data}`);
      if (res.statusCode === 200) {
        console.log('✅ 生产环境 webhook 测试成功');
      } else {
        console.log('❌ 生产环境 webhook 测试失败');
      }
    });
  });

  req.on('error', (error) => {
    console.log('❌ 请求失败:', error.message);
  });

  req.write(testPayload);
  req.end();
}

// 测试用户订阅 API
function testSubscriptionAPI() {
  console.log('\n👤 测试用户订阅 API...\n');

  // 这里需要一个有效的用户 token
  console.log('需要提供有效的用户 token 来测试此 API');
  console.log('可以通过浏览器开发者工具的 Network 标签获取');
}

// 主函数
function main() {
  console.log('🔧 Paddle Webhook 调试工具\n');
  console.log('====================================');

  // 从 .env.local 加载环境变量
  try {
    require('dotenv').config({ path: '.env.local' });
  } catch (error) {
    console.log('提示: 未找到 dotenv 包，请手动设置环境变量');
  }

  checkEnvironmentVariables();
  testWebhookSignature();

  // 根据参数选择测试
  const args = process.argv.slice(2);

  if (args.includes('--local')) {
    setTimeout(testLocalWebhook, 1000);
  } else if (args.includes('--production')) {
    setTimeout(testProductionWebhook, 1000);
  } else if (args.includes('--subscription')) {
    setTimeout(testSubscriptionAPI, 1000);
  } else {
    console.log('\n使用方法:');
    console.log('node debug-webhook.js --local        # 测试本地环境');
    console.log('node debug-webhook.js --production   # 测试生产环境');
    console.log('node debug-webhook.js --subscription # 测试订阅API');
  }
}

if (require.main === module) {
  main();
}