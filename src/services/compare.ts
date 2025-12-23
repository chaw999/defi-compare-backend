/**
 * 数据源对比服务
 */
import type { 
  AddressDefiData, 
  DataSourceCompareResult, 
  PositionDiff,
  CompareSummary,
  Position,
  DiffType
} from '../types';

/**
 * 生成 position 的唯一标识 key
 * 用于在两个数据源之间匹配相同的 position
 */
function getPositionKey(position: Position): string {
  // 使用 protocol + chain + token symbol 作为匹配 key
  const tokenSymbol = position.tokens[0]?.token.symbol || 'unknown';
  return `${position.protocol.id}-${position.protocol.chain}-${tokenSymbol}`.toLowerCase();
}

/**
 * 对比两个数据源的数据
 */
export function compareDataSources(
  sourceAData: AddressDefiData,
  sourceBData: AddressDefiData
): DataSourceCompareResult {
  const positionDiffs: PositionDiff[] = [];

  // 创建 position 映射（使用自定义 key 而非 id）
  const sourceAPositionMap = new Map<string, Position>();
  const sourceBPositionMap = new Map<string, Position>();

  sourceAData.positions.forEach(p => {
    sourceAPositionMap.set(getPositionKey(p), p);
  });

  sourceBData.positions.forEach(p => {
    sourceBPositionMap.set(getPositionKey(p), p);
  });

  let positionsOnlyInA = 0;
  let positionsOnlyInB = 0;
  let commonPositions = 0;
  let changedPositions = 0;

  // 检查 source A 的 positions
  for (const [key, posA] of sourceAPositionMap) {
    const posB = sourceBPositionMap.get(key);

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
        // 匹配
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

  // 检查只在 source B 中的 positions
  for (const [key, posB] of sourceBPositionMap) {
    if (!sourceAPositionMap.has(key)) {
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

  return {
    addressA: sourceAData,
    addressB: sourceBData,
    summary,
    positionDiffs,
  };
}
