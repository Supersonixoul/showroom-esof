import 'package:flutter/material.dart';

import '../models/pro_models.dart';
import '../services/auth_session.dart';
import '../services/pro_api_service.dart';
import '../widgets/password_field.dart';

/// Formulaire de création/édition d'un compte Pro (Espace des Pros, admin).
/// Le mot de passe est laissé vide en édition (placeholder explicite) — s'il
/// n'est pas renseigné, le mot de passe actuel est conservé.
class ProfessionnelFormScreen extends StatefulWidget {
  const ProfessionnelFormScreen({super.key, this.professionnel});

  final Professionnel? professionnel;

  @override
  State<ProfessionnelFormScreen> createState() => _ProfessionnelFormScreenState();
}

class _ProfessionnelFormScreenState extends State<ProfessionnelFormScreen> {
  final _api = ProApiService();
  late final TextEditingController _nomController;
  late final TextEditingController _identifiantController;
  final _passwordController = TextEditingController();
  late final TextEditingController _telephone1Controller;
  late final TextEditingController _telephone2Controller;
  bool _saving = false;
  String? _error;

  bool get _isEditing => widget.professionnel != null;

  String get _token => AuthSession.instance.currentUser.value!.token;

  @override
  void initState() {
    super.initState();
    final pro = widget.professionnel;
    _nomController = TextEditingController(text: pro?.nom ?? '');
    _identifiantController = TextEditingController(text: pro?.identifiant ?? '');
    _telephone1Controller = TextEditingController(text: pro?.telephone1 ?? '');
    _telephone2Controller = TextEditingController(text: pro?.telephone2 ?? '');
  }

  @override
  void dispose() {
    _nomController.dispose();
    _identifiantController.dispose();
    _passwordController.dispose();
    _telephone1Controller.dispose();
    _telephone2Controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final nom = _nomController.text.trim();
    final identifiant = _identifiantController.text.trim();
    final telephone1 = _telephone1Controller.text.trim();
    final telephone2 = _telephone2Controller.text.trim();
    final motDePasse = _passwordController.text;

    if (nom.isEmpty || identifiant.isEmpty || telephone1.isEmpty) {
      setState(() => _error = 'Nom, identifiant et téléphone sont obligatoires.');
      return;
    }
    if (!_isEditing && motDePasse.isEmpty) {
      setState(() => _error = 'Le mot de passe est obligatoire à la création.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      if (_isEditing) {
        await _api.updateProfessionnel(
          _token,
          widget.professionnel!.id,
          nom: nom,
          identifiant: identifiant,
          motDePasse: motDePasse.isEmpty ? null : motDePasse,
          telephone1: telephone1,
          telephone2: telephone2,
        );
      } else {
        await _api.createProfessionnel(
          _token,
          nom: nom,
          identifiant: identifiant,
          motDePasse: motDePasse,
          telephone1: telephone1,
          telephone2: telephone2,
        );
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = 'Erreur : $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Modifier le Pro' : 'Nouveau Pro'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _nomController,
              decoration: const InputDecoration(labelText: 'Nom *'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _identifiantController,
              decoration: const InputDecoration(labelText: 'Identifiant *'),
            ),
            const SizedBox(height: 12),
            PasswordField(
              controller: _passwordController,
              labelText: _isEditing ? 'Mot de passe' : 'Mot de passe *',
              hintText: _isEditing
                  ? 'Laisser vide pour conserver le mot de passe actuel'
                  : null,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _telephone1Controller,
              decoration: const InputDecoration(labelText: 'Téléphone 1 *'),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _telephone2Controller,
              decoration: const InputDecoration(labelText: 'Téléphone 2'),
              keyboardType: TextInputType.phone,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : _submit,
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Enregistrer'),
            ),
          ],
        ),
      ),
    );
  }
}
