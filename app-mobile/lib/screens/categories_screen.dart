import 'dart:async';

import 'package:flutter/material.dart';

import '../models/catalog_models.dart';
import '../services/api_service.dart';
import '../services/catalog_repository.dart';
import 'home_screen.dart' show kHorizontalPadding;
import 'product_list_screen.dart';

const double _kCategoryThumbSize = 48;

/// Miniature d'une catégorie : image réseau arrondie, avec indicateur de
/// chargement discret et repli sur une icône générique si `imageUrl` est
/// absent ou si le chargement échoue.
class _CategoryThumbnail extends StatelessWidget {
  final String? imageUrl;

  const _CategoryThumbnail({required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    final url = imageUrl;
    if (url == null || url.isEmpty) {
      return _placeholder();
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.network(
        ApiService.mediaUrl(url),
        width: _kCategoryThumbSize,
        height: _kCategoryThumbSize,
        fit: BoxFit.cover,
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return const SizedBox(
            width: _kCategoryThumbSize,
            height: _kCategoryThumbSize,
            child: Center(
              child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        },
        errorBuilder: (context, error, stackTrace) => _placeholder(),
      ),
    );
  }

  Widget _placeholder() {
    return Container(
      width: _kCategoryThumbSize,
      height: _kCategoryThumbSize,
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(Icons.category, color: Colors.grey.shade500),
    );
  }
}

/// Navigation récursive dans l'arborescence des catégories (accueil →
/// Catégories). Une catégorie sans sous-catégorie (feuille) affiche
/// directement la liste des produits qui lui sont rattachés, avec une
/// recherche multi-mots au sein de la catégorie.
class CategoriesScreen extends StatefulWidget {
  final String? parentId;
  final String title;

  const CategoriesScreen({
    super.key,
    required this.parentId,
    required this.title,
  });

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  bool _searchLoading = false;
  List<String>? _matchingIds;

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
    if (query.isEmpty) {
      setState(() {
        _matchingIds = null;
        _searchLoading = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () => _runSearch(query));
  }

  Future<void> _runSearch(String query) async {
    final categoryId = widget.parentId;
    if (categoryId == null) return;
    setState(() => _searchLoading = true);
    try {
      final ids = await _api.searchCategoryProductIds(categoryId, query);
      if (!mounted || query != _query) return;
      setState(() {
        _matchingIds = ids;
        _searchLoading = false;
      });
    } catch (_) {
      if (!mounted || query != _query) return;
      setState(() {
        _matchingIds = [];
        _searchLoading = false;
      });
    }
  }

  void _clearSearch() {
    _debounce?.cancel();
    _searchController.clear();
    setState(() {
      _query = '';
      _matchingIds = null;
      _searchLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: ValueListenableBuilder<CatalogSnapshot>(
        valueListenable: CatalogRepository.instance.snapshot,
        builder: (context, catalog, _) {
          final children = catalog.categories
              .where((c) => c.parentId == widget.parentId)
              .toList();
          if (children.isEmpty) {
            var products = catalog.products
                .where((p) => p.categoryId == widget.parentId && p.isActive)
                .toList();
            final matchingIds = _matchingIds;
            if (matchingIds != null) {
              final idSet = matchingIds.toSet();
              products = products.where((p) => idSet.contains(p.id)).toList();
            }
            return Column(
              children: [
                _CategorySearchField(
                  controller: _searchController,
                  onChanged: _onSearchChanged,
                  onClear: _clearSearch,
                ),
                Expanded(
                  child: _searchLoading
                      ? const Center(child: CircularProgressIndicator())
                      : (matchingIds != null && products.isEmpty)
                          ? const _EmptyCategorySearchState()
                          : ProductGrid(products: products),
                ),
              ],
            );
          }
          return ListView.builder(
            itemCount: children.length,
            itemBuilder: (context, index) {
              final category = children[index];
              return ListTile(
                leading: _CategoryThumbnail(imageUrl: category.imageUrl),
                title: Text(category.name),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => CategoriesScreen(
                      parentId: category.id,
                      title: category.name,
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

/// Champ de recherche en pilule, même style que la barre de recherche de
/// l'accueil (fond gris clair, bords totalement arrondis, aucune bordure).
class _CategorySearchField extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  const _CategorySearchField({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        kHorizontalPadding,
        12,
        kHorizontalPadding,
        8,
      ),
      child: SizedBox(
        height: 42,
        child: AnimatedBuilder(
          animation: controller,
          builder: (context, _) {
            return TextField(
              controller: controller,
              onChanged: onChanged,
              textAlignVertical: TextAlignVertical.center,
              style: const TextStyle(fontSize: 14),
              decoration: InputDecoration(
                isDense: true,
                hintText: 'Rechercher dans cette catégorie...',
                hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade500),
                prefixIcon: const Icon(Icons.search, size: 20, color: Colors.grey),
                suffixIcon: controller.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear, size: 18, color: Colors.grey),
                        onPressed: onClear,
                      ),
                filled: true,
                fillColor: Colors.grey.shade100,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(30),
                  borderSide: BorderSide.none,
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

/// État vide quand aucun produit ne correspond à la recherche en cours.
class _EmptyCategorySearchState extends StatelessWidget {
  const _EmptyCategorySearchState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search_off, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(
              'Aucun article ne correspond à votre recherche',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    );
  }
}
