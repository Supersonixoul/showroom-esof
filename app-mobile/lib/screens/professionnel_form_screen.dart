import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/pro_models.dart';
import '../services/auth_session.dart';
import '../services/pro_api_service.dart';
import '../services/pro_session.dart';
import '../utils/client_code_preview.dart';
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
  late final TextEditingController _codeController;
  final _passwordController = TextEditingController();
  late final TextEditingController _telephone1Controller;
  late final TextEditingController _telephone2Controller;
  bool _saving = false;
  String? _error;
  String? _codeError;
  bool _codeManuallyEdited = false;

  bool get _isEditing => widget.professionnel != null;

  String get _token => AuthSession.instance.currentUser.value!.token;

  @override
  void initState() {
    super.initState();
    final pro = widget.professionnel;
    _nomController = TextEditingController(text: pro?.nom ?? '');
    _identifiantController = TextEditingController(text: pro?.identifiant ?? '');
    _codeController = TextEditingController(text: pro?.code ?? '');
    _telephone1Controller = TextEditingController(text: pro?.telephone1 ?? '');
    _telephone2Controller = TextEditingController(text: pro?.telephone2 ?? '');
    if (!_isEditing) {
      _nomController.addListener(_updateCodePreview);
    }
  }

  /// À la création, pré-remplit/actualise l'aperçu du code tant que
  /// l'utilisateur ne l'a pas modifié à la main (le backend reste la
  /// source de vérité en cas de collision).
  void _updateCodePreview() {
    if (_codeManuallyEdited) return;
    final preview = previewClientCode(_nomController.text);
    _codeController.value = TextEditingValue(
      text: preview ?? '',
      selection: TextSelection.collapsed(offset: (preview ?? '').length),
    );
  }

  @override
  void dispose() {
    _nomController.dispose();
    _identifiantController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    _telephone1Controller.dispose();
    _telephone2Controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final nom = _nomController.text.trim();
    final identifiant = _identifiantController.text.trim();
    final code = _codeController.text.trim().toUpperCase();
    final telephone1 = _telephone1Controller.text.trim();
    final telephone2 = _telephone2Controller.text.trim();
    final motDePasse = _passwordController.text;

    if (nom.isEmpty || identifiant.isEmpty || telephone1.isEmpty) {
      setState(() {
        _error = 'Nom, identifiant et téléphone sont obligatoires.';
        _codeError = null;
      });
      return;
    }
    if (!_isEditing && motDePasse.isEmpty) {
      setState(() {
        _error = 'Le mot de passe est obligatoire à la création.';
        _codeError = null;
      });
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
      _codeError = null;
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
          code: code,
        );
      } else {
        await _api.createProfessionnel(
          _token,
          nom: nom,
          identifiant: identifiant,
          motDePasse: motDePasse,
          telephone1: telephone1,
          telephone2: telephone2,
          code: code,
        );
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ProConflictException catch (e) {
      setState(() {
        if (e.message.toLowerCase().contains('code')) {
          _codeError = e.message;
        } else {
          _error = e.message;
        }
      });
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
        title: Text(_isEditing ? 'Modifier le client' : 'Nouveau client'),
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
            TextField(
              controller: _codeController,
              textCapitalization: TextCapitalization.characters,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp('[A-Za-z0-9]')),
                LengthLimitingTextInputFormatter(3),
                _UpperCaseTextFormatter(),
              ],
              onChanged: (_) => _codeManuallyEdited = true,
              decoration: InputDecoration(
                labelText: 'Code client',
                helperText: 'Généré automatiquement à partir du nom, modifiable.',
                errorText: _codeError,
              ),
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

/// Force la saisie en majuscules (code client), sans modifier la position
/// du curseur.
class _UpperCaseTextFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return newValue.copyWith(text: newValue.text.toUpperCase());
  }
}
