import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DefiController } from './defi.controller';
import { ZerionService } from './services/zerion.service';
import { PlaceholderService } from './services/placeholder.service';
import { CompareService } from './services/compare.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [DefiController],
  providers: [ZerionService, PlaceholderService, CompareService],
  exports: [ZerionService, PlaceholderService, CompareService],
})
export class DefiModule {}

