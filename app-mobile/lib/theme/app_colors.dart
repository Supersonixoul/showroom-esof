import 'package:flutter/material.dart';

/// Palette centrale de l'app, dérivée du logo ESOF. Toute couleur utilisée
/// dans les widgets doit provenir d'ici — aucune couleur hardcodée ailleurs.
class AppColors {
  AppColors._();

  static const Color navy = Color(0xFF1B2A6B);
  static const Color blueAccent = Color(0xFF1E88E5);
  static const Color orangeAccent = Color(0xFFF5821F);
  static const Color background = Color(0xFFF7F9FC);

  static const List<Color> heroGradient = [navy, blueAccent];

  // Blocs "Mis en avant" (page d'accueil) — mêmes teintes que les badges
  // de l'admin (nouveau/promo/solde).
  static const Color featuredNew = Color(0xFF2E8B57);
  static const Color featuredPromo = Color(0xFFE08A1E);
  static const Color featuredSale = Color(0xFFC0392B);
}
