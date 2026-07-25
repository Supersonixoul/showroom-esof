import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/catalog_models.dart' show FeaturedProduct;
import '../models/traitement_models.dart';
import '../services/api_service.dart';
import '../services/commercial_session.dart';
import '../services/traitement_api_service.dart';
import '../widgets/commercial_logout_action.dart';
import 'traitement_list_screen.dart' show statutColor, statutLabel;

String _formatFcfa(num value) {
  final formatted = NumberFormat('#,##0', 'fr_FR').format(value.round());
  return '${formatted.replaceAll('\u00A0', ' ')} F';
}

class _LigneEdit {
  final LigneCommandeTraitement ligne;
  final TextEditingController prixController;

  _LigneEdit(this.ligne)
      : prixController = TextEditingController(
          text: ligne.prixUnitaire != null
              ? ligne.prixUnitaire!.round().toString()
              : '',
        );

  void dispose() => prixController.dispose();
}

/// Écran de traitement d'une commande par le commercial : lignes éditables,
/// TVA, totaux, ajout d'articles, génération de la proforma, annulation.
class TraitementDetailScreen extends StatefulWidget {
  const TraitementDetailScreen({super.key, required this.commande});

  final CommandeTraitement commande;

  @override
  State<TraitementDetailScreen> createState() => _TraitementDetailScreenState();
}

class _TraitementDetailScreenState extends State<TraitementDetailScreen> {
  final _api = TraitementApiService();
  late CommandeTraitement _commande;
  late List<_LigneEdit> _lignes;
  late bool _tvaApplicable;
  late bool _bicApplicable;
  bool _saving = false;
  bool _generating = false;
  String? _error;

  String get _token =>
      CommercialSession.instance.currentCommercial.value!.token;

  @override
  void initState() {
    super.initState();
    requireCommercialSession(context);
    _commande = widget.commande;
    _tvaApplicable = _commande.tvaApplicable;
    _bicApplicable = _commande.bicApplicable;
    _lignes = _commande.lignes.map((l) => _LigneEdit(l)).toList();
  }

  @override
  void dispose() {
    for (final l in _lignes) {
      l.dispose();
    }
    super.dispose();
  }

  double get _totalHt => _lignes.fold(
        0.0,
        (sum, l) =>
            sum +
            (double.tryParse(l.prixController.text) ?? 0) * l.ligne.quantite,
      );

  bool get _toutesLignesPricees =>
      _lignes.isNotEmpty &&
      _lignes.every((l) => double.tryParse(l.prixController.text) != null);

  List<LigneCommandeTraitement> _lignesActuelles() {
    return _lignes.map((edit) {
      final prix = double.tryParse(edit.prixController.text);
      return LigneCommandeTraitement(
        id: edit.ligne.id,
        produitId: edit.ligne.produitId,
        libelleProduit: edit.ligne.libelleProduit,
        quantite: edit.ligne.quantite,
        prixUnitaire: prix,
      );
    }).toList();
  }

