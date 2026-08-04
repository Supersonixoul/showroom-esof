import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { CreateProductSpecDto } from './dto/create-product-spec.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { MoveProductDto } from './dto/move-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { ImportProductsDto } from './dto/import-products.dto';
import { ImportProductRowDto } from './dto/import-product-row.dto';
import { ImportReport, ImportReportRow } from './dto/import-report';
import { buildImageVariants } from './image-variants.util';
import { normalizeForComparison } from './normalize.util';
import { assertPromoPriceBelowNormalPrice } from './promo-price.util';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    await this.validateSubcategory(dto.categoryId, dto.subcategoryId);
    await this.validateGamme(dto.brandId, dto.gammeId);
    if (dto.reference) {
      await this.ensureReferenceNameAvailable(dto.reference, dto.name);
    }
    assertPromoPriceBelowNormalPrice(dto.price ?? null, dto.promoPrice ?? null);

    const { _max } = await this.prisma.product.aggregate({
      _max: { displayOrder: true },
      where: { categoryId: dto.categoryId },
    });
    const displayOrder = (_max.displayOrder ?? -1) + 1;

    return this.prisma.product.create({ data: { ...dto, displayOrder } });
  }

  async findAll(query: FindProductsQueryDto) {
    const products = await this.prisma.product.findMany({
      where: {
        brandId: query.brandId,
        categoryId: query.categoryId,
        subcategoryId: query.subcategoryId,
        gammeId: query.gammeId,
      },
      include: {
        brand: true,
        category: true,
        subcategory: true,
        gamme: true,
        images: { orderBy: { position: 'asc' }, take: 1 },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return products.map((product) => ({
      ...product,
      images: product.images.map((image) => ({
        ...image,
        imageVariants: buildImageVariants(image.url),
      })),
    }));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        subcategory: true,
        gamme: true,
        specs: true,
        images: { orderBy: { position: 'asc' } },
      },
    });
    if (!product) {
      throw new NotFoundException(`Produit ${id} introuvable`);
    }
    return {
      ...product,
      images: product.images.map((image) => ({
        ...image,
        imageVariants: buildImageVariants(image.url),
      })),
    };
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.findOne(id);
    const categoryId = dto.categoryId ?? product.categoryId;
    const brandId = dto.brandId ?? product.brandId;

    if (dto.subcategoryId !== undefined) {
      await this.validateSubcategory(categoryId, dto.subcategoryId);
    } else if (dto.categoryId) {
      // La catégorie change sans préciser la sous-catégorie : vérifie que la
      // sous-catégorie existante (le cas échéant) reste cohérente.
      await this.validateSubcategory(categoryId, product.subcategoryId);
    }

    if (dto.gammeId !== undefined) {
      await this.validateGamme(brandId, dto.gammeId);
    } else if (dto.brandId) {
      // La marque change sans préciser la gamme : vérifie que la gamme
      // existante (le cas échéant) reste cohérente avec la nouvelle marque.
      await this.validateGamme(brandId, product.gammeId);
    }

    // La référence seule n'est pas une clé d'unicité valable (deux produits
    // distincts — ex. fils électriques de couleurs différentes — peuvent
    // légitimement partager la même référence) : on ne vérifie donc que si
    // la référence et/ou la désignation changent, sur le couple résultant.
    const resolvedReference =
      dto.reference !== undefined ? dto.reference : product.reference;
    const resolvedName = dto.name !== undefined ? dto.name : product.name;
    if (resolvedReference && (dto.reference !== undefined || dto.name !== undefined)) {
      await this.ensureReferenceNameAvailable(resolvedReference, resolvedName, id);
    }

    // Si le prix normal et/ou le prix promo changent, revalider leur
    // cohérence en tenant compte des valeurs déjà enregistrées pour le
    // champ non modifié (ex. baisser le prix normal sous un prix promo
    // existant doit être rejeté, pas seulement l'inverse).
    const resolvedPrice =
      dto.price !== undefined ? dto.price : product.price != null ? Number(product.price) : null;
    const resolvedPromoPrice =
      dto.promoPrice !== undefined
        ? dto.promoPrice
        : product.promoPrice != null
        ? Number(product.promoPrice)
        : null;
    assertPromoPriceBelowNormalPrice(resolvedPrice, resolvedPromoPrice);

    return this.prisma.product.update({ where: { id }, data: dto });
  }

  /** Une sous-catégorie est toujours facultative, mais si présente elle doit
   * appartenir à la catégorie du produit. */
  private async validateSubcategory(
    categoryId: string,
    subcategoryId?: string | null,
  ) {
    if (!subcategoryId) {
      return;
    }
    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id: subcategoryId },
    });
    if (!subcategory) {
      throw new NotFoundException(
        `Sous-catégorie ${subcategoryId} introuvable`,
      );
    }
    if (subcategory.categoryId !== categoryId) {
      throw new BadRequestException(
        "La sous-catégorie sélectionnée n'appartient pas à la catégorie du produit",
      );
    }
  }

  /** Une gamme est toujours facultative, mais si présente elle doit
   * appartenir à la marque du produit (qui doit alors être renseignée). */
  private async validateGamme(
    brandId: string | null | undefined,
    gammeId?: string | null,
  ) {
    if (!gammeId) {
      return;
    }
    if (!brandId) {
      throw new BadRequestException(
        'Une gamme ne peut être choisie sans marque',
      );
    }
    const gamme = await this.prisma.gamme.findUnique({
      where: { id: gammeId },
    });
    if (!gamme) {
      throw new NotFoundException(`Gamme ${gammeId} introuvable`);
    }
    if (gamme.brandId !== brandId) {
      throw new BadRequestException(
        "La gamme sélectionnée n'appartient pas à la marque du produit",
      );
    }
  }

  /** La référence est facultative et n'est PAS une clé d'unicité à elle
   * seule : deux produits distincts (ex. fils électriques de couleurs
   * différentes) peuvent légitimement partager la même référence. L'unicité
   * porte donc sur le couple (référence, désignation) — normalisé (espaces
   * réduits, casse uniformisée, voir `normalizeForComparison`) — et reflète
   * la contrainte `@@unique([reference, name])` en base. Vérifiée en amont
   * pour renvoyer un message clair plutôt qu'une erreur Prisma brute (500). */
  private async ensureReferenceNameAvailable(
    reference: string,
    name: string,
    excludeId?: string,
  ) {
    const candidates = await this.prisma.product.findMany({
      where: { reference },
    });
    const normalizedName = normalizeForComparison(name);
    const conflict = candidates.find(
      (p) => p.id !== excludeId && normalizeForComparison(p.name) === normalizedName,
    );
    if (conflict) {
      throw new ConflictException(
        `Un produit avec la référence "${reference}" et la désignation "${name}" existe déjà`,
      );
    }
  }

  /** Clé de dédoublonnage normalisée sur le couple (référence, désignation)
   * — voir `normalizeForComparison` pour les règles de normalisation
   * (espaces début/fin et internes, casse). */
  private buildDedupKey(reference: string | null | undefined, name: string): string {
    const normalizedReference = reference ? normalizeForComparison(reference) : '';
    return `${normalizedReference}\u0000${normalizeForComparison(name)}`;
  }

  /**
   * Import en masse de produits (depuis le fichier Excel parsé côté admin) :
   * - couple (référence, désignation) inexistant → création ;
   * - référence déjà présente mais désignation différente → création
   *   (produit distinct) ;
   * - couple strictement identique (après normalisation) à un produit déjà
   *   en base, ou à une ligne précédente du même fichier → rejet (doublon).
   * L'ensemble des créations est enveloppé dans une transaction Prisma ;
   * chaque ligne est isolée par un savepoint pour qu'une erreur ponctuelle
   * (ex. contrainte violée) n'annule pas les créations déjà effectuées.
   * Aucun produit existant n'est jamais modifié ni supprimé par cet import.
   */
  async importProducts(dto: ImportProductsDto): Promise<ImportReport> {
    await this.validateSubcategory(dto.categoryId, dto.subcategoryId);
    await this.validateGamme(dto.brandId, dto.gammeId);

    const existingProducts = await this.prisma.product.findMany({
      select: { reference: true, name: true },
    });
    const seen = new Set<string>(
      existingProducts.map((p) => this.buildDedupKey(p.reference, p.name)),
    );

    const doublons: ImportReportRow[] = [];
    const erreurs: (ImportReportRow & { message: string })[] = [];
    const aCreer: { ligne: number; row: ImportProductRowDto }[] = [];

    dto.rows.forEach((row, index) => {
      const ligne = index + 1;
      const name = (row.name ?? '').toString().trim();
      const reference = row.reference?.toString().trim() || undefined;

      if (!name) {
        erreurs.push({
          ligne,
          reference: reference ?? null,
          designation: name,
          message: 'Désignation manquante',
        });
        return;
      }

      const key = this.buildDedupKey(reference, name);
      if (seen.has(key)) {
        doublons.push({ ligne, reference: reference ?? null, designation: name });
        return;
      }
      seen.add(key);
      aCreer.push({ ligne, row: { ...row, name, reference } });
    });

    let produitsCrees = 0;
    await this.prisma.$transaction(async (tx) => {
      const { _max } = await tx.product.aggregate({
        _max: { displayOrder: true },
        where: { categoryId: dto.categoryId },
      });
      let displayOrder = (_max.displayOrder ?? -1) + 1;

      for (const { ligne, row } of aCreer) {
        await tx.$executeRawUnsafe('SAVEPOINT import_row');
        try {
          await tx.product.create({
            data: {
              name: row.name,
              reference: row.reference,
              description: row.description,
              price: row.price,
              brandId: dto.brandId ?? null,
              categoryId: dto.categoryId,
              subcategoryId: dto.subcategoryId ?? null,
              gammeId: dto.gammeId ?? null,
              displayOrder: displayOrder++,
            },
          });
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT import_row');
          produitsCrees++;
        } catch (err) {
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT import_row');
          erreurs.push({
            ligne,
            reference: row.reference ?? null,
            designation: row.name,
            message:
              err instanceof Error ? err.message : 'Erreur inconnue lors de la création',
          });
        }
      }
    });

    return {
      lignesLues: dto.rows.length,
      produitsCrees,
      doublons,
      erreurs,
    };
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }

  async move(id: string, dto: MoveProductDto) {
    const product = await this.findOne(id);

    const neighbor = await this.prisma.product.findFirst({
      where: {
        categoryId: product.categoryId,
        displayOrder:
          dto.direction === 'up'
            ? { lt: product.displayOrder }
            : { gt: product.displayOrder },
      },
      orderBy: { displayOrder: dto.direction === 'up' ? 'desc' : 'asc' },
    });

    if (!neighbor) {
      return product;
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: neighbor.id },
        data: { displayOrder: product.displayOrder },
      }),
      this.prisma.product.update({
        where: { id: product.id },
        data: { displayOrder: neighbor.displayOrder },
      }),
    ]);

    return updated;
  }

  /** Bascule la visibilité du produit dans les apps (mobile/TV) — voir catalog.service.ts. */
  async setVisibility(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { isActive } });
  }

  /**
   * Met à jour les statuts de mise en avant (nouveau / promo / solde) —
   * voir catalog.service.ts `getFeaturedProducts` pour l'endpoint public
   * consommé par les apps. Règles :
   * - `onPromotion` et `onSale` sont mutuellement exclusifs.
   * - Solde : quand `onSale` est (ou reste) actif, le prix solde est
   *   obligatoire et doit être strictement inférieur au prix normal du
   *   produit.
   * - Promotion : statut d'affichage indépendant du prix — le prix promo
   *   est facultatif. S'il est renseigné ET que le produit a un prix
   *   normal, il doit être strictement inférieur à celui-ci. S'il est
   *   renseigné sans prix normal, il est accepté tel quel. Sans prix promo
   *   saisi, le badge promotion seul suffit.
   * - Quand `onPromotion`/`onSale` est désactivé, le prix réduit
   *   correspondant est remis à `null`.
   */
  async updateStatus(id: string, dto: UpdateProductStatusDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Produit ${id} introuvable`);
    }

    const isNew = dto.isNew ?? product.isNew;
    const onPromotion = dto.onPromotion ?? product.onPromotion;
    const onSale = dto.onSale ?? product.onSale;

    if (onPromotion && onSale) {
      throw new BadRequestException(
        'Un produit ne peut pas être à la fois en promotion et en solde',
      );
    }

    const normalPrice = product.price != null ? Number(product.price) : null;

    const resolveReducedPrice = (
      active: boolean,
      provided: number | null | undefined,
      current: unknown,
      label: string,
    ): number | null => {
      if (!active) return null;
      const candidate = provided !== undefined ? provided : current != null ? Number(current) : null;
      if (candidate == null) {
        throw new BadRequestException(`Le prix ${label} est obligatoire quand le produit est ${label === 'promo' ? 'en promotion' : 'en solde'}`);
      }
      if (normalPrice == null || candidate >= normalPrice) {
        throw new BadRequestException(`Le prix ${label} doit être strictement inférieur au prix normal du produit`);
      }
      return candidate;
    };

    // Prix promo : facultatif (statut d'affichage), contrairement au prix
    // solde qui reste obligatoire — voir la doc de `updateStatus` ci-dessus.
    const resolvePromoPrice = (
      active: boolean,
      provided: number | null | undefined,
      current: unknown,
    ): number | null => {
      if (!active) return null;
      const candidate = provided !== undefined ? provided : current != null ? Number(current) : null;
      if (candidate == null) return null;
      assertPromoPriceBelowNormalPrice(normalPrice, candidate);
      return candidate;
    };

    const promoPrice = resolvePromoPrice(onPromotion, dto.promoPrice, product.promoPrice);
    const salePrice = resolveReducedPrice(onSale, dto.salePrice, product.salePrice, 'solde');

    return this.prisma.product.update({
      where: { id },
      data: { isNew, onPromotion, promoPrice, onSale, salePrice },
    });
  }

  // ---- Caractéristiques (specs) ---------------------------------------

  async addSpec(productId: string, dto: CreateProductSpecDto) {
    await this.findOne(productId);
    const spec = await this.prisma.productSpec.create({
      data: { ...dto, productId },
    });
    await this.touch(productId);
    return spec;
  }

  async removeSpec(productId: string, specId: string) {
    const spec = await this.prisma.productSpec.findUnique({
      where: { id: specId },
    });
    if (!spec || spec.productId !== productId) {
      throw new NotFoundException(
        `Caractéristique ${specId} introuvable pour ce produit`,
      );
    }
    await this.prisma.productSpec.delete({ where: { id: specId } });
    await this.touch(productId);
  }

  // ---- Images -----------------------------------------------------------

  async addImage(productId: string, dto: CreateProductImageDto) {
    await this.findOne(productId);
    const image = await this.prisma.productImage.create({
      data: { ...dto, productId },
    });
    await this.touch(productId);
    return { ...image, imageVariants: buildImageVariants(image.url) };
  }

  async removeImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });
    if (!image || image.productId !== productId) {
      throw new NotFoundException(
        `Image ${imageId} introuvable pour ce produit`,
      );
    }
    await this.prisma.productImage.delete({ where: { id: imageId } });
    await this.touch(productId);
  }

  async moveImage(productId: string, imageId: string, dto: MoveProductDto) {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });
    if (!image || image.productId !== productId) {
      throw new NotFoundException(
        `Image ${imageId} introuvable pour ce produit`,
      );
    }

    const neighbor = await this.prisma.productImage.findFirst({
      where: {
        productId,
        position:
          dto.direction === 'up'
            ? { lt: image.position }
            : { gt: image.position },
      },
      orderBy: { position: dto.direction === 'up' ? 'desc' : 'asc' },
    });

    if (!neighbor) {
      return { ...image, imageVariants: buildImageVariants(image.url) };
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.productImage.update({
        where: { id: neighbor.id },
        data: { position: image.position },
      }),
      this.prisma.productImage.update({
        where: { id: image.id },
        data: { position: neighbor.position },
      }),
    ]);
    await this.touch(productId);

    return { ...updated, imageVariants: buildImageVariants(updated.url) };
  }

  /** Force la mise à jour de `updatedAt` du produit (utilisé pour la sync différentielle). */
  private touch(productId: string) {
    return this.prisma.product.update({
      where: { id: productId },
      data: { updatedAt: new Date() },
    });
  }
}
