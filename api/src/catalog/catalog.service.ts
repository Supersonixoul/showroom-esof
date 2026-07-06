import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
