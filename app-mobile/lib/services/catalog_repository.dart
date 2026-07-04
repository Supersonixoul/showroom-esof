import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/catalog_models.dart';
import 'api_service.dart';
import 'database_service.dart';

/// Combine le cache local (SQLite) et l'API distante pour le catalogue
/// complet (marques, catégories, produits). Singleton partagé par tous les
/// écrans, pour éviter de recharger le cache à chaque navigation.
///
/// Synchronisation différentielle (spec §2.2) : après le premier chargement
/// complet, les rafraîchissements suivants n'interrogent que `/catalog/sync`
/// (éléments modifiés depuis le dernier curseur `since`), et sont répétés
/// périodiquement en arrière-plan.
class CatalogRepository {
  CatalogRepository._internal();
  static final CatalogRepository instance = CatalogRepository._internal();

  static const _syncInterval = Duration(minutes: 5);

  final ApiService _api = ApiService();
  final DatabaseService _db = DatabaseService.instance;

  final ValueNotifier<CatalogSnapshot> snapshot =
      ValueNotifier<CatalogSnapshot>(CatalogSnapshot.empty);

  bool _initialized = false;
  Timer? _syncTimer;

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
    _syncTimer ??= Timer.periodic(_syncInterval, (_) => refresh());
  }

  Future<void> refresh() async {
    try {
      final lastSyncedAt = await _db.getLastSyncedAt();
      if (lastSyncedAt == null) {
        final result = await _api.fetchCatalog();
        await _db.replaceCatalog(result.snapshot);
        snapshot.value = result.snapshot;
        await _db.setLastSyncedAt(result.syncedAt);
      } else {
        final result = await _api.fetchCatalogSync(lastSyncedAt);
        if (!result.snapshot.isEmpty) {
          await _db.mergeCatalog(result.snapshot);
          snapshot.value = await _db.getCatalog();
        }
        await _db.setLastSyncedAt(result.syncedAt);
      }
    } catch (_) {
      // API injoignable : on garde le contenu du cache local.
    }
  }
}
