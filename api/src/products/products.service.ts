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

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    await this.validateSubcategory(dto.categoryId, dto.subcategoryId);
    return this.prisma.product.create({ data: dto });
  }

  findAll(query: FindProductsQueryDto) {
    return this.prisma.product.findMany({
      where: {
        brandId: query.brandId,
        categoryId: query.categoryId,
        subcategoryId: query.subcategoryId,
      },
      include: { brand: true, category: true, subcategory: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        subcategory: true,
        specs: true,
        images: { orderBy: { position: 'asc' } },
      },
    });
    if (!product) {
      throw new NotFoundException(`Produit ${id} introuvable`);
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.findOne(id);
    const categoryId = dto.categoryId ?? product.categoryId;

    if (dto.subcategoryId !== undefined) {
      await this.validateSubcategory(categoryId, dto.subcategoryId);
    } else if (dto.categoryId) {
      // La catégorie change sans préciser la sous-catégorie : vérifie que la
      // sous-catégorie existante (le cas échéant) reste cohérente.
      await this.validateSubcategory(categoryId, product.subcategoryId);
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

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
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
    return image;
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

  /** Force la mise à jour de `updatedAt` du produit (utilisé pour la sync différentielle). */
  private touch(productId: string) {
    return this.prisma.product.update({
      where: { id: productId },
      data: { updatedAt: new Date() },
    });
  }
}
