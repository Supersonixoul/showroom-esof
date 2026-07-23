import 'package:shared_preferences/shared_preferences.dart';

/// Adresse du serveur backend, configurable sans rebuild (spec écran de
/// réglages). Persistée via shared_preferences, mise en cache en mémoire
/// pour un accès synchrone depuis [ApiService.baseUrl].
class ServerConfig {
  ServerConfig._();

  static const String _prefKey = 'server_base_url';
  static const String defaultBaseUrl = 'http://192.168.137.1:3000';

  static String _cachedBaseUrl = defaultBaseUrl;

  /// À appeler une fois au démarrage de l'app pour charger l'adresse
  /// persistée (avant tout appel réseau).
  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_prefKey);
    if (stored != null && stored.isNotEmpty) {
      _cachedBaseUrl = stored;
    }
  }

  /// Adresse courante du serveur (accès synchrone, valeur en cache).
  static String getBaseUrl() => _cachedBaseUrl;

  /// Valide et normalise une adresse saisie par l'utilisateur : doit
  /// commencer par http:// ou https://, sans '/' final. Lève une
  /// [FormatException] si l'adresse est invalide.
  static String normalize(String input) {
    final trimmed = input.trim();
    final lower = trimmed.toLowerCase();
    if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
      throw const FormatException(
        "L'adresse doit commencer par http:// ou https://",
      );
    }
    var normalized = trimmed;
    while (normalized.endsWith('/')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    final uri = Uri.tryParse(normalized);
    if (uri == null || uri.host.isEmpty) {
      throw const FormatException('Adresse invalide');
    }
    return normalized;
  }

  /// Valide, normalise et persiste la nouvelle adresse du serveur. Les
  /// écrans suivants utilisent immédiatement la nouvelle valeur (cache
  /// mémoire mis à jour avant l'écriture disque).
  static Future<void> setBaseUrl(String url) async {
    final normalized = normalize(url);
    _cachedBaseUrl = normalized;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKey, normalized);
  }

  /// Remet l'adresse par défaut et la persiste.
  static Future<void> resetToDefault() async {
    _cachedBaseUrl = defaultBaseUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefKey);
  }
}
