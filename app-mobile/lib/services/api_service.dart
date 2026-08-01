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

  /// Recherche produit (barre de recherche de l'accueil) : correspondance
  /// partielle insensible à la casse sur la désignation OU la référence.
  Future<List<FeaturedProduct>> searchProducts(String query) async {
    final response = await http.get(
      Uri.parse('$baseUrl/catalog/search').replace(queryParameters: {'q': query}),
    );
    if (response.statusCode != 200) {
      throw Exception('Erreur API recherche produit: ${response.statusCode}');
    }
    final data = jsonDecode(response.body) as List<dynamic>;
    return data
        .map((p) => FeaturedProduct.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  /// Recherche multi-mots au sein d'une catégorie (écran liste produits d'une
  /// catégorie) : chaque mot doit être trouvé dans la désignation, la
  /// référence OU la marque (`GET /catalog/products`, paramètre `q`). Ne
  /// renvoie que les identifiants — l'affichage réutilise le produit complet
  /// déjà présent dans le catalogue synchronisé localement.
  Future<List<String>> searchCategoryProductIds(
    String categoryId,
    String query,
  ) async {
    final response = await http.get(
      Uri.parse('$baseUrl/catalog/products').replace(queryParameters: {
        'categoryId': categoryId,
        'q': query,
        'pageSize': '50',
      }),
    );
    if (response.statusCode != 200) {
      throw Exception('Erreur API recherche catégorie: ${response.statusCode}');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>? ?? [];
    return items
        .map((item) => (item as Map<String, dynamic>)['id'] as String)
        .toList();
  }
}
