% 国学智能词典 · 前后端说明（含部署指南）

本项目提供一个“国学智能词典”网页（前端）与两条 Serverless 后端接口（适配 Vercel Python 运行时）：
- 图片 OCR（阿里云·通义千问多模态）`POST /api/ocr`
- 字/词释义（阿里云·通义千问文本大模型）`POST /api/translate`

已按照你的要求，文本生成模型默认使用通义千问的 `Qwen-max`。

---

## 目录结构

- `index.html` — 页面骨架与内容
- `style.css` — 粉紫氛围 + 国画风凤凰与祥云装饰
- `script.js` — 上传/拖拽/粘贴 OCR、查询、结构化结果与历史功能
- `api/ocr.py` — OCR 接口（调用 `qwen-vl-max`）
- `api/translate.py` — 释义接口（调用 `qwen-max`）
- `assets/` — 凤凰与祥云 SVG 素材
- `requirements.txt` — 仅需 `requests`

---

## 前端要点（已对接后端）

- 原文输入（支持）：
  - 直接粘贴文字
  - 粘贴/拖拽截图自动 OCR（/api/ocr）
  - 右下角图标按钮选择图片 OCR
- 字/词查询（/api/translate）：
  - 支持多字/词
  - 结构化结果优先展示：释义、出处、例句（否则 fallback 文本）
  - 历史与收藏、导入导出
- 无障碍与易用性：
  - 键盘快捷（Enter、Ctrl/Cmd + Enter）
  - 状态提示与加载动画

---

## 后端接口（Serverless）

### 1) OCR：`POST /api/ocr`
- 请求体（JSON）：
```
{ "image": "data:image/png;base64,...." }
```
也支持 `http(s)` 图片链接。

- 响应体（JSON，成功）：
```
{ "text": "识别出的汉字" }
```

- 模型与地址：
  - 默认：多模态 `qwen-vl-max`
  - URL: `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`

### 2) 释义：`POST /api/translate`
- 请求体（JSON）：
```
{ "context": "古文上下文", "word": "查询字或词", "useOcrResult": true }
```
- 响应（优先结构化）示例：
```
{ "term": "道", "explanation": "1. …", "sources": ["《道德经》·第一章：…"], "examples": ["[b]道可道[/b]，非常道。"] }
```
若解析失败则返回：`{ "text": "……" }`

- 模型与地址：
  - 默认：`qwen-max`（可通过环境变量覆盖）
  - URL: `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`

---

## 环境变量（Vercel → Project → Settings → Environment Variables）

- `DASHSCOPE_API_KEY`（必填）你的 DashScope/通义千问 API Key
- 可选覆盖：
  - `DASHSCOPE_VL_MODEL`（默认 `qwen-vl-max`）
  - `DASHSCOPE_VL_URL`
  - `DASHSCOPE_TEXT_MODEL`（默认 `qwen-max`）
  - `DASHSCOPE_TXT_URL`

> 你已指定文本模型用「通义千问 Qwen-max」。项目默认值已是 `qwen-max`，无需额外设置。

---

## 部署到 Vercel（推荐）

1) 代码推送到你的 Git 仓库（GitHub/GitLab/Bitbucket）
2) Vercel 导入项目 → Framework 选择「Other」
3) Python 运行时自动识别 `api/*.py` 为 Serverless Functions
4) 在 Project → Settings → Environment Variables 添加：`DASHSCOPE_API_KEY = <你的Key>`
5) 重新部署（Redeploy）
6) 打开站点，前端会直接调用 `/api/ocr` 与 `/api/translate`

> 注：`requirements.txt` 已包含 `requests`，Vercel 会自动安装依赖。

---

## 本地开发与测试

### 快速启动本地服务器

1. **配置API密钥**：
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，填入你的 DASHSCOPE_API_KEY
   ```

2. **启动本地开发服务器**：
   ```bash
   python run.py
   ```

3. **访问应用**：
   打开浏览器访问 http://localhost:8000

### 环境配置

创建 `.env` 文件并配置：
```bash
DASHSCOPE_API_KEY=你的API密钥
PORT=8000
DASHSCOPE_TEXT_MODEL=qwen-max
DASHSCOPE_VL_MODEL=qwen-vl-max
```

### 本地测试（curl 示例）

- OCR：
```
curl -X POST "https://<your-domain>/api/ocr" \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/png;base64,....."}'
```

- 释义：
```
curl -X POST "https://<your-domain>/api/translate" \
  -H "Content-Type: application/json" \
  -d '{
    "context": "道可道，非常道……",
    "word": "道",
    "useOcrResult": false
  }'
```

---

## 模型与输出

- 文本生成：`Qwen-max`（通义千问）精度较高，适合释义与结构化输出
- 多模态 OCR：`qwen-vl-max` 适合识别生僻字/复杂图像

如需降低成本或加快响应，可改为轻量模型（例如 `qwen-turbo`）；只需设置 `DASHSCOPE_TEXT_MODEL`。

---

## 安全与健壮性

- 服务端错误使用 4xx/5xx，并附带 `detail/trace`（便于调试）
- 简单 CORS 处理（OPTIONS → 204）
- 超时：OCR 30s，释义 45s（可按需调整）
- 结果解析：OCR 兼容 list/string；释义优先 JSON，失败回退文本

---

## 自定义/扩展建议

- 术语库/用户自定义补充：可在 `explanation/sources/examples` 结果上叠加本地词库
- 历史/收藏云端化：持久化到 KV/DB（如 Vercel KV / Supabase）
- 速率限制：前置轻量防护（如基于 IP 的限流）
- 多语言：当前前端主要中英同屏，如需语言切换可加开关并做 i18n 资源表

---

## 版本与维护

- 前端：已对接拖拽/粘贴/上传 OCR、结构化释义、历史收藏导入导出；UI 可在 `style.css` 微调凤凰/祥云显隐与透明度
- 后端：以 `requests` 调用 DashScope，函数化部署（Vercel Python）

如需我帮你补充「语言切换」或「关闭/调整凤凰与祥云」的快速开关，或联调脚本与健康检查（/api/health）等，请告诉我你的需求。

