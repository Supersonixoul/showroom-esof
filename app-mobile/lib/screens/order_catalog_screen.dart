import 'dart:async';

import 'package:flutter/material.dart';

import '../models/catalog_models.dart';
import '../models/pro_models.dart';
import '../services/api_service.dart';
import '../services/catalog_repository.dart';
import '../services/order_cart.dart';
import '../widgets/pro_logout_action.dart';
import 'order_summary_screen.dart';

/// Écran 2 de « Passer commande » : recherche produit (endpoint existant) et
/// navigation par catégorie (réutilise [CatalogRepository]) + panier
/// (spec §3.3).
class OrderCatalogScreen extends StatefulWidget {
  const OrderCatalogScreen({super.key});

  @override
  State<OrderCatalogScreen> createState() => _OrderCatalogScreenState();
}

class _OrderCatalogScreenState extends State<OrderCatalogScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  bool _searchLoading = false;
  List<FeaturedProduct>? _searchResults;
  String? _selectedCategoryId;

  @override
  void initState() {
    super.initState();
    requireProSession(context);
    CatalogRepository.instance.ensureInitialized();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
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
      final results = await _api.searchProducts(query);
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

  @override
  Widget build(BuildContext context) {
    final showSearchResults = _query.length >= 2;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Commander'),
        actions: [
          ValueListenableBuilder<List<CartLine>>(
            valueListenable: OrderCart.instance.lines,
            builder: (context, lines, _) {
              return Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.shopping_cart),
                    tooltip: 'Voir le panier',
                    onPressed: () async {
                      final numero = await Navigator.of(context).push<String>(
                        MaterialPageRoute(builder: (_) => const OrderSummaryScreen()),
                      );
                      if (numero != null && context.mounted) {
                        Navigator.of(context).pop(numero);
                      }
                    },
                  ),
                  if (lines.isNotEmpty)
                    Positioned(
                      right: 6,
                      top: 6,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                        child: Text(
                          '${lines.length}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white, fontSize: 10),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          const ProLogoutAction(),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
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
          ),
          Expanded(
            child: showSearchResults ? _buildSearchResults() : _buildCategoryBrowse(),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchResults() {
    if (_searchLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    final items = _searchResults;
    if (items == null || items.isEmpty) {
      return Center(child: Text('Aucun produit trouvé pour « $_query ».'));
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final match = CatalogRepository.instance.snapshot.value.products
            .where((p) => p.id == items[index].id);
        if (match.isEmpty) return const SizedBox.shrink();
        return _ProductCard(product: match.first);
      },
    );
  }

  Widget _buildCategoryBrowse() {
    return ValueListenableBuilder<CatalogSnapshot>(
      valueListenable: CatalogRepository.instance.snapshot,
      builder: (context, catalog, _) {
        final topCategories = catalog.categories.where((c) => c.parentId == null).toList();
        final products = _selectedCategoryId == null
            ? catalog.products
            : catalog.products.where((p) => p.categoryId == _selectedCategoryId).toList();
        return Column(
          children: [
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: const Text('Toutes'),
                      selected: _selectedCategoryId == null,
                      onSelected: (_) => setState(() => _selectedCategoryId = null),
                    ),
                  ),
                  for (final category in topCategories)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(category.name),
                        selected: _selectedCategoryId == category.id,
                        onSelected: (_) => setState(() => _selectedCategoryId = category.id),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: products.isEmpty
                  ? const Center(child: Text('Aucun produit.'))
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                      itemCount: products.length,
                      itemBuilder: (context, index) => _ProductCard(product: products[index]),
                    ),
            ),
          ],
        );
      },
    );
  }
}

/// Carte produit avec sélecteur de quantité et bouton « Ajouter » au panier.
class _ProductCard extends StatefulWidget {
  const _ProductCard({required this.product});

  final Product product;

  @override
  State<_ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends State<_ProductCard> {
  int _quantite = 1;

  void _add() {
    OrderCart.instance.addProduct(widget.product.id, widget.product.name, quantite: _quantite);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${widget.product.name} ajouté au panier.'),
        duration: const Duration(seconds: 1),
      ),
    );
    setState(() => _quantite = 1);
  }

  @override
  Widget build(BuildContext context) {
    final imageUrl = widget.product.images.isNotEmpty ? widget.product.images.first.url : null;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: 64,
                height: 64,
                color: Colors.grey.shade100,
                alignment: Alignment.center,
                child: imageUrl == null
                    ? Icon(Icons.image_outlined, color: Colors.grey.shade400)
                    : Image.network(
                        ApiService.mediaUrl(imageUrl),
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) =>
                            Icon(Icons.image_outlined, color: Colors.grey.shade400),
                      ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.product.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  if (widget.product.reference != null && widget.product.reference!.isNotEmpty)
                    Text(
                      widget.product.reference!,
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                    ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.remove_circle_outline),
                        onPressed: _quantite > 1 ? () => setState(() => _quantite--) : null,
                        visualDensity: VisualDensity.compact,
                      ),
                      Text('$_quantite', style: const TextStyle(fontWeight: FontWeight.bold)),
                      IconButton(
                        icon: const Icon(Icons.add_circle_outline),
                        onPressed: () => setState(() => _quantite++),
                        visualDensity: VisualDensity.compact,
                      ),
                      const Spacer(),
                      FilledButton.icon(
                        onPressed: _add,
                        icon: const Icon(Icons.add_shopping_cart, size: 16),
                        label: const Text('Ajouter'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
