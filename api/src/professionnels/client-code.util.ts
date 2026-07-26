/// Génération du code d'identification unique à 3 caractères alphanumériques
/// attribué à chaque Professionnel ("Client"), dérivé de son nom.
///
/// Algorithme (voir brief) :
/// 1. Nettoyage du nom : suppression des accents, mise en majuscules,
///    conservation des seuls caractères alphanumériques (A-Z, 0-9).
/// 2. Candidat de base : PREMIER + MILIEU + DERNIER caractère du nom nettoyé,
///    où MILIEU = caractère d'indice ceil(longueur / 2) (1-indexé).
///    Ex. "ROGREF" (6) -> milieu = indice 3 = "G" -> "RGF".
/// 3. En cas de collision, on essaie d'autres caractères du milieu en
///    s'écartant du centre en alternance (centre, centre-1, centre+1,
///    centre-2, centre+2, ...), en ignorant les indices déjà utilisés comme
///    PREMIER/DERNIER caractère.
///    Ex. "ROGREF" -> RGF, ROF, RRF, REF.
/// 4. Cas particuliers (nom nettoyé trop court pour avoir un milieu) :
///    - longueur 2 : PREMIER + DERNIER + chiffre (1 à 9). Ex. "AB" -> "AB1".
///    - longueur 1 : PREMIER + 2 chiffres (01 à 99). Ex. "K" -> "K01".
///    - longueur 0 : aucun candidat nominal, on passe directement au
///      repli par chiffres puis au repli aléatoire.
/// 5. Si tous les candidats issus du nom sont épuisés, repli par
///    PREMIER + 2 chiffres (01 à 99), puis, en dernier recours, un code
///    entièrement aléatoire.

const RANDOM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/// Nettoie un nom pour la génération du code : accents supprimés,
/// majuscules, uniquement A-Z et 0-9.
export function cleanNameForCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/// Construit la liste ordonnée des candidats de code dérivés du nom nettoyé
/// (sans les replis par chiffres/aléatoire, gérés séparément).
export function buildNameCodeCandidates(cleaned: string): string[] {
  const len = cleaned.length;
  if (len === 0 || len === 1) {
    return [];
  }

  const first = cleaned[0];
  const last = cleaned[len - 1];

  if (len === 2) {
    const candidates: string[] = [];
    for (let n = 1; n <= 9; n++) {
      candidates.push(`${first}${last}${n}`);
    }
    return candidates;
  }

  const center = Math.ceil(len / 2); // indice 1-indexé
  const offsets: number[] = [0];
  for (let k = 1; k < len; k++) {
    offsets.push(-k, k);
  }

  const seen = new Set<number>();
  const candidates: string[] = [];
  for (const offset of offsets) {
    const idx = center + offset;
    if (idx < 1 || idx > len) continue;
    if (idx === 1 || idx === len) continue; // déjà utilisés comme PREMIER/DERNIER
    if (seen.has(idx)) continue;
    seen.add(idx);
    candidates.push(`${first}${cleaned[idx - 1]}${last}`);
  }
  return candidates;
}

/// Repli : PREMIER caractère (ou lettre aléatoire si nom vide) + 2 chiffres
/// incrémentaux (01 à 99).
export function buildFallbackDigitCandidates(first: string): string[] {
  const candidates: string[] = [];
  for (let n = 1; n <= 99; n++) {
    candidates.push(`${first}${String(n).padStart(2, '0')}`);
  }
  return candidates;
}

/// Code entièrement aléatoire (dernier recours).
export function randomCode(): string {
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];
  }
  return code;
}
