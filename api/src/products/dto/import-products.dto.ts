import { ArrayMinSize, IsArray, IsOptional, IsUUID } from 'class-validator';
import { ImportProductRowDto } from './import-product-row.dto';

export class ImportProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  rows: ImportProductRowDto[];

  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string | null;

  @IsOptional()
  @IsUUID()
  gammeId?: string | null;
}
