/**
 * Formatage centralisé des prix affichés dans l'admin : séparateur de
 * milliers "espace" (format français, `Intl.NumberFormat('fr-FR')`) et
 * symbole "F" seul en suffixe — aucune mention "CFA"/"FCFA".
 * Ex. : 125000 -> "125 000 F" ; 4500 -> "4 500 F".
 */
export function formatPrix(montant?: number | string | null): string {
  if (montant == null || montant === '') return '—';
  const n = Number(montant);
  if (!Number.isFinite(n)) return '—';
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} F`;
}
