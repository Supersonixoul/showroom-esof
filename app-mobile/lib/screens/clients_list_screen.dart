import 'dart:async';

import 'package:flutter/material.dart';

import '../models/commercial_models.dart';
import '../services/auth_session.dart';
import '../services/commercial_api_service.dart';
import '../services/pending_quote_queue.dart';
import 'client_detail_screen.dart';

/// Liste des clients avec recherche (spec §5.4, §6.3).
class ClientsListScreen extends StatefulWidget {
  const ClientsListScreen({super.key});

  @override
  State<ClientsListScreen> createState() => _ClientsListScreenState();
}

class _ClientsListScreenState extends State<ClientsListScreen> {
  final _api = CommercialApiService();
  final _searchController = TextEditingController();
  Timer? _debounce;
  Future<List<Client>>? _future;

  String get _token => AuthSession.instance.currentUser.value!.token;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    setState(() {
      _future = _api.fetchClients(_token, search: _searchController.text.trim());
    });
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _reload);
  }

  Future<void> _openNewClientDialog() async {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final emailController = TextEditingController();
    final companyController = TextEditingController();

    final created = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Nouveau client'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Nom *'),
            ),
            TextField(
              controller: phoneController,
              decoration: const InputDecoration(labelText: 'Téléphone *'),
              keyboardType: TextInputType.phone,
            ),
            TextField(
              controller: emailController,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
            TextField(
              controller: companyController,
              decoration: const InputDecoration(labelText: 'Entreprise'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () async {
              if (nameController.text.trim().isEmpty ||
                  phoneController.text.trim().isEmpty) {
                return;
              }
              await _api.createClient(
                _token,
                name: nameController.text.trim(),
                phone: phoneController.text.trim(),
                email: emailController.text.trim(),
                company: companyController.text.trim(),
              );
              if (context.mounted) Navigator.of(context).pop(true);
            },
            child: const Text('Créer'),
          ),
        ],
      ),
    );

    if (created == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Clients'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Se déconnecter',
            onPressed: () async {
              await AuthSession.instance.logout();
              if (context.mounted) Navigator.of(context).pop();
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openNewClientDialog,
        child: const Icon(Icons.person_add),
      ),
      body: Column(
        children: [
          ValueListenableBuilder<int>(
            valueListenable: PendingQuoteQueue.instance.pendingCount,
            builder: (context, count, _) {
              if (count == 0) return const SizedBox.shrink();
              return Container(
                width: double.infinity,
                color: Colors.amber.shade100,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Text(
                  '$count devis en attente d\'envoi (pas de réseau au moment de la création).',
                  style: const TextStyle(fontSize: 13),
                ),
              );
            },
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                labelText: 'Rechercher un client',
                border: OutlineInputBorder(),
              ),
            ),
          ),
          Expanded(
            child: FutureBuilder<List<Client>>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(child: Text('Erreur : ${snapshot.error}'));
                }
                final clients = snapshot.data ?? [];
                if (clients.isEmpty) {
                  return const Center(child: Text('Aucun client.'));
                }
                return ListView.builder(
                  itemCount: clients.length,
                  itemBuilder: (context, index) {
                    final client = clients[index];
                    return ListTile(
                      title: Text(client.name),
                      subtitle: Text(
                        [client.company, client.phone]
                            .whereType<String>()
                            .where((s) => s.isNotEmpty)
                            .join(' · '),
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ClientDetailScreen(clientId: client.id),
                          ),
                        );
                        _reload();
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
