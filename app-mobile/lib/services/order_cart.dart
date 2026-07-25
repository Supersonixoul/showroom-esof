import 'package:flutter/foundation.dart';

import '../models/pro_models.dart';

/// Panier de commande Pro — en mémoire, vidé à la fin de la session ou après
/// envoi réussi (spec §3.3).
class OrderCart {
  OrderCart._internal();
  static final OrderCart instance = OrderCart._internal();

  final ValueNotifier<List<CartLine>> lines = ValueNotifier<List<CartLine>>([]);

  int get lineCount => lines.value.length;

  void addProduct(String produitId, String nomProduit, {int quantite = 1}) {
    final existing = lines.value.where((l) => l.produitId == produitId).toList();
    if (existing.isNotEmpty) {
      existing.first.quantite += quantite;
      lines.value = [...lines.value];
      return;
    }
    lines.value = [
      ...lines.value,
      CartLine(produitId: produitId, nomProduit: nomProduit, quantite: quantite),
    ];
  }

  void updateQuantite(String produitId, int quantite) {
    if (quantite <= 0) {
      removeLine(produitId);
      return;
    }
    lines.value = [
      for (final line in lines.value)
        if (line.produitId == produitId)
          CartLine(produitId: line.produitId, nomProduit: line.nomProduit, quantite: quantite)
        else
          line,
    ];
  }

  void removeLine(String produitId) {
    lines.value = lines.value.where((l) => l.produitId != produitId).toList();
  }

  void clear() {
    lines.value = [];
  }
}
