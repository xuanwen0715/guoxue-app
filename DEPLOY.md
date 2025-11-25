# Vercel 部署指南

## 快速部署步骤

### 1. 环境变量配置
在Vercel Dashboard的Environment Variables中添加：

```bash
DASHSCOPE_API_KEY=你的阿里云DashScope API密钥
DASHSCOPE_TEXT_MODEL=qwen-max
DASHSCOPE_VL_MODEL=qwen-vl-max
DASHSCOPE_TXT_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
DASHSCOPE_VL_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
```

### 2. 部署流程
1. 登录 [vercel.com](https://vercel.com)
2. 点击 "New Project"
3. 导入GitHub仓库: `xuanwen0715/guoxue-app`
4. 配置环境变量
5. 点击 "Deploy"

### 3. API端点
部署后的API端点：
- 文字翻译: `https://你的域名.vercel.app/api/translate`
- OCR识别: `https://你的域名.vercel.app/api/ocr`

### 4. 测试API
```bash
# 测试翻译API
curl -X POST https://你的域名.vercel.app/api/translate \
  -H "Content-Type: application/json" \
  -d '{"word": "学而时习之", "context": "论语学而篇"}'

# 测试OCR API
curl -X POST https://你的域名.vercel.app/api/ocr \
  -H "Content-Type: application/json" \
  -d '{"image_url": "图片URL"}'
```

## 常见问题解决

### 1. 部署失败
- 检查 `requirements.txt` 文件格式
- 确认Python版本兼容性
- 查看构建日志定位错误

### 2. 环境变量问题
- 确保变量名拼写正确
- 检查API密钥有效性
- 重新部署使变量生效

### 3. API超时
- 默认设置60秒超时
- 如需调整，修改 `vercel.json` 中的 `maxDuration`
- 检查网络连接和API服务状态

### 4. CORS问题
- 已配置允许所有来源的请求
- 如需限制，修改API文件中的CORS设置

## 监控和维护

### 查看日志
在Vercel Dashboard的Functions标签查看：
- 请求日志
- 错误信息
- 性能指标

### 性能优化
- 监控API响应时间
- 调整内存分配（当前1024MB）
- 使用缓存减少API调用

## 本地开发

```bash
# 安装依赖
pip install -r requirements.txt

# 创建环境文件
cp .env.example .env
# 编辑 .env 文件填入实际配置

# 启动本地服务器
python server.py

# 访问应用
open http://localhost:8000
```