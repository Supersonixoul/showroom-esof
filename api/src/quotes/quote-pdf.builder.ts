import PDFDocument from 'pdfkit';

interface QuotePdfData {
  id: string;
  status: string;
  createdAt: Date;
  client: {
    name: string;
    phone: string;
    email: string | null;
    company: string | null;
  };
  commercial: { name: string; email: string };
  items: Array<{
    quantity: number;
    unitPrice: unknown;
    note: string | null;
    product: { name: string; reference: string | null };
  }>;
}

/// Génère le PDF d'un devis côté serveur (spec §5.4, GET /quotes/:id/pdf).
/// Format simple, à affiner avec la charte graphique ESOF (voir spec §11 - point ouvert).
export function buildQuotePdf(quote: QuotePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('ESOF — Devis');
    doc.moveDown();
    doc.fontSize(10).text(`Devis n° ${quote.id}`);
    doc.text(`Date : ${quote.createdAt.toLocaleDateString('fr-FR')}`);
    doc.text(`Statut : ${quote.status}`);
    doc.moveDown();

    doc.fontSize(12).text('Client', { underline: true });
    doc.fontSize(10).text(quote.client.name);
    if (quote.client.company) doc.text(quote.client.company);
    doc.text(quote.client.phone);
    if (quote.client.email) doc.text(quote.client.email);
    doc.moveDown();

    doc.fontSize(12).text('Commercial', { underline: true });
    doc.fontSize(10).text(`${quote.commercial.name} (${quote.commercial.email})`);
    doc.moveDown();

    doc.fontSize(12).text('Articles', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(9);
    let y = doc.y;
    doc.text('Produit', 50, y, { width: 180 });
    doc.text('Qté', 230, y, { width: 40 });
    doc.text('PU (FCFA)', 270, y, { width: 80 });
    doc.text('Total (FCFA)', 350, y, { width: 90 });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    let total = 0;
    for (const item of quote.items) {
      const unitPrice = Number(item.unitPrice);
      const lineTotal = unitPrice * item.quantity;
      total += lineTotal;
      y = doc.y;
      doc.text(item.product.name, 50, y, { width: 180 });
      doc.text(String(item.quantity), 230, y, { width: 40 });
      doc.text(unitPrice.toLocaleString('fr-FR'), 270, y, { width: 80 });
      doc.text(lineTotal.toLocaleString('fr-FR'), 350, y, { width: 90 });
      doc.moveDown();
      if (item.note) {
        doc.fontSize(8).fillColor('gray').text(item.note, 50, doc.y, { width: 480 });
        doc.fillColor('black').fontSize(9);
        doc.moveDown();
      }
    }

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();
    doc.fontSize(12).text(`Total : ${total.toLocaleString('fr-FR')} FCFA`, { align: 'right' });

    doc.end();
  });
}
