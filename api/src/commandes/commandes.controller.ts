import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { CommandesService } from './commandes.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { ProAuthGuard } from '../auth/pro-auth.guard';
import { ProOrAdminGuard } from '../auth/pro-or-admin.guard';

interface RequestWithAuth {
  pro?: { professionnelId: string };
  user?: { userId: string };
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
}
