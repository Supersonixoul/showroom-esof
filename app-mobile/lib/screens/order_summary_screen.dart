import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/pro_models.dart';
import '../services/order_cart.dart';
import '../services/pro_api_service.dart';
import '../services/pro_session.dart';
import '../widgets/pro_logout_action.dart';

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
  bool _sessionExpiredHandled = false;
  String? _error;
  String? _pendingMessage;
  int? _createdNumero;

  String get _token => ProSession.instance.currentPro.value!.token;

  @override
  void initState() {
    super.initState();
    requireProSession(context);
    if (ProSession.instance.currentPro.value == null) return;
    _commerciauxFuture = _api.fetchCommerciaux(_token).then((list) {
      final actifs = list.where((c) => c.actif).toList();
      if (actifs.isNotEmpty && mounted) {
        setState(() => _selectedCommercial = actifs.first);
      }
      return actifs;
    });
  }

  String _buildMessage(List<CartLine> lines, String numero) {
    final pro = ProSession.instance.currentPro.value!;
    final date = DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now());
    final buffer = StringBuffer();
    buffer.writeln('🛒 COMMANDE CLIENT');
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

  /// Valide et sauvegarde la commande en cours via l'endpoint existant
  /// (POST /commandes, réutilisé par `_send` et `_save`). Retourne `null`
  /// sans perdre les lignes du panier en cas d'erreur (affichée dans `_error`).
  Future<CommandePro?> _createOrder(List<CartLine> lines) async {
    final commercial = _selectedCommercial;
    if (lines.isEmpty) {
      setState(() => _error = 'Le panier est vide.');
      return null;
    }
    if (commercial == null) {
      setState(() => _error = 'Choisissez un commercial.');
      return null;
    }
    setState(() {
      _sending = true;
      _error = null;
      _pendingMessage = null;
    });

    try {
      final created = await _api.createCommande(_token, commercialId: commercial.id, lignes: lines);
      _createdNumero = created.numeroClient;
      return created;
    } on ProSessionExpiredException {
      if (!mounted) return null;
      await performProLogout(context, message: 'Session expirée, veuillez vous reconnecter.');
      return null;
    } catch (e) {
      setState(() {
        _sending = false;
        _error = "Erreur lors de l'enregistrement de la commande : $e";
      });
      return null;
    }
  }

  Future<void> _send() async {
    final lines = OrderCart.instance.lines.value;
    final created = await _createOrder(lines);
    if (created == null) return;

    final message = _buildMessage(lines, created.numero);
    final phone = _selectedCommercial!.telephone1.replaceFirst('+', '');
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
      Navigator.of(context).pop(_createdNumero);
      return;
    }
    setState(() {
      _sending = false;
      _pendingMessage = message;
    });
  }

  /// Bouton « Enregistrer » : termine la commande en cours en la validant/
  /// sauvegardant via le même endpoint que `_send` (POST /commandes), sans
  /// passer par l'envoi WhatsApp. Affiche une confirmation puis ferme
  /// l'écran (flux existant : pop avec le numéro de commande).
  Future<void> _save() async {
    final lines = OrderCart.instance.lines.value;
    final created = await _createOrder(lines);
    if (created == null) return;

    if (!mounted) return;
    OrderCart.instance.clear();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Commande n° ${created.numeroClient} enregistrée avec succès.')),
    );
    Navigator.of(context).pop(created.numeroClient);
  }

  Future<void> _copyPendingMessage() async {
    final message = _pendingMessage;
    if (message == null) return;
    await Clipboard.setData(ClipboardData(text: message));
    OrderCart.instance.clear();
    if (!mounted) return;
    Navigator.of(context).pop(_createdNumero);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Récapitulatif de commande'),
        actions: const [ProLogoutAction()],
      ),
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
                      Text(
                        'Commande n° $_createdNumero enregistrée.',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
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
                      onPressed: (_sending || lines.isEmpty) ? null : _save,
                      icon: _sending
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.save),
                      label: const Text('Enregistrer'),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: (_sending || lines.isEmpty) ? null : _send,
                      icon: const Icon(Icons.send),
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
