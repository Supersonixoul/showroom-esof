import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/catalog_models.dart';
import 'server_config.dart';

class ApiService {
  /// Adresse du serveur backend, configurable depuis l'écran de réglages
  /// (voir [ServerConfig]) — jamais figée en dur dans le code.
  static String get baseUrl => ServerConfig.getBaseUrl();

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

  /// Produits mis en avant (nouveautés/promos/soldes) pour le carrousel de
  /// la page d'accueil. Pas de mise en cache locale : appel simple, l'appelant
  /// doit masquer silencieusement la section en cas d'échec réseau.
  Future<FeaturedProducts> fetchFeaturedProducts() async {
    final response = await http.get(Uri.parse('$baseUrl/catalog/featured'));
    if (response.statusCode != 200) {
      throw Exception('Erreur API produits mis en avant: ${response.statusCode}');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return FeaturedProducts.fromJson(data);
  }
}
