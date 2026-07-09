import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { MoveSubcategoryDto } from './dto/move-subcategory.dto';
import { FindSubcategoriesQueryDto } from './dto/find-subcategories-query.dto';

@Injectable()
export class SubcategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubcategoryDto) {
    await this.validateCategoryExists(dto.categoryId);
    await this.ensureNameAvailable(dto.categoryId, dto.name);

    const { _max } = await this.prisma.subcategory.aggregate({
      _max: { displayOrder: true },
      where: { categoryId: dto.categoryId },
    });
    const displayOrder = (_max.displayOrder ?? -1) + 1;

    return this.prisma.subcategory.create({
      data: { ...dto, displayOrder },
    });
  }

  findAll(query: FindSubcategoriesQueryDto) {
    return this.prisma.subcategory.findMany({
      where: query.categoryId ? { categoryId: query.categoryId } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async findOne(id: string) {
    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id },
    });
    if (!subcategory) {
      throw new NotFoundException(`Sous-catégorie ${id} introuvable`);
    }
    return subcategory;
  }

  async update(id: string, dto: UpdateSubcategoryDto) {
    const subcategory = await this.findOne(id);
    const categoryId = dto.categoryId ?? subcategory.categoryId;

    if (dto.categoryId) {
      await this.validateCategoryExists(dto.categoryId);
    }
    if (dto.name) {
      await this.ensureNameAvailable(categoryId, dto.name, id);
    }

    return this.prisma.subcategory.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);

    const productCount = await this.prisma.product.count({
      where: { subcategoryId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        'Impossible de supprimer une sous-catégorie associée à des produits',
      );
    }

    await this.prisma.subcategory.delete({ where: { id } });
  }

  async move(id: string, dto: MoveSubcategoryDto) {
    const subcategory = await this.findOne(id);

    const neighbor = await this.prisma.subcategory.findFirst({
      where: {
        categoryId: subcategory.categoryId,
        displayOrder:
          dto.direction === 'up'
            ? { lt: subcategory.displayOrder }
            : { gt: subcategory.displayOrder },
      },
      orderBy: { displayOrder: dto.direction === 'up' ? 'desc' : 'asc' },
    });

    if (!neighbor) {
      // Déjà en première (up) ou dernière (down) position : rien à faire.
      return subcategory;
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.subcategory.update({
        where: { id: neighbor.id },
        data: { displayOrder: subcategory.displayOrder },
      }),
      this.prisma.subcategory.update({
        where: { id: subcategory.id },
        data: { displayOrder: neighbor.displayOrder },
      }),
    ]);

    return updated;
  }

  private async validateCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Catégorie ${categoryId} introuvable`);
    }
  }

  private async ensureNameAvailable(
    categoryId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.subcategory.findFirst({
      where: { categoryId, name },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Une sous-catégorie nommée "${name}" existe déjà dans cette catégorie`,
      );
    }
  }
}
