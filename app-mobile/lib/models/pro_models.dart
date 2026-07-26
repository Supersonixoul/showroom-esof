/// Compte Pro (revendeur, électricien, entreprise de construction...) —
/// authentification par identifiant/mot de passe, distincte du compte
/// admin/commercial ESOF (Espace commercial).
class Professionnel {
  final String id;
  final String nom;
  final String identifiant;
  final String code;
  final String telephone1;
  final String? telephone2;
  final bool actif;

  Professionnel({
    required this.id,
    required this.nom,
    required this.identifiant,
    required this.code,
    required this.telephone1,
    this.telephone2,
    this.actif = true,
  });

  factory Professionnel.fromJson(Map<String, dynamic> json) => Professionnel(
        id: json['id'] as String,
        nom: json['nom'] as String,
        identifiant: json['identifiant'] as String,
        code: json['code'] as String? ?? '',
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

double _parseDecimal(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  return double.parse(value.toString());
}

/// Ligne d'une commande telle que renvoyée par l'API (rubrique "Commander",
/// compte Pro) — `prixUnitaire` reste nul tant que le commercial ne l'a pas
/// encore renseigné (rubrique "Traitement").
class LigneCommandePro {
  final String? id;
  final String produitId;
  final String libelleProduit;
  final int quantite;
  final double? prixUnitaire;

  LigneCommandePro({
    this.id,
    required this.produitId,
    required this.libelleProduit,
    required this.quantite,
    this.prixUnitaire,
  });

  double get montant => (prixUnitaire ?? 0) * quantite;

  factory LigneCommandePro.fromJson(Map<String, dynamic> json) => LigneCommandePro(
        id: json['id'] as String?,
        produitId: json['produitId'] as String,
        libelleProduit: json['libelleProduit'] as String,
        quantite: json['quantite'] as int,
        prixUnitaire:
            json['prixUnitaire'] != null ? _parseDecimal(json['prixUnitaire']) : null,
      );
}

/// Commande telle que vue par le compte Pro propriétaire (rubrique
/// "Commander") — `numero` est immuable, attribué par le backend à la
/// création (format XXX99-9999, voir CommandesService.generateNumeroCommande).
/// Statuts possibles : ENVOYEE | EN_TRAITEMENT | PROFORMA_EMISE | MODIFIEE | ANNULEE.
class CommandePro {
  final String id;
  final String numero;
  final DateTime dateCommande;
  final String statut;
  final List<LigneCommandePro> lignes;

  CommandePro({
    required this.id,
    required this.numero,
    required this.dateCommande,
    required this.statut,
    required this.lignes,
  });

  factory CommandePro.fromJson(Map<String, dynamic> json) => CommandePro(
        id: json['id'] as String,
        numero: json['numero'] as String,
        dateCommande: DateTime.parse(json['dateCommande'] as String),
        statut: json['statut'] as String,
        lignes: (json['lignes'] as List<dynamic>)
            .map((l) => LigneCommandePro.fromJson(l as Map<String, dynamic>))
            .toList(),
      );

  bool get toutesLignesPricees =>
      lignes.isNotEmpty && lignes.every((l) => l.prixUnitaire != null);

  double get totalHt => lignes.fold(0.0, (sum, l) => sum + l.montant);

  bool get estAnnulee => statut == 'ANNULEE';
}
