import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ImageOptimizationService } from './image-optimization.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ImageOptimizationService],
  exports: [ImageOptimizationService],
})
export class ProductsModule {}
