import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommandeDto } from './dto/create-commande.dto';

const COMMANDE_INCLUDE = {
  professionnel: {
    select: { id: true, nom: true, identifiant: true, telephone1: true },
  },
  commercial: true,
  lignes: { include: { produit: true } },
} as const;

@Injectable()
export class CommandesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(professionnelId: string, dto: CreateCommandeDto) {
    const commercial = await this.prisma.agentCommercial.findUnique({
      where: { id: dto.commercialId },
    });
    if (!commercial || !commercial.actif) {
      throw new NotFoundException(`Commercial ${dto.commercialId} introuvable`);
    }

    const produits = await this.prisma.product.findMany({
      where: { id: { in: dto.lignes.map((ligne) => ligne.produitId) } },
    });
    const produitsById = new Map(produits.map((produit) => [produit.id, produit]));
    for (const ligne of dto.lignes) {
      if (!produitsById.has(ligne.produitId)) {
        throw new BadRequestException(`Produit ${ligne.produitId} introuvable`);
      }
    }

    const commande = await this.prisma.commande.create({
      data: {
        professionnelId,
        commercialId: dto.commercialId,
        lignes: {
          create: dto.lignes.map((ligne) => ({
            produitId: ligne.produitId,
            quantite: ligne.quantite,
            libelleProduit: produitsById.get(ligne.produitId)!.name,
          })),
        },
      },
      include: COMMANDE_INCLUDE,
    });

    return commande;
  }

  findAllForAdmin() {
    return this.prisma.commande.findMany({
      orderBy: { dateCommande: 'desc' },
      include: COMMANDE_INCLUDE,
    });
  }

  findAllForProfessionnel(professionnelId: string) {
    return this.prisma.commande.findMany({
      where: { professionnelId },
      orderBy: { dateCommande: 'desc' },
      include: COMMANDE_INCLUDE,
    });
  }
}
