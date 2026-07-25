/// Modèles pour la rubrique "Traitement" des commandes (session commercial).

double _parseDecimal(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  return double.parse(value.toString());
}

class LigneCommandeTraitement {
  final String? id;
  final String produitId;
  final String libelleProduit;
  int quantite;
  double? prixUnitaire;

  LigneCommandeTraitement({
    this.id,
    required this.produitId,
    required this.libelleProduit,
    required this.quantite,
    this.prixUnitaire,
  });

  double get montant => (prixUnitaire ?? 0) * quantite;

  factory LigneCommandeTraitement.fromJson(Map<String, dynamic> json) =>
      LigneCommandeTraitement(
        id: json['id'] as String?,
        produitId: json['produitId'] as String,
        libelleProduit: json['libelleProduit'] as String,
        quantite: json['quantite'] as int,
        prixUnitaire: json['prixUnitaire'] != null
            ? _parseDecimal(json['prixUnitaire'])
            : null,
      );

  Map<String, dynamic> toJson() => {
        if (id != null) 'id': id,
        'produitId': produitId,
        'quantite': quantite,
        if (prixUnitaire != null) 'prixUnitaire': prixUnitaire,
      };
}

class ProfessionnelInfo {
  final String id;
  final String nom;
  final String telephone1;

  ProfessionnelInfo(
      {required this.id, required this.nom, required this.telephone1});

  factory ProfessionnelInfo.fromJson(Map<String, dynamic> json) =>
      ProfessionnelInfo(
        id: json['id'] as String,
        nom: json['nom'] as String,
        telephone1: json['telephone1'] as String,
      );
}

/// Statuts possibles : ENVOYEE | EN_TRAITEMENT | PROFORMA_EMISE | MODIFIEE | ANNULEE.
class CommandeTraitement {
  final String id;
  final ProfessionnelInfo professionnel;
  final DateTime dateCommande;
  final String statut;
  final String? motifAnnulation;
  final bool tvaApplicable;
  final bool bicApplicable;
  final String? numeroProforma;
  final DateTime? dateProforma;
  final List<LigneCommandeTraitement> lignes;

  CommandeTraitement({
    required this.id,
    required this.professionnel,
    required this.dateCommande,
    required this.statut,
    this.motifAnnulation,
    required this.tvaApplicable,
    required this.bicApplicable,
    this.numeroProforma,
    this.dateProforma,
    required this.lignes,
  });

  factory CommandeTraitement.fromJson(Map<String, dynamic> json) =>
      CommandeTraitement(
        id: json['id'] as String,
        professionnel: ProfessionnelInfo.fromJson(
            json['professionnel'] as Map<String, dynamic>),
        dateCommande: DateTime.parse(json['dateCommande'] as String),
        statut: json['statut'] as String,
        motifAnnulation: json['motifAnnulation'] as String?,
        tvaApplicable: json['tvaApplicable'] as bool? ?? false,
        bicApplicable: json['bicApplicable'] as bool? ?? false,
        numeroProforma: json['numeroProforma'] as String?,
        dateProforma: json['dateProforma'] != null
            ? DateTime.parse(json['dateProforma'] as String)
            : null,
        lignes: (json['lignes'] as List<dynamic>)
            .map((l) =>
                LigneCommandeTraitement.fromJson(l as Map<String, dynamic>))
            .toList(),
      );

  bool get toutesLignesPricees =>
      lignes.isNotEmpty && lignes.every((l) => l.prixUnitaire != null);

  double get totalHt => lignes.fold(0.0, (sum, l) => sum + l.montant);

  bool get estAnnulee => statut == 'ANNULEE';
  bool get proformaEmise => statut == 'PROFORMA_EMISE';
}

class TraitementResult {
  final CommandeTraitement commande;
  final bool articlesModifies;

  TraitementResult({required this.commande, required this.articlesModifies});
}
