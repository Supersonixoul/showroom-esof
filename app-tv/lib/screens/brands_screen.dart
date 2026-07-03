import 'package:flutter/material.dart';

import '../models/catalog_models.dart';
import '../services/api_service.dart';
import '../services/catalog_repository.dart';
import 'product_list_screen.dart';

/// Liste des marques (mode Catalogue → Marques). Le tap sur une marque ouvre
/// la liste des produits actifs de cette marque.
class BrandsScreen extends StatelessWidget {
  const BrandsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Marques')),
      body: ValueListenableBuilder<CatalogSnapshot>(
        valueListenable: CatalogRepository.instance.snapshot,
        builder: (context, catalog, _) {
          final brands = catalog.brands;
          if (brands.isEmpty) {
            return const Center(
              child: Text(
                'Aucune marque disponible',
                style: TextStyle(color: Colors.white70),
              ),
            );
          }
          return ListView.builder(
            itemCount: brands.length,
            itemBuilder: (context, index) {
              final brand = brands[index];
              final products = catalog.products
                  .where((p) => p.brandId == brand.id && p.isActive)
                  .toList();
              return ListTile(
                leading: brand.logoUrl != null
                    ? Image.network(
                        ApiService.mediaUrl(brand.logoUrl!),
                        width: 48,
                        height: 48,
                      )
                    : const Icon(Icons.business, color: Colors.white70),
                title: Text(brand.name,
                    style: const TextStyle(color: Colors.white)),
                subtitle: Text(
                  '${products.length} produit(s)',
                  style: const TextStyle(color: Colors.white54),
                ),
                trailing: const Icon(Icons.chevron_right, color: Colors.white54),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ProductListScreen(
                      title: brand.name,
                      products: products,
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
