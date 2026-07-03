import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { CreateProductSpecDto } from './dto/create-product-spec.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  findAll(query: FindProductsQueryDto) {
    return this.prisma.product.findMany({
      where: {
        brandId: query.brandId,
        categoryId: query.categoryId,
      },
      include: { brand: true, category: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
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
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto });
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
