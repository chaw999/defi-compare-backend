/**
 * DeFi 数据统一接口定义
 * 所有数据源 Service 都需要实现这个接口
 */

// 代币信息
export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  price?: number;
  logo?: string;
}

// 协议信息
export interface Protocol {
  id: string;
  name: string;
  logo?: string;
  chain: string;
  url?: string;
}

// 代币余额
export interface TokenBalance {
  token: Token;
  balance: string; // 原始余额（未除以 decimals）
  balanceFormatted: number; // 格式化后的余额
  balanceUSD: number;
}

// DeFi 持仓类型
export type PositionType =
  | 'lending'
  | 'borrowing'
  | 'liquidity'
  | 'staking'
  | 'farming'
  | 'wallet'
  | 'other';

// 单个持仓
export interface Position {
  id: string;
  protocol: Protocol;
  type: PositionType;
  tokens: TokenBalance[];
  totalValueUSD: number;
  apy?: number;
  healthFactor?: number;
  metadata?: Record<string, unknown>;
}

// 地址的完整 DeFi 数据
export interface AddressDefiData {
  address: string;
  totalValueUSD: number;
  positions: Position[];
  chains: string[];
  lastUpdated: string;
  source: string; // 数据源标识
}

// 数据对比差异类型
export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

// 持仓差异
export interface PositionDiff {
  protocol: string;
  chain: string;
  type: PositionType;
  diffType: DiffType;
  positionA?: Position;
  positionB?: Position;
  valueDiffUSD?: number;
  valueDiffPercent?: number;
}

// 对比结果摘要
export interface CompareSummary {
  totalValueDiffUSD: number;
  totalValueDiffPercent: number;
  positionsOnlyInA: number;
  positionsOnlyInB: number;
  commonPositions: number;
  changedPositions: number;
}

// 完整对比结果
export interface CompareResult {
  addressA: AddressDefiData;
  addressB: AddressDefiData;
  summary: CompareSummary;
  positionDiffs: PositionDiff[];
}

/**
 * DeFi 数据提供者接口
 * 所有数据源 Service 必须实现此接口
 */
export interface IDefiDataProvider {
  /**
   * 数据源名称
   */
  readonly sourceName: string;

  /**
   * 获取地址的 DeFi 数据
   * @param address 钱包地址
   */
  getAddressDefiData(address: string): Promise<AddressDefiData>;

  /**
   * 获取地址的 portfolio 总览
   * @param address 钱包地址
   */
  getPortfolio(address: string): Promise<AddressDefiData>;

  /**
   * 获取地址在指定协议的持仓
   * @param address 钱包地址
   * @param protocolId 协议 ID
   */
  getPositionsByProtocol?(
    address: string,
    protocolId: string,
  ): Promise<Position[]>;
}

