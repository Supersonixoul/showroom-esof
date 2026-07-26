import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

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

  /// Code d'identification unique à 3 caractères alphanumériques. Optionnel :
  /// s'il n'est pas fourni, il est généré automatiquement à partir de `nom`.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9]{3}$/, {
    message: 'Le code doit contenir exactement 3 caractères alphanumériques (A-Z, 0-9)',
  })
  code?: string;
}
