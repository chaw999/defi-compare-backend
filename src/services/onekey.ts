/**
 * OneKey Portfolio API 服务
 * 参考文档: https://github.com/OneKeyHQ/server-service-onchain/docs/features/defi-portfolio/attachments/zerion-onekey-api-comparison.md
 */
import type { AddressDefiData, Position, TokenBalance, PositionType, Token } from '../types';

// OneKey API 配置
const ONEKEY_API_BASE = 'https://wallet.onekeycn.com/wallet/v1/portfolio';

// 固定的 Instance ID (全 8)
const INSTANCE_ID = '88888888-8888-8888-8888-888888888888';

// OneKey networkId 到 Zerion chain 的映射
const NETWORK_ID_TO_CHAIN: Record<string, string> = {
  'evm--1': 'ethereum',
  'evm--10': 'optimism',
  'evm--100': 'xdai',
  'evm--1101': 'polygon-zkevm',
  'evm--130': 'unichain',
  'evm--1313161554': 'aurora',
  'evm--137': 'polygon',
  'evm--143': 'monad',
  'evm--146': 'sonic',
  'evm--196': 'okbchain',
  'evm--250': 'fantom',
  'evm--324': 'zksync-era',
  'evm--42161': 'arbitrum',
  'evm--42220': 'celo',
  'evm--43114': 'avalanche',
  'evm--480': 'world',
  'evm--50': 'xinfin-xdc',
  'evm--5000': 'mantle',
  'evm--534352': 'scroll',
  'evm--56': 'binance-smart-chain',
  'evm--59144': 'linea',
  'evm--7777777': 'zora',
  'evm--80094': 'berachain',
  'evm--81457': 'blast',
  'evm--8453': 'base',
  'evm--9745': 'plasma',
  'evm--999': 'hyperevm',
};

// Chain 到 networkId 的反向映射
const CHAIN_TO_NETWORK_ID: Record<string, string> = Object.fromEntries(
  Object.entries(NETWORK_ID_TO_CHAIN).map(([k, v]) => [v, k])
);

// OneKey 返回的 chain 简称到标准 chain 名的映射
const ONEKEY_CHAIN_TO_STANDARD: Record<string, string> = {
  'eth': 'ethereum',
  'bsc': 'binance-smart-chain',
  'arb': 'arbitrum',
  'op': 'optimism',
  'matic': 'polygon',
  'avax': 'avalanche',
  'ftm': 'fantom',
  'gnosis': 'xdai',
  'celo': 'celo',
  // 已经是标准名的不需要映射
  'arbitrum': 'arbitrum',
  'optimism': 'optimism',
  'polygon': 'polygon',
  'avalanche': 'avalanche',
  'base': 'base',
  'blast': 'blast',
  'linea': 'linea',
  'scroll': 'scroll',
  'zksync-era': 'zksync-era',
  'mantle': 'mantle',
  'zora': 'zora',
  'berachain': 'berachain',
  'fantom': 'fantom',
  'xdai': 'xdai',
  'aurora': 'aurora',
  'polygon-zkevm': 'polygon-zkevm',
  'ethereum': 'ethereum',
  'binance-smart-chain': 'binance-smart-chain',
};

/**
 * 标准化 chain 名称
 */
function normalizeChainName(chain: string): string {
  return ONEKEY_CHAIN_TO_STANDARD[chain.toLowerCase()] || chain.toLowerCase();
}

// 主要链列表（优先查询）
const PRIMARY_NETWORKS = [
  'evm--1',      // ethereum
  'evm--42161',  // arbitrum
  'evm--10',     // optimism
  'evm--8453',   // base
  'evm--137',    // polygon
  'evm--56',     // binance-smart-chain
  'evm--43114',  // avalanche
  'evm--324',    // zksync-era
  'evm--59144',  // linea
  'evm--534352', // scroll
  'evm--5000',   // mantle
  'evm--81457',  // blast
  'evm--250',    // fantom
  'evm--100',    // xdai (gnosis)
  'evm--42220',  // celo
  'evm--80094',  // berachain
];

/**
 * 生成动态 Request ID
 */
function generateRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 获取 OneKey API Headers
 */
