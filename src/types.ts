/**
 * Cloudflare Worker 环境变量类型
 */
export interface Env {
  ZERION_API_KEY: string;
  ONEKEY_AUTH_TOKEN: string;
}

/**
 * Token 信息
 */
export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  price?: number;
  logo?: string;
}

/**
 * Token 余额信息
 */
export interface TokenBalance {
  token: Token;
  balance: string;
  balanceFormatted: number;
  balanceUSD: number;
}

/**
 * 协议信息
 */
export interface Protocol {
  id: string;
  name: string;
  chain: string;
  logo?: string;
}

/**
 * Position 类型
 */
export type PositionType = 
  | 'lending'
  | 'borrowing'
  | 'liquidity'
  | 'staking'
  | 'farming'
  | 'wallet'
  | 'other';

/**
 * 单个 DeFi Position
 */
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

/**
 * 地址 DeFi 数据
 */
export interface AddressDefiData {
  address: string;
  totalValueUSD: number;
  positions: Position[];
  chains: string[];  // 所有涉及的链
  lastUpdated: string;
  source: string;
}

/**
 * 差异类型
 */
export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

/**
 * Position 差异详情
 */
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

/**
 * 对比摘要
 */
export interface CompareSummary {
  totalValueDiffUSD: number;
  totalValueDiffPercent: number;
  positionsOnlyInA: number;
  positionsOnlyInB: number;
  commonPositions: number;
  changedPositions: number;
}

/**
 * 数据源对比结果
 */
export interface DataSourceCompareResult {
  addressA: AddressDefiData;  // 数据源 A（Zerion）
  addressB: AddressDefiData;  // 数据源 B（OneKey）
  summary: CompareSummary;
  positionDiffs: PositionDiff[];
}

/**
 * API 响应包装
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
