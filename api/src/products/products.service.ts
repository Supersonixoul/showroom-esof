import {
  BadRequestException,
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
import { buildImageVariants } from './image-variants.util';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    await this.validateSubcategory(dto.categoryId, dto.subcategoryId);
    await this.validateGamme(dto.brandId, dto.gammeId);

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
