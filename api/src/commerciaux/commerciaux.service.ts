import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentCommercialDto } from './dto/create-agent-commercial.dto';
import { UpdateAgentCommercialDto } from './dto/update-agent-commercial.dto';
import { LoginAgentCommercialDto } from './dto/login-agent-commercial.dto';

const SALT_ROUNDS = 10;

/// Champs renvoyés par l'API — motDePasse (hash bcrypt) n'apparaît JAMAIS
/// dans une réponse, conformément au brief "Traitement" §1.1.
const PUBLIC_SELECT = {
  id: true,
  nom: true,
  prenom: true,
  telephone1: true,
  telephone2: true,
  identifiant: true,
  actif: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CommerciauxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async create(dto: CreateAgentCommercialDto) {
    if (dto.identifiant) {
      await this.ensureIdentifiantAvailable(dto.identifiant);
    }
    const { motDePasse, ...rest } = dto;
    return this.prisma.agentCommercial.create({
      data: {
        ...rest,
        ...(motDePasse ? { motDePasse: await bcrypt.hash(motDePasse, SALT_ROUNDS) } : {}),
      },
      select: PUBLIC_SELECT,
    });
  }

  /// onlyActive: true pour les requêtes Pro (brief §1.5) — les admins voient
  /// aussi les commerciaux désactivés.
  findAll(onlyActive: boolean) {
    return this.prisma.agentCommercial.findMany({
      where: onlyActive ? { actif: true } : undefined,
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      select: PUBLIC_SELECT,
    });
  }

  async findOne(id: string) {
    const agent = await this.prisma.agentCommercial.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
    if (!agent) {
      throw new NotFoundException(`Commercial ${id} introuvable`);
    }
    return agent;
  }

  async update(id: string, dto: UpdateAgentCommercialDto) {
    await this.findOne(id);
    if (dto.identifiant) {
      await this.ensureIdentifiantAvailable(dto.identifiant, id);
    }

    const { motDePasse, ...rest } = dto;
    return this.prisma.agentCommercial.update({
      where: { id },
      data: {
        ...rest,
        ...(motDePasse ? { motDePasse: await bcrypt.hash(motDePasse, SALT_ROUNDS) } : {}),
      },
      select: PUBLIC_SELECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.agentCommercial.update({
      where: { id },
      data: { actif: false },
    });
  }

  /// Connexion à la rubrique "Traitement" — public, throttlé (voir
  /// CommerciauxController). role 'AGENT_COMMERCIAL' distinct de
  /// Role.COMMERCIAL (voir CommercialAuthGuard).
  async login(dto: LoginAgentCommercialDto) {
    const agent = await this.prisma.agentCommercial.findUnique({
      where: { identifiant: dto.identifiant },
    });
    if (
      !agent ||
      !agent.actif ||
      !agent.motDePasse ||
      !(await bcrypt.compare(dto.motDePasse, agent.motDePasse))
    ) {
      throw new UnauthorizedException('Identifiant ou mot de passe incorrect');
    }

    const token = await this.jwtService.signAsync(
      { sub: agent.id, identifiant: agent.identifiant, role: 'AGENT_COMMERCIAL' },
      { expiresIn: '30d' },
    );

    return {
      token,
      commercial: {
        id: agent.id,
        nom: agent.nom,
        prenom: agent.prenom,
        telephone1: agent.telephone1,
      },
    };
  }

  private async ensureIdentifiantAvailable(identifiant: string, excludeId?: string) {
    const existing = await this.prisma.agentCommercial.findUnique({
      where: { identifiant },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`L'identifiant "${identifiant}" est déjà utilisé`);
    }
  }
}
