/**
 * OneKey 数据源服务 (Placeholder)
 * TODO: 实现真实的 OneKey 数据获取逻辑
 */
import type { AddressDefiData } from '../types';

/**
 * 获取地址的 DeFi 数据
 * 目前返回空数据，后续实现真实逻辑
 */
export async function getAddressDefiData(address: string): Promise<AddressDefiData> {
  const normalizedAddress = address.toLowerCase();

  // TODO: 实现 OneKey 数据源的真实获取逻辑
  // 可能需要调用 OneKey 内部 API 或其他数据源

  return {
    address: normalizedAddress,
    totalValueUSD: 0,
    positions: [],
    chains: [],
    lastUpdated: new Date().toISOString(),
    source: 'OneKey',
  };
}
