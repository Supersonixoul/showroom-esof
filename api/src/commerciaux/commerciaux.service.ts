import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentCommercialDto } from './dto/create-agent-commercial.dto';
import { UpdateAgentCommercialDto } from './dto/update-agent-commercial.dto';

@Injectable()
export class CommerciauxService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAgentCommercialDto) {
    return this.prisma.agentCommercial.create({ data: dto });
  }

  /// onlyActive: true pour les requêtes Pro (brief §1.5) — les admins voient
  /// aussi les commerciaux désactivés.
  findAll(onlyActive: boolean) {
    return this.prisma.agentCommercial.findMany({
      where: onlyActive ? { actif: true } : undefined,
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
  }

  async findOne(id: string) {
    const agent = await this.prisma.agentCommercial.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundException(`Commercial ${id} introuvable`);
    }
    return agent;
  }

  async update(id: string, dto: UpdateAgentCommercialDto) {
    await this.findOne(id);
    return this.prisma.agentCommercial.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.agentCommercial.update({
      where: { id },
      data: { actif: false },
    });
  }
}
