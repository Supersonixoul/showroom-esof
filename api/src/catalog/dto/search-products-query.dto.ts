import { IsOptional, IsString } from 'class-validator';

export class SearchProductsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}
