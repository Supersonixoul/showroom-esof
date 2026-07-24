import 'package:flutter/material.dart';

import '../models/catalog_models.dart';
import '../services/api_service.dart';
import '../services/catalog_repository.dart';
import 'brands_screen.dart';
import 'categories_screen.dart';
import 'characteristics_screen.dart';
import 'product_detail_screen.dart';
import 'product_list_screen.dart';

/// Point d'entrée du mode Catalogue (spec §6.1) : Menu Général avec les
/// trois axes de navigation (Marques / Catégories / Caractéristiques), une
/// grille statique des marques et le carrousel « Mis en avant ».
class GeneralMenuScreen extends StatefulWidget {
  const GeneralMenuScreen({super.key});

  @override
  State<GeneralMenuScreen> createState() => _GeneralMenuScreenState();
}

class _GeneralMenuScreenState extends State<GeneralMenuScreen> {
  @override
  void initState() {
    super.initState();
    CatalogRepository.instance.ensureInitialized();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Catalogue')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _FeaturedSection(),
            const _BrandsGrid(),
            const SizedBox(height: 8),
            Center(
              child: Wrap(
                spacing: 24,
                runSpacing: 24,
                alignment: WrapAlignment.center,
                children: [
                  _MenuTile(
                    icon: Icons.business,
                    label: 'Marques',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const BrandsScreen()),
                    ),
                  ),
                  _MenuTile(
                    icon: Icons.category,
                    label: 'Catégories',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const CategoriesScreen(
                          parentId: null,
                          title: 'Catégories',
                        ),
                      ),
                    ),
                  ),
                  _MenuTile(
                    icon: Icons.tune,
                    label: 'Caractéristiques',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const CharacteristicsScreen(),
                      ),
                    ),
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

class _MenuTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _MenuTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 220,
        height: 220,
        decoration: BoxDecoration(
          color: Colors.white10,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 64, color: Colors.white),
            const SizedBox(height: 16),
            Text(label, style: const TextStyle(fontSize: 22, color: Colors.white)),
          ],
        ),
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  final String title;
  final Color color;

  const _SectionHeading({required this.title, this.color = Colors.white});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 12),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 22,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            title,
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color),
          ),
        ],
      ),
    );
  }
}

/// Grille statique (non défilante) des logos de marques, 6 par ligne, issue
/// du catalogue synchronisé (`CatalogRepository`). Masquée s'il n'y a aucune
/// marque disponible.
class _BrandsGrid extends StatelessWidget {
  const _BrandsGrid();

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<CatalogSnapshot>(
      valueListenable: CatalogRepository.instance.snapshot,
      builder: (context, catalog, _) {
        if (catalog.brands.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _SectionHeading(title: 'Nos grandes marques'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: GridView.count(
                crossAxisCount: 6,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.4,
                children: [
                  for (final brand in catalog.brands)
                    _BrandCard(brand: brand, products: catalog.products),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _BrandCard extends StatelessWidget {
  final Brand brand;
  final List<Product> products;

  const _BrandCard({required this.brand, required this.products});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () {
        final brandProducts =
            products.where((p) => p.brandId == brand.id && p.isActive).toList();
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ProductListScreen(title: brand.name, products: brandProducts),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.white10,
          borderRadius: BorderRadius.circular(10),
        ),
        child: brand.logoUrl != null
            ? Image.network(
                ApiService.mediaUrl(brand.logoUrl!),
                height: 44,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) => _brandLabel(),
              )
            : _brandLabel(),
      ),
    );
  }

  Widget _brandLabel() => Text(
        brand.name,
        textAlign: TextAlign.center,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
      );
}

enum _FeaturedKind { newProduct, promo, sale }

/// Section « Mis en avant » du Menu Général : jusqu'à 3 blocs (Nouveautés /
/// Promotions / Soldes) alimentés par `GET /catalog/featured`. Un bloc n'est
/// affiché que s'il contient des produits ; la section entière est masquée
/// si les 3 blocs sont vides ou en cas d'échec réseau (échec silencieux).
class _FeaturedSection extends StatefulWidget {
  const _FeaturedSection();

  @override
  State<_FeaturedSection> createState() => _FeaturedSectionState();
}

class _FeaturedSectionState extends State<_FeaturedSection> {
  final ApiService _api = ApiService();
  bool _loading = true;
  FeaturedProducts? _data;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _api.fetchFeaturedProducts();
      if (mounted) {
        setState(() {
          _data = data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }
    final data = _data;
    if (data == null || data.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (data.newProducts.isNotEmpty)
          _FeaturedBlock(
            title: 'Nouveautés',
            color: const Color(0xFF2E8B57),
            products: data.newProducts,
            kind: _FeaturedKind.newProduct,
          ),
        if (data.promotions.isNotEmpty)
          _FeaturedBlock(
            title: 'Promotions',
            color: const Color(0xFFE08A1E),
            products: data.promotions,
            kind: _FeaturedKind.promo,
          ),
        if (data.sales.isNotEmpty)
          _FeaturedBlock(
            title: 'Soldes',
            color: const Color(0xFFC0392B),
            products: data.sales,
            kind: _FeaturedKind.sale,
          ),
      ],
    );
  }
}

class _FeaturedBlock extends StatelessWidget {
  final String title;
  final Color color;
  final List<FeaturedProduct> products;
  final _FeaturedKind kind;

  const _FeaturedBlock({
    required this.title,
    required this.color,
    required this.products,
    required this.kind,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionHeading(title: title, color: color),
        SizedBox(
          height: 250,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: products.length,
            itemBuilder: (context, index) => _FeaturedProductCard(
              product: products[index],
              accentColor: color,
              kind: kind,
            ),
          ),
        ),
      ],
    );
  }
}

class _FeaturedProductCard extends StatelessWidget {
  final FeaturedProduct product;
  final Color accentColor;
  final _FeaturedKind kind;

  const _FeaturedProductCard({
    required this.product,
    required this.accentColor,
    required this.kind,
  });

  String _formatPrice(double price) => '${price.toStringAsFixed(0)} FCFA';

  void _openDetail(BuildContext context) {
    final match = CatalogRepository.instance.snapshot.value.products
        .where((p) => p.id == product.id);
    if (match.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ProductDetailScreen(product: match.first)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final reducedPrice = kind == _FeaturedKind.promo
        ? product.promoPrice
        : kind == _FeaturedKind.sale
            ? product.salePrice
            : null;
    final imageUrl = product.image?.medium ?? product.image?.thumb;

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _openDetail(context),
      child: Container(
        width: 170,
        margin: const EdgeInsets.only(right: 16),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white10,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: accentColor.withOpacity(0.5)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Container(
                height: 120,
                width: double.infinity,
                color: Colors.black26,
                alignment: Alignment.center,
                child: imageUrl == null
                    ? const Icon(Icons.image_outlined, color: Colors.white38)
                    : Image.network(
                        ApiService.mediaUrl(imageUrl),
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) =>
                            const Icon(Icons.image_outlined, color: Colors.white38),
                      ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              product.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
            const Spacer(),
            if (reducedPrice != null && product.price != null) ...[
              Text(
                _formatPrice(product.price!),
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.white54,
                  decoration: TextDecoration.lineThrough,
                ),
              ),
              Text(
                _formatPrice(reducedPrice),
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: accentColor),
              ),
            ] else if (product.price != null)
              Text(
                _formatPrice(product.price!),
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
              ),
          ],
        ),
      ),
    );
  }
}
