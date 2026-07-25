import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'api_service.dart';

/// Levée quand l'API répond 401 (jeton commercial expiré ou invalide) —
/// même principe que [ProSessionExpiredException].
class CommercialSessionExpiredException implements Exception {}

class CommercialUser {
  final String id;
  final String nom;
  final String prenom;
  final String telephone1;
  final String token;

  CommercialUser({
    required this.id,
    required this.nom,
    required this.prenom,
    required this.telephone1,
    required this.token,
  });

  String get nomComplet => '$prenom $nom';
}

/// Session du compte commercial (rubrique "Traitement") — jeton JWT persisté
/// via shared_preferences pour rester connecté entre les lancements de
/// l'app, sur le même principe que [ProSession].
class CommercialSession {
  CommercialSession._internal();
  static final CommercialSession instance = CommercialSession._internal();

  static const _tokenKey = 'commercial_token';
  static const _userKey = 'commercial_user';

  final ValueNotifier<CommercialUser?> currentCommercial = ValueNotifier<CommercialUser?>(null);

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    final userJson = prefs.getString(_userKey);
    if (token == null || userJson == null) return;
    final data = jsonDecode(userJson) as Map<String, dynamic>;
    currentCommercial.value = CommercialUser(
      id: data['id'] as String,
      nom: data['nom'] as String,
      prenom: data['prenom'] as String,
      telephone1: data['telephone1'] as String,
      token: token,
    );
  }

  Future<void> login(String identifiant, String motDePasse) async {
    final response = await http.post(
      Uri.parse('${ApiService.baseUrl}/commerciaux/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'identifiant': identifiant, 'motDePasse': motDePasse}),
    );
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Identifiant ou mot de passe incorrect');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final token = data['token'] as String;
    final commercialData = data['commercial'] as Map<String, dynamic>;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userKey, jsonEncode(commercialData));

    currentCommercial.value = CommercialUser(
      id: commercialData['id'] as String,
      nom: commercialData['nom'] as String,
      prenom: commercialData['prenom'] as String,
      telephone1: commercialData['telephone1'] as String,
      token: token,
    );
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
    currentCommercial.value = null;
  }
}
