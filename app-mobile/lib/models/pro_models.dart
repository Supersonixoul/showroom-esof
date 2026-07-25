/// Compte Pro (revendeur, électricien, entreprise de construction...) —
/// authentification par identifiant/mot de passe, distincte du compte
/// admin/commercial ESOF (Espace commercial).
class Professionnel {
  final String id;
  final String nom;
  final String identifiant;
  final String telephone1;
  final String? telephone2;
  final bool actif;

  Professionnel({
    required this.id,
    required this.nom,
    required this.identifiant,
    required this.telephone1,
    this.telephone2,
    this.actif = true,
  });

  factory Professionnel.fromJson(Map<String, dynamic> json) => Professionnel(
        id: json['id'] as String,
        nom: json['nom'] as String,
        identifiant: json['identifiant'] as String,
        telephone1: json['telephone1'] as String,
        telephone2: json['telephone2'] as String?,
        actif: json['actif'] as bool? ?? true,
      );
}

/// Contact commercial ESOF (WhatsApp) — sans rapport avec le compte
/// admin/commercial (Espace commercial) existant.
class AgentCommercial {
  final String id;
  final String nom;
  final String prenom;
  final String telephone1;
  final String? telephone2;
  final bool actif;

  AgentCommercial({
    required this.id,
    required this.nom,
    required this.prenom,
    required this.telephone1,
    this.telephone2,
    this.actif = true,
  });

  String get nomComplet => '$prenom $nom';

  factory AgentCommercial.fromJson(Map<String, dynamic> json) => AgentCommercial(
        id: json['id'] as String,
        nom: json['nom'] as String,
        prenom: json['prenom'] as String,
        telephone1: json['telephone1'] as String,
        telephone2: json['telephone2'] as String?,
        actif: json['actif'] as bool? ?? true,
      );
}

/// Ligne du panier de commande Pro (en mémoire, le temps de la session).
class CartLine {
  final String produitId;
  final String nomProduit;
  int quantite;

  CartLine({
    required this.produitId,
    required this.nomProduit,
    this.quantite = 1,
  });
}
