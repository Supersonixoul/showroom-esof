import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
