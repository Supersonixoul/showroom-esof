import 'package:flutter/material.dart';

import '../models/catalog_models.dart';
import '../services/api_service.dart';
import 'product_detail_screen.dart';

/// Écran plein cadre (avec AppBar) listant des produits, utilisé depuis les
/// écrans Marques et Caractéristiques.
class ProductListScreen extends StatelessWidget {
  final String title;
  final List<Product> products;

  const ProductListScreen({
    super.key,
    required this.title,
    required this.products,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ProductGrid(products: products),
    );
  }
}

/// Grille de vignettes produit (photo + nom). Le nombre de colonnes s'adapte
/// à la largeur disponible pour un rendu correct sur téléphone et tablette
/// (interface responsive, spec §6.2).
class ProductGrid extends StatelessWidget {
  final List<Product> products;

  const ProductGrid({super.key, required this.products});

  int _crossAxisCount(double width) {
    if (width < 420) return 2;
    if (width < 700) return 3;
    if (width < 1000) return 4;
    return 5;
  }

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) {
      return const Center(child: Text('Aucun produit disponible'));
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        return GridView.builder(
          padding: const EdgeInsets.all(16),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: _crossAxisCount(constraints.maxWidth),
            mainAxisSpacing: 16,
            crossAxisSpacing: 16,
            childAspectRatio: 0.8,
          ),
          itemCount: products.length,
          itemBuilder: (context, index) {
            final product = products[index];
            final thumbnail =
                product.images.isNotEmpty ? product.images.first.url : null;
            return InkWell(
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ProductDetailScreen(product: product),
                ),
              ),
              child: Column(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.black12,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: thumbnail != null
                          ? Image.network(
                              ApiService.mediaUrl(thumbnail),
                              fit: BoxFit.cover,
                            )
                          : const Icon(Icons.inventory_2,
                              size: 48, color: Colors.black38),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    product.name,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
