import { IsOptional, IsUUID } from 'class-validator';

export class FindSubcategoriesQueryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
