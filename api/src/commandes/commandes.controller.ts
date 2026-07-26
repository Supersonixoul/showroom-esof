import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { CommandesService } from './commandes.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { UpdateCommandeDto } from './dto/update-commande.dto';
import { TraitementCommandeDto } from './dto/traitement-commande.dto';
import { AnnulationCommandeDto } from './dto/annulation-commande.dto';
import { ProAuthGuard } from '../auth/pro-auth.guard';
import { ProOrAdminGuard } from '../auth/pro-or-admin.guard';
import { CommercialAuthGuard } from '../auth/commercial-auth.guard';
import { CommercialOrAdminGuard } from '../auth/commercial-or-admin.guard';

interface RequestWithAuth {
  pro?: { professionnelId: string };
  user?: { userId: string };
  commercial?: { agentCommercialId: string; identifiant: string };
}

@Controller('commandes')
export class CommandesController {
  constructor(private readonly commandesService: CommandesService) {}

  @UseGuards(ProAuthGuard)
  @Post()
  create(@Req() request: RequestWithAuth, @Body() dto: CreateCommandeDto) {
    return this.commandesService.create(request.pro!.professionnelId, dto);
  }

  @UseGuards(ProOrAdminGuard)
  @Get()
  findAll(@Req() request: RequestWithAuth) {
    if (request.pro) {
      return this.commandesService.findAllForProfessionnel(request.pro.professionnelId);
    }
    return this.commandesService.findAllForAdmin();
  }

  @UseGuards(CommercialAuthGuard)
  @Get('a-traiter')
  findAllForCommercial(@Req() request: RequestWithAuth, @Query('statut') statut?: string) {
    return this.commandesService.findAllForCommercial(
      request.commercial!.agentCommercialId,
      statut,
    );
  }

  @UseGuards(ProAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithAuth,
    @Body() dto: UpdateCommandeDto,
  ) {
    return this.commandesService.updateForProfessionnel(id, request.pro!.professionnelId, dto);
  }

  @UseGuards(CommercialAuthGuard)
  @Patch(':id/traitement')
  traitement(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithAuth,
    @Body() dto: TraitementCommandeDto,
  ) {
    return this.commandesService.traitement(id, request.commercial!.agentCommercialId, dto);
  }

  @UseGuards(CommercialAuthGuard)
  @Post(':id/proforma')
  proforma(@Param('id', ParseUUIDPipe) id: string, @Req() request: RequestWithAuth) {
    return this.commandesService.proforma(id, request.commercial!.agentCommercialId);
  }

  @UseGuards(CommercialAuthGuard)
  @Post(':id/annulation')
  annulation(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithAuth,
    @Body() dto: AnnulationCommandeDto,
  ) {
    return this.commandesService.annulation(id, request.commercial!.agentCommercialId, dto);
  }

  @UseGuards(CommercialOrAdminGuard)
  @Get(':id/proforma.pdf')
  async downloadProforma(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithAuth,
    @Res() res: Response,
  ) {
    const path = await this.commandesService.getProformaPath(id, {
      commercialId: request.commercial?.agentCommercialId,
      isAdmin: !!request.user,
    });
    if (!existsSync(path)) {
      throw new NotFoundException('Fichier proforma introuvable');
    }
    res.download(path);
  }
}
