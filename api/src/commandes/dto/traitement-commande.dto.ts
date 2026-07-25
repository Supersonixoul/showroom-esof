import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class LigneTraitementInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
  produitId: string;

  @IsInt()
  @Min(1)
  quantite: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prixUnitaire?: number;
}

export class TraitementCommandeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LigneTraitementInputDto)
  lignes: LigneTraitementInputDto[];

  @IsOptional()
  @IsBoolean()
  tvaApplicable?: boolean;

  @IsOptional()
  @IsBoolean()
  bicApplicable?: boolean;
}
