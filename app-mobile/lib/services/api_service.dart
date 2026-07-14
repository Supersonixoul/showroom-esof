import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/catalog_models.dart';

class ApiService {
  /// 10.0.2.2 = l'hôte vu depuis l'émulateur Android ; localhost sur les
  /// autres cibles (iOS simulator, desktop).
  static String get baseUrl {
    if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  static String mediaUrl(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return '$baseUrl$url';
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
