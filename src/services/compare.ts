/**
 * 数据源对比服务
 * 参考: Zerion vs OneKey API 字段比對分析
 * 
 * 对比逻辑：
 * - 使用 protocol + chain + token symbol 作为匹配 key
 * - 计算 netWorth = totalValue + totalReward - totalDebt
 * - 差异超过 1% 认为有变化
 */
import type { 
  AddressDefiData, 
  DataSourceCompareResult, 
  PositionDiff,
  CompareSummary,
  Position,
  PositionType
} from '../types';

/**
 * 生成 position 的匹配 key
 * 用于在两个数据源之间匹配相同的 position
 */
function getPositionMatchKey(position: Position): string {
  const tokenSymbols = position.tokens
    .map(t => t.token.symbol.toLowerCase())
    .sort()
    .join('+');
  
  // 使用 protocol + chain + type + tokens 作为匹配 key
  return `${position.protocol.id}-${position.protocol.chain}-${position.type}-${tokenSymbols}`.toLowerCase();
}

/**
 * 生成更宽松的匹配 key（仅 protocol + chain + 主要 token）
 */
function getLooseMatchKey(position: Position): string {
  const mainToken = position.tokens[0]?.token.symbol.toLowerCase() || 'unknown';
  return `${position.protocol.id}-${position.protocol.chain}-${mainToken}`.toLowerCase();
}

/**
 * 生成按协议分组的 key
 */
function getProtocolKey(position: Position): string {
  return `${position.protocol.id}-${position.protocol.chain}`.toLowerCase();
}

/**
 * 对比两个数据源的数据
 */
