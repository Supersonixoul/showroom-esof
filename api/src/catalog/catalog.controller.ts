import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SyncQueryDto } from './dto/sync-query.dto';
import { FindCatalogProductsQueryDto } from './dto/find-catalog-products-query.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('full')
  getFull() {
    return this.catalogService.getFull();
  }

  @Get('sync')
  getSince(@Query() query: SyncQueryDto) {
    return this.catalogService.getSince(new Date(query.since));
  }

  /// Public — consommé par le kiosque TV (pas de session), spec §5.3.
  @Get('promo-videos')
  getActivePromoVideos() {
    return this.catalogService.getActivePromoVideos();
  }

  // ---- Mode « Catalogue produits » du kiosque TV — public, lecture seule ----

  @Get('categories')
  getCatalogCategories() {
    return this.catalogService.getCatalogCategories();
  }

  @Get('products')
  getCatalogProducts(@Query() query: FindCatalogProductsQueryDto) {
    return this.catalogService.getCatalogProducts(query);
  }

  @Get('products/:id')
  getCatalogProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.getCatalogProduct(id);
  }
}
