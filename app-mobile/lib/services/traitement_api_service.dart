import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../models/traitement_models.dart';
import 'api_service.dart';
import 'commercial_session.dart';

/// Appels API de la rubrique "Traitement" (session commercial).
class TraitementApiService {
  Map<String, String> _headers(String token) => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

  void _checkOk(http.Response response) {
    if (response.statusCode == 401) {
      throw CommercialSessionExpiredException();
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Erreur API (${response.statusCode}) : ${response.body}');
    }
  }

  Future<List<CommandeTraitement>> fetchCommandes(String token, {String? statut}) async {
    final uri = Uri.parse('${ApiService.baseUrl}/commandes/a-traiter').replace(
      queryParameters: statut != null ? {'statut': statut} : null,
    );
    final response = await http.get(uri, headers: _headers(token));
    _checkOk(response);
    return (jsonDecode(response.body) as List<dynamic>)
        .map((c) => CommandeTraitement.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  Future<TraitementResult> updateTraitement(
    String token,
    String commandeId, {
    required List<LigneCommandeTraitement> lignes,
    bool? tvaApplicable,
  }) async {
    final response = await http.patch(
      Uri.parse('${ApiService.baseUrl}/commandes/$commandeId/traitement'),
      headers: _headers(token),
      body: jsonEncode({
        'lignes': lignes.map((l) => l.toJson()).toList(),
        if (tvaApplicable != null) 'tvaApplicable': tvaApplicable,
      }),
    );
    _checkOk(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return TraitementResult(
      commande: CommandeTraitement.fromJson(data['commande'] as Map<String, dynamic>),
      articlesModifies: data['articlesModifies'] as bool? ?? false,
    );
  }

  Future<String> genererProforma(String token, String commandeId) async {
    final response = await http.post(
      Uri.parse('${ApiService.baseUrl}/commandes/$commandeId/proforma'),
      headers: _headers(token),
    );
    _checkOk(response);
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['numeroProforma'] as String;
  }

  Future<Uint8List> telechargerProformaPdf(String token, String commandeId) async {
    final response = await http.get(
      Uri.parse('${ApiService.baseUrl}/commandes/$commandeId/proforma.pdf'),
      headers: _headers(token),
    );
    _checkOk(response);
    return response.bodyBytes;
  }

  Future<CommandeTraitement> annulerCommande(
    String token,
    String commandeId,
    String motif,
  ) async {
    final response = await http.post(
      Uri.parse('${ApiService.baseUrl}/commandes/$commandeId/annulation'),
      headers: _headers(token),
      body: jsonEncode({'motif': motif}),
    );
    _checkOk(response);
    return CommandeTraitement.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }
}
