import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { FindClientsQueryDto } from './dto/find-clients-query.dto';
import { CreateClientNoteDto } from './dto/create-client-note.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateClientDto, createdBy: string) {
    return this.prisma.client.create({ data: { ...dto, createdBy } });
  }

  findAll(query: FindClientsQueryDto) {
    const search = query.search?.trim();
    return this.prisma.client.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        notes: { orderBy: { visitDate: 'desc' } },
        quotes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!client) {
      throw new NotFoundException(`Client ${id} introuvable`);
    }
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.ensureExists(id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.client.delete({ where: { id } });
  }

  async addNote(clientId: string, dto: CreateClientNoteDto, commercialId: string) {
    await this.ensureExists(clientId);
    return this.prisma.clientNote.create({
      data: {
        clientId,
        commercialId,
        note: dto.note,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : new Date(),
      },
    });
  }

  private async ensureExists(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client ${id} introuvable`);
    }
  }
}
