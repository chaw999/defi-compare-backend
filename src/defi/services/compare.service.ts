import { Injectable, Logger } from '@nestjs/common';
import {
  AddressDefiData,
  Position,
  PositionDiff,
  CompareResult,
  CompareSummary,
  DiffType,
} from '../../common/interfaces/defi-data.interface';
import { ZerionService } from './zerion.service';
import { PlaceholderService } from './placeholder.service';

/**
 * 数据对比服务
 * 用于对比两个数据源或两个地址的 DeFi 数据差异
 */
@Injectable()
export class CompareService {
  private readonly logger = new Logger(CompareService.name);

  constructor(
    private readonly zerionService: ZerionService,
    private readonly placeholderService: PlaceholderService,
  ) {}

  /**
   * 对比两个地址的 DeFi 数据（使用 Zerion 数据源）
   */
  async compareAddresses(
    addressA: string,
    addressB: string,
  ): Promise<CompareResult> {
    this.logger.log(`Comparing addresses: ${addressA} vs ${addressB}`);

    const [dataA, dataB] = await Promise.all([
      this.zerionService.getAddressDefiData(addressA),
      this.zerionService.getAddressDefiData(addressB),
    ]);

    return this.compareDefiData(dataA, dataB);
  }

  /**
   * 对比同一地址在两个不同数据源的数据
   */
  async compareDataSources(address: string): Promise<CompareResult> {
    this.logger.log(`Comparing data sources for address: ${address}`);

    const [zerionData, placeholderData] = await Promise.all([
      this.zerionService.getAddressDefiData(address),
      this.placeholderService.getAddressDefiData(address),
    ]);

    return this.compareDefiData(zerionData, placeholderData);
  }

  /**
   * 对比两份 DeFi 数据
   */
  compareDefiData(dataA: AddressDefiData, dataB: AddressDefiData): CompareResult {
    const positionDiffs = this.comparePositions(dataA.positions, dataB.positions);
    const summary = this.calculateSummary(dataA, dataB, positionDiffs);

    return {
      addressA: dataA,
      addressB: dataB,
      summary,
      positionDiffs,
    };
  }

  /**
   * 对比两组持仓数据
   */
  private comparePositions(
    positionsA: Position[],
    positionsB: Position[],
  ): PositionDiff[] {
    const diffs: PositionDiff[] = [];

    // 创建持仓映射（使用 protocol + chain + type 作为 key）
    const mapA = this.createPositionMap(positionsA);
    const mapB = this.createPositionMap(positionsB);

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

    for (const key of allKeys) {
      const positionA = mapA.get(key);
      const positionB = mapB.get(key);

      if (positionA && positionB) {
        // 两边都有，检查是否有变化
        const valueDiff = positionB.totalValueUSD - positionA.totalValueUSD;
        const valueDiffPercent =
          positionA.totalValueUSD > 0
            ? (valueDiff / positionA.totalValueUSD) * 100
            : positionB.totalValueUSD > 0
              ? 100
              : 0;

        const diffType: DiffType =
          Math.abs(valueDiffPercent) > 0.01 ? 'changed' : 'unchanged';

        if (diffType === 'changed') {
          diffs.push({
            protocol: positionA.protocol.name,
            chain: positionA.protocol.chain,
            type: positionA.type,
            diffType,
            positionA,
            positionB,
            valueDiffUSD: valueDiff,
            valueDiffPercent,
          });
        }
      } else if (positionA && !positionB) {
        // 只在 A 中存在（B 中移除）
        diffs.push({
          protocol: positionA.protocol.name,
          chain: positionA.protocol.chain,
          type: positionA.type,
          diffType: 'removed',
          positionA,
          valueDiffUSD: -positionA.totalValueUSD,
          valueDiffPercent: -100,
        });
      } else if (!positionA && positionB) {
        // 只在 B 中存在（新增）
        diffs.push({
          protocol: positionB.protocol.name,
          chain: positionB.protocol.chain,
          type: positionB.type,
          diffType: 'added',
          positionB,
          valueDiffUSD: positionB.totalValueUSD,
          valueDiffPercent: 100,
        });
      }
    }

    // 按差异类型和价值排序
    return diffs.sort((a, b) => {
      const typeOrder: Record<DiffType, number> = {
        added: 1,
        removed: 2,
        changed: 3,
        unchanged: 4,
      };

      if (typeOrder[a.diffType] !== typeOrder[b.diffType]) {
        return typeOrder[a.diffType] - typeOrder[b.diffType];
      }

      return Math.abs(b.valueDiffUSD || 0) - Math.abs(a.valueDiffUSD || 0);
    });
  }

