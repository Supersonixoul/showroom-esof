import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateQuoteItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  note?: string;
}
