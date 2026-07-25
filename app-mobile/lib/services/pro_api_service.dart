import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/pro_models.dart';
import 'api_service.dart';
import 'pro_session.dart';

/// Appels API de l'Espace des Pros (gestion admin des Professionnel) et de
/// "Passer commande" (liste des commerciaux ESOF, envoi de commande).
class ProApiService {
  Map<String, String> _headers(String token) => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

  void _checkOk(http.Response response) {
    if (response.statusCode == 401) {
      throw ProSessionExpiredException();
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Erreur API (${response.statusCode}) : ${response.body}');
    }
  }

  // ---- Gestion admin des Professionnels (Espace des Pros) ---------------

  Future<List<Professionnel>> fetchProfessionnels(String adminToken) async {
    final response = await http.get(
      Uri.parse('${ApiService.baseUrl}/professionnels'),
      headers: _headers(adminToken),
    );
    _checkOk(response);
    return (jsonDecode(response.body) as List<dynamic>)
        .map((p) => Professionnel.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  Future<void> createProfessionnel(
    String adminToken, {
    required String nom,
    required String identifiant,
    required String motDePasse,
    required String telephone1,
    String? telephone2,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiService.baseUrl}/professionnels'),
      headers: _headers(adminToken),
      body: jsonEncode({
        'nom': nom,
        'identifiant': identifiant,
        'motDePasse': motDePasse,
        'telephone1': telephone1,
        if (telephone2 != null && telephone2.isNotEmpty) 'telephone2': telephone2,
      }),
    );
    _checkOk(response);
  }

  Future<void> updateProfessionnel(
    String adminToken,
    String id, {
    required String nom,
    required String identifiant,
    String? motDePasse,
    required String telephone1,
    String? telephone2,
  }) async {
    final response = await http.patch(
      Uri.parse('${ApiService.baseUrl}/professionnels/$id'),
      headers: _headers(adminToken),
      body: jsonEncode({
        'nom': nom,
        'identifiant': identifiant,
        if (motDePasse != null && motDePasse.isNotEmpty) 'motDePasse': motDePasse,
        'telephone1': telephone1,
        'telephone2': telephone2 ?? '',
      }),
    );
    _checkOk(response);
  }

  Future<void> deactivateProfessionnel(String adminToken, String id) async {
    final response = await http.delete(
      Uri.parse('${ApiService.baseUrl}/professionnels/$id'),
      headers: _headers(adminToken),
    );
    _checkOk(response);
  }

  // ---- Passer commande (compte Pro) --------------------------------------

  Future<List<AgentCommercial>> fetchCommerciaux(String proToken) async {
    final response = await http.get(
      Uri.parse('${ApiService.baseUrl}/commerciaux'),
      headers: _headers(proToken),
    );
    _checkOk(response);
    return (jsonDecode(response.body) as List<dynamic>)
        .map((c) => AgentCommercial.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  Future<void> createCommande(
    String proToken, {
    required String commercialId,
    required List<CartLine> lignes,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiService.baseUrl}/commandes'),
      headers: _headers(proToken),
      body: jsonEncode({
        'commercialId': commercialId,
        'lignes': lignes
            .map((l) => {'produitId': l.produitId, 'quantite': l.quantite})
            .toList(),
      }),
    );
    _checkOk(response);
  }
}
