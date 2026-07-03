import 'package:flutter/foundation.dart';

import '../models/promo_video.dart';
import 'api_service.dart';
import 'database_service.dart';

/// Combine le cache local (SQLite) et l'API distante : au démarrage, affiche
/// immédiatement le cache (fonctionnement hors-ligne), puis tente un
/// rafraîchissement depuis l'API en arrière-plan.
class VideoRepository {
  final ApiService _api = ApiService();
  final DatabaseService _db = DatabaseService.instance;

  final ValueNotifier<List<PromoVideo>> videos =
      ValueNotifier<List<PromoVideo>>([]);

  Future<void> init() async {
    final cached = await _db.getPromoVideos();
    if (cached.isNotEmpty) {
      videos.value = cached.where((v) => v.isActive).toList();
    }
    await refresh();
  }

  Future<void> refresh() async {
    try {
      final fresh = await _api.fetchActiveVideos();
      await _db.replacePromoVideos(fresh);
      videos.value = fresh;
    } catch (_) {
      // API injoignable : on garde le contenu du cache local.
    }
  }
}
