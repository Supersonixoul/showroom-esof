import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/catalog_models.dart';
import '../models/promo_video.dart';

class ApiService {
  /// 10.0.2.2 = l'hôte vu depuis l'émulateur Android ; localhost sur les
  /// autres cibles (Windows desktop, web). À terme, adresse de l'API
  /// configurable (ex. serveur local du magasin).
  static String get baseUrl {
    if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  static String mediaUrl(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return '$baseUrl$url';
  }

  /// Endpoint public dédié au kiosque (voir `catalog/promo-videos` côté API) —
  /// `GET /videos` est réservé à l'admin (JWT + rôle ADMIN) et renvoie 401
  /// pour un client non authentifié comme ce kiosque.
  Future<List<PromoVideo>> fetchActiveVideos() async {
    final response = await http.get(Uri.parse('$baseUrl/catalog/promo-videos'));
    if (response.statusCode != 200) {
      debugPrint(
        '[ApiService] Échec GET /catalog/promo-videos : '
        '${response.statusCode} — ${response.body}',
      );
      throw Exception(
        'Erreur API vidéos: ${response.statusCode} — ${response.body}',
      );
    }
    final List<dynamic> data = jsonDecode(response.body) as List<dynamic>;
    final videos = data
        .map((json) => PromoVideo.fromJson(json as Map<String, dynamic>))
        .where((video) => video.isActive)
        .toList();
    // Tri stable par position : en cas d'égalité (ex. toutes à 0), on
    // conserve l'ordre reçu de l'API (déjà trié par position puis createdAt)
    // au lieu de laisser le quicksort de List.sort mélanger les égalités.
    final indexed = List<MapEntry<int, PromoVideo>>.generate(
      videos.length,
      (i) => MapEntry(i, videos[i]),
    );
    indexed.sort((a, b) {
      final cmp = a.value.position.compareTo(b.value.position);
      return cmp != 0 ? cmp : a.key.compareTo(b.key);
    });
    return indexed.map((e) => e.value).toList();
  }

  Future<CatalogSyncResult> fetchCatalog() async {
    final response = await http.get(Uri.parse('$baseUrl/catalog/full'));
    if (response.statusCode != 200) {
      throw Exception('Erreur API catalogue: ${response.statusCode}');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return CatalogSyncResult(
      snapshot: CatalogSnapshot.fromJson(data),
      syncedAt: data['syncedAt'] as String,
    );
  }

  /// Synchronisation différentielle (spec §2.2, §5.3) : ne renvoie que les
  /// éléments créés/modifiés depuis `since`.
  Future<CatalogSyncResult> fetchCatalogSync(String since) async {
    final response = await http.get(
      Uri.parse('$baseUrl/catalog/sync').replace(queryParameters: {'since': since}),
    );
    if (response.statusCode != 200) {
      throw Exception('Erreur API sync catalogue: ${response.statusCode}');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return CatalogSyncResult(
      snapshot: CatalogSnapshot.fromJson(data),
      syncedAt: data['syncedAt'] as String,
    );
  }
}
