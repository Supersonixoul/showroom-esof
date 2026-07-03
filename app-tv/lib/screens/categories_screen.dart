import 'package:flutter/material.dart';

import '../models/catalog_models.dart';
import '../services/catalog_repository.dart';
import 'product_list_screen.dart';

/// Navigation récursive dans l'arborescence des catégories (mode Catalogue →
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
                title: Text(category.name,
                    style: const TextStyle(color: Colors.white)),
                trailing: const Icon(Icons.chevron_right, color: Colors.white54),
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
