import 'package:flutter/material.dart';

import '../services/auth_session.dart';
import '../widgets/password_field.dart';
import 'clients_list_screen.dart';

/// Écran de connexion du mode commercial (spec §6.3). Réutilisé tel quel
/// (même mécanisme d'authentification admin) par l'Espace des Pros — voir
/// [destinationBuilder]/[requiredRole].
class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    this.destinationBuilder,
    this.requiredRole,
  });

  /// Écran ouvert après connexion réussie. Par défaut [ClientsListScreen]
  /// (comportement historique de l'Espace commercial).
  final Widget Function(BuildContext context)? destinationBuilder;

  /// Si renseigné, la connexion est refusée si le rôle du compte ne
  /// correspond pas (ex. 'ADMIN' pour l'Espace des Pros).
  final String? requiredRole;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await AuthSession.instance.login(
        _emailController.text.trim(),
        _passwordController.text,
      );
      if (widget.requiredRole != null &&
          AuthSession.instance.currentUser.value?.role != widget.requiredRole) {
        await AuthSession.instance.logout();
        setState(() => _error = 'Accès réservé aux administrateurs.');
        return;
      }
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: widget.destinationBuilder ?? (_) => const ClientsListScreen(),
        ),
      );
    } catch (_) {
      setState(() => _error = 'Email ou mot de passe incorrect.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Connexion commercial')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email'),
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
