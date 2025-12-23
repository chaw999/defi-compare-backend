# DeFi OneKey Backend

基于 Cloudflare Workers + Hono 的 DeFi 数据对比 API 服务。

## 项目结构

```
src/
├── index.ts          # Worker 入口，中间件配置
├── types.ts          # TypeScript 类型定义
├── routes/
│   └── defi.ts       # DeFi 相关 API 路由
└── services/
    ├── zerion.ts     # Zerion API 服务
    ├── onekey.ts     # OneKey 数据源服务 (待实现)
    └── compare.ts    # 数据源对比服务
```

## 开发

### 1. 安装依赖

```bash
yarn install
```

### 2. 配置环境变量

复制 `.dev.vars.example` 到 `.dev.vars` 并填入你的 API Key：

```
ZERION_API_KEY=your_zerion_api_key_here
```

### 3. 本地开发

```bash
yarn dev
```

Worker 将在 `http://localhost:8787` 启动。

### 4. 类型检查

```bash
yarn typecheck
```

## 部署

### 部署到 Cloudflare

```bash
yarn deploy
```

### 配置生产环境变量

在 Cloudflare Dashboard 中配置：

1. 进入 Workers & Pages
2. 选择 `defi-onekey-be` Worker
3. 进入 Settings > Variables
4. 添加 `ZERION_API_KEY` 变量

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/defi/zerion/:address` | 获取 Zerion 数据 |
| GET | `/api/defi/onekey/:address` | 获取 OneKey 数据 |
| GET | `/api/compare/sources/:address` | 对比两个数据源 |
| GET | `/api/debug/zerion/raw/:address` | 调试：Zerion 原始数据 |

## CORS 配置

已配置允许以下来源：

- `http://localhost:3000` (前端开发)
- `http://localhost:5173` (Vite 默认端口)
- `https://defi-onekey.qa.onekey-internal.com` (生产前端)
- `https://defi.qa.onekey-internal.com` (生产前端)

## 技术栈

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Language**: TypeScript
- **Build Tool**: Wrangler
