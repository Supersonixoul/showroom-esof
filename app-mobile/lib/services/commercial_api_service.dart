import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/commercial_models.dart';
import 'api_service.dart';

/// Appels API du mode commercial (spec §5.4) : clients, notes de visite,
/// devis. Toutes les requêtes nécessitent le jeton JWT du commercial connecté.
class CommercialApiService {
  Map<String, String> _headers(String token) => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

  void _checkOk(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Erreur API (${response.statusCode}) : ${response.body}');
    }
  }

  Future<List<Client>> fetchClients(String token, {String? search}) async {
    final uri = Uri.parse('${ApiService.baseUrl}/clients').replace(
      queryParameters:
          (search != null && search.isNotEmpty) ? {'search': search} : null,
    );
    final response = await http.get(uri, headers: _headers(token));
    _checkOk(response);
    return (jsonDecode(response.body) as List<dynamic>)
        .map((c) => Client.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  Future<Client> fetchClient(String token, String id) async {
    final response = await http.get(
      Uri.parse('${ApiService.baseUrl}/clients/$id'),
      headers: _headers(token),
    );
    _checkOk(response);
    return Client.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<Client> createClient(
    String token, {
    required String name,
    required String phone,
    String? email,
    String? company,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiService.baseUrl}/clients'),
      headers: _headers(token),
      body: jsonEncode({
        'name': name,
        'phone': phone,
        if (email != null && email.isNotEmpty) 'email': email,
        if (company != null && company.isNotEmpty) 'company': company,
      }),
    );
    _checkOk(response);
    return Client.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<void> addNote(String token, String clientId, String note) async {
    final response = await http.post(
      Uri.parse('${ApiService.baseUrl}/clients/$clientId/notes'),
      headers: _headers(token),
      body: jsonEncode({'note': note}),
    );
    _checkOk(response);
  }

  Future<Quote> createQuote(
    String token, {
    required String clientId,
    required List<Map<String, dynamic>> items,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiService.baseUrl}/quotes'),
      headers: _headers(token),
      body: jsonEncode({'clientId': clientId, 'items': items}),
    );
    _checkOk(response);
    return Quote.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<List<int>> fetchQuotePdf(String token, String quoteId) async {
    final response = await http.get(
      Uri.parse('${ApiService.baseUrl}/quotes/$quoteId/pdf'),
      headers: _headers(token),
    );
    _checkOk(response);
    return response.bodyBytes;
  }
}
