import 'package:flutter/material.dart';

import '../services/commercial_session.dart';
import '../widgets/password_field.dart';
import 'traitement_list_screen.dart';

/// Écran de connexion de la rubrique "Traitement" (compte commercial),
/// structurellement identique à [ProLoginScreen].
class CommercialLoginScreen extends StatefulWidget {
  const CommercialLoginScreen({super.key});

  @override
  State<CommercialLoginScreen> createState() => _CommercialLoginScreenState();
}

class _CommercialLoginScreenState extends State<CommercialLoginScreen> {
  final _identifiantController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await CommercialSession.instance.login(
        _identifiantController.text.trim(),
        _passwordController.text,
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const TraitementListScreen()),
      );
    } catch (_) {
      setState(() => _error = 'Identifiant ou mot de passe incorrect.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _identifiantController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Connexion — Traitement')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: _identifiantController,
                  decoration: const InputDecoration(labelText: 'Identifiant'),
                ),
                const SizedBox(height: 16),
                PasswordField(
                  controller: _passwordController,
                  labelText: 'Mot de passe',
                  onSubmitted: (_) => _loading ? null : _submit(),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _loading ? null : _submit,
                    child: _loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Se connecter'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
