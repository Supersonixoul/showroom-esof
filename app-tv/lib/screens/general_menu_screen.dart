import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/catalog_models.dart';
import '../services/api_service.dart';
import '../services/catalog_repository.dart';
import '../widgets/tv_focusable.dart';
import 'brands_screen.dart';
import 'categories_screen.dart';
import 'characteristics_screen.dart';
import 'product_detail_screen.dart';
import 'product_list_screen.dart';

/// Point d'entrée du mode Catalogue (spec §6.1) : Menu Général avec le
/// carrousel « Mis en avant » (Nouveau/Promotion) et la grille des
/// catégories directement visibles à l'écran, les trois axes de navigation
/// (Marques / Catégories / Caractéristiques) et une grille statique des
/// marques.
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
            const SizedBox(height: 8),
            const _CategoriesGridSection(),
            const SizedBox(height: 8),
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
    return TvFocusable(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
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

/// Grille des catégories racines, directement visible sur l'Accueil (comme
/// sur mobile). Nombre de colonnes adapté à la largeur disponible (format TV
/// paysage : plus de colonnes que sur mobile). Chaque vignette est focusable
/// au D-pad (voir [TvFocusable]).
class _CategoriesGridSection extends StatelessWidget {
  const _CategoriesGridSection();

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<CatalogSnapshot>(
      valueListenable: CatalogRepository.instance.snapshot,
      builder: (context, catalog, _) {
        final categories =
            catalog.categories.where((c) => c.parentId == null).toList();
        if (categories.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _SectionHeading(title: 'Catégories'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  const tileWidth = 190.0;
                  final crossAxisCount =
                      (constraints.maxWidth / tileWidth).floor().clamp(3, 6);
                  return GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: crossAxisCount,
                      mainAxisSpacing: 16,
                      crossAxisSpacing: 16,
                      childAspectRatio: 0.85,
                    ),
                    itemCount: categories.length,
                    itemBuilder: (context, index) => _TvCategoryTile(
                      category: categories[index],
                      autofocus: index == 0,
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}

class _TvCategoryTile extends StatelessWidget {
  final Category category;
  final bool autofocus;

  const _TvCategoryTile({required this.category, this.autofocus = false});

  @override
  Widget build(BuildContext context) {
    return TvFocusable(
      borderRadius: BorderRadius.circular(14),
      autofocus: autofocus,
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => CategoriesScreen(
            parentId: category.id,
            title: category.name,
          ),
        ),
      ),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white10,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: _buildThumbnail(),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              category.name,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildThumbnail() {
    final url = category.imageUrl;
    if (url == null || url.isEmpty) return _placeholder();
    return Image.network(
      ApiService.mediaUrl(url),
      fit: BoxFit.cover,
      width: double.infinity,
      errorBuilder: (context, error, stackTrace) => _placeholder(),
    );
  }

  Widget _placeholder() {
    return Container(
      color: Colors.black26,
      alignment: Alignment.center,
      child: const Icon(Icons.category, color: Colors.white38, size: 40),
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
    return TvFocusable(
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

enum _FeaturedKind { newProduct, promo }

/// Une entrée du carrousel fusionné : un produit et son étiquette
/// (nouveau/promo). Si un produit est présent à la fois dans les
/// nouveautés et les promotions, seule l'étiquette « promo » est retenue
/// (voir [_buildFeaturedEntries]) — même logique que la Home mobile.
class _FeaturedEntry {
  final FeaturedProduct product;
  final _FeaturedKind kind;

  const _FeaturedEntry({required this.product, required this.kind});
}

/// Fusionne nouveautés et promotions en une seule liste, intercalées
/// (nouveau, promo, nouveau, promo…) ; une fois l'une des deux listes
/// épuisée, le reste de l'autre est simplement concaténé. Un produit
/// présent dans les deux listes n'apparaît qu'une fois, étiqueté « promo »
/// (priorité à la promotion).
List<_FeaturedEntry> _buildFeaturedEntries(FeaturedProducts data) {
  final promoIds = data.promotions.map((p) => p.id).toSet();
  final newItems = data.newProducts
      .where((p) => !promoIds.contains(p.id))
      .map((p) => _FeaturedEntry(product: p, kind: _FeaturedKind.newProduct))
      .toList();
  final promoItems = data.promotions
      .map((p) => _FeaturedEntry(product: p, kind: _FeaturedKind.promo))
      .toList();

  final merged = <_FeaturedEntry>[];
  final maxLen =
      newItems.length > promoItems.length ? newItems.length : promoItems.length;
  for (var i = 0; i < maxLen; i++) {
    if (i < newItems.length) merged.add(newItems[i]);
    if (i < promoItems.length) merged.add(promoItems[i]);
  }
  return merged;
}

/// Section « Mis en avant » du Menu Général : un unique carrousel pleine
/// largeur mélangeant nouveautés et promotions, alimenté par
/// `GET /catalog/featured` (même source et même logique que la Home
/// mobile). Masquée si la liste fusionnée est vide ou en cas d'échec réseau
/// (échec silencieux).
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

    final entries = _buildFeaturedEntries(data);
    if (entries.isEmpty) return const SizedBox.shrink();

    return _FeaturedCombinedCarousel(entries: entries);
  }
}

/// Bande + carrousel fusionnés : la bande affiche « Nouveau » (vert) ou
/// « Promotion » (orange) selon la carte actuellement visible, avec une
/// transition douce (~300 ms). Le carrousel défile automatiquement toutes
/// les 4 secondes et boucle en fin de liste. Pas de défilement auto si 0 ou
/// 1 entrée. Sur TV (pas d'écran tactile), la navigation manuelle se fait au
/// D-pad gauche/droite quand le carrousel a le focus : elle met en pause le
/// défilement auto, qui reprend après ~5 secondes d'inactivité.
class _FeaturedCombinedCarousel extends StatefulWidget {
  final List<_FeaturedEntry> entries;

  const _FeaturedCombinedCarousel({required this.entries});

  @override
  State<_FeaturedCombinedCarousel> createState() =>
      _FeaturedCombinedCarouselState();
}

class _FeaturedCombinedCarouselState extends State<_FeaturedCombinedCarousel> {
  static const Color _newColor = Color(0xFF2E8B57);
  static const Color _promoColor = Color(0xFFE08A1E);

  late final PageController _controller;
  Timer? _autoTimer;
  Timer? _resumeTimer;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _controller = PageController(viewportFraction: 0.92);
    _startAutoScroll();
  }

  void _startAutoScroll() {
    _autoTimer?.cancel();
    if (widget.entries.length <= 1) return;
    _autoTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!_controller.hasClients) return;
      final next = (_page + 1) % widget.entries.length;
      _controller.animateToPage(
        next,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    });
  }

  void _onManualInteraction() {
    _autoTimer?.cancel();
    _resumeTimer?.cancel();
    _resumeTimer = Timer(const Duration(seconds: 5), () {
      if (mounted) _startAutoScroll();
    });
  }

  KeyEventResult _handleKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent || widget.entries.length <= 1) {
      return KeyEventResult.ignored;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowRight) {
      _onManualInteraction();
      final next = (_page + 1) % widget.entries.length;
      _controller.animateToPage(next,
          duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowLeft) {
      _onManualInteraction();
      final prev = (_page - 1 + widget.entries.length) % widget.entries.length;
      _controller.animateToPage(prev,
          duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  void dispose() {
    _autoTimer?.cancel();
    _resumeTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final current = widget.entries[_page.clamp(0, widget.entries.length - 1)];
    final isPromo = current.kind == _FeaturedKind.promo;
    final label = isPromo ? 'Promotion' : 'Nouveau';
    final color = isPromo ? _promoColor : _newColor;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: double.infinity,
          color: color,
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 24),
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 20,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Focus(
            onKeyEvent: _handleKey,
            child: SizedBox(
              height: 160,
              child: PageView.builder(
                controller: _controller,
                itemCount: widget.entries.length,
                onPageChanged: (index) => setState(() => _page = index),
                itemBuilder: (context, index) {
                  final entry = widget.entries[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: _FeaturedProductCard(
                      product: entry.product,
                      accentColor:
                          entry.kind == _FeaturedKind.promo ? _promoColor : _newColor,
                      kind: entry.kind,
                    ),
                  );
                },
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
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
    final reducedPrice = kind == _FeaturedKind.promo ? product.promoPrice : null;
    final imageUrl = product.image?.medium ?? product.image?.thumb;

    return TvFocusable(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _openDetail(context),
      child: Container(
        height: 160,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white10,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: accentColor.withOpacity(0.5)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Container(
                width: 136,
                height: 136,
                color: Colors.black26,
                alignment: Alignment.center,
                child: imageUrl == null
                    ? const Icon(Icons.image_outlined, color: Colors.white38, size: 40)
                    : Image.network(
                        ApiService.mediaUrl(imageUrl),
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) => const Icon(
                            Icons.image_outlined,
                            color: Colors.white38,
                            size: 40),
                      ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (reducedPrice != null && product.price != null) ...[
                    Text(
                      _formatPrice(product.price!),
                      style: const TextStyle(
                        fontSize: 14,
                        color: Colors.white54,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                    Text(
                      _formatPrice(reducedPrice),
                      style: TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold, color: accentColor),
                    ),
                  ] else if (product.price != null)
                    Text(
                      _formatPrice(product.price!),
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
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
