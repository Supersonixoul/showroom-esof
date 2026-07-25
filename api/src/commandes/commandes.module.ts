import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommandesService } from './commandes.service';
import { CommandesController } from './commandes.controller';

@Module({
  imports: [AuthModule],
  controllers: [CommandesController],
  providers: [CommandesService],
})
export class CommandesModule {}
