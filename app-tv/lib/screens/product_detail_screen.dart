import 'package:flutter/material.dart';

import '../models/catalog_models.dart';
import '../services/api_service.dart';

/// Détail d'un produit : galerie d'images (swipe), description et tableau
/// des caractéristiques techniques.
class ProductDetailScreen extends StatefulWidget {
  final Product product;

  const ProductDetailScreen({super.key, required this.product});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    return Scaffold(
      appBar: AppBar(title: Text(product.name)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (product.images.isNotEmpty) ...[
              SizedBox(
                height: 320,
                child: PageView.builder(
                  controller: _pageController,
                  itemCount: product.images.length,
                  onPageChanged: (index) =>
                      setState(() => _currentPage = index),
                  itemBuilder: (context, index) => Image.network(
                    ApiService.mediaUrl(product.images[index].url),
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  product.images.length,
                  (index) => Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color:
                          index == _currentPage ? Colors.white : Colors.white30,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
            if (product.reference != null) ...[
              Text(
                'Référence : ${product.reference}',
                style: const TextStyle(color: Colors.white70, fontSize: 16),
              ),
              const SizedBox(height: 8),
            ],
            if (product.description != null) ...[
              Text(
                product.description!,
                style: const TextStyle(color: Colors.white, fontSize: 16),
              ),
              const SizedBox(height: 24),
            ],
            if (product.specs.isNotEmpty) ...[
              const Text(
                'Caractéristiques',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Table(
                border: TableBorder.all(color: Colors.white24),
                columnWidths: const {
                  0: FlexColumnWidth(1),
                  1: FlexColumnWidth(2),
                },
                children: product.specs
                    .map((spec) => TableRow(children: [
                          Padding(
                            padding: const EdgeInsets.all(8),
                            child: Text(
                              spec.label,
                              style: const TextStyle(color: Colors.white70),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(8),
                            child: Text(
                              spec.value,
                              style: const TextStyle(color: Colors.white),
                            ),
                          ),
                        ]))
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
