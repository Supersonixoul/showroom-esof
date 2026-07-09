import { Controller, Get, Header } from '@nestjs/common';
import { TV_PAGE_HTML } from './tv-page';
import { TV_CLIENT_JS } from './tv-client';

/// Public — page plein écran pour navigateur TV (WebOS), aucune session requise.
@Controller('tv')
export class TvController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPage(): string {
    return TV_PAGE_HTML;
  }

  @Get('tv.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  getClientScript(): string {
    return TV_CLIENT_JS;
  }
}
