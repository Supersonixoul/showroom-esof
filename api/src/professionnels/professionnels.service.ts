import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionnelDto } from './dto/create-professionnel.dto';
import { UpdateProfessionnelDto } from './dto/update-professionnel.dto';
import { LoginProfessionnelDto } from './dto/login-professionnel.dto';

const SALT_ROUNDS = 10;

/// Champs renvoyés par l'API — motDePasse (hash bcrypt) n'apparaît JAMAIS
/// dans une réponse, conformément au brief.
const PUBLIC_SELECT = {
  id: true,
  nom: true,
  identifiant: true,
  telephone1: true,
  telephone2: true,
  actif: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ProfessionnelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async create(dto: CreateProfessionnelDto) {
    await this.ensureIdentifiantAvailable(dto.identifiant);
    const motDePasse = await bcrypt.hash(dto.motDePasse, SALT_ROUNDS);
    return this.prisma.professionnel.create({
      data: { ...dto, motDePasse },
      select: PUBLIC_SELECT,
    });
  }

  findAll() {
    return this.prisma.professionnel.findMany({
      orderBy: { nom: 'asc' },
      select: PUBLIC_SELECT,
    });
  }

  async findOne(id: string) {
    const professionnel = await this.prisma.professionnel.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
    if (!professionnel) {
      throw new NotFoundException(`Professionnel ${id} introuvable`);
    }
    return professionnel;
  }

  async update(id: string, dto: UpdateProfessionnelDto) {
    await this.findOne(id);
    if (dto.identifiant) {
      await this.ensureIdentifiantAvailable(dto.identifiant, id);
    }

    const { motDePasse, ...rest } = dto;
    return this.prisma.professionnel.update({
      where: { id },
      data: {
        ...rest,
        ...(motDePasse
          ? { motDePasse: await bcrypt.hash(motDePasse, SALT_ROUNDS) }
          : {}),
      },
      select: PUBLIC_SELECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.professionnel.update({
      where: { id },
      data: { actif: false },
    });
  }

  async login(dto: LoginProfessionnelDto) {
    const professionnel = await this.prisma.professionnel.findUnique({
      where: { identifiant: dto.identifiant },
    });
    if (
      !professionnel ||
      !professionnel.actif ||
      !(await bcrypt.compare(dto.motDePasse, professionnel.motDePasse))
    ) {
      throw new UnauthorizedException('Identifiant ou mot de passe incorrect');
    }

    const token = await this.jwtService.signAsync(
      { sub: professionnel.id, identifiant: professionnel.identifiant, role: 'PRO' },
      { expiresIn: '30d' },
    );

    return {
      token,
      professionnel: {
        id: professionnel.id,
        nom: professionnel.nom,
        identifiant: professionnel.identifiant,
        telephone1: professionnel.telephone1,
      },
    };
  }

  private async ensureIdentifiantAvailable(identifiant: string, excludeId?: string) {
    const existing = await this.prisma.professionnel.findUnique({
      where: { identifiant },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `L'identifiant "${identifiant}" est déjà utilisé`,
      );
    }
  }
}
