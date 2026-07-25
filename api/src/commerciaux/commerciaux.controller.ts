import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CommerciauxService } from './commerciaux.service';
import { CreateAgentCommercialDto } from './dto/create-agent-commercial.dto';
import { UpdateAgentCommercialDto } from './dto/update-agent-commercial.dto';
import { LoginAgentCommercialDto } from './dto/login-agent-commercial.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ProOrAdminGuard } from '../auth/pro-or-admin.guard';
import { Role } from '../../generated/prisma/client';

interface RequestWithAuth {
  pro?: { professionnelId: string };
  user?: { userId: string; role: Role };
}

@Controller('commerciaux')
export class CommerciauxController {
  constructor(private readonly commerciauxService: CommerciauxService) {}

  /// Public — connexion à la rubrique "Traitement". Throttle strict, même
  /// principe que /professionnels/login.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  login(@Body() dto: LoginAgentCommercialDto) {
    return this.commerciauxService.login(dto);
  }

  @UseGuards(ProOrAdminGuard)
  @Get()
  findAll(@Req() request: RequestWithAuth) {
    return this.commerciauxService.findAll(Boolean(request.pro));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateAgentCommercialDto) {
    return this.commerciauxService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentCommercialDto,
  ) {
    return this.commerciauxService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.commerciauxService.remove(id);
  }
}
