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
import {
  buildFallbackDigitCandidates,
  buildNameCodeCandidates,
  cleanNameForCode,
  randomCode,
} from './client-code.util';

const SALT_ROUNDS = 10;

/// Champs renvoyés par l'API — motDePasse (hash bcrypt) n'apparaît JAMAIS
/// dans une réponse, conformément au brief.
const PUBLIC_SELECT = {
  id: true,
  nom: true,
  identifiant: true,
  code: true,
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
    const code = dto.code
      ? await this.ensureCodeAvailable(dto.code)
      : await this.generateClientCode(dto.nom);
    const motDePasse = await bcrypt.hash(dto.motDePasse, SALT_ROUNDS);
    return this.prisma.professionnel.create({
      data: { ...dto, motDePasse, code },
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
    if (dto.code) {
      await this.ensureCodeAvailable(dto.code, id);
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
        code: professionnel.code,
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

  /// Vérifie qu'un code n'est pas déjà utilisé par un autre Professionnel.
  private async ensureCodeAvailable(code: string, excludeId?: string): Promise<string> {
    const existing = await this.prisma.professionnel.findUnique({
      where: { code },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Le code ${code} est déjà utilisé par un autre client`,
      );
    }
    return code;
  }

  private async isCodeAvailable(code: string): Promise<boolean> {
    const existing = await this.prisma.professionnel.findUnique({
      where: { code },
    });
    return !existing;
  }

  /// Génère automatiquement un code client unique à 3 caractères à partir
  /// du nom (voir client-code.util.ts pour le détail de l'algorithme).
  private async generateClientCode(nom: string): Promise<string> {
    const cleaned = cleanNameForCode(nom);

    for (const candidate of buildNameCodeCandidates(cleaned)) {
      if (await this.isCodeAvailable(candidate)) return candidate;
    }

    const first = cleaned[0] ?? randomCode()[0];
    for (const candidate of buildFallbackDigitCandidates(first)) {
      if (await this.isCodeAvailable(candidate)) return candidate;
    }

    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = randomCode();
      if (await this.isCodeAvailable(candidate)) return candidate;
    }

    throw new ConflictException('Impossible de générer un code client unique.');
  }
}