export function compareDataSources(
  sourceAData: AddressDefiData,
  sourceBData: AddressDefiData
): DataSourceCompareResult {
  const positionDiffs: PositionDiff[] = [];

  // 创建多层级匹配映射
  const sourceAByExactKey = new Map<string, Position>();
  const sourceAByLooseKey = new Map<string, Position[]>();
  const sourceBByExactKey = new Map<string, Position>();
  const sourceBByLooseKey = new Map<string, Position[]>();

  // 建立 A 的索引
  sourceAData.positions.forEach(p => {
    const exactKey = getPositionMatchKey(p);
    const looseKey = getLooseMatchKey(p);
    
    sourceAByExactKey.set(exactKey, p);
    
    if (!sourceAByLooseKey.has(looseKey)) {
      sourceAByLooseKey.set(looseKey, []);
    }
    sourceAByLooseKey.get(looseKey)!.push(p);
  });

  // 建立 B 的索引
  sourceBData.positions.forEach(p => {
    const exactKey = getPositionMatchKey(p);
    const looseKey = getLooseMatchKey(p);
    
    sourceBByExactKey.set(exactKey, p);
    
    if (!sourceBByLooseKey.has(looseKey)) {
      sourceBByLooseKey.set(looseKey, []);
    }
    sourceBByLooseKey.get(looseKey)!.push(p);
  });

  const matchedBKeys = new Set<string>();
  let positionsOnlyInA = 0;
  let positionsOnlyInB = 0;
  let commonPositions = 0;
  let changedPositions = 0;

  // 遍历 A 的 positions
  for (const posA of sourceAData.positions) {
    const exactKey = getPositionMatchKey(posA);
    const looseKey = getLooseMatchKey(posA);
    
    let posB: Position | undefined;
    let matchedKey: string | undefined;

    // 首先尝试精确匹配
    if (sourceBByExactKey.has(exactKey)) {
      posB = sourceBByExactKey.get(exactKey);
      matchedKey = exactKey;
    } 
    // 其次尝试宽松匹配
    else if (sourceBByLooseKey.has(looseKey)) {
      const candidates = sourceBByLooseKey.get(looseKey)!;
      // 找到未被匹配且值最接近的
      for (const candidate of candidates) {
        const candidateKey = getPositionMatchKey(candidate);
        if (!matchedBKeys.has(candidateKey)) {
          posB = candidate;
          matchedKey = candidateKey;
          break;
        }
      }
    }

    if (!posB) {
      // 只在 A 中存在
      positionsOnlyInA++;
      positionDiffs.push({
        protocol: posA.protocol.name,
        chain: posA.protocol.chain,
        type: posA.type,
        diffType: 'removed',
        positionA: posA,
        valueDiffUSD: -posA.totalValueUSD,
        valueDiffPercent: -100,
      });
    } else {
      // 标记 B 已被匹配
      matchedBKeys.add(matchedKey!);

      // 两边都存在，比较值差异
      const valueDiff = posB.totalValueUSD - posA.totalValueUSD;
      const percentDiff = posA.totalValueUSD > 0
        ? (valueDiff / posA.totalValueUSD) * 100
        : (posB.totalValueUSD > 0 ? 100 : 0);

      if (Math.abs(percentDiff) > 1) {
        // 差异超过 1% 认为有变化
        changedPositions++;
        positionDiffs.push({
          protocol: posA.protocol.name,
          chain: posA.protocol.chain,
          type: posA.type,
          diffType: 'changed',
          positionA: posA,
          positionB: posB,
          valueDiffUSD: valueDiff,
          valueDiffPercent: percentDiff,
        });
      } else {
        // 匹配且值相近
        commonPositions++;
        positionDiffs.push({
          protocol: posA.protocol.name,
          chain: posA.protocol.chain,
          type: posA.type,
          diffType: 'unchanged',
          positionA: posA,
          positionB: posB,
          valueDiffUSD: valueDiff,
          valueDiffPercent: percentDiff,
        });
      }
    }
  }

  // 检查只在 B 中的 positions
  for (const posB of sourceBData.positions) {
    const exactKey = getPositionMatchKey(posB);
    
    if (!matchedBKeys.has(exactKey)) {
      positionsOnlyInB++;
      positionDiffs.push({
        protocol: posB.protocol.name,
        chain: posB.protocol.chain,
        type: posB.type,
        diffType: 'added',
        positionB: posB,
        valueDiffUSD: posB.totalValueUSD,
        valueDiffPercent: 100,
      });
    }
  }

  // 计算总值差异
  const totalValueDiffUSD = sourceBData.totalValueUSD - sourceAData.totalValueUSD;
  const totalValueDiffPercent = sourceAData.totalValueUSD > 0
    ? (totalValueDiffUSD / sourceAData.totalValueUSD) * 100
    : (sourceBData.totalValueUSD > 0 ? 100 : 0);

  const summary: CompareSummary = {
    totalValueDiffUSD,
    totalValueDiffPercent,
    positionsOnlyInA,
    positionsOnlyInB,
    commonPositions,
    changedPositions,
  };

  // 按差异类型和金额排序
  positionDiffs.sort((a, b) => {
    // 先按类型排序：removed > added > changed > unchanged
    const typeOrder = { removed: 0, added: 1, changed: 2, unchanged: 3 };
    const typeCompare = typeOrder[a.diffType] - typeOrder[b.diffType];
    if (typeCompare !== 0) return typeCompare;
    
    // 同类型按差异金额绝对值排序
    return Math.abs(b.valueDiffUSD || 0) - Math.abs(a.valueDiffUSD || 0);
  });

  return {
    addressA: sourceAData,
    addressB: sourceBData,
    summary,
    positionDiffs,
  };
}

/**
 * 按协议聚合对比
 */
export function aggregateByProtocol(result: DataSourceCompareResult): Record<string, {
  protocol: string;
  chain: string;
  totalA: number;
  totalB: number;
  diff: number;
  diffPercent: number;
}> {
  const protocolTotals: Record<string, { protocol: string; chain: string; totalA: number; totalB: number }> = {};

  for (const diff of result.positionDiffs) {
    const key = getProtocolKey(diff.positionA || diff.positionB!);
    
    if (!protocolTotals[key]) {
      protocolTotals[key] = {
        protocol: diff.protocol,
        chain: diff.chain,
        totalA: 0,
        totalB: 0,
      };
    }

    protocolTotals[key].totalA += diff.positionA?.totalValueUSD || 0;
    protocolTotals[key].totalB += diff.positionB?.totalValueUSD || 0;
  }

  const result2: Record<string, any> = {};
  for (const [key, data] of Object.entries(protocolTotals)) {
    const diff = data.totalB - data.totalA;
    const diffPercent = data.totalA > 0 ? (diff / data.totalA) * 100 : 0;
    result2[key] = {
      ...data,
      diff,
      diffPercent,
    };
  }

  return result2;
}
