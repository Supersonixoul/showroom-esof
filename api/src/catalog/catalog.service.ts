import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FindCatalogProductsQueryDto } from './dto/find-catalog-products-query.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catalogue complet — utilisé lors de la première installation d'une app. */
  async getFull() {
    const [brands, categories, products, promoVideos] = await Promise.all([
      this.prisma.brand.findMany(),
      this.prisma.category.findMany(),
      this.prisma.product.findMany({
        include: { specs: true, images: { orderBy: { position: 'asc' } } },
      }),
      this.prisma.promoVideo.findMany({ orderBy: { position: 'asc' } }),
    ]);

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

  /** Éléments créés/modifiés depuis `since` — utilisé pour la synchronisation différentielle. */
  async getSince(since: Date) {
    const [brands, categories, products, promoVideos] = await Promise.all([
      this.prisma.brand.findMany({ where: { updatedAt: { gt: since } } }),
      this.prisma.category.findMany({ where: { updatedAt: { gt: since } } }),
      this.prisma.product.findMany({
        where: { updatedAt: { gt: since } },
        include: { specs: true, images: { orderBy: { position: 'asc' } } },
      }),
      this.prisma.promoVideo.findMany({
        where: { updatedAt: { gt: since } },
        orderBy: { position: 'asc' },
      }),
    ]);

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
    return categories.map((category) => ({
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
      brandById.set(row.brand.id, row.brand);
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
        brand: product.brand.name,
        price: product.price,
        imageUrl: product.images[0] ? product.images[0].url : null,
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
    return {
      id: product.id,
      name: product.name,
      reference: product.reference,
      description: product.description,
      price: product.price,
      brand: {
        id: product.brand.id,
        name: product.brand.name,
        logoUrl: product.brand.logoUrl,
      },
      category: { id: product.category.id, name: product.category.name },
      gamme: product.gamme ? { id: product.gamme.id, name: product.gamme.name } : null,
      images: product.images.map((image) => image.url),
    };
  }
}
