/**
 * DeFi 相关路由
 */
import { Hono } from 'hono';
import type { Env } from '../types';
import * as zerionService from '../services/zerion';
import * as onekeyService from '../services/onekey';
import { compareDataSources } from '../services/compare';

export const defiRoutes = new Hono<{ Bindings: Env }>();

/**
 * 获取 Zerion 数据
 * GET /api/defi/zerion/:address
 */
defiRoutes.get('/defi/zerion/:address', async (c) => {
  const address = c.req.param('address');
  const apiKey = c.env.ZERION_API_KEY;

  if (!apiKey) {
    return c.json({
      success: false,
      message: 'ZERION_API_KEY not configured',
    }, 500);
  }

  try {
    const data = await zerionService.getAddressDefiData(address, apiKey);
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('Zerion API error:', error);
    return c.json({
      success: false,
      message: error.message || 'Failed to fetch Zerion data',
    }, 500);
  }
});

/**
 * 获取 OneKey 数据
 * GET /api/defi/onekey/:address
 */
defiRoutes.get('/defi/onekey/:address', async (c) => {
  const address = c.req.param('address');

  try {
    const data = await onekeyService.getAddressDefiData(address);
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('OneKey API error:', error);
    return c.json({
      success: false,
      message: error.message || 'Failed to fetch OneKey data',
    }, 500);
  }
});

/**
 * 对比数据源
 * GET /api/compare/sources/:address
 */
defiRoutes.get('/compare/sources/:address', async (c) => {
  const address = c.req.param('address');
  const apiKey = c.env.ZERION_API_KEY;

  if (!apiKey) {
    return c.json({
      success: false,
      message: 'ZERION_API_KEY not configured',
    }, 500);
  }

  try {
    // 并行获取两个数据源的数据
    const [zerionData, onekeyData] = await Promise.all([
      zerionService.getAddressDefiData(address, apiKey),
      onekeyService.getAddressDefiData(address),
    ]);

    // 对比数据：Zerion 作为 A，OneKey 作为 B
    const result = compareDataSources(zerionData, onekeyData);

    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Compare API error:', error);
    return c.json({
      success: false,
      message: error.message || 'Failed to compare data sources',
    }, 500);
  }
});

/**
 * Debug: 获取 Zerion 原始数据
 * GET /api/debug/zerion/raw/:address
 */
defiRoutes.get('/debug/zerion/raw/:address', async (c) => {
  const address = c.req.param('address');
  const apiKey = c.env.ZERION_API_KEY;

  if (!apiKey) {
    return c.json({
      success: false,
      message: 'ZERION_API_KEY not configured',
    }, 500);
  }

  try {
    const data = await zerionService.getRawPositions(address, apiKey);
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('Debug API error:', error);
    return c.json({
      success: false,
      message: error.message || 'Failed to fetch raw data',
    }, 500);
  }
});
