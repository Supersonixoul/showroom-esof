import 'package:flutter/foundation.dart';

import '../models/catalog_models.dart';
import 'api_service.dart';
import 'database_service.dart';

/// Combine le cache local (SQLite) et l'API distante pour le catalogue
/// complet (marques, catégories, produits). Singleton partagé par tous les
/// écrans, pour éviter de recharger le cache à chaque navigation.
class CatalogRepository {
  CatalogRepository._internal();
  static final CatalogRepository instance = CatalogRepository._internal();

  final ApiService _api = ApiService();
  final DatabaseService _db = DatabaseService.instance;

  final ValueNotifier<CatalogSnapshot> snapshot =
      ValueNotifier<CatalogSnapshot>(CatalogSnapshot.empty);

  bool _initialized = false;

  /// Charge le cache local immédiatement (si disponible) puis rafraîchit
  /// depuis l'API en arrière-plan. Idempotent : n'agit qu'une seule fois par
  /// session, les appels suivants sont des no-op.
  Future<void> ensureInitialized() async {
    if (_initialized) return;
    _initialized = true;
    final cached = await _db.getCatalog();
    if (cached.products.isNotEmpty) {
      snapshot.value = cached;
    }
    await refresh();
  }

  Future<void> refresh() async {
    try {
      final fresh = await _api.fetchCatalog();
      await _db.replaceCatalog(fresh);
      snapshot.value = fresh;
    } catch (_) {
      // API injoignable : on garde le contenu du cache local.
    }
  }
}
