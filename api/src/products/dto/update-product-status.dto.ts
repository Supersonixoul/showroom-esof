import { IsBoolean, IsNumber, IsOptional, Min, ValidateIf } from 'class-validator';

/** Tous les champs sont optionnels : seuls ceux fournis sont modifiés
 * (voir `ProductsService.updateStatus` pour les règles de cohérence
 * promo/prixPromo et promo/solde mutuellement exclusifs). */
export class UpdateProductStatusDto {
  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @IsBoolean()
  onPromotion?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  promoPrice?: number | null;

  @IsOptional()
  @IsBoolean()
  onSale?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  salePrice?: number | null;
}
