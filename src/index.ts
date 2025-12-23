/**
 * DeFi OneKey Backend - Cloudflare Worker Entry Point
 * 使用 Hono 框架，完全兼容 Cloudflare Workers
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { defiRoutes } from './routes/defi';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// ============ 中间件 ============

// 日志
app.use('*', logger());

// JSON 美化
app.use('*', prettyJSON());

// CORS 配置 - 支持动态 origin 验证
app.use('*', cors({
  origin: (origin) => {
    // 允许的域名列表
    const allowedOrigins = [
      // 本地开发
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'https://defi-compare.qa.onekey-internal.com',
      'https://defi.qa.onekey-internal.com',
      'https://defi-backend.qa.onekey-internal.com',
    ];

    // 检查是否在允许列表中
    if (allowedOrigins.includes(origin)) {
      return origin;
    }

    // 允许所有 *.onekey-internal.com 子域名
    if (origin && origin.endsWith('.onekey-internal.com')) {
      return origin;
    }

    // 不匹配时返回第一个允许的 origin（用于没有 origin 的请求）
    return allowedOrigins[0];
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  credentials: true,
  maxAge: 86400,
}));

// ============ 路由 ============

// 健康检查
app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'DeFi OneKey API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

// DeFi 相关路由
app.route('/api', defiRoutes);

// ============ 错误处理 ============

// 404
app.notFound((c) => {
  return c.json({
    success: false,
    message: `Not Found: ${c.req.path}`,
  }, 404);
});

// 全局错误处理
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({
    success: false,
    message: err.message || 'Internal Server Error',
  }, 500);
});

export default app;

