import { IsBoolean, IsNumber, IsOptional, IsPositive, Min, ValidateIf } from 'class-validator';

/** Tous les champs sont optionnels : seuls ceux fournis sont modifiés
 * (voir `ProductsService.updateStatus` pour les règles de cohérence
 * promo/prixPromo et promo/solde mutuellement exclusifs). Le prix promo
 * est facultatif (la promotion est un statut d'affichage) : quand il est
 * fourni, il doit simplement être un nombre strictement positif — la
 * comparaison au prix normal est gérée dans le service. */
export class UpdateProductStatusDto {
  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @IsBoolean()
  onPromotion?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({}, { message: 'Le prix promo doit être un nombre' })
  @IsPositive({ message: 'Le prix promo doit être un nombre strictement positif' })
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
