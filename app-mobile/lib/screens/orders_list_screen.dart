import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/pro_models.dart';
import '../services/pro_api_service.dart';
import '../services/pro_session.dart';
import '../widgets/pro_logout_action.dart';
import 'order_catalog_screen.dart';
import 'order_edit_screen.dart';
import 'traitement_list_screen.dart' show statutColor, statutLabel;

String _formatFcfa(num value) {
  final formatted = NumberFormat('#,##0', 'fr_FR').format(value.round());
  return '${formatted.replaceAll('\u00A0', ' ')} F';
}

/// Écran d'accueil de la rubrique "Commander" (compte Pro/Client) : liste
/// des commandes du client, du plus récent au plus ancien (tri assuré côté
/// backend). Le bouton "+" ouvre le flux de création existante (recherche
/// produit → récapitulatif → envoi).
class OrdersListScreen extends StatefulWidget {
  const OrdersListScreen({super.key});

  @override
  State<OrdersListScreen> createState() => _OrdersListScreenState();
}

class _OrdersListScreenState extends State<OrdersListScreen> {
  final _api = ProApiService();
  Future<List<CommandePro>>? _future;

  String get _token => ProSession.instance.currentPro.value!.token;

  @override
  void initState() {
    super.initState();
    requireProSession(context);
    if (ProSession.instance.currentPro.value != null) {
      _load();
    }
  }

  void _load() {
    setState(() => _future = _api.fetchCommandes(_token));
  }

  Future<void> _refresh() async {
    if (ProSession.instance.currentPro.value == null) return;
    final future = _api.fetchCommandes(_token);
    setState(() => _future = future);
    await future;
  }

  Future<void> _create() async {
    final numero = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const OrderCatalogScreen()),
    );
    if (!mounted) return;
    _load();
    if (numero != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Commande $numero enregistrée.')),
      );
    }
  }

  Future<void> _edit(CommandePro commande) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => OrderEditScreen(commande: commande)),
    );
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mes commandes'),
        actions: const [ProLogoutAction()],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _create,
        tooltip: 'Nouvelle commande',
        child: const Icon(Icons.add),
      ),
      body: FutureBuilder<List<CommandePro>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.hasError && snapshot.error is ProSessionExpiredException) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted) return;
              performProLogout(context, message: 'Session expirée, veuillez vous reconnecter.');
            });
            return const SizedBox.shrink();
          }
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Erreur de chargement : ${snapshot.error}'));
          }
          final commandes = snapshot.data ?? [];
          if (commandes.isEmpty) {
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: Text('Aucune commande pour le moment.')),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              itemCount: commandes.length,
              itemBuilder: (context, index) {
                final commande = commandes[index];
                final date = DateFormat('dd/MM/yyyy HH:mm').format(commande.dateCommande);
                final montant = commande.toutesLignesPricees
                    ? _formatFcfa(commande.totalHt)
                    : 'En attente de traitement';
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    onTap: () => _edit(commande),
                    title: Text(
                      commande.numero,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text('$date — ${commande.lignes.length} article(s) — $montant'),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: statutColor(commande.statut),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        statutLabel(commande.statut),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
