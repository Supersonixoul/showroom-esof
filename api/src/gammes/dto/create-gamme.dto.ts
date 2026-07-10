import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateGammeDto {
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
  brandId: string;
}
