import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  IDefiDataProvider,
  AddressDefiData,
  Position,
  PositionType,
  TokenBalance,
  Protocol,
  Token,
} from '../../common/interfaces/defi-data.interface';

/**
 * Zerion API 数据源服务
 * 从 Zerion API 获取 DeFi 数据
 */
@Injectable()
export class ZerionService implements IDefiDataProvider {
  private readonly logger = new Logger(ZerionService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.zerion.io/v1';

  readonly sourceName = 'zerion';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('ZERION_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('ZERION_API_KEY is not set in environment variables');
    }
  }

  /**
   * 获取请求头
   */
  private getHeaders() {
    return {
      accept: 'application/json',
      authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
    };
  }

  /**
   * 获取地址的 DeFi 数据（包含 portfolio 和 positions）
   */
  async getAddressDefiData(address: string): Promise<AddressDefiData> {
    const normalizedAddress = address.toLowerCase();
    this.logger.log(`Fetching DeFi data for address: ${normalizedAddress}`);

    try {
      // 并行获取 portfolio 和 positions
      const [portfolioData, positionsData] = await Promise.all([
        this.fetchPortfolio(normalizedAddress),
        this.fetchPositions(normalizedAddress),
      ]);

      this.logger.log(
        `Portfolio total: $${portfolioData.totalValue}, Raw positions count: ${positionsData.length}`,
      );

      const positions = this.transformPositions(positionsData);
      const chains = [...new Set(positions.map((p) => p.protocol.chain))];

      this.logger.log(
        `Transformed positions: ${positions.length}, Chains: ${chains.join(', ')}`,
      );

      return {
        address: normalizedAddress,
        totalValueUSD: portfolioData.totalValue || 0,
        positions,
        chains,
        lastUpdated: new Date().toISOString(),
        source: this.sourceName,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch DeFi data for ${address}:`, error);
      throw error;
    }
  }

  /**
   * 获取原始 Zerion API 数据（用于调试）
   */
  async getRawPositions(address: string): Promise<unknown[]> {
    const normalizedAddress = address.toLowerCase();
    return this.fetchPositions(normalizedAddress);
  }

  /**
   * 获取 Portfolio 总览
   */
  async getPortfolio(address: string): Promise<AddressDefiData> {
    return this.getAddressDefiData(address);
  }

  /**
   * 获取 Portfolio 数据
   */
  private async fetchPortfolio(
    address: string,
  ): Promise<{ totalValue: number }> {
    try {
      const url = `${this.baseUrl}/wallets/${address}/portfolio`;
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getHeaders(),
          params: {
            currency: 'usd',
          },
        }),
      );

      const data = response.data?.data?.attributes;
      return {
        totalValue: data?.total?.positions || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch portfolio:`, error);
      return { totalValue: 0 };
    }
  }

  /**
   * 获取 DeFi Positions
   * 使用与 Zerion 官方脚本相同的参数
   */
  private async fetchPositions(address: string): Promise<unknown[]> {
    const MAX_RETRIES = 3;
    let retries = 0;

    while (retries < MAX_RETRIES) {
      try {
        const url = `${this.baseUrl}/wallets/${address}/positions`;
        this.logger.debug(`Fetching positions from: ${url}`);

        const response = await firstValueFrom(
          this.httpService.get(url, {
            headers: this.getHeaders(),
            params: {
              currency: 'usd',
              'filter[positions]': 'no_filter',
              'filter[trash]': 'no_filter',
            },
          }),
        );

        // 处理 202 状态（数据处理中）
        if (response.status === 202) {
          this.logger.warn('Data processing (202), retrying in 3s...');
          await this.sleep(3000);
          retries++;
          continue;
        }

        const positions = response.data?.data || [];
        this.logger.log(`Got ${positions.length} positions for ${address}`);
        return positions;
      } catch (error: unknown) {
        const axiosError = error as { response?: { status?: number }; message?: string };
        
        // 处理 429 限流
        if (axiosError.response?.status === 429) {
          this.logger.warn('Rate limited (429), retrying in 5s...');
          await this.sleep(5000);
          retries++;
          continue;
        }

        this.logger.error(`Failed to fetch positions: ${axiosError.message}`);
        return [];
      }
    }

    this.logger.warn(`Max retries reached for ${address}`);
    return [];
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 转换 Zerion positions 数据为统一格式
   * 参考结构: data[i].relationships.chain.data.id (e.g. "ethereum")
   */
  private transformPositions(rawPositions: unknown[]): Position[] {
    this.logger.debug(`Transforming ${rawPositions.length} raw positions`);

    return rawPositions.map((item: unknown, index: number) => {
      const position = item as {
        id?: string;
        type?: string;
        attributes?: {
          position_type?: string;
          value?: number;
          protocol?: string;
          name?: string;
          fungible_info?: {
            symbol?: string;
            name?: string;
            icon?: { url?: string };
            implementations?: Array<{
              address?: string;
              decimals?: number;
              chain_id?: string;
            }>;
          };
          quantity?: {
            float?: number;
            decimals?: number;
            numeric?: string;
          };
          price?: number;
        };
        relationships?: {
          protocol?: {
            data?: {
              id?: string;
            };
          };
          chain?: {
            data?: {
              id?: string;
            };
          };
        };
      };

      const attrs = position.attributes || {};
      const relationships = position.relationships || {};

      // 从 relationships 获取 chain ID（如 "ethereum", "arbitrum"）
      const chainId = relationships.chain?.data?.id || 'unknown';

      // 协议信息
      const protocolId = relationships.protocol?.data?.id || attrs.protocol || 'wallet';
      const protocol: Protocol = {
        id: protocolId,
        name: attrs.protocol || attrs.name || protocolId,
        chain: chainId,
      };

      // 代币信息
      const fungibleInfo = attrs.fungible_info || {};
      const implementation = fungibleInfo.implementations?.[0] || {};

      const token: Token = {
        symbol: fungibleInfo.symbol || 'UNKNOWN',
        name: fungibleInfo.name || attrs.name || 'Unknown Token',
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

      const positionType = this.mapPositionType(attrs.position_type);

      return {
        id: position.id || `${protocol.id}-${chainId}-${index}`,
        protocol,
        type: positionType,
        tokens: [tokenBalance],
        totalValueUSD: attrs.value || 0,
        metadata: {
          rawType: attrs.position_type,
          zerionType: position.type,
        },
      };
    });
  }

  /**
   * 映射 Zerion position type 到统一类型
   */
  private mapPositionType(zerionType?: string): PositionType {
    const typeMap: Record<string, PositionType> = {
      deposit: 'lending',
      loan: 'borrowing',
      staked: 'staking',
      locked: 'staking',
      leveraged_position: 'lending',
      liquidity: 'liquidity',
      farming: 'farming',
      wallet: 'wallet',
    };

    return typeMap[zerionType || ''] || 'other';
  }
}