  /**
   * 创建持仓映射
   */
  private createPositionMap(positions: Position[]): Map<string, Position> {
    const map = new Map<string, Position>();

    for (const position of positions) {
      // 使用 protocol.id + chain + type 作为唯一键
      const key = `${position.protocol.id}:${position.protocol.chain}:${position.type}`;

      // 如果有重复的 key，合并 totalValueUSD
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.totalValueUSD += position.totalValueUSD;
        existing.tokens.push(...position.tokens);
      } else {
        // 创建副本避免修改原数据
        map.set(key, {
          ...position,
          tokens: [...position.tokens],
        });
      }
    }

    return map;
  }

  /**
   * 计算对比摘要
   */
  private calculateSummary(
    dataA: AddressDefiData,
    dataB: AddressDefiData,
    diffs: PositionDiff[],
  ): CompareSummary {
    const totalValueDiffUSD = dataB.totalValueUSD - dataA.totalValueUSD;
    const totalValueDiffPercent =
      dataA.totalValueUSD > 0
        ? (totalValueDiffUSD / dataA.totalValueUSD) * 100
        : dataB.totalValueUSD > 0
          ? 100
          : 0;

    const positionsOnlyInA = diffs.filter((d) => d.diffType === 'removed').length;
    const positionsOnlyInB = diffs.filter((d) => d.diffType === 'added').length;
    const changedPositions = diffs.filter((d) => d.diffType === 'changed').length;

    // 计算共同持仓（所有持仓数 - 仅在 A 中 - 仅在 B 中）
    const totalUniquePositionsA = dataA.positions.length;
    const commonPositions = totalUniquePositionsA - positionsOnlyInA;

    return {
      totalValueDiffUSD,
      totalValueDiffPercent,
      positionsOnlyInA,
      positionsOnlyInB,
      commonPositions,
      changedPositions,
    };
  }

  /**
   * 序列化对比结果为 JSON 字符串
   */
  serializeCompareResult(result: CompareResult): string {
    return JSON.stringify(result, null, 2);
  }

  /**
   * 生成对比报告文本
   */
  generateCompareReport(result: CompareResult): string {
    const { summary, addressA, addressB } = result;
    const lines: string[] = [
      '='.repeat(60),
      'DeFi 数据对比报告',
      '='.repeat(60),
      '',
      `数据源 A: ${addressA.source} (${addressA.address})`,
      `数据源 B: ${addressB.source} (${addressB.address})`,
      '',
      '-'.repeat(40),
      '总览',
      '-'.repeat(40),
      `A 总价值: $${addressA.totalValueUSD.toLocaleString()}`,
      `B 总价值: $${addressB.totalValueUSD.toLocaleString()}`,
      `差异: $${summary.totalValueDiffUSD.toLocaleString()} (${summary.totalValueDiffPercent.toFixed(2)}%)`,
      '',
      '-'.repeat(40),
      '持仓统计',
      '-'.repeat(40),
      `仅在 A 中: ${summary.positionsOnlyInA}`,
      `仅在 B 中: ${summary.positionsOnlyInB}`,
      `共同持仓: ${summary.commonPositions}`,
      `有变化的: ${summary.changedPositions}`,
      '',
    ];

    if (result.positionDiffs.length > 0) {
      lines.push('-'.repeat(40));
      lines.push('持仓差异详情');
      lines.push('-'.repeat(40));

      for (const diff of result.positionDiffs) {
        const icon =
          diff.diffType === 'added'
            ? '+'
            : diff.diffType === 'removed'
              ? '-'
              : '~';
        const position = diff.positionA || diff.positionB;
        lines.push(
          `[${icon}] ${diff.protocol} (${diff.chain}) - ${diff.type}`,
        );
        if (position) {
          lines.push(`    价值: $${position.totalValueUSD.toLocaleString()}`);
        }
        if (diff.valueDiffUSD !== undefined) {
          lines.push(
            `    差异: $${diff.valueDiffUSD.toLocaleString()} (${diff.valueDiffPercent?.toFixed(2)}%)`,
          );
        }
        lines.push('');
      }
    }

    lines.push('='.repeat(60));

    return lines.join('\n');
  }
}