  Future<CommandeTraitement?> _save({bool silent = false}) async {
    if (_lignes.isEmpty) {
      setState(() => _error = 'La commande doit contenir au moins un article.');
      return null;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await _api.updateTraitement(
        _token,
        _commande.id,
        lignes: _lignesActuelles(),
        tvaApplicable: _tvaApplicable,
        bicApplicable: _bicApplicable,
      );
      if (!mounted) return null;
      setState(() {
        _commande = result.commande;
        _tvaApplicable = result.commande.tvaApplicable;
        _bicApplicable = result.commande.bicApplicable;
        for (final l in _lignes) {
          l.dispose();
        }
        _lignes = result.commande.lignes.map((l) => _LigneEdit(l)).toList();
        _saving = false;
      });
      if (!silent) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Modifications enregistrées.')),
        );
        if (result.articlesModifies) {
          await _proposerNotificationModification(result.commande);
        }
      }
      return result.commande;
    } on CommercialSessionExpiredException {
      if (!mounted) return null;
      await performCommercialLogout(context,
          message: 'Session expirée, veuillez vous reconnecter.');
      return null;
    } catch (e) {
      setState(() {
        _saving = false;
        _error = "Erreur lors de l'enregistrement : $e";
      });
      return null;
    }
  }

  Future<void> _proposerNotificationModification(
      CommandeTraitement commande) async {
    if (!mounted) return;
    final confirmer = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Notifier le client'),
        content: const Text(
          "La commande a été modifiée. Voulez-vous informer le client par WhatsApp ?",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Non'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Envoyer'),
          ),
        ],
      ),
    );
    if (confirmer != true) return;
    await _envoyerWhatsApp(_buildMessageModification(commande));
  }

  String _buildMessageModification(CommandeTraitement commande) {
    final date = DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now());
    final buffer = StringBuffer();
    buffer.writeln('✏️ COMMANDE MODIFIÉE');
    buffer.writeln('━━━━━━━━━━━━━━');
    buffer.writeln('Client : ${commande.professionnel.nom}');
    buffer.writeln('Date : $date');
    buffer.writeln('━━━━━━━━━━━━━━');
    for (var i = 0; i < commande.lignes.length; i++) {
      final l = commande.lignes[i];
      buffer.writeln('${i + 1}. ${l.libelleProduit} — Qté : ${l.quantite}');
    }
    buffer.writeln('━━━━━━━━━━━━━━');
    buffer.write('Merci de vérifier ces modifications. — ESOF');
    return buffer.toString();
  }

  String _buildMessageAnnulation(String motif) {
    final date = DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now());
    final buffer = StringBuffer();
    buffer.writeln('❌ COMMANDE ANNULÉE');
    buffer.writeln('━━━━━━━━━━━━━━');
    buffer.writeln('Client : ${_commande.professionnel.nom}');
    buffer.writeln('Date : $date');
    buffer.writeln('━━━━━━━━━━━━━━');
    buffer.writeln('Motif : $motif');
    buffer.writeln('━━━━━━━━━━━━━━');
    buffer.write(
        'Nous restons à votre disposition pour toute nouvelle commande. — ESOF');
    return buffer.toString();
  }

  Future<void> _envoyerWhatsApp(String message) async {
    final phone = _commande.professionnel.telephone1.replaceFirst('+', '');
    final uri =
        Uri.parse('https://wa.me/$phone?text=${Uri.encodeComponent(message)}');
    var launched = false;
    try {
      launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      launched = false;
    }
    if (!mounted || launched) return;
    final copier = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("WhatsApp n'a pas pu être ouvert"),
        content:
            const Text('Vous pouvez copier le message à envoyer manuellement.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Fermer'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.of(context).pop(true),
            icon: const Icon(Icons.copy),
            label: const Text('Copier le message'),
          ),
        ],
      ),
    );
    if (copier == true) {
      await Clipboard.setData(ClipboardData(text: message));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Message copié dans le presse-papiers.')),
      );
    }
  }

  Future<void> _genererProforma({required bool renvoyer}) async {
    setState(() {
      _generating = true;
      _error = null;
    });
    try {
      String numeroProforma;
      if (renvoyer && _commande.numeroProforma != null) {
        numeroProforma = _commande.numeroProforma!;
      } else {
        final saved = await _save(silent: true);
        if (saved == null) {
          setState(() => _generating = false);
          return;
        }
        numeroProforma = await _api.genererProforma(_token, _commande.id);
        setState(() {
          _commande = CommandeTraitement(
            id: saved.id,
            professionnel: saved.professionnel,
            dateCommande: saved.dateCommande,
            statut: 'PROFORMA_EMISE',
            motifAnnulation: saved.motifAnnulation,
            tvaApplicable: saved.tvaApplicable,
            bicApplicable: saved.bicApplicable,
            numeroProforma: numeroProforma,
            dateProforma: DateTime.now(),
            lignes: saved.lignes,
          );
        });
      }

      final bytes = await _api.telechargerProformaPdf(_token, _commande.id);
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/$numeroProforma.pdf');
      await file.writeAsBytes(bytes);
      if (!mounted) return;
      await Share.shareXFiles(
        [XFile(file.path)],
        text: 'Facture proforma $numeroProforma — ESOF',
      );
    } on CommercialSessionExpiredException {
      if (!mounted) return;
      await performCommercialLogout(context,
          message: 'Session expirée, veuillez vous reconnecter.');
      return;
    } catch (e) {
      setState(
          () => _error = 'Erreur lors de la génération de la proforma : $e');
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _annuler() async {
    final motifController = TextEditingController();
    final motif = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Annuler la commande"),
        content: TextField(
          controller: motifController,
          decoration: const InputDecoration(labelText: "Motif de l'annulation"),
          autofocus: true,
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Retour'),
          ),
          FilledButton(
            onPressed: () {
              if (motifController.text.trim().isEmpty) return;
              Navigator.of(context).pop(motifController.text.trim());
            },
            child: const Text("Confirmer l'annulation"),
          ),
        ],
      ),
    );
    if (motif == null || motif.isEmpty) return;

    try {
      final updated = await _api.annulerCommande(_token, _commande.id, motif);
      if (!mounted) return;
      setState(() => _commande = updated);
      await _envoyerWhatsApp(_buildMessageAnnulation(motif));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Commande annulée.')),
      );
    } on CommercialSessionExpiredException {
      if (!mounted) return;
      await performCommercialLogout(context,
          message: 'Session expirée, veuillez vous reconnecter.');
    } catch (e) {
      setState(() => _error = "Erreur lors de l'annulation : $e");
    }
  }

  void _ajouterArticle() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => _AjoutArticleSheet(
        onAdd: (produitId, nomProduit) {
          setState(() {
            final existante =
                _lignes.where((l) => l.ligne.produitId == produitId);
            if (existante.isNotEmpty) {
              existante.first.ligne.quantite += 1;
            } else {
              _lignes.add(_LigneEdit(
                LigneCommandeTraitement(
                  produitId: produitId,
                  libelleProduit: nomProduit,
                  quantite: 1,
                ),
              ));
            }
          });
        },
      ),
    );
  }

  void _supprimerLigne(_LigneEdit edit) {
    showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Retirer cet article ?'),
        content: Text(edit.ligne.libelleProduit),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Retirer'),
          ),
        ],
      ),
    ).then((confirmed) {
      if (confirmed == true) {
        setState(() {
          edit.dispose();
          _lignes.remove(edit);
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final estAnnulee = _commande.estAnnulee;
    final tva = _tvaApplicable ? _totalHt * 0.18 : 0;
    final baseBic = _totalHt + tva;
    final bic = _bicApplicable ? baseBic * 0.02 : 0;
    final totalFinal = baseBic + bic;
    // Le clavier réduit la hauteur disponible : on masque le bandeau de
    // totaux/actions pendant la saisie pour garder les champs de prix
    // visibles au-dessus du clavier.
    final clavierOuvert = MediaQuery.of(context).viewInsets.bottom > 0;

    return Scaffold(
      appBar: AppBar(
        title: Text('Commande — ${_commande.professionnel.nom}'),
        actions: const [CommercialLogoutAction()],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _commande.professionnel.nom,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: statutColor(_commande.statut),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            statutLabel(_commande.statut),
                            style: const TextStyle(
                                color: Colors.white, fontSize: 11),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.schedule,
                            size: 14, color: Colors.black54),
                        const SizedBox(width: 4),
                        Text(
                          DateFormat('dd/MM/yyyy HH:mm')
                              .format(_commande.dateCommande),
                          style: const TextStyle(
                              fontSize: 12, color: Colors.black54),
                        ),
                        const SizedBox(width: 12),
                        const Icon(Icons.phone,
                            size: 14, color: Colors.black54),
                        const SizedBox(width: 4),
                        Text(
                          _commande.professionnel.telephone1,
                          style: const TextStyle(
                              fontSize: 12, color: Colors.black54),
                        ),
                        IconButton(
                          icon: const Icon(Icons.call, size: 16),
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () => launchUrl(
                            Uri.parse(
                                'tel:${_commande.professionnel.telephone1}'),
                          ),
                        ),
                      ],
                    ),
                    if (estAnnulee && _commande.motifAnnulation != null) ...[
                      const Divider(),
                      Text(
                        "Motif d'annulation : ${_commande.motifAnnulation}",
                        style: const TextStyle(color: Colors.red),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              itemCount: _lignes.length,
              itemBuilder: (context, index) {
                final edit = _lignes[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                edit.ligne.libelleProduit,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600),
                              ),
                            ),
                            if (!estAnnulee)
                              IconButton(
                                icon: const Icon(Icons.delete_outline),
                                onPressed: () => _supprimerLigne(edit),
                              ),
                          ],
                        ),
                        Row(
                          children: [
                            if (!estAnnulee) ...[
                              IconButton(
                                icon: const Icon(Icons.remove_circle_outline),
                                onPressed: edit.ligne.quantite > 1
                                    ? () =>
                                        setState(() => edit.ligne.quantite--)
                                    : null,
                                visualDensity: VisualDensity.compact,
                              ),
                              Text('${edit.ligne.quantite}'),
                              IconButton(
                                icon: const Icon(Icons.add_circle_outline),
                                onPressed: () =>
                                    setState(() => edit.ligne.quantite++),
                                visualDensity: VisualDensity.compact,
                              ),
                            ] else
                              Text('Qté : ${edit.ligne.quantite}'),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextField(
                                controller: edit.prixController,
                                enabled: !estAnnulee,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Prix unitaire (FCFA)',
                                  isDense: true,
                                ),
                                onChanged: (_) => setState(() {}),
                              ),
                            ),
                          ],
                        ),
                        Align(
                          alignment: Alignment.centerRight,
                          child: Text(
                            _formatFcfa(
                              (double.tryParse(edit.prixController.text) ?? 0) *
                                  edit.ligne.quantite,
                            ),
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          if (!estAnnulee && !clavierOuvert)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton.icon(
                  onPressed: _ajouterArticle,
                  icon: const Icon(Icons.add),
                  label: const Text('Ajouter un article'),
                ),
              ),
            ),
          if (!estAnnulee && !clavierOuvert)
            CheckboxListTile(
              value: _tvaApplicable,
              onChanged: (value) =>
                  setState(() => _tvaApplicable = value ?? false),
              title: const Text('Appliquer la TVA (18 %)'),
              controlAffinity: ListTileControlAffinity.leading,
            ),
          if (!estAnnulee && !clavierOuvert)
            CheckboxListTile(
              value: _bicApplicable,
              onChanged: (value) =>
                  setState(() => _bicApplicable = value ?? false),
              title: const Text('Appliquer le BIC (2 %)'),
              controlAffinity: ListTileControlAffinity.leading,
            ),
          if (!clavierOuvert)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: Colors.grey.shade100,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_tvaApplicable) ...[
                    Text('Total HT : ${_formatFcfa(_totalHt)}'),
                    Text('TVA 18 % : ${_formatFcfa(tva)}'),
                  ],
                  if (_bicApplicable) ...[
                    Text(
                      '${_tvaApplicable ? 'Total TTC' : 'Montant HT'} : ${_formatFcfa(baseBic)}',
                    ),
                    Text('BIC 2 % : ${_formatFcfa(bic)}'),
                    Text(
                      'Net à payer : ${_formatFcfa(totalFinal)}',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ] else if (_tvaApplicable)
                    Text(
                      'Total TTC : ${_formatFcfa(baseBic)}',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16),
                    )
                  else
                    Text(
                      'Montant total : ${_formatFcfa(_totalHt)}',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  const SizedBox(height: 12),
                  if (!estAnnulee) ...[
                    FilledButton.icon(
                      onPressed: _saving ? null : () => _save(),
                      icon: _saving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.save),
                      label: const Text('Enregistrer les modifications'),
                    ),
                    const SizedBox(height: 8),
                    Tooltip(
                      message: _toutesLignesPricees
                          ? ''
                          : 'Renseignez tous les prix',
                      child: FilledButton.icon(
                        onPressed: (_toutesLignesPricees && !_generating)
                            ? () => _genererProforma(renvoyer: false)
                            : null,
                        icon: _generating
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.picture_as_pdf),
                        label: const Text('Générer la proforma'),
                      ),
                    ),
                    if (_commande.proformaEmise) ...[
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: _generating
                            ? null
                            : () => _genererProforma(renvoyer: true),
                        icon: const Icon(Icons.share),
                        label: const Text('Renvoyer la proforma'),
                      ),
                    ],
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _annuler,
                      style:
                          OutlinedButton.styleFrom(foregroundColor: Colors.red),
                      icon: const Icon(Icons.cancel_outlined),
                      label: const Text('Annuler la commande'),
                    ),
                  ] else if (_commande.proformaEmise ||
                      _commande.numeroProforma != null)
                    OutlinedButton.icon(
                      onPressed: _generating
                          ? null
                          : () => _genererProforma(renvoyer: true),
                      icon: const Icon(Icons.share),
                      label: const Text('Renvoyer la proforma'),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Feuille de recherche/ajout d'un article (reprend le modèle de recherche
/// de "Passer commande").
class _AjoutArticleSheet extends StatefulWidget {
  const _AjoutArticleSheet({required this.onAdd});

  final void Function(String produitId, String nomProduit) onAdd;

  @override
  State<_AjoutArticleSheet> createState() => _AjoutArticleSheetState();
}

class _AjoutArticleSheetState extends State<_AjoutArticleSheet> {
  final _api = ApiService();
  final _searchController = TextEditingController();
  Timer? _debounce;
  bool _loading = false;
  List<FeaturedProduct>? _results;

  void _onChanged(String value) {
    _debounce?.cancel();
    final query = value.trim();
    if (query.length < 2) {
      setState(() => _results = null);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () async {
      setState(() => _loading = true);
      try {
        final results = await _api.searchProducts(query);
        if (!mounted) return;
        setState(() {
          _results = results;
          _loading = false;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _results = [];
          _loading = false;
        });
      }
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.6,
        child: Column(
          children: [
            const Text('Ajouter un article',
                style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextField(
              controller: _searchController,
              autofocus: true,
              onChanged: _onChanged,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                labelText: 'Rechercher un produit',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : (_results == null)
                      ? const Center(
                          child: Text('Tapez au moins 2 caractères.'))
                      : _results!.isEmpty
                          ? const Center(child: Text('Aucun produit trouvé.'))
                          : ListView.builder(
                              itemCount: _results!.length,
                              itemBuilder: (context, index) {
                                final produit = _results![index];
                                return ListTile(
                                  title: Text(produit.name),
                                  subtitle: produit.reference != null
                                      ? Text(produit.reference!)
                                      : null,
                                  trailing: const Icon(Icons.add),
                                  onTap: () {
                                    widget.onAdd(produit.id, produit.name);
                                    Navigator.of(context).pop();
                                  },
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}
