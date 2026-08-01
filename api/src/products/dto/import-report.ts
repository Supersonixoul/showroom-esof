/** Rapport de fin d'import Excel — voir ProductsService.importProducts.
 * Toutes les mentions (messages) sont en français. */
export interface ImportReportRow {
  ligne: number;
  reference: string | null;
  designation: string;
}

export interface ImportReport {
  lignesLues: number;
  produitsCrees: number;
  doublons: ImportReportRow[];
  erreurs: (ImportReportRow & { message: string })[];
}
