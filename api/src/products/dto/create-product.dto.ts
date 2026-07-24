import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Quantité en stock — gérée uniquement côté admin (voir catalog.service.ts
   * `toPublicProduct` pour le badge de disponibilité exposé au public). */
  @IsOptional()
  @IsInt()
  @Min(0)
  quantiteStock?: number;

  /** Si vrai, `quantiteStock` est exposé tel quel aux apps publiques en plus
   * du badge Disponible/Épuisé. */
  @IsOptional()
  @IsBoolean()
  afficherQuantite?: boolean;

  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string | null;

  @IsOptional()
  @IsUUID()
  gammeId?: string | null;
}
