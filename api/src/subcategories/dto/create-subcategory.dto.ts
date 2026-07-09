import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSubcategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsNotEmpty()
  @IsUUID()
  categoryId: string;
}
