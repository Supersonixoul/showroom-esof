import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGammeDto } from './dto/create-gamme.dto';
import { UpdateGammeDto } from './dto/update-gamme.dto';
import { MoveGammeDto } from './dto/move-gamme.dto';
import { FindGammesQueryDto } from './dto/find-gammes-query.dto';

@Injectable()
export class GammesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGammeDto) {
    await this.validateBrandExists(dto.brandId);
    await this.ensureNameAvailable(dto.brandId, dto.name);

    const { _max } = await this.prisma.gamme.aggregate({
      _max: { displayOrder: true },
      where: { brandId: dto.brandId },
    });
    const displayOrder = (_max.displayOrder ?? -1) + 1;

    return this.prisma.gamme.create({
      data: { ...dto, displayOrder },
    });
  }

  findAll(query: FindGammesQueryDto) {
    return this.prisma.gamme.findMany({
      where: query.brandId ? { brandId: query.brandId } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async findOne(id: string) {
    const gamme = await this.prisma.gamme.findUnique({ where: { id } });
    if (!gamme) {
      throw new NotFoundException(`Gamme ${id} introuvable`);
    }
    return gamme;
  }

  async update(id: string, dto: UpdateGammeDto) {
    const gamme = await this.findOne(id);
    const brandId = dto.brandId ?? gamme.brandId;

    if (dto.brandId) {
      await this.validateBrandExists(dto.brandId);
    }
    if (dto.name) {
      await this.ensureNameAvailable(brandId, dto.name, id);
    }

    return this.prisma.gamme.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);

    const productCount = await this.prisma.product.count({
      where: { gammeId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        'Impossible de supprimer une gamme associée à des produits',
      );
    }

    await this.prisma.gamme.delete({ where: { id } });
  }

  async move(id: string, dto: MoveGammeDto) {
    const gamme = await this.findOne(id);

    const neighbor = await this.prisma.gamme.findFirst({
      where: {
        brandId: gamme.brandId,
        displayOrder:
          dto.direction === 'up'
            ? { lt: gamme.displayOrder }
            : { gt: gamme.displayOrder },
      },
      orderBy: { displayOrder: dto.direction === 'up' ? 'desc' : 'asc' },
    });

    if (!neighbor) {
      // Déjà en première (up) ou dernière (down) position : rien à faire.
      return gamme;
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.gamme.update({
        where: { id: neighbor.id },
        data: { displayOrder: gamme.displayOrder },
      }),
      this.prisma.gamme.update({
        where: { id: gamme.id },
        data: { displayOrder: neighbor.displayOrder },
      }),
    ]);

    return updated;
  }

  private async validateBrandExists(brandId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
    });
    if (!brand) {
      throw new NotFoundException(`Marque ${brandId} introuvable`);
    }
  }

  private async ensureNameAvailable(
    brandId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.gamme.findFirst({
      where: { brandId, name },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Une gamme nommée "${name}" existe déjà pour cette marque`,
      );
    }
  }
}
