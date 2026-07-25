import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfessionnelsService } from './professionnels.service';
import { ProfessionnelsController } from './professionnels.controller';

@Module({
  imports: [AuthModule],
  controllers: [ProfessionnelsController],
  providers: [ProfessionnelsService],
})
export class ProfessionnelsModule {}
