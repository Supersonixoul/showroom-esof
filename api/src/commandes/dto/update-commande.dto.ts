import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LigneCommandeInputDto } from './create-commande.dto';

/// Modification d'une commande par son Client propriétaire (rubrique
/// "Commander") — remplace intégralement les lignes si fournies.
/// `numero` est accepté pour ne pas faire échouer un client qui le
/// renverrait tel quel, mais n'est jamais lu par le service : le numéro
/// est immuable après création.
export class UpdateCommandeDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LigneCommandeInputDto)
  lignes?: LigneCommandeInputDto[];

  @IsOptional()
  @IsString()
  numero?: string;
}
