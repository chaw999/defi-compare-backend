/**
 * Zerion API 服务
 */
import type { AddressDefiData, Position, TokenBalance, PositionType } from '../types';

const ZERION_API_BASE = 'https://api.zerion.io/v1';

/**
 * 获取 Zerion API Headers
 */
function getHeaders(apiKey: string): Record<string, string> {
  const encoded = btoa(apiKey + ':');
  return {
    'Authorization': `Basic ${encoded}`,
    'Content-Type': 'application/json',
  };
}

/**
 * 映射 Zerion position type 到统一类型
 */
function mapPositionType(zerionType: string): PositionType {
  const typeMap: Record<string, PositionType> = {
    'deposit': 'lending',
    'loan': 'borrowing',
    'staked': 'staking',
    'locked': 'staking',
    'liquidity': 'liquidity',
    'farming': 'farming',
    'reward': 'staking',
    'claimable': 'staking',
    'wallet': 'wallet',
  };
  return typeMap[zerionType] || 'other';
}

/**
 * 获取 Portfolio 总值
 */
async function fetchPortfolio(address: string, apiKey: string): Promise<{ totalValueUSD: number }> {
  const response = await fetch(`${ZERION_API_BASE}/wallets/${address}/portfolio`, {
    headers: getHeaders(apiKey),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zerion portfolio API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;
  return {
    totalValueUSD: data?.data?.attributes?.total?.positions || 0,
  };
}

/**
 * 获取所有 Positions
 */
async function fetchPositions(address: string, apiKey: string): Promise<Position[]> {
  const response = await fetch(
    `${ZERION_API_BASE}/wallets/${address}/positions?currency=usd&sort=value`,
    { headers: getHeaders(apiKey) }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zerion positions API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;
  const rawPositions = data?.data || [];

  return rawPositions.map((item: any, index: number) => {
    const attrs = item.attributes || {};
    const relationships = item.relationships || {};

    // 获取 chain 信息
    const chain = relationships.chain?.data?.id || attrs.chain || 'unknown';

    // Protocol 信息
    const protocol = {
      id: relationships.protocol?.data?.id || attrs.protocol || `wallet-${chain}`,
      name: attrs.protocol || 'Wallet',
      chain: chain,
      logo: attrs.protocol_info?.logo?.url,
    };

    // Token 信息
    const fungibleInfo = attrs.fungible_info || {};
    const implementation = fungibleInfo.implementations?.[0] || {};

    const token = {
      symbol: fungibleInfo.symbol || 'UNKNOWN',
      name: fungibleInfo.name || 'Unknown Token',
      address: implementation.address || '',
      decimals: implementation.decimals || 18,
      price: attrs.price,
      logo: fungibleInfo.icon?.url,
    };

    const tokenBalance: TokenBalance = {
      token,
      balance: attrs.quantity?.numeric || '0',
      balanceFormatted: attrs.quantity?.float || 0,
      balanceUSD: attrs.value || 0,
    };

    return {
      id: item.id || `${protocol.id}-${token.symbol}-${index}`,
      protocol,
      type: mapPositionType(attrs.position_type),
      tokens: [tokenBalance],
      totalValueUSD: attrs.value || 0,
      metadata: {
        rawType: attrs.position_type,
      },
    } as Position;
  });
}

/**
 * 从 positions 中提取所有唯一的链
 */
function extractChains(positions: Position[]): string[] {
  const chains = new Set<string>();
  positions.forEach(p => {
    if (p.protocol.chain && p.protocol.chain !== 'unknown') {
      chains.add(p.protocol.chain);
    }
  });
  return Array.from(chains).sort();
}

/**
 * 获取地址的完整 DeFi 数据
 */
export async function getAddressDefiData(address: string, apiKey: string): Promise<AddressDefiData> {
  const normalizedAddress = address.toLowerCase();

  const [portfolio, positions] = await Promise.all([
    fetchPortfolio(normalizedAddress, apiKey),
    fetchPositions(normalizedAddress, apiKey),
  ]);

  // 提取所有涉及的链
  const chains = extractChains(positions);

  return {
    address: normalizedAddress,
    totalValueUSD: portfolio.totalValueUSD,
    positions,
    chains,
    lastUpdated: new Date().toISOString(),
    source: 'Zerion',
  };
}

/**
 * 获取原始 Positions 数据（用于调试）
 */
export async function getRawPositions(address: string, apiKey: string): Promise<unknown> {
  const response = await fetch(
    `${ZERION_API_BASE}/wallets/${address}/positions?currency=usd`,
    { headers: getHeaders(apiKey) }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zerion API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}
