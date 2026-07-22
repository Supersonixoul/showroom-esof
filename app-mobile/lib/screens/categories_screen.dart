import 'package:flutter/material.dart';

import '../models/catalog_models.dart';
import '../services/api_service.dart';
import '../services/catalog_repository.dart';
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
/// directement la liste des produits qui lui sont rattachés.
class CategoriesScreen extends StatelessWidget {
  final String? parentId;
  final String title;

  const CategoriesScreen({
    super.key,
    required this.parentId,
    required this.title,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ValueListenableBuilder<CatalogSnapshot>(
        valueListenable: CatalogRepository.instance.snapshot,
        builder: (context, catalog, _) {
          final children = catalog.categories
              .where((c) => c.parentId == parentId)
              .toList();
          if (children.isEmpty) {
            final products = catalog.products
                .where((p) => p.categoryId == parentId && p.isActive)
                .toList();
            return ProductGrid(products: products);
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
