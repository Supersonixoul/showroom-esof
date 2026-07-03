import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../../generated/prisma/client';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

const QUOTE_DETAIL_INCLUDE = {
  client: true,
  commercial: { select: { id: true, name: true, email: true } },
  items: { include: { product: { select: { id: true, name: true, reference: true } } } },
} as const;

export interface AuthUser {
  userId: string;
  role: Role;
}

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateQuoteDto, commercialId: string) {
    return this.prisma.quote.create({
      data: {
        clientId: dto.clientId,
        commercialId,
        items: { create: dto.items },
      },
      include: QUOTE_DETAIL_INCLUDE,
    });
  }

  findAll(user: AuthUser) {
    return this.prisma.quote.findMany({
      where: user.role === Role.ADMIN ? undefined : { commercialId: user.userId },
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: QUOTE_DETAIL_INCLUDE,
    });
    if (!quote) throw new NotFoundException(`Devis ${id} introuvable`);
    this.assertAccess(quote, user);
    return quote;
  }

  async update(id: string, dto: UpdateQuoteDto, user: AuthUser) {
    const existing = await this.prisma.quote.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Devis ${id} introuvable`);
    this.assertAccess(existing, user);

    await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.quoteItem.deleteMany({ where: { quoteId: id } });
        await tx.quote.update({
          where: { id },
          data: {
            ...(dto.status ? { status: dto.status } : {}),
            items: { create: dto.items },
            updatedAt: new Date(),
          },
        });
      } else if (dto.status) {
        await tx.quote.update({ where: { id }, data: { status: dto.status } });
      }
    });

    return this.findOne(id, user);
  }

  private assertAccess(quote: { commercialId: string }, user: AuthUser) {
    if (user.role !== Role.ADMIN && quote.commercialId !== user.userId) {
      throw new ForbiddenException('Ce devis appartient à un autre commercial');
    }
  }
}
