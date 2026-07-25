import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/pro_models.dart';
import '../services/order_cart.dart';
import '../services/pro_api_service.dart';
import '../services/pro_session.dart';

/// Écran 3 de « Passer commande » : récapitulatif des lignes, choix du
/// commercial et envoi par WhatsApp (spec §3.3 Écran 3).
class OrderSummaryScreen extends StatefulWidget {
  const OrderSummaryScreen({super.key});

  @override
  State<OrderSummaryScreen> createState() => _OrderSummaryScreenState();
}

class _OrderSummaryScreenState extends State<OrderSummaryScreen> {
  final _api = ProApiService();
  Future<List<AgentCommercial>>? _commerciauxFuture;
  AgentCommercial? _selectedCommercial;
  bool _sending = false;
  String? _error;
  String? _pendingMessage;

  String get _token => ProSession.instance.currentPro.value!.token;

  @override
  void initState() {
    super.initState();
    _commerciauxFuture = _api.fetchCommerciaux(_token).then((list) {
      final actifs = list.where((c) => c.actif).toList();
      if (actifs.isNotEmpty && mounted) {
        setState(() => _selectedCommercial = actifs.first);
      }
      return actifs;
    });
  }

  String _buildMessage(List<CartLine> lines) {
    final pro = ProSession.instance.currentPro.value!;
    final date = DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now());
    final buffer = StringBuffer();
    buffer.writeln('🛒 COMMANDE ESOF');
    buffer.writeln('━━━━━━━━━━━━━━');
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

  Future<void> _send() async {
    final lines = OrderCart.instance.lines.value;
    final commercial = _selectedCommercial;
    if (lines.isEmpty) {
      setState(() => _error = 'Le panier est vide.');
      return;
    }
    if (commercial == null) {
      setState(() => _error = 'Choisissez un commercial.');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
      _pendingMessage = null;
    });

    try {
      await _api.createCommande(_token, commercialId: commercial.id, lignes: lines);
    } catch (e) {
      setState(() {
        _sending = false;
        _error = "Erreur lors de l'enregistrement de la commande : $e";
      });
      return;
    }

    final message = _buildMessage(lines);
    final phone = commercial.telephone1.replaceFirst('+', '');
    final uri = Uri.parse('https://wa.me/$phone?text=${Uri.encodeComponent(message)}');
    var launched = false;
    try {
      launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      launched = false;
    }

    if (!mounted) return;
    if (launched) {
      OrderCart.instance.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Commande envoyée avec succès.')),
      );
      Navigator.of(context).popUntil((route) => route.isFirst);
      return;
    }
    setState(() {
      _sending = false;
      _pendingMessage = message;
    });
  }

  Future<void> _copyPendingMessage() async {
    final message = _pendingMessage;
    if (message == null) return;
    await Clipboard.setData(ClipboardData(text: message));
    OrderCart.instance.clear();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Commande copiée dans le presse-papiers.')),
    );
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Récapitulatif de commande')),
      body: ValueListenableBuilder<List<CartLine>>(
        valueListenable: OrderCart.instance.lines,
        builder: (context, lines, _) {
          return Column(
            children: [
              Expanded(
                child: lines.isEmpty
                    ? const Center(child: Text('Le panier est vide.'))
                    : ListView.builder(
                        itemCount: lines.length,
                        itemBuilder: (context, index) {
                          final line = lines[index];
                          return ListTile(
                            title: Text(line.nomProduit),
                            subtitle: Text('Quantité : ${line.quantite}'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove_circle_outline),
                                  onPressed: () => OrderCart.instance
                                      .updateQuantite(line.produitId, line.quantite - 1),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.add_circle_outline),
                                  onPressed: () => OrderCart.instance
                                      .updateQuantite(line.produitId, line.quantite + 1),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline),
                                  onPressed: () =>
                                      OrderCart.instance.removeLine(line.produitId),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    FutureBuilder<List<AgentCommercial>>(
                      future: _commerciauxFuture,
                      builder: (context, snapshot) {
                        final commerciaux = snapshot.data ?? [];
                        return DropdownButtonFormField<AgentCommercial>(
                          value: commerciaux.contains(_selectedCommercial)
                              ? _selectedCommercial
                              : null,
                          decoration: const InputDecoration(labelText: 'Choisir un commercial'),
                          items: [
                            for (final c in commerciaux)
                              DropdownMenuItem(value: c, child: Text(c.nomComplet)),
                          ],
                          onChanged: (value) => setState(() => _selectedCommercial = value),
                        );
                      },
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                    ],
                    if (_pendingMessage != null) ...[
                      const SizedBox(height: 8),
                      const Text(
                        "WhatsApp n'a pas pu être ouvert. Vous pouvez copier la commande :",
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: _copyPendingMessage,
                        icon: const Icon(Icons.copy),
                        label: const Text('Copier la commande'),
                      ),
                    ],
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: (_sending || lines.isEmpty) ? null : _send,
                      icon: _sending
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.send),
                      label: const Text('Envoyer par WhatsApp'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
