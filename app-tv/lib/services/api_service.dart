import 'dart:convert';
import 'dart:io';

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

  Future<List<PromoVideo>> fetchActiveVideos() async {
    final response = await http.get(Uri.parse('$baseUrl/videos'));
    if (response.statusCode != 200) {
      throw Exception('Erreur API vidéos: ${response.statusCode}');
    }
    final List<dynamic> data = jsonDecode(response.body) as List<dynamic>;
    final videos = data
        .map((json) => PromoVideo.fromJson(json as Map<String, dynamic>))
        .where((video) => video.isActive)
        .toList();
    videos.sort((a, b) => a.position.compareTo(b.position));
    return videos;
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
