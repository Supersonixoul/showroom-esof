import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/// Pagination + filtre marque pour la grille produits du kiosque TV (/tv),
/// et recherche multi-mots (désignation/référence/marque) réutilisée par
/// l'écran « produits d'une catégorie » de l'app mobile.
export class FindCatalogProductsQueryDto {
  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @IsOptional()
  @IsUUID()
  gammeId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 8;
}
