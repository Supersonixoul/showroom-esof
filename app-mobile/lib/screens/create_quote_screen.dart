import 'dart:io';

import 'package:flutter/material.dart';

import '../models/catalog_models.dart';
import '../services/auth_session.dart';
import '../services/catalog_repository.dart';
import '../services/commercial_api_service.dart';
import '../services/pending_quote_queue.dart';
import '../services/quote_pdf_share.dart';

class _QuoteLine {
  final Product product;
  int quantity;
  double unitPrice;
  String note;

  _QuoteLine({required this.product, this.quantity = 1, this.unitPrice = 0, this.note = ''});
}

/// Création de devis : sélection d'articles dans le catalogue, quantités,
/// prix saisi librement, association au client (spec §5.4, §6.3).
class CreateQuoteScreen extends StatefulWidget {
  final String clientId;
  final String clientName;

  const CreateQuoteScreen({
    super.key,
    required this.clientId,
    required this.clientName,
  });

  @override
  State<CreateQuoteScreen> createState() => _CreateQuoteScreenState();
}

class _CreateQuoteScreenState extends State<CreateQuoteScreen> {
  final _api = CommercialApiService();
  final _searchController = TextEditingController();
  final List<_QuoteLine> _lines = [];
  bool _submitting = false;

  String get _token => AuthSession.instance.currentUser.value!.token;

  double get _total =>
      _lines.fold(0.0, (sum, l) => sum + l.quantity * l.unitPrice);

  @override
  void initState() {
    super.initState();
    CatalogRepository.instance.ensureInitialized();
  }

  void _addProduct(Product product) {
    if (_lines.any((l) => l.product.id == product.id)) return;
    setState(() => _lines.add(_QuoteLine(product: product)));
  }

  void _removeLine(_QuoteLine line) {
    setState(() => _lines.remove(line));
  }

  Future<void> _submit() async {
    if (_lines.isEmpty) return;
    setState(() => _submitting = true);
    final items = _lines
        .map((l) => {
              'productId': l.product.id,
              'quantity': l.quantity,
              'unitPrice': l.unitPrice,
              if (l.note.isNotEmpty) 'note': l.note,
            })
        .toList();
    try {
      final quote = await _api.createQuote(
        _token,
        clientId: widget.clientId,
        items: items,
      );
      try {
        await shareQuotePdf(_token, quote.id);
      } catch (_) {
        // Le devis est créé même si le partage échoue (ex. pas de réseau
        // pour re-télécharger le PDF) — l'utilisateur pourra repartager
        // depuis la fiche client.
      }
      if (mounted) Navigator.of(context).pop(true);
    } on SocketException catch (_) {
      // Pas de réseau (spec §6.3, Sprint 10) : le devis est conservé
      // localement et envoyé automatiquement à la reconnexion.
      await PendingQuoteQueue.instance.enqueue(
        clientId: widget.clientId,
        items: items,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text(
              'Pas de réseau : devis enregistré, il sera envoyé automatiquement dès la reconnexion.'),
        ));
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Devis — ${widget.clientName}')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                labelText: 'Rechercher un produit à ajouter',
                border: OutlineInputBorder(),
              ),
            ),
          ),
          if (_searchController.text.trim().isNotEmpty) _buildSearchResults(),
          const Divider(height: 1),
          Expanded(child: _buildLinesList()),
          _buildFooter(),
        ],
      ),
    );
  }

  Widget _buildSearchResults() {
    return ValueListenableBuilder(
      valueListenable: CatalogRepository.instance.snapshot,
      builder: (context, snapshot, _) {
        final query = _searchController.text.trim().toLowerCase();
        final matches = snapshot.products
            .where((p) => p.isActive && p.name.toLowerCase().contains(query))
            .take(10)
            .toList();
        if (matches.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(12),
            child: Text('Aucun produit trouvé.'),
          );
        }
        return ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 200),
          child: ListView.builder(
            itemCount: matches.length,
            itemBuilder: (context, index) {
              final product = matches[index];
              return ListTile(
                dense: true,
                title: Text(product.name),
                subtitle: product.reference != null ? Text(product.reference!) : null,
                trailing: const Icon(Icons.add_circle_outline),
                onTap: () {
                  _addProduct(product);
                  _searchController.clear();
                  FocusScope.of(context).unfocus();
                },
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildLinesList() {
    if (_lines.isEmpty) {
      return const Center(child: Text('Aucun article. Recherchez un produit ci-dessus.'));
    }
    return ListView.builder(
      itemCount: _lines.length,
      itemBuilder: (context, index) {
        final line = _lines[index];
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        line.product.name,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () => _removeLine(line),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        initialValue: line.quantity.toString(),
                        decoration: const InputDecoration(labelText: 'Quantité'),
                        keyboardType: TextInputType.number,
                        onChanged: (v) =>
                            setState(() => line.quantity = int.tryParse(v) ?? 1),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        decoration: const InputDecoration(labelText: 'Prix unitaire (FCFA)'),
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        onChanged: (v) =>
                            setState(() => line.unitPrice = double.tryParse(v) ?? 0),
                      ),
                    ),
                  ],
                ),
                TextFormField(
                  decoration: const InputDecoration(labelText: 'Note (optionnel)'),
                  onChanged: (v) => line.note = v,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFooter() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Total : ${_total.toStringAsFixed(0)} FCFA',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          FilledButton(
            onPressed: (_lines.isEmpty || _submitting) ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Créer et partager'),
          ),
        ],
      ),
    );
  }
}
