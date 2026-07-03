import 'package:flutter/material.dart';

import '../models/catalog_models.dart';
import '../services/catalog_repository.dart';
import 'product_list_screen.dart';

/// Liste des libellés de caractéristiques distincts (mode Catalogue →
/// Caractéristiques), construite à partir des `ProductSpec.label` de tous
/// les produits actifs.
class CharacteristicsScreen extends StatelessWidget {
  const CharacteristicsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Caractéristiques')),
      body: ValueListenableBuilder<CatalogSnapshot>(
        valueListenable: CatalogRepository.instance.snapshot,
        builder: (context, catalog, _) {
          final labels = <String>{};
          for (final product in catalog.products) {
            if (!product.isActive) continue;
            for (final spec in product.specs) {
              labels.add(spec.label);
            }
          }
          final sorted = labels.toList()..sort();
          if (sorted.isEmpty) {
            return const Center(
              child: Text(
                'Aucune caractéristique disponible',
                style: TextStyle(color: Colors.white70),
              ),
            );
          }
          return ListView.builder(
            itemCount: sorted.length,
            itemBuilder: (context, index) {
              final label = sorted[index];
              return ListTile(
                title: Text(label, style: const TextStyle(color: Colors.white)),
                trailing: const Icon(Icons.chevron_right, color: Colors.white54),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => CharacteristicValuesScreen(label: label),
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

/// Liste des valeurs distinctes pour un libellé de caractéristique donné ;
/// le tap sur une valeur ouvre la liste des produits qui la partagent.
class CharacteristicValuesScreen extends StatelessWidget {
  final String label;

  const CharacteristicValuesScreen({super.key, required this.label});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(label)),
      body: ValueListenableBuilder<CatalogSnapshot>(
        valueListenable: CatalogRepository.instance.snapshot,
        builder: (context, catalog, _) {
          final valueToProducts = <String, List<Product>>{};
          for (final product in catalog.products) {
            if (!product.isActive) continue;
            for (final spec in product.specs) {
              if (spec.label != label) continue;
              valueToProducts.putIfAbsent(spec.value, () => []).add(product);
            }
          }
          final values = valueToProducts.keys.toList()..sort();
          return ListView.builder(
            itemCount: values.length,
            itemBuilder: (context, index) {
              final value = values[index];
              final products = valueToProducts[value]!;
              return ListTile(
                title: Text(value, style: const TextStyle(color: Colors.white)),
                subtitle: Text(
                  '${products.length} produit(s)',
                  style: const TextStyle(color: Colors.white54),
                ),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ProductListScreen(
                      title: '$label : $value',
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
