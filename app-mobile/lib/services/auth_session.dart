import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'api_service.dart';

class AuthUser {
  final String id;
  final String name;
  final String email;
  final String role;
  final String token;

  AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.token,
  });
}

/// Session du mode commercial (spec §6.3) : connexion email/mot de passe,
/// jeton JWT persisté via shared_preferences pour rester connecté entre
/// les lancements de l'app.
class AuthSession {
  AuthSession._internal();
  static final AuthSession instance = AuthSession._internal();

  static const _tokenKey = 'auth_token';
  static const _userKey = 'auth_user';

  final ValueNotifier<AuthUser?> currentUser = ValueNotifier<AuthUser?>(null);

  /// À appeler au démarrage de l'app pour restaurer une session existante.
  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    final userJson = prefs.getString(_userKey);
    if (token == null || userJson == null) return;
    final data = jsonDecode(userJson) as Map<String, dynamic>;
    currentUser.value = AuthUser(
      id: data['id'] as String,
      name: data['name'] as String,
      email: data['email'] as String,
      role: data['role'] as String,
      token: token,
    );
  }

  Future<void> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('${ApiService.baseUrl}/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Identifiants invalides');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final token = data['accessToken'] as String;
    final userData = data['user'] as Map<String, dynamic>;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userKey, jsonEncode(userData));

    currentUser.value = AuthUser(
      id: userData['id'] as String,
      name: userData['name'] as String,
      email: userData['email'] as String,
      role: userData['role'] as String,
      token: token,
    );
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
    currentUser.value = null;
  }
}
