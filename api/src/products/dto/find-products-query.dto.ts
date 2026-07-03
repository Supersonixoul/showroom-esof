import { IsOptional, IsUUID } from 'class-validator';

export class FindProductsQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
