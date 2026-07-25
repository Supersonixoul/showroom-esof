import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProfessionnelDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  identifiant: string;

  @IsString()
  @MinLength(6)
  motDePasse: string;

  @IsString()
  @IsNotEmpty()
  telephone1: string;

  @IsOptional()
  @IsString()
  telephone2?: string;
}
