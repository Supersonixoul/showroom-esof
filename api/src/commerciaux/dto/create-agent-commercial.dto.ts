import { IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/// Format international attendu pour le lien WhatsApp (wa.me), ex. +22670123456.
const TELEPHONE_REGEX = /^\+226\d{8}$/;

export class CreateAgentCommercialDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  prenom: string;

  @Matches(TELEPHONE_REGEX, {
    message: 'telephone1 doit être au format +226 suivi de 8 chiffres',
  })
  telephone1: string;

  @IsOptional()
  @Matches(TELEPHONE_REGEX, {
    message: 'telephone2 doit être au format +226 suivi de 8 chiffres',
  })
  telephone2?: string;

  /// Accès à la rubrique "Traitement" — facultatif, un admin peut créer un
  /// commercial sans lui attribuer d'accès tout de suite.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  identifiant?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  motDePasse?: string;
}
