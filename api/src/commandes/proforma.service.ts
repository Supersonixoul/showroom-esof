import { Injectable } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { UPLOADS_ROOT } from '../media/multer.config';

/// Coordonnées ESOF affichées en en-tête/pied de page du PDF proforma.
/// Valeurs placeholder — à remplacer par les vraies coordonnées de
/// l'entreprise avant mise en production.
// TODO À COMPLÉTER — remplacer par les vraies coordonnées ESOF.
const ENTREPRISE_INFOS = {
  nom: 'ESOF',
  adresse: '// TODO À COMPLÉTER — adresse ESOF',
  telephone: '// TODO À COMPLÉTER — téléphone ESOF',
  email: '// TODO À COMPLÉTER — email ESOF',
  rccmIfu: '// TODO À COMPLÉTER — RCCM / IFU ESOF',
};

const NAVY = '#1B2A4A';
const GOLD = '#C9A227';
const TVA_TAUX = 0.18;
/// BIC (Bénéfice Industriel et Commercial), Burkina Faso — 2 %, optionnel,
/// appliqué sur le montant TTC (ou HT si la TVA n'est pas appliquée).
const BIC_TAUX = 0.02;

export const PROFORMAS_DIR = join(UPLOADS_ROOT, 'proformas');

export interface ProformaLigne {
  libelleProduit: string;
  quantite: number;
  prixUnitaire: number;
}

export interface ProformaData {
  numeroProforma: string;
  dateProforma: Date;
  professionnel: { nom: string; telephone1: string };
  lignes: ProformaLigne[];
  tvaApplicable: boolean;
  bicApplicable: boolean;
}

function formatFcfa(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} F`;
}

/// Génération du PDF de facture proforma (rubrique "Traitement", brief
/// §1.4) — palette bleu marine/or, archivé dans api/uploads/proformas/.
@Injectable()
export class ProformaService {
  filePath(numeroProforma: string): string {
    return join(PROFORMAS_DIR, `${numeroProforma}.pdf`);
  }

  generate(data: ProformaData): Promise<string> {
    if (!existsSync(PROFORMAS_DIR)) {
      mkdirSync(PROFORMAS_DIR, { recursive: true });
    }
    const path = this.filePath(data.numeroProforma);

    return new Promise<string>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = createWriteStream(path);
      doc.pipe(stream);
      stream.on('finish', () => resolve(path));
      stream.on('error', reject);
      doc.on('error', reject);

      const pageWidth = doc.page.width;

      // 1. En-tête — bandeau bleu marine.
      doc.rect(0, 0, pageWidth, 90).fill(NAVY);
      doc.fillColor('#FFFFFF').fontSize(26).text('ESOF', 50, 28);
      doc.fontSize(11).text('Distribution de matériel électrique', 50, 62);

      // 2. Titre.
      doc.fillColor(NAVY).fontSize(18).text('FACTURE PROFORMA', 50, 116);
      doc.fillColor('#000000').fontSize(10);
      doc.text(`N° ${data.numeroProforma}`, 50, 144);
      doc.text(`Date : ${data.dateProforma.toLocaleDateString('fr-FR')}`, 50, 158);
      doc
        .moveTo(50, 180)
        .lineTo(545, 180)
        .lineWidth(2)
        .strokeColor(GOLD)
        .stroke();
      doc.lineWidth(1).strokeColor('#000000');

      // 3. Bloc client.
      doc.fillColor(NAVY).fontSize(11).text('Client', 50, 194);
      doc.fillColor('#000000').fontSize(10);
      doc.text(data.professionnel.nom, 50, 210);
      doc.text(data.professionnel.telephone1, 50, 224);

      // 4. Tableau des lignes.
      let y = 258;
      doc.fillColor(NAVY).fontSize(9);
      doc.text('N°', 50, y, { width: 25 });
      doc.text('Désignation', 75, y, { width: 210 });
      doc.text('Qté', 285, y, { width: 40, align: 'right' });
      doc.text('Prix unitaire (FCFA)', 325, y, { width: 105, align: 'right' });
      doc.text('Montant (FCFA)', 430, y, { width: 115, align: 'right' });
      y += 14;
      doc.moveTo(50, y).lineTo(545, y).strokeColor(GOLD).stroke();
      y += 8;

      doc.fillColor('#000000').fontSize(9);
      let totalHt = 0;
      data.lignes.forEach((ligne, index) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        const montant = ligne.quantite * ligne.prixUnitaire;
        totalHt += montant;
        doc.text(String(index + 1), 50, y, { width: 25 });
        doc.text(ligne.libelleProduit, 75, y, { width: 210 });
        doc.text(String(ligne.quantite), 285, y, { width: 40, align: 'right' });
        doc.text(formatFcfa(ligne.prixUnitaire), 325, y, { width: 105, align: 'right' });
        doc.text(formatFcfa(montant), 430, y, { width: 115, align: 'right' });
        y += 18;
      });

      y += 6;
      doc.moveTo(50, y).lineTo(545, y).strokeColor(GOLD).stroke();
      y += 14;

      // 5. Totaux, alignés à droite.
      let baseBic = totalHt;
      if (data.tvaApplicable) {
        const tva = totalHt * TVA_TAUX;
        baseBic = totalHt + tva;
        doc.fontSize(10).fillColor('#000000');
        doc.text(`Total HT : ${formatFcfa(totalHt)}`, 325, y, { width: 220, align: 'right' });
        y += 16;
        doc.text(`TVA 18 % : ${formatFcfa(tva)}`, 325, y, { width: 220, align: 'right' });
        y += 18;
      }

      if (data.bicApplicable) {
        const bic = baseBic * BIC_TAUX;
        const netAPayer = baseBic + bic;
        doc.fontSize(10).fillColor('#000000');
        doc.text(
          `${data.tvaApplicable ? 'Total TTC' : 'Montant HT'} : ${formatFcfa(baseBic)}`,
          325,
          y,
          { width: 220, align: 'right' },
        );
        y += 16;
        doc.text(`BIC 2 % : ${formatFcfa(bic)}`, 325, y, { width: 220, align: 'right' });
        y += 18;
        doc
          .fontSize(12)
          .fillColor(NAVY)
          .text(`Net à payer : ${formatFcfa(netAPayer)}`, 325, y, { width: 220, align: 'right' });
      } else if (data.tvaApplicable) {
        doc
          .fontSize(12)
          .fillColor(NAVY)
          .text(`Total TTC : ${formatFcfa(baseBic)}`, 325, y, { width: 220, align: 'right' });
      } else {
        doc
          .fontSize(12)
          .fillColor(NAVY)
          .text(`Montant total : ${formatFcfa(totalHt)}`, 325, y, { width: 220, align: 'right' });
      }

      // 6. Pied de page.
      const footerY = doc.page.height - 90;
      doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor(GOLD).stroke();
      doc.fillColor('#555555').fontSize(8);
      doc.text('Proforma valable 15 jours — Prix susceptibles de modification', 50, footerY + 10, {
        width: 495,
        align: 'center',
      });
      doc.text(
        `${ENTREPRISE_INFOS.nom} — ${ENTREPRISE_INFOS.adresse} — ${ENTREPRISE_INFOS.telephone} — ${ENTREPRISE_INFOS.email}`,
        50,
        footerY + 24,
        { width: 495, align: 'center' },
      );
      doc.text(ENTREPRISE_INFOS.rccmIfu, 50, footerY + 38, { width: 495, align: 'center' });

      doc.end();
    });
  }
}
