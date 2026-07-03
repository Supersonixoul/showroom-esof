import { Type } from 'class-transformer';
import { ArrayMinSize, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { QuoteStatus } from '../../../generated/prisma/client';
import { CreateQuoteItemDto } from './create-quote-item.dto';

export class UpdateQuoteDto {
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @IsOptional()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items?: CreateQuoteItemDto[];
}
