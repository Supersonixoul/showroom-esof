import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/catalog_models.dart' show FeaturedProduct;
import '../models/pro_models.dart';
import '../services/api_service.dart';
import '../services/pro_api_service.dart';
import '../services/pro_session.dart';
import '../widgets/pro_logout_action.dart';

/// Écran de modification d'une commande existante (rubrique "Commander") :
/// lignes préchargées depuis [commande], ajout/retrait de produits et
/// modification des quantités, sauvegarde via `PATCH /commandes/:id`. Le
/// numéro de commande, immuable, est affiché en lecture seule et n'est
/// jamais envoyé au backend.
class OrderEditScreen extends StatefulWidget {
  const OrderEditScreen({super.key, required this.commande});

  final CommandePro commande;

  @override
  State<OrderEditScreen> createState() => _OrderEditScreenState();
}

class _OrderEditScreenState extends State<OrderEditScreen> {
  final _api = ProApiService();
  final _apiService = ApiService();
  late List<CartLine> _lines;
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  bool _searchLoading = false;
  List<FeaturedProduct>? _searchResults;
  bool _saving = false;
  String? _error;

  Future<List<AgentCommercial>>? _commerciauxFuture;
  AgentCommercial? _selectedCommercial;
  bool _sendingWhatsapp = false;
  bool _sessionExpiredHandled = false;
  String? _whatsappError;

  String get _token => ProSession.instance.currentPro.value!.token;
  bool get _readOnly => widget.commande.estAnnulee;

  @override
  void initState() {
    super.initState();
    requireProSession(context);
    _lines = widget.commande.lignes
        .map((l) => CartLine(
              produitId: l.produitId,
              nomProduit: l.libelleProduit,
              quantite: l.quantite,
            ))
        .toList();
    if (!_readOnly) {
      _commerciauxFuture = _api.fetchCommerciaux(_token).then((list) {
        final actifs = list.where((c) => c.actif).toList();
        if (actifs.isNotEmpty && mounted) {
          setState(() => _selectedCommercial = actifs.first);
        }
        return actifs;
      });
    }
  }