function getHeaders(authToken: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${authToken}`,
    'X-Onekey-Request-ID': generateRequestId(),
    'X-Onekey-Request-Currency': 'usd',
    'X-Onekey-Request-Locale': 'zh-cn',
    'X-Onekey-Request-Theme': 'light',
    'X-Onekey-Request-Platform': 'android-apk',
    'X-Onekey-Request-Version': '5.19.0',
    'X-Onekey-Request-Build-Number': '2000000000',
    'X-Onekey-Request-Token': '',
    'X-Onekey-Request-Currency-Value': '1.0',
    'X-Onekey-Instance-Id': INSTANCE_ID,
    'x-onekey-wallet-type': 'hd',
    'x-onekey-hide-asset-details': 'false',
    'x-onekey-request-device-name': '',
    'Content-Type': 'application/json',
  };
}

/**
 * OneKey Position 类型定义
 * 参考实际 API 响应格式
 */
interface OnekeyAsset {
  symbol: string;
  name?: string;
  address: string;
  amount: string;  // 余额数量
  value: number;   // USD 价值
  price: number;   // 单价
  category?: string;  // deposit, reward, debt 等
  meta?: {
    decimals?: number;
    logoUrl?: string;
    isVerified?: boolean;
  };
}

interface OnekeyPosition {
  networkId: string;
  owner: string;
  protocol: string;
  protocolName: string;
  protocolLogo?: string;
  protocolUrl?: string;
  name: string;
  chain: string;
  category: string;
  assets: OnekeyAsset[];
  debts?: OnekeyAsset[];
  rewards?: OnekeyAsset[];
  metrics?: Record<string, any>;
  groupId?: string;
  source?: {
    provider: string;
    fetchedAt: string;
  };
}

interface OnekeyTotals {
  totalValue: number;
  totalDebt: number;
  totalReward: number;
  netWorth: number;
}

interface OnekeyResponse {
  data: {
    positions: OnekeyPosition[];
    totals: OnekeyTotals;
    protocolSummaries?: Array<{
      protocol: string;
      totalValue: number;
      totalDebt: number;
      totalReward: number;
      netWorth: number;
    }>;
  };
}

/**
 * 映射 OneKey category 到统一的 PositionType
 */
function mapCategory(category: string): PositionType {
  const categoryMap: Record<string, PositionType> = {
    'lending': 'lending',
    'borrowing': 'borrowing',
    'liquidity': 'liquidity',
    'staking': 'staking',
    'farming': 'farming',
    'wallet': 'wallet',
    'deposit': 'lending',
    'borrow': 'borrowing',
    'stake': 'staking',
    'lp': 'liquidity',
    'reward': 'staking',
  };
  return categoryMap[category.toLowerCase()] || 'other';
}

/**
 * 转换 OneKey Asset 到 TokenBalance
 */
function transformAsset(asset: OnekeyAsset): TokenBalance {
  const token: Token = {
    symbol: asset.symbol || 'UNKNOWN',
    name: asset.name || asset.symbol || 'Unknown Token',
    address: asset.address || '',
    decimals: asset.meta?.decimals || 18,
    price: asset.price,
    logo: asset.meta?.logoUrl,
  };

  return {
    token,
    balance: asset.amount || '0',
    balanceFormatted: parseFloat(asset.amount) || 0,
    balanceUSD: asset.value || 0,
  };
}

/**
 * 转换 OneKey Position 到统一格式
 */
function transformPosition(pos: OnekeyPosition, index: number): Position {
  // 使用 chain 字段或从 networkId 映射，并标准化名称
  const rawChain = pos.chain || NETWORK_ID_TO_CHAIN[pos.networkId] || pos.networkId;
  const chain = normalizeChainName(rawChain);
  
  // 转换 assets
  const tokens: TokenBalance[] = (pos.assets || []).map(transformAsset);
  
  // 如果有 rewards，也加入 tokens
  if (pos.rewards && pos.rewards.length > 0) {
    pos.rewards.forEach(reward => {
      tokens.push(transformAsset(reward));
    });
  }

  // 计算总价值 = 资产价值 + 奖励价值 - 负债价值
  const totalAssetValue = (pos.assets || []).reduce((sum, a) => sum + (a.value || 0), 0);
  const totalRewardValue = (pos.rewards || []).reduce((sum, r) => sum + (r.value || 0), 0);
  const totalDebtValue = (pos.debts || []).reduce((sum, d) => sum + (d.value || 0), 0);
  const netWorth = totalAssetValue + totalRewardValue - totalDebtValue;

  return {
    id: `${pos.protocol}-${chain}-${pos.groupId || index}`,
    protocol: {
      id: pos.protocol || 'unknown',
      name: pos.protocolName || pos.protocol || 'Unknown',
      chain: chain,
      logo: pos.protocolLogo,
    },
    type: mapCategory(pos.category),
    tokens: tokens.length > 0 ? tokens : [{
      token: {
        symbol: 'UNKNOWN',
        name: 'Unknown',
        address: '',
        decimals: 18,
      },
      balance: '0',
      balanceFormatted: 0,
      balanceUSD: 0,
    }],
    totalValueUSD: netWorth,
    metadata: {
      category: pos.category,
      totalValue: totalAssetValue,
      totalDebt: totalDebtValue,
      totalReward: totalRewardValue,
      groupId: pos.groupId,
      source: pos.source?.provider,
    },
  };
}

/**
 * 查询单个网络的 positions
 */
async function fetchNetworkPositions(
  address: string,
  networkId: string,
  authToken: string
): Promise<OnekeyPosition[]> {
  try {
    const response = await fetch(`${ONEKEY_API_BASE}/positions`, {
      method: 'POST',
      headers: getHeaders(authToken),
      body: JSON.stringify({
        networkId,
        accountAddress: address,
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`OneKey API error for ${networkId}: ${response.status} - ${responseText.substring(0, 500)}`);
      return [];
    }

    try {
      const data = JSON.parse(responseText) as any;
      
      // 检查 API 返回的错误码
      if (data.code !== 0 && data.code !== undefined) {
        console.error(`OneKey API returned error code for ${networkId}: ${data.code} - ${data.message || ''}`);
        return [];
      }
      
      // OneKey API 返回格式: 
      // { code: 0, message: "Success", data: { success: true, data: { positions: { "evm--1": [...] } } } }
      // positions 是以 networkId 为 key 的对象
      const positionsData = data?.data?.data?.positions || data?.data?.positions || {};
      
      // 获取指定网络的 positions
      let positions: OnekeyPosition[] = [];
      
      if (Array.isArray(positionsData)) {
        // 如果直接是数组
        positions = positionsData;
      } else if (typeof positionsData === 'object') {
        // 如果是以 networkId 为 key 的对象
        positions = positionsData[networkId] || [];
      }
      
      if (positions.length > 0) {
        console.log(`[OneKey] Found ${positions.length} positions on ${networkId}`);
      }
      
      return positions;
    } catch (parseError) {
      console.error(`Failed to parse OneKey response for ${networkId}:`, parseError);
      return [];
    }
  } catch (error) {
    console.error(`Failed to fetch ${networkId}:`, error);
    return [];
  }
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
 * 根据 Zerion 返回的链列表获取对应的 OneKey networkIds
 */
function getNetworkIdsFromChains(chains: string[]): string[] {
  const networkIds: string[] = [];
  
  for (const chain of chains) {
    const networkId = CHAIN_TO_NETWORK_ID[chain];
    if (networkId) {
      networkIds.push(networkId);
    }
  }
  
  // 如果没有匹配的，返回主要链
  return networkIds.length > 0 ? networkIds : PRIMARY_NETWORKS;
}

/**
 * 获取地址的完整 DeFi 数据
 * @param address 钱包地址
 * @param authToken OneKey Auth Token
 * @param targetChains 可选，指定要查询的链（用于与 Zerion 对齐）
 */
export async function getAddressDefiData(
  address: string,
  authToken: string,
  targetChains?: string[]
): Promise<AddressDefiData> {
  const normalizedAddress = address.toLowerCase();

  // 确定要查询的网络
  let networksToQuery: string[];
  if (targetChains && targetChains.length > 0) {
    networksToQuery = getNetworkIdsFromChains(targetChains);
  } else {
    networksToQuery = PRIMARY_NETWORKS;
  }

  console.log(`[OneKey] Querying ${networksToQuery.length} networks for ${normalizedAddress}`);

  // 并行查询所有网络
  const results = await Promise.all(
    networksToQuery.map(networkId => 
      fetchNetworkPositions(normalizedAddress, networkId, authToken)
    )
  );

  // 合并所有 positions
  const allOnekeyPositions = results.flat();
  
  console.log(`[OneKey] Found ${allOnekeyPositions.length} positions`);

  // 转换为统一格式
  const positions = allOnekeyPositions.map((pos, index) => transformPosition(pos, index));

  // 计算总值
  const totalValueUSD = positions.reduce((sum, p) => sum + p.totalValueUSD, 0);

  // 提取所有涉及的链
  const chains = extractChains(positions);

  return {
    address: normalizedAddress,
    totalValueUSD,
    positions,
    chains,
    lastUpdated: new Date().toISOString(),
    source: 'OneKey',
  };
}

/**
 * 导出网络映射供其他模块使用
 */
export { NETWORK_ID_TO_CHAIN, CHAIN_TO_NETWORK_ID };
