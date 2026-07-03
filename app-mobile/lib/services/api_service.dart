import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../models/catalog_models.dart';

class ApiService {
  /// 10.0.2.2 = l'hôte vu depuis l'émulateur Android ; localhost sur les
  /// autres cibles (iOS simulator, desktop). À terme, adresse de l'API
  /// configurable (utile pour un test sur téléphone physique).
  static String get baseUrl {
    if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  static String mediaUrl(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return '$baseUrl$url';
  }

  Future<CatalogSnapshot> fetchCatalog() async {
    final response = await http.get(Uri.parse('$baseUrl/catalog/full'));
    if (response.statusCode != 200) {
      throw Exception('Erreur API catalogue: ${response.statusCode}');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return CatalogSnapshot.fromJson(data);
  }
}
