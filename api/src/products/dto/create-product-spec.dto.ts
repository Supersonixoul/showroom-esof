import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProductSpecDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}
