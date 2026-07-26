import 'package:flutter/material.dart';

import '../models/pro_models.dart';
import '../services/auth_session.dart';
import '../services/pro_api_service.dart';
import '../services/pro_session.dart';
import 'login_screen.dart';
import 'professionnel_form_screen.dart';

/// Liste des comptes Pro (Espace des Pros, admin uniquement) — modelée sur
/// [ClientsListScreen] : pull-to-refresh + FAB de création.
class ProfessionnelsListScreen extends StatefulWidget {
  const ProfessionnelsListScreen({super.key});

  @override
  State<ProfessionnelsListScreen> createState() =>
      _ProfessionnelsListScreenState();
}

class _ProfessionnelsListScreenState extends State<ProfessionnelsListScreen> {
  final _api = ProApiService();
  Future<List<Professionnel>>? _future;
  bool _sessionExpiredHandled = false;

  String get _token => AuthSession.instance.currentUser.value!.token;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  /// La session admin persistée peut avoir expiré (jeton JWT valable 12h) —
  /// dans ce cas on déconnecte et on redemande une connexion plutôt que
  /// d'afficher une erreur 401 brute.
  void _handleSessionExpired() {
    if (_sessionExpiredHandled) return;
    _sessionExpiredHandled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await AuthSession.instance.logout();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => LoginScreen(
            destinationBuilder: (_) => const ProfessionnelsListScreen(),
            requiredRole: 'ADMIN',
          ),
        ),
      );
    });
  }

  Future<void> _reload() async {
    setState(() {
      _future = _api.fetchProfessionnels(_token);
    });
    await _future;
  }

  Future<void> _openForm({Professionnel? professionnel}) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ProfessionnelFormScreen(professionnel: professionnel),
      ),
    );
    if (changed == true) _reload();
  }

  Future<void> _deactivate(Professionnel professionnel) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Désactiver ce compte ?'),
        content: Text('« ${professionnel.nom} » ne pourra plus se connecter.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Désactiver'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _api.deactivateProfessionnel(_token, professionnel.id);
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Espace Client')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: FutureBuilder<List<Professionnel>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              if (snapshot.error is ProSessionExpiredException) {
                _handleSessionExpired();
                return const Center(child: CircularProgressIndicator());
              }
              return Center(child: Text('Erreur : ${snapshot.error}'));
            }
            final list = snapshot.data ?? [];
            if (list.isEmpty) {
              return ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: Text('Aucun client.')),
                  ),
                ],
              );
            }
            return ListView.builder(
              itemCount: list.length,
              itemBuilder: (context, index) {
                final pro = list[index];
                return ListTile(
                  title: Text('${pro.nom} (${pro.code})'),
                  subtitle: Text([pro.identifiant, pro.telephone1].join(' · ')),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (!pro.actif)
                        const Padding(
                          padding: EdgeInsets.only(right: 8),
                          child: Text('Inactif', style: TextStyle(color: Colors.grey)),
                        ),
                      IconButton(
                        icon: const Icon(Icons.block),
                        tooltip: 'Désactiver',
                        onPressed: pro.actif ? () => _deactivate(pro) : null,
                      ),
                    ],
                  ),
                  onTap: () => _openForm(professionnel: pro),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
