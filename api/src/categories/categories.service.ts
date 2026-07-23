import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { MoveCategoryDto } from './dto/move-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) {
      await this.findOne(dto.parentId);
    }

    const { _max } = await this.prisma.category.aggregate({
      _max: { displayOrder: true },
      where: { parentId: dto.parentId ?? null },
    });
    const displayOrder = (_max.displayOrder ?? -1) + 1;

    return this.prisma.category.create({ data: { ...dto, displayOrder } });
  }

  findAll() {
    return this.prisma.category.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { children: true },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });
    if (!category) {
      throw new NotFoundException(`Catégorie ${id} introuvable`);
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException(
          'Une catégorie ne peut pas être sa propre catégorie parente',
        );
      }
      await this.findOne(dto.parentId);
    }
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const category = await this.findOne(id);

    if (category.children.length > 0) {
      throw new ConflictException(
        'Impossible de supprimer une catégorie qui a des sous-catégories',
      );
    }

    const subcategoryCount = await this.prisma.subcategory.count({
      where: { categoryId: id },
    });
    if (subcategoryCount > 0) {
      throw new ConflictException(
        'Impossible de supprimer une catégorie qui a des sous-catégories',
      );
    }

    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        'Impossible de supprimer une catégorie associée à des produits',
      );
    }

    await this.prisma.category.delete({ where: { id } });
  }

  /** Bascule la visibilité de la catégorie dans les apps (mobile/TV) — voir catalog.service.ts. */
  async setVisibility(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.category.update({ where: { id }, data: { isActive } });
  }

  async move(id: string, dto: MoveCategoryDto) {
    const category = await this.findOne(id);

    const neighbor = await this.prisma.category.findFirst({
      where: {
        parentId: category.parentId,
        displayOrder:
          dto.direction === 'up'
            ? { lt: category.displayOrder }
            : { gt: category.displayOrder },
      },
      orderBy: { displayOrder: dto.direction === 'up' ? 'desc' : 'asc' },
    });

    if (!neighbor) {
      // Déjà en première (up) ou dernière (down) position : rien à faire.
      return category;
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.category.update({
        where: { id: neighbor.id },
        data: { displayOrder: category.displayOrder },
      }),
      this.prisma.category.update({
        where: { id: category.id },
        data: { displayOrder: neighbor.displayOrder },
      }),
    ]);

    return updated;
  }
}
