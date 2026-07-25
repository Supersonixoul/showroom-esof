import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { TraitementCommandeDto } from './dto/traitement-commande.dto';
import { AnnulationCommandeDto } from './dto/annulation-commande.dto';
import { ProformaService } from './proforma.service';

const COMMANDE_INCLUDE = {
  professionnel: {
    select: { id: true, nom: true, identifiant: true, telephone1: true },
  },
  commercial: {
    select: { id: true, nom: true, prenom: true, telephone1: true, telephone2: true },
  },
  lignes: { include: { produit: true } },
} as const;

/// Rubrique "Traitement" (brief §1) — actions du commercial sur ses
/// propres commandes : prise en charge/modification des lignes, émission
/// de la proforma, annulation. Chaque action est historisée dans
/// `historique_commandes`.
@Injectable()
export class CommandesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proformaService: ProformaService,
  ) {}

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

  findAllForCommercial(commercialId: string, statut?: string) {
    return this.prisma.commande.findMany({
      where: { commercialId, ...(statut ? { statut } : {}) },
      orderBy: { dateCommande: 'desc' },
      include: COMMANDE_INCLUDE,
    });
  }

  private async findOwnedCommande(id: string, commercialId: string) {
    const commande = await this.prisma.commande.findUnique({
      where: { id },
      include: COMMANDE_INCLUDE,
    });
    if (!commande) {
      throw new NotFoundException(`Commande ${id} introuvable`);
    }
    if (commande.commercialId !== commercialId) {
      throw new ForbiddenException("Cette commande n'appartient pas à ce commercial");
    }
    return commande;
  }

  async traitement(id: string, commercialId: string, dto: TraitementCommandeDto) {
    const commande = await this.findOwnedCommande(id, commercialId);
    if (commande.statut === 'ANNULEE') {
      throw new BadRequestException('Cette commande est annulée et ne peut plus être modifiée');
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

    // Détection d'un changement d'articles/quantités par rapport à l'existant.
    const ancien = new Map(commande.lignes.map((ligne) => [ligne.produitId, ligne.quantite]));
    const nouveau = new Map(dto.lignes.map((ligne) => [ligne.produitId, ligne.quantite]));
    let articlesModifies = ancien.size !== nouveau.size;
    if (!articlesModifies) {
      for (const [produitId, quantite] of nouveau) {
        if (ancien.get(produitId) !== quantite) {
          articlesModifies = true;
          break;
        }
      }
    }

    let nouveauStatut: string;
    let action: string;
    let details: string;
    if (articlesModifies) {
      nouveauStatut = 'MODIFIEE';
      action = 'MODIFICATION';
      details = 'Articles ou quantités modifiés par le commercial';
    } else if (commande.statut === 'ENVOYEE') {
      nouveauStatut = 'EN_TRAITEMENT';
      action = 'PRISE_EN_CHARGE';
      details = 'Commande prise en charge par le commercial';
    } else {
      nouveauStatut = commande.statut === 'MODIFIEE' ? 'MODIFIEE' : 'EN_TRAITEMENT';
      action = 'PRIX_RENSEIGNES';
      details = 'Prix unitaires renseignés par le commercial';
    }

    const tvaApplicable = dto.tvaApplicable ?? commande.tvaApplicable;
    const bicApplicable = dto.bicApplicable ?? commande.bicApplicable;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.ligneCommande.deleteMany({ where: { commandeId: id } });
      await tx.commande.update({
        where: { id },
        data: {
          tvaApplicable,
          bicApplicable,
          statut: nouveauStatut,
          lignes: {
            create: dto.lignes.map((ligne) => ({
              produitId: ligne.produitId,
              quantite: ligne.quantite,
              libelleProduit: produitsById.get(ligne.produitId)!.name,
              prixUnitaire: ligne.prixUnitaire ?? null,
            })),
          },
        },
      });
      await tx.historiqueCommande.create({
        data: { commandeId: id, action, details },
      });
      return tx.commande.findUniqueOrThrow({ where: { id }, include: COMMANDE_INCLUDE });
    });

    return { commande: updated, articlesModifies };
  }

  async proforma(id: string, commercialId: string) {
    const commande = await this.findOwnedCommande(id, commercialId);
    if (commande.statut === 'ANNULEE') {
      throw new BadRequestException('Cette commande est annulée');
    }
    if (commande.lignes.length === 0 || commande.lignes.some((ligne) => ligne.prixUnitaire == null)) {
      throw new BadRequestException(
        'Tous les articles doivent avoir un prix unitaire renseigné avant de générer la proforma',
      );
    }

    const numeroProforma = commande.numeroProforma ?? (await this.generateNumeroProforma());
    const dateProforma = commande.dateProforma ?? new Date();

    await this.proformaService.generate({
      numeroProforma,
      dateProforma,
      professionnel: {
        nom: commande.professionnel.nom,
        telephone1: commande.professionnel.telephone1,
      },
      lignes: commande.lignes.map((ligne) => ({
        libelleProduit: ligne.libelleProduit,
        quantite: ligne.quantite,
        prixUnitaire: Number(ligne.prixUnitaire),
      })),
      tvaApplicable: commande.tvaApplicable,
      bicApplicable: commande.bicApplicable,
    });

    await this.prisma.$transaction([
      this.prisma.commande.update({
        where: { id },
        data: { statut: 'PROFORMA_EMISE', numeroProforma, dateProforma },
      }),
      this.prisma.historiqueCommande.create({
        data: {
          commandeId: id,
          action: 'PROFORMA_EMISE',
          details: `Proforma ${numeroProforma} générée`,
        },
      }),
    ]);

    return { numeroProforma, urlPdf: `/commandes/${id}/proforma.pdf` };
  }

  private async generateNumeroProforma(): Promise<string> {
    const annee = new Date().getFullYear();
    const prefix = `PF-${annee}-`;
    const dernier = await this.prisma.commande.findFirst({
      where: { numeroProforma: { startsWith: prefix } },
      orderBy: { numeroProforma: 'desc' },
    });
    let prochain = 1;
    if (dernier?.numeroProforma) {
      const suffixe = dernier.numeroProforma.slice(prefix.length);
      const n = parseInt(suffixe, 10);
      if (!Number.isNaN(n)) {
        prochain = n + 1;
      }
    }
    return `${prefix}${String(prochain).padStart(4, '0')}`;
  }

  async annulation(id: string, commercialId: string, dto: AnnulationCommandeDto) {
    const commande = await this.findOwnedCommande(id, commercialId);
    if (commande.statut === 'ANNULEE') {
      throw new BadRequestException('Cette commande est déjà annulée');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.commande.update({
        where: { id },
        data: { statut: 'ANNULEE', motifAnnulation: dto.motif },
        include: COMMANDE_INCLUDE,
      }),
      this.prisma.historiqueCommande.create({
        data: { commandeId: id, action: 'ANNULATION', details: dto.motif },
      }),
    ]);
    return updated;
  }

  async getProformaPath(
    id: string,
    auth: { commercialId?: string; isAdmin?: boolean },
  ): Promise<string> {
    const commande = await this.prisma.commande.findUnique({ where: { id } });
    if (!commande) {
      throw new NotFoundException(`Commande ${id} introuvable`);
    }
    if (!auth.isAdmin && commande.commercialId !== auth.commercialId) {
      throw new ForbiddenException("Cette commande n'appartient pas à ce commercial");
    }
    if (!commande.numeroProforma) {
      throw new NotFoundException('Aucune proforma générée pour cette commande');
    }
    return this.proformaService.filePath(commande.numeroProforma);
  }
}
