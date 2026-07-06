import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SyncQueryDto } from './dto/sync-query.dto';

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
}
