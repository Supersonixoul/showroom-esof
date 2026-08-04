import { BadRequestException } from '@nestjs/common';

/** Règle métier partagée par tous les chemins qui touchent au prix promo
 * (création/mise à jour du produit dans `ProductsService.create`/`update`,
 * et modal Statuts dans `ProductsService.updateStatus`) : quand un prix
 * normal ET un prix promo sont tous deux renseignés, le prix promo doit
 * être strictement inférieur au prix normal. Si le prix normal est absent,
 * aucune comparaison n'est faite (le prix promo reste facultatif). Point
 * unique de vérité pour éviter toute divergence entre ces chemins. */
export function assertPromoPriceBelowNormalPrice(
  normalPrice: number | null,
  promoPrice: number | null,
): void {
  if (normalPrice == null || promoPrice == null) return;
  if (promoPrice >= normalPrice) {
    throw new BadRequestException(
      'Le prix promo doit être strictement inférieur au prix normal du produit',
    );
  }
}
