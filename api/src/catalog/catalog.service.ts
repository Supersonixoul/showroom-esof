import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FindCatalogProductsQueryDto } from './dto/find-catalog-products-query.dto';
import { buildImageVariants } from '../products/image-variants.util';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Visibilité en cascade : une catégorie n'est visible que si elle-même ET
   * tous ses ancêtres (via `parentId`) ont `isActive = true`. Catégorie
   * masquée -> masque aussi ses sous-catégories/descendantes.
   */
  private computeVisibleCategoryIds(
    categories: { id: string; parentId: string | null; isActive: boolean }[],
  ): Set<string> {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const cache = new Map<string, boolean>();
    const isVisible = (id: string): boolean => {
      if (cache.has(id)) return cache.get(id) as boolean;
      const cat = byId.get(id);
      if (!cat) return false;
      cache.set(id, false); // garde-fou anti-cycle
      const result = cat.isActive && (!cat.parentId || isVisible(cat.parentId));
      cache.set(id, result);
      return result;
    };
    const visible = new Set<string>();
    for (const c of categories) {
      if (isVisible(c.id)) visible.add(c.id);
    }
    return visible;
  }

  private async getVisibleCategoryIds(): Promise<Set<string>> {
    const categories = await this.prisma.category.findMany({
      select: { id: true, parentId: true, isActive: true },
    });
    return this.computeVisibleCategoryIds(categories);
  }

  /** Catalogue complet — utilisé lors de la première installation d'une app. */
  async getFull() {
    const [brands, allCategories, promoVideos] = await Promise.all([
      this.prisma.brand.findMany(),
      this.prisma.category.findMany({
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.promoVideo.findMany({ orderBy: { position: 'asc' } }),
    ]);

    const visibleCategoryIds = this.computeVisibleCategoryIds(allCategories);
    const categories = allCategories.filter((c) => visibleCategoryIds.has(c.id));

    const products = await this.prisma.product.findMany({
      where: { categoryId: { in: Array.from(visibleCategoryIds) } },
      include: { specs: true, images: { orderBy: { position: 'asc' } } },
    });

    return {
      syncedAt: new Date().toISOString(),
      brands,
      categories,
      products,
      promoVideos,
    };
  }

  /**
   * Vidéos promotionnelles actives, triées par position — endpoint public
   * dédié aux kiosques (app-tv), qui n'ont pas de session admin/commercial.
   * Tri secondaire par `createdAt` pour un ordre déterministe quand toutes
   * les positions sont à 0 (valeur par défaut).
   */
  async getActivePromoVideos() {
    return this.prisma.promoVideo.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Éléments créés/modifiés depuis `since` — utilisé pour la synchronisation
   * différentielle. Note : une catégorie masquée APRÈS le dernier sync complet
   * d'un appareil ne disparaîtra pas via ce lot différentiel (elle n'est
   * simplement plus renvoyée, mais rien n'indique à l'app de la retirer de son
   * cache local) — limitation connue, voir remarque dans la réponse finale.
   */
  async getSince(since: Date) {
    const [brands, allCategories, promoVideos] = await Promise.all([
      this.prisma.brand.findMany({ where: { updatedAt: { gt: since } } }),
      // Toutes les catégories (pas seulement celles modifiées) sont
      // nécessaires pour calculer correctement la cascade de visibilité.
      this.prisma.category.findMany({
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.promoVideo.findMany({
        where: { updatedAt: { gt: since } },
        orderBy: { position: 'asc' },
      }),
    ]);

    const visibleCategoryIds = this.computeVisibleCategoryIds(allCategories);
    const categories = allCategories.filter(
      (c) => c.updatedAt > since && visibleCategoryIds.has(c.id),
    );

    const products = await this.prisma.product.findMany({
      where: {
        updatedAt: { gt: since },
        categoryId: { in: Array.from(visibleCategoryIds) },
      },
      include: { specs: true, images: { orderBy: { position: 'asc' } } },
    });

    return {
      syncedAt: new Date().toISOString(),
      brands,
      categories,
      products,
      promoVideos,
    };
  }

  // ---- Mode « Catalogue produits » du kiosque TV (/tv) — lecture seule ------
  // Endpoints publics dédiés (pas de session) : réponses allégées, uniquement
  // les champs utiles à l'affichage TV.

  /**
   * Catégories avec le nombre de produits actifs qu'elles contiennent (pour un
   * état vide propre côté TV), et leurs sous-catégories (le cas échéant) pour
   * peupler la ligne de puces "Sous-catégorie" sans appel réseau supplémentaire.
   */
  async getCatalogCategories() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: { where: { isActive: true } } } },
        subcategories: {
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
          include: {
            _count: { select: { products: { where: { isActive: true } } } },
          },
        },
      },
    });
    const visibleCategoryIds = this.computeVisibleCategoryIds(categories);
    return categories
      .filter((category) => visibleCategoryIds.has(category.id))
      .map((category) => ({
      id: category.id,
      name: category.name,
      imageUrl: category.imageUrl,
      productCount: category._count.products,
      subcategories: category.subcategories.map((subcategory) => ({
        id: subcategory.id,
        name: subcategory.name,
        imageUrl: subcategory.imageUrl,
        productCount: subcategory._count.products,
      })),
    }));
  }

  /**
   * Produits actifs d'une catégorie, paginés, avec filtre marque optionnel.
   * `brands` liste les marques réellement présentes dans la catégorie
   * (indépendamment du filtre appliqué) pour peupler les puces côté TV.
   */
  async getCatalogProducts(query: FindCatalogProductsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 8;

    const visibleCategoryIds = await this.getVisibleCategoryIds();
    if (!visibleCategoryIds.has(query.categoryId)) {
      // Catégorie masquée (ou l'un de ses ancêtres) : aucun produit exposé.
      return {
        items: [],
        page,
        pageSize,
        totalItems: 0,
        totalPages: 1,
        brands: [],
        gammes: [],
      };
    }

    const baseWhere = { categoryId: query.categoryId, isActive: true };
    // subcategoryId/gammeId absents (puce "Toutes") -> pas de filtre, inclut
    // aussi les produits sans sous-catégorie / sans gamme.
    const filterWhere = {
      ...baseWhere,
      brandId: query.brandId,
      subcategoryId: query.subcategoryId,
      gammeId: query.gammeId,
    };

    const [brandRows, gammeRows, totalItems, products] = await Promise.all([
      this.prisma.product.findMany({
        where: baseWhere,
        select: { brand: { select: { id: true, name: true } } },
      }),
      // Gammes de la marque filtrée présentes dans la catégorie — n'existe
      // que si un filtre marque est actif (une gamme appartient toujours à
      // une marque). Indépendant du filtre sous-catégorie/gamme en cours
      // pour que la ligne de puces reste stable pendant la sélection.
      query.brandId
        ? this.prisma.product.findMany({
            where: { ...baseWhere, brandId: query.brandId },
            select: { gamme: { select: { id: true, name: true, imageUrl: true } } },
          })
        : Promise.resolve([]),
      this.prisma.product.count({ where: filterWhere }),
      this.prisma.product.findMany({
        where: filterWhere,
        include: { brand: true, images: { orderBy: { position: 'asc' }, take: 1 } },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const brandById = new Map<string, { id: string; name: string }>();
    for (const row of brandRows) {
      if (row.brand) {
        brandById.set(row.brand.id, row.brand);
      }
    }
    const brands = Array.from(brandById.values()).sort((a, b) => a.name.localeCompare(b.name));

    const gammeById = new Map<string, { id: string; name: string; imageUrl: string | null }>();
    for (const row of gammeRows) {
      if (row.gamme) {
        gammeById.set(row.gamme.id, row.gamme);
      }
    }
    const gammes = Array.from(gammeById.values()).sort((a, b) => a.name.localeCompare(b.name));

    return {
      items: products.map((product) => ({
        id: product.id,
        name: product.name,
        brand: product.brand ? product.brand.name : null,
        price: product.price,
        // Kiosque TV (1080p) : on expose les 3 variantes, le client TV
        // utilise systématiquement "full" pour un rendu net (voir mission
        // qualité d'affichage catalogue produits).
        imageVariants: product.images[0]
          ? buildImageVariants(product.images[0].url)
          : null,
      })),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      brands,
      gammes,
    };
  }

  /** Fiche produit détaillée pour le kiosque TV. */
  async getCatalogProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true },
      include: {
        brand: true,
        category: true,
        gamme: true,
        images: { orderBy: { position: 'asc' } },
      },
    });
    if (!product) {
      throw new NotFoundException(`Produit ${id} introuvable`);
    }
    const visibleCategoryIds = await this.getVisibleCategoryIds();
    if (!visibleCategoryIds.has(product.categoryId)) {
      // Catégorie masquée (ou l'un de ses ancêtres) : traité comme introuvable.
      throw new NotFoundException(`Produit ${id} introuvable`);
    }
    return {
      id: product.id,
      name: product.name,
      reference: product.reference,
      description: product.description,
      price: product.price,
      brand: product.brand
        ? {
            id: product.brand.id,
            name: product.brand.name,
            logoUrl: product.brand.logoUrl,
          }
        : null,
      category: { id: product.category.id, name: product.category.name },
      gamme: product.gamme ? { id: product.gamme.id, name: product.gamme.name } : null,
      images: product.images.map((image) => buildImageVariants(image.url)),
    };
  }

  // ---- Produits mis en avant (accueil mobile/TV) — public, lecture seule ----

  /**
   * Nouveautés / promotions / soldes, max 10 par bloc, triés du plus
   * récemment modifié au plus ancien. Public (mêmes règles de visibilité
   * en cascade que le reste du catalogue — catégorie/ancêtre masqué exclu).
   */
  async getFeaturedProducts() {
    const visibleCategoryIds = await this.getVisibleCategoryIds();
    const baseWhere = {
      isActive: true,
      categoryId: { in: Array.from(visibleCategoryIds) },
    };
    const include = {
      brand: true,
      category: true,
      images: { orderBy: { position: 'asc' as const }, take: 1 },
    };

    const [newProducts, promotions, sales] = await Promise.all([
      this.prisma.product.findMany({
        where: { ...baseWhere, isNew: true },
        include,
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      this.prisma.product.findMany({
        where: { ...baseWhere, onPromotion: true },
        include,
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      this.prisma.product.findMany({
        where: { ...baseWhere, onSale: true },
        include,
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ]);

    const map = (product: (typeof newProducts)[number]) => ({
      id: product.id,
      name: product.name,
      reference: product.reference,
      price: product.price,
      promoPrice: product.promoPrice,
      salePrice: product.salePrice,
      image: product.images[0] ? buildImageVariants(product.images[0].url) : null,
      brand: product.brand ? { id: product.brand.id, name: product.brand.name } : null,
      category: { id: product.category.id, name: product.category.name },
    });

    return {
      newProducts: newProducts.map(map),
      promotions: promotions.map(map),
      sales: sales.map(map),
    };
  }
}