  String _buildWhatsappMessage(List<CartLine> lines, String numero) {
    final pro = ProSession.instance.currentPro.value!;
    final date = DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now());
    final buffer = StringBuffer();
    buffer.writeln('🛒 COMMANDE CLIENT (modifiée)');
    buffer.writeln('━━━━━━━━━━━━━━');
    buffer.writeln('N° : $numero');
    buffer.writeln('Pro : ${pro.nom}');
    buffer.writeln('Tél : ${pro.telephone1}');
    buffer.writeln('Date : $date');
    buffer.writeln('━━━━━━━━━━━━━━');
    for (var i = 0; i < lines.length; i++) {
      final line = lines[i];
      buffer.writeln('${i + 1}. ${line.nomProduit} — Qté : ${line.quantite}');
    }
    buffer.writeln('━━━━━━━━━━━━━━');
    buffer.write('Total : ${lines.length} article(s)');
    return buffer.toString();
  }

  Future<void> _sendWhatsapp() async {
    if (_lines.isEmpty) {
      setState(() => _whatsappError = 'La commande est vide.');
      return;
    }
    final commercial = _selectedCommercial;
    if (commercial == null) {
      setState(() => _whatsappError = 'Choisissez un commercial.');
      return;
    }
    setState(() {
      _sendingWhatsapp = true;
      _whatsappError = null;
    });
    final message = _buildWhatsappMessage(_lines, widget.commande.numero);
    final phone = commercial.telephone1.replaceFirst('+', '');
    final uri = Uri.parse('https://wa.me/$phone?text=${Uri.encodeComponent(message)}');
    var launched = false;
    try {
      launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      launched = false;
    }
    if (!mounted) return;
    setState(() {
      _sendingWhatsapp = false;
      _whatsappError = launched ? null : "Impossible d'ouvrir WhatsApp.";
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _addProduct(String produitId, String nomProduit) {
    final existing = _lines.where((l) => l.produitId == produitId).toList();
    setState(() {
      if (existing.isNotEmpty) {
        existing.first.quantite += 1;
      } else {
        _lines = [..._lines, CartLine(produitId: produitId, nomProduit: nomProduit)];
      }
    });
  }

  void _updateQuantite(String produitId, int quantite) {
    setState(() {
      if (quantite <= 0) {
        _lines = _lines.where((l) => l.produitId != produitId).toList();
        return;
      }
      for (final line in _lines) {
        if (line.produitId == produitId) line.quantite = quantite;
      }
    });
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    final query = value.trim();
    setState(() => _query = query);
    if (query.length < 2) {
      setState(() {
        _searchResults = null;
        _searchLoading = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () => _runSearch(query));
  }

  void _clearSearch() {
    _debounce?.cancel();
    _searchController.clear();
    setState(() {
      _query = '';
      _searchResults = null;
      _searchLoading = false;
    });
  }

  Future<void> _runSearch(String query) async {
    setState(() => _searchLoading = true);
    try {
      final results = await _apiService.searchProducts(query);
      if (!mounted || query != _query) return;
      setState(() {
        _searchResults = results;
        _searchLoading = false;
      });
    } catch (_) {
      if (!mounted || query != _query) return;
      setState(() {
        _searchResults = [];
        _searchLoading = false;
      });
    }
  }

  Future<void> _save() async {
    if (_lines.isEmpty) {
      setState(() => _error = 'La commande doit contenir au moins un article.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await _api.updateCommande(_token, widget.commande.id, lignes: _lines);
    } on ProSessionExpiredException {
      if (!mounted) return;
      await performProLogout(context, message: 'Session expirée, veuillez vous reconnecter.');
      return;
    } catch (e) {
      setState(() {
        _saving = false;
        _error = 'Erreur lors de la sauvegarde : $e';
      });
      return;
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Commande mise à jour.')),
    );
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Commande n° ${widget.commande.numeroClient}'),
        actions: const [ProLogoutAction()],
      ),
      body: _readOnly ? _buildReadOnly() : _buildEditable(),
    );
  }

  Widget _buildReadOnly() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Cette commande est annulée et ne peut plus être modifiée.',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  Widget _buildEditable() {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              const Text('Articles', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              if (_lines.isEmpty) const Text('Aucun article.'),
              for (final line in _lines)
                Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(line.nomProduit),
                    subtitle: Text('Quantité : ${line.quantite}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove_circle_outline),
                          onPressed: () => _updateQuantite(line.produitId, line.quantite - 1),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline),
                          onPressed: () => _updateQuantite(line.produitId, line.quantite + 1),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline),
                          onPressed: () => _updateQuantite(line.produitId, 0),
                        ),
                      ],
                    ),
                  ),
                ),
              const Divider(height: 24),
              const Text('Ajouter un produit', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              TextField(
                controller: _searchController,
                onChanged: _onSearchChanged,
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search),
                  hintText: 'Rechercher : désignation, référence, gamme…',
                  border: const OutlineInputBorder(),
                  suffixIcon: _query.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.clear),
                          tooltip: 'Effacer',
                          onPressed: _clearSearch,
                        ),
                ),
              ),
              const SizedBox(height: 8),
              if (_searchLoading)
                const Center(child: CircularProgressIndicator())
              else if (_searchResults != null && _searchResults!.isEmpty)
                Text('Aucun produit trouvé pour « $_query ».')
              else if (_searchResults != null)
                for (final product in _searchResults!)
                  ListTile(
                    title: Text(product.name),
                    trailing: TextButton.icon(
                      icon: const Icon(Icons.add),
                      label: const Text('Ajouter'),
                      onPressed: () => _addProduct(product.id, product.name),
                    ),
                  ),
            ],
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(_error!, style: const TextStyle(color: Colors.red)),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: FutureBuilder<List<AgentCommercial>>(
            future: _commerciauxFuture,
            builder: (context, snapshot) {
              if (snapshot.hasError &&
                  snapshot.error is ProSessionExpiredException &&
                  !_sessionExpiredHandled) {
                _sessionExpiredHandled = true;
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (!mounted) return;
                  performProLogout(
                    context,
                    message: 'Session expirée, veuillez vous reconnecter.',
                  );
                });
              }
              final commerciaux = snapshot.data ?? [];
              return DropdownButtonFormField<AgentCommercial>(
                value:
                    commerciaux.contains(_selectedCommercial) ? _selectedCommercial : null,
                decoration: const InputDecoration(labelText: 'Commercial (WhatsApp)'),
                items: [
                  for (final c in commerciaux)
                    DropdownMenuItem(value: c, child: Text(c.nomComplet)),
                ],
                onChanged: (value) => setState(() => _selectedCommercial = value),
              );
            },
          ),
        ),
        if (_whatsappError != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Text(_whatsappError!, style: const TextStyle(color: Colors.red)),
          ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.save),
                label: const Text('Enregistrer les modifications'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _sendingWhatsapp ? null : _sendWhatsapp,
                icon: _sendingWhatsapp
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send),
                label: const Text('Envoyer par WhatsApp'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
