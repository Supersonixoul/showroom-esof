import { Module } from '@nestjs/common';
import { TvController } from './tv.controller';

@Module({
  controllers: [TvController],
})
export class TvModule {}
