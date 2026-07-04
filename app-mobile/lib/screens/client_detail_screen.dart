import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/commercial_models.dart';
import '../services/auth_session.dart';
import '../services/commercial_api_service.dart';
import '../services/quote_pdf_share.dart';
import 'create_quote_screen.dart';

/// Fiche client : coordonnées, historique des notes de visite et des devis
/// (spec §5.4, §6.3).
class ClientDetailScreen extends StatefulWidget {
  final String clientId;

  const ClientDetailScreen({super.key, required this.clientId});

  @override
  State<ClientDetailScreen> createState() => _ClientDetailScreenState();
}

class _ClientDetailScreenState extends State<ClientDetailScreen> {
  final _api = CommercialApiService();
  Future<Client>? _future;
  final _dateFormat = DateFormat('dd/MM/yyyy');

  String get _token => AuthSession.instance.currentUser.value!.token;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    setState(() {
      _future = _api.fetchClient(_token, widget.clientId);
    });
  }

  Future<void> _addNote() async {
    final controller = TextEditingController();
    final added = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Note de visite'),
        content: TextField(
          controller: controller,
          maxLines: 4,
          decoration: const InputDecoration(hintText: 'Détails de la visite...'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () async {
              if (controller.text.trim().isEmpty) return;
              await _api.addNote(_token, widget.clientId, controller.text.trim());
              if (context.mounted) Navigator.of(context).pop(true);
            },
            child: const Text('Ajouter'),
          ),
        ],
      ),
    );
    if (added == true) _reload();
  }

  Future<void> _createQuote(Client client) async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreateQuoteScreen(
          clientId: client.id,
          clientName: client.name,
        ),
      ),
    );
    if (created == true) _reload();
  }

  Future<void> _sharePdf(Quote quote) async {
    try {
      await shareQuotePdf(_token, quote.id);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Fiche client')),
      body: FutureBuilder<Client>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Erreur : ${snapshot.error}'));
          }
          final client = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(client.name, style: Theme.of(context).textTheme.headlineSmall),
              if (client.company != null && client.company!.isNotEmpty)
                Text(client.company!),
              Text(client.phone),
              if (client.email != null && client.email!.isNotEmpty)
                Text(client.email!),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _addNote,
                      icon: const Icon(Icons.note_add),
                      label: const Text('Ajouter une note'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => _createQuote(client),
                      icon: const Icon(Icons.request_quote),
                      label: const Text('Créer un devis'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Text('Historique des visites', style: Theme.of(context).textTheme.titleMedium),
              if (client.notes.isEmpty) const Text('Aucune note.'),
              for (final note in client.notes)
                Card(
                  child: ListTile(
                    title: Text(note.note),
                    subtitle: Text(_dateFormat.format(note.visitDate)),
                  ),
                ),
              const SizedBox(height: 24),
              Text('Devis', style: Theme.of(context).textTheme.titleMedium),
              if (client.quotes.isEmpty) const Text('Aucun devis.'),
              for (final quote in client.quotes)
                Card(
                  child: ListTile(
                    title: Text('Devis du ${_dateFormat.format(quote.createdAt)}'),
                    subtitle: Text('${quote.itemCount} article(s) · ${quote.status}'),
                    trailing: IconButton(
                      icon: const Icon(Icons.share),
                      tooltip: 'Générer et partager le PDF',
                      onPressed: () => _sharePdf(quote),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
