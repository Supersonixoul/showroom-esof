import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { buildQuotePdf } from './quote-pdf.builder';
import type { AuthUser } from './quotes.service';

/// Devis (spec §5.4) — accessible aux commerciaux et admins authentifiés.
/// Un commercial ne voit/modifie que ses propres devis, un admin voit tout.
@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  create(@Body() dto: CreateQuoteDto, @CurrentUser() user: AuthUser) {
    return this.quotesService.create(dto, user.userId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.quotesService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.quotesService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quotesService.update(id, dto, user);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const quote = await this.quotesService.findOne(id, user);
    const buffer = await buildQuotePdf(quote);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="devis-${quote.id}.pdf"`,
    });
    res.send(buffer);
  }
}
