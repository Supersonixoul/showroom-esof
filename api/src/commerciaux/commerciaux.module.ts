import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommerciauxService } from './commerciaux.service';
import { CommerciauxController } from './commerciaux.controller';

@Module({
  imports: [AuthModule],
  controllers: [CommerciauxController],
  providers: [CommerciauxService],
})
export class CommerciauxModule {}
