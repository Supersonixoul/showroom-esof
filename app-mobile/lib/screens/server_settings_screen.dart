import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../services/server_config.dart';
import '../theme/app_colors.dart';

/// Écran de réglages : adresse du serveur backend configurable sans
/// rebuild, persistée via [ServerConfig] et utilisée immédiatement par
/// tous les appels réseau (API + images) une fois enregistrée.
class ServerSettingsScreen extends StatefulWidget {
  const ServerSettingsScreen({super.key});

  @override
  State<ServerSettingsScreen> createState() => _ServerSettingsScreenState();
}

class _ServerSettingsScreenState extends State<ServerSettingsScreen> {
  late final TextEditingController _controller;
  bool _testing = false;
  bool _saving = false;
  String? _message;
  Color _messageColor = Colors.green;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: ServerConfig.getBaseUrl());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _testConnection() async {
    setState(() {
      _testing = true;
      _message = null;
    });
    try {
      final url = ServerConfig.normalize(_controller.text);
      // Toute réponse HTTP (même 401/404) prouve que le serveur est
      // joignable sur le réseau — seule une exception (timeout, connexion
      // refusée, DNS) signifie qu'il ne l'est pas.
      await http.get(Uri.parse('$url/categories')).timeout(
        const Duration(seconds: 5),
      );
      setState(() {
        _message = 'Serveur joignable ✓';
        _messageColor = Colors.green;
      });
    } on FormatException catch (e) {
      setState(() {
        _message = e.message;
        _messageColor = Colors.red;
      });
    } catch (_) {
      setState(() {
        _message = "Serveur injoignable — vérifier l'adresse et le réseau";
        _messageColor = Colors.red;
      });
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _message = null;
    });
    try {
      await ServerConfig.setBaseUrl(_controller.text);
      if (!mounted) return;
      Navigator.of(context).pop();
    } on FormatException catch (e) {
      setState(() {
        _message = e.message;
        _messageColor = Colors.red;
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _reset() async {
    await ServerConfig.resetToDefault();
    setState(() {
      _controller.text = ServerConfig.defaultBaseUrl;
      _message = 'Adresse par défaut restaurée';
      _messageColor = Colors.green;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Réglages du serveur')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _controller,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                    labelText: 'Adresse du serveur',
                    hintText: 'http://192.168.1.10:3000',
                  ),
                ),
                if (_message != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _message!,
                    style: TextStyle(
                      color: _messageColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: _testing ? null : _testConnection,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.blueAccent,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: _testing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.wifi_tethering),
                  label: const Text('Tester la connexion'),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.navy,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Enregistrer'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: _reset,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.orangeAccent,
                  ),
                  child: const Text('Réinitialiser'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
