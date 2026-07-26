/// Aperçu local (non faisant foi) du code d'identification à 3 caractères
/// généré automatiquement à partir du nom d'un client (Professionnel).
///
/// Mirrore uniquement le calcul du *premier* candidat de l'algorithme côté
/// API (`api/src/professionnels/client-code.util.ts`) : seul le backend
/// vérifie l'unicité en base et résout les collisions (autres lettres du
/// milieu, puis repli par chiffres, puis code aléatoire) — ce champ n'est
/// donc qu'une prévisualisation, éditable par l'utilisateur.

const Map<String, String> _accentMap = {
  'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A',
  'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
  'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
  'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
  'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
  'Ç': 'C', 'Ñ': 'N', 'Ý': 'Y', 'Ÿ': 'Y',
  'Œ': 'OE', 'Æ': 'AE',
};

/// Nettoie un nom pour la génération du code : accents supprimés,
/// majuscules, uniquement A-Z et 0-9 — même règle que côté API.
String cleanNameForCode(String name) {
  final upper = name.toUpperCase();
  final buffer = StringBuffer();
  for (final char in upper.split('')) {
    buffer.write(_accentMap[char] ?? char);
  }
  return buffer.toString().replaceAll(RegExp(r'[^A-Z0-9]'), '');
}

/// Calcule le premier candidat (PREMIER + MILIEU + DERNIER caractère, ou cas
/// particuliers pour les noms nettoyés de 0/1/2 caractères). Retourne `null`
/// si le nom nettoyé est vide.
String? previewClientCode(String nom) {
  final cleaned = cleanNameForCode(nom);
  final len = cleaned.length;
  if (len == 0) return null;
  if (len == 1) return '${cleaned[0]}01';
  if (len == 2) return '${cleaned[0]}${cleaned[1]}1';

  final first = cleaned[0];
  final last = cleaned[len - 1];
  final center = (len + 1) ~/ 2; // 1-indexé, ceil(len / 2)
  final middle = cleaned[center - 1];
  return '$first$middle$last';
}
