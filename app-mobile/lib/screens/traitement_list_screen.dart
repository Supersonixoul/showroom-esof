import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/traitement_models.dart';
import '../services/commercial_session.dart';
import '../services/traitement_api_service.dart';
import '../widgets/commercial_logout_action.dart';
import 'traitement_detail_screen.dart';

enum _Filtre { toutes, aTraiter, proformaEmise, annulees }

/// Écran liste des commandes à traiter par le commercial connecté
/// (rubrique "Traitement").
class TraitementListScreen extends StatefulWidget {
  const TraitementListScreen({super.key});

  @override
  State<TraitementListScreen> createState() => _TraitementListScreenState();
}

class _TraitementListScreenState extends State<TraitementListScreen> {
  final _api = TraitementApiService();
  Future<List<CommandeTraitement>>? _future;
  _Filtre _filtre = _Filtre.toutes;

  String get _token => CommercialSession.instance.currentCommercial.value!.token;

  @override
  void initState() {
    super.initState();
    requireCommercialSession(context);
    if (CommercialSession.instance.currentCommercial.value != null) {
      _load();
    }
  }

  void _load() {
    setState(() => _future = _api.fetchCommandes(_token));
  }

  Future<void> _refresh() async {
    if (CommercialSession.instance.currentCommercial.value == null) return;
    final future = _api.fetchCommandes(_token);
    setState(() => _future = future);
    await future;
  }

  List<CommandeTraitement> _applyFiltre(List<CommandeTraitement> commandes) {
    switch (_filtre) {
      case _Filtre.toutes:
        return commandes;
      case _Filtre.aTraiter:
        return commandes
            .where((c) => ['ENVOYEE', 'EN_TRAITEMENT', 'MODIFIEE'].contains(c.statut))
            .toList();
      case _Filtre.proformaEmise:
        return commandes.where((c) => c.statut == 'PROFORMA_EMISE').toList();
      case _Filtre.annulees:
        return commandes.where((c) => c.statut == 'ANNULEE').toList();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Traitement des commandes'),
        actions: const [CommercialLogoutAction()],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _filterChip('Toutes', _Filtre.toutes),
                  const SizedBox(width: 8),
                  _filterChip('À traiter', _Filtre.aTraiter),
                  const SizedBox(width: 8),
                  _filterChip('Proforma émise', _Filtre.proformaEmise),
                  const SizedBox(width: 8),
                  _filterChip('Annulées', _Filtre.annulees),
                ],
              ),
            ),
          ),
          Expanded(
            child: FutureBuilder<List<CommandeTraitement>>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.hasError && snapshot.error is CommercialSessionExpiredException) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (!mounted) return;
                    performCommercialLogout(
                      context,
                      message: 'Session expirée, veuillez vous reconnecter.',
                    );
                  });
                  return const SizedBox.shrink();
                }
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Center(
                    child: Text('Erreur de chargement : ${snapshot.error}'),
                  );
                }
                final commandes = _applyFiltre(snapshot.data ?? []);
                if (commandes.isEmpty) {
                  return RefreshIndicator(
                    onRefresh: _refresh,
                    child: ListView(
                      children: const [
                        SizedBox(height: 120),
                        Center(child: Text('Aucune commande.')),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    itemCount: commandes.length,
                    itemBuilder: (context, index) => _CommandeCard(
                      commande: commandes[index],
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => TraitementDetailScreen(commande: commandes[index]),
                          ),
                        );
                        if (mounted) _load();
                      },
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, _Filtre value) {
    return ChoiceChip(
      label: Text(label),
      selected: _filtre == value,
      onSelected: (_) => setState(() => _filtre = value),
    );
  }
}

/// Couleur/libellé de badge de statut, réutilisés par
/// [TraitementDetailScreen].
Color statutColor(String statut) {
  switch (statut) {
    case 'ENVOYEE':
      return Colors.blue;
    case 'EN_TRAITEMENT':
    case 'MODIFIEE':
      return Colors.orange;
    case 'PROFORMA_EMISE':
      return Colors.green;
    case 'ANNULEE':
      return Colors.red;
    default:
      return Colors.grey;
  }
}

String statutLabel(String statut) {
  switch (statut) {
    case 'ENVOYEE':
      return 'Envoyée';
    case 'EN_TRAITEMENT':
      return 'En traitement';
    case 'MODIFIEE':
      return 'Modifiée';
    case 'PROFORMA_EMISE':
      return 'Proforma émise';
    case 'ANNULEE':
      return 'Annulée';
    default:
      return statut;
  }
}

class _CommandeCard extends StatelessWidget {
  const _CommandeCard({required this.commande, required this.onTap});

  final CommandeTraitement commande;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final date = DateFormat('dd/MM/yyyy HH:mm').format(commande.dateCommande);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        onTap: onTap,
        title: Text(commande.professionnel.nom, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('$date — ${commande.lignes.length} article(s)'),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: statutColor(commande.statut),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            statutLabel(commande.statut),
            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
          ),
        ),
      ),
    );
  }
}
