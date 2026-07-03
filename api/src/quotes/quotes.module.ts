import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';

@Module({
  imports: [AuthModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
