import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { ZerionService } from './services/zerion.service';
import { PlaceholderService } from './services/placeholder.service';
import { CompareService } from './services/compare.service';
import { ApiResponse } from '../common/dto/response.dto';
import {
  AddressDefiData,
  CompareResult,
} from '../common/interfaces/defi-data.interface';

@Controller()
export class DefiController {
  private readonly logger = new Logger(DefiController.name);

  constructor(
    private readonly zerionService: ZerionService,
    private readonly placeholderService: PlaceholderService,
    private readonly compareService: CompareService,
  ) {}

  /**
   * 获取地址的 DeFi 数据（使用 Zerion 数据源）
   * GET /api/address/:address
   */
  @Get('address/:address')
  async getAddressData(
    @Param('address') address: string,
  ): Promise<ApiResponse<AddressDefiData>> {
    this.logger.log(`Getting DeFi data for address: ${address}`);

    try {
      const data = await this.zerionService.getAddressDefiData(address);
      return ApiResponse.success(data);
    } catch (error) {
      this.logger.error(`Failed to get address data:`, error);
      return ApiResponse.error(
        error instanceof Error ? error.message : 'Failed to fetch data',
      );
    }
  }

  /**
   * 获取地址的 DeFi 数据（指定数据源）
   * GET /api/address/:address/source/:source
   */
  @Get('address/:address/source/:source')
  async getAddressDataBySource(
    @Param('address') address: string,
    @Param('source') source: string,
  ): Promise<ApiResponse<AddressDefiData>> {
    this.logger.log(`Getting DeFi data for ${address} from source: ${source}`);

    try {
      let data: AddressDefiData;

      switch (source.toLowerCase()) {
        case 'zerion':
          data = await this.zerionService.getAddressDefiData(address);
          break;
        case 'placeholder':
          data = await this.placeholderService.getAddressDefiData(address);
          break;
        default:
          return ApiResponse.error(`Unknown data source: ${source}`);
      }

      return ApiResponse.success(data);
    } catch (error) {
      this.logger.error(`Failed to get address data:`, error);
      return ApiResponse.error(
        error instanceof Error ? error.message : 'Failed to fetch data',
      );
    }
  }

  /**
   * 对比两个地址的 DeFi 数据
   * GET /api/compare?addressA=xxx&addressB=xxx
   */
  @Get('compare')
  async compareAddresses(
    @Query('addressA') addressA: string,
    @Query('addressB') addressB: string,
  ): Promise<ApiResponse<CompareResult>> {
    if (!addressA || !addressB) {
      return ApiResponse.error('Both addressA and addressB are required');
    }

    this.logger.log(`Comparing addresses: ${addressA} vs ${addressB}`);

    try {
      const result = await this.compareService.compareAddresses(
        addressA,
        addressB,
      );
      return ApiResponse.success(result);
    } catch (error) {
      this.logger.error(`Failed to compare addresses:`, error);
      return ApiResponse.error(
        error instanceof Error ? error.message : 'Failed to compare',
      );
    }
  }

  /**
   * 对比同一地址在不同数据源的数据差异
   * GET /api/compare/sources/:address
   */
  @Get('compare/sources/:address')
  async compareDataSources(
    @Param('address') address: string,
  ): Promise<ApiResponse<CompareResult>> {
    this.logger.log(`Comparing data sources for address: ${address}`);

    try {
      const result = await this.compareService.compareDataSources(address);
      return ApiResponse.success(result);
    } catch (error) {
      this.logger.error(`Failed to compare data sources:`, error);
      return ApiResponse.error(
        error instanceof Error ? error.message : 'Failed to compare sources',
      );
    }
  }

  /**
   * 健康检查
   * GET /api/health
   */
  @Get('health')
  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    return ApiResponse.success({ status: 'ok' });
  }
}

