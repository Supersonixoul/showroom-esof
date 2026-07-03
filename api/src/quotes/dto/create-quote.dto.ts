import { Type } from 'class-transformer';
import { ArrayMinSize, IsUUID, ValidateNested } from 'class-validator';
import { CreateQuoteItemDto } from './create-quote-item.dto';

export class CreateQuoteDto {
  @IsUUID()
  clientId: string;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items: CreateQuoteItemDto[];
}
