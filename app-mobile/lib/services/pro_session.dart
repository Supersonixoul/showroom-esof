import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'api_service.dart';

class ProUser {
  final String id;
  final String nom;
  final String identifiant;
  final String telephone1;
  final String token;

  ProUser({
    required this.id,
    required this.nom,
    required this.identifiant,
    required this.telephone1,
    required this.token,
  });
}

/// Session du compte Pro ("Passer commande") — jeton JWT persisté via
/// shared_preferences pour rester connecté entre les lancements de l'app,
/// sur le même principe que [AuthSession] (Espace commercial).
class ProSession {
  ProSession._internal();
  static final ProSession instance = ProSession._internal();

  static const _tokenKey = 'pro_token';
  static const _userKey = 'pro_user';

  final ValueNotifier<ProUser?> currentPro = ValueNotifier<ProUser?>(null);

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    final userJson = prefs.getString(_userKey);
    if (token == null || userJson == null) return;
    final data = jsonDecode(userJson) as Map<String, dynamic>;
    currentPro.value = ProUser(
      id: data['id'] as String,
      nom: data['nom'] as String,
      identifiant: data['identifiant'] as String,
      telephone1: data['telephone1'] as String,
      token: token,
    );
  }

  Future<void> login(String identifiant, String motDePasse) async {
    final response = await http.post(
      Uri.parse('${ApiService.baseUrl}/professionnels/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'identifiant': identifiant, 'motDePasse': motDePasse}),
    );
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Identifiant ou mot de passe incorrect');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final token = data['token'] as String;
    final proData = data['professionnel'] as Map<String, dynamic>;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userKey, jsonEncode(proData));

    currentPro.value = ProUser(
      id: proData['id'] as String,
      nom: proData['nom'] as String,
      identifiant: proData['identifiant'] as String,
      telephone1: proData['telephone1'] as String,
      token: token,
    );
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
    currentPro.value = null;
  }
}
