import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommandesService } from './commandes.service';
import { CommandesController } from './commandes.controller';
import { ProformaService } from './proforma.service';

@Module({
  imports: [AuthModule],
  controllers: [CommandesController],
  providers: [CommandesService, ProformaService],
})
export class CommandesModule {}
