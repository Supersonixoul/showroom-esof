import { IsString, MinLength } from 'class-validator';

export class SearchProductsQueryDto {
  @IsString()
  @MinLength(2)
  q: string;
}
