import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class LigneCommandeInputDto {
  @IsUUID()
  produitId: string;

  @IsInt()
  @Min(1)
  quantite: number;
}

export class CreateCommandeDto {
  @IsUUID()
  commercialId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LigneCommandeInputDto)
  lignes: LigneCommandeInputDto[];
}
