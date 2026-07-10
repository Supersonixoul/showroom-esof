import { Module } from '@nestjs/common';
import { GammesService } from './gammes.service';
import { GammesController } from './gammes.controller';

@Module({
  controllers: [GammesController],
  providers: [GammesService],
  exports: [GammesService],
})
export class GammesModule {}
