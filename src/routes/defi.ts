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
  const authToken = c.env.ONEKEY_AUTH_TOKEN;

  if (!authToken) {
    return c.json({
      success: false,
      message: 'ONEKEY_AUTH_TOKEN not configured',
    }, 500);
  }

  try {
    const data = await onekeyService.getAddressDefiData(address, authToken);
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
  const zerionApiKey = c.env.ZERION_API_KEY;
  const onekeyAuthToken = c.env.ONEKEY_AUTH_TOKEN;

  if (!zerionApiKey) {
    return c.json({
      success: false,
      message: 'ZERION_API_KEY not configured',
    }, 500);
  }

  if (!onekeyAuthToken) {
    return c.json({
      success: false,
      message: 'ONEKEY_AUTH_TOKEN not configured',
    }, 500);
  }

  try {
    // 首先获取 Zerion 数据（作为基准）
    console.log(`[Compare] Fetching Zerion data for ${address}`);
    const zerionData = await zerionService.getAddressDefiData(address, zerionApiKey);
    
    console.log(`[Compare] Zerion found ${zerionData.positions.length} positions on ${zerionData.chains.length} chains`);

    // 然后获取 OneKey 数据（使用 Zerion 返回的链列表来对齐查询范围）
    console.log(`[Compare] Fetching OneKey data for ${address} on chains: ${zerionData.chains.join(', ')}`);
    const onekeyData = await onekeyService.getAddressDefiData(
      address, 
      onekeyAuthToken,
      zerionData.chains  // 传入 Zerion 的链列表，确保查询范围一致
    );

    console.log(`[Compare] OneKey found ${onekeyData.positions.length} positions`);

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

/**
 * Debug: 获取 OneKey 原始数据
 * GET /api/debug/onekey/raw/:address/:networkId
 */
defiRoutes.get('/debug/onekey/raw/:address/:networkId', async (c) => {
  const address = c.req.param('address');
  const networkId = c.req.param('networkId');
  const authToken = c.env.ONEKEY_AUTH_TOKEN;

  if (!authToken) {
    return c.json({
      success: false,
      message: 'ONEKEY_AUTH_TOKEN not configured',
    }, 500);
  }

  try {
    // 直接调用 OneKey API 返回原始数据
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${authToken}`,
      'X-Onekey-Request-ID': crypto.randomUUID(),
      'X-Onekey-Request-Currency': 'usd',
      'X-Onekey-Request-Locale': 'zh-cn',
      'X-Onekey-Request-Theme': 'light',
      'X-Onekey-Request-Platform': 'android-apk',
      'X-Onekey-Request-Version': '5.19.0',
      'X-Onekey-Request-Build-Number': '2000000000',
      'X-Onekey-Request-Token': '',
      'X-Onekey-Request-Currency-Value': '1.0',
      'X-Onekey-Instance-Id': '88888888-8888-8888-8888-888888888888',
      'x-onekey-wallet-type': 'hd',
      'x-onekey-hide-asset-details': 'false',
      'x-onekey-request-device-name': '',
      'Content-Type': 'application/json',
    };

    const response = await fetch('https://wallet.onekeycn.com/wallet/v1/portfolio/positions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        networkId,
        accountAddress: address,
      }),
    });

    const responseText = await response.text();
    
    try {
      const data = JSON.parse(responseText);
      return c.json({ 
        success: true, 
        status: response.status,
        data 
      });
    } catch {
      return c.json({ 
        success: false, 
        status: response.status,
        rawResponse: responseText.substring(0, 2000)
      });
    }
  } catch (error: any) {
    console.error('Debug OneKey API error:', error);
    return c.json({
      success: false,
      message: error.message || 'Failed to fetch raw data',
    }, 500);
  }
});
