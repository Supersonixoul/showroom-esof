/** Normalise une chaîne pour comparaison de doublons : espaces de début/fin
 * supprimés, espaces internes multiples réduits à un seul, casse uniformisée
 * en majuscules. Ex. "  fil  1.5  rouge " et "FIL 1.5 ROUGE" sont considérés
 * identiques après normalisation. */
export function normalizeForComparison(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}
