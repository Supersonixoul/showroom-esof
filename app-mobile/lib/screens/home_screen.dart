import 'dart:async';

import 'package:flutter/material.dart';

import '../models/catalog_models.dart';
import '../services/api_service.dart';
import '../services/auth_session.dart';
import '../services/catalog_repository.dart';
import '../theme/app_colors.dart';
import 'brands_screen.dart';
import 'categories_screen.dart';
import 'characteristics_screen.dart';
import 'clients_list_screen.dart';
import 'login_screen.dart';
import 'product_detail_screen.dart';
import 'server_settings_screen.dart';

/// Écran d'accueil du mode client (spec §6.2) : en-tête compact (logo +
/// slogan + accès réglages), grille de catégories et bandeau des marques
/// partenaires. Le pied de page reste toujours collé au bas de l'écran.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    CatalogRepository.instance.ensureInitialized();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            const _CompactHeader(),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: const [
                    _FeaturedSection(),
                    SizedBox(height: 16),
                    _CategoriesSection(),
                    SizedBox(height: 28),
                    _SectionTitle('Nos grandes marques'),
                    Padding(
                      padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
                      child: _BrandsGrid(),
                    ),
                  ],
                ),
              ),
            ),
            const _Footer(),
          ],
        ),
      ),
    );
  }
}

/// En-tête compact : logo (agrandi) à gauche, accès « plus » (espace
/// commercial / marques / caractéristiques) et réglages du serveur à droite.
class _CompactHeader extends StatelessWidget {
  const _CompactHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 8, 4, 8),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Image.asset(
            'assets/images/logo_esof.png',
            height: 80,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) => const Text(
              'ESOF',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: AppColors.navy,
              ),
            ),
          ),
          const Spacer(),
          PopupMenuButton<int>(
            icon: const Icon(Icons.more_vert, color: AppColors.navy),
            tooltip: 'Plus',
            onSelected: (value) {
              switch (value) {
                case 0:
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) =>
                          AuthSession.instance.currentUser.value != null
                              ? const ClientsListScreen()
                              : const LoginScreen(),
                    ),
                  );
                  break;
                case 1:
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const BrandsScreen()),
                  );
                  break;
                case 2:
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const CharacteristicsScreen(),
                    ),
                  );
                  break;
              }
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 0, child: Text('Espace commercial')),
              PopupMenuItem(value: 1, child: Text('Marques')),
              PopupMenuItem(value: 2, child: Text('Caractéristiques')),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: AppColors.navy),
            tooltip: 'Réglages du serveur',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ServerSettingsScreen()),
            ),
          ),
        ],
      ),
    );
  }
}

const double _kCategoryTileWidth = 68;
const double _kCategoryTileHeight = 92;
const double _kCategoryThumbSize = 52;

/// Grille horizontale des catégories sur 4 lignes fixes, défilement
/// horizontal libre. Chargée depuis le catalogue déjà synchronisé via
/// [CatalogRepository] (lui-même basé sur l'adresse de [ServerConfig]).
class _CategoriesSection extends StatefulWidget {
  const _CategoriesSection();

  @override
  State<_CategoriesSection> createState() => _CategoriesSectionState();
}

class _CategoriesSectionState extends State<_CategoriesSection> {
  bool _timedOut = false;
  Timer? _timeoutTimer;

  @override
  void initState() {
    super.initState();
    _timeoutTimer = Timer(const Duration(seconds: 6), () {
      if (mounted) setState(() => _timedOut = true);
    });
  }

  @override
  void dispose() {
    _timeoutTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<CatalogSnapshot>(
      valueListenable: CatalogRepository.instance.snapshot,
      builder: (context, catalog, _) {
        final categories =
            catalog.categories.where((c) => c.parentId == null).toList();
        if (categories.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: _timedOut
                  ? const Text(
                      "Serveur injoignable — impossible de charger les catégories",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey, fontSize: 13),
                    )
                  : const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
            ),
          );
        }
        const rows = 4;
        return SizedBox(
          height: rows * _kCategoryTileHeight,
          child: GridView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: rows,
              mainAxisSpacing: 4,
              crossAxisSpacing: 8,
              childAspectRatio: _kCategoryTileWidth / _kCategoryTileHeight,
            ),
            itemCount: categories.length,
            itemBuilder: (context, index) =>
                _HomeCategoryTile(category: categories[index]),
          ),
        );
      },
    );
  }
}

class _HomeCategoryTile extends StatelessWidget {
  final Category category;

  const _HomeCategoryTile({required this.category});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => CategoriesScreen(
            parentId: category.id,
            title: category.name,
          ),
        ),
      ),
      child: SizedBox(
        width: _kCategoryTileWidth,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: _buildThumbnail(),
            ),
            const SizedBox(height: 6),
            Text(
              category.name,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
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
      width: _kCategoryThumbSize,
      height: _kCategoryThumbSize,
      fit: BoxFit.cover,
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return _placeholder(loading: true);
      },
      errorBuilder: (context, error, stackTrace) => _placeholder(),
    );
  }

  Widget _placeholder({bool loading = false}) {
    return Container(
      width: _kCategoryThumbSize,
      height: _kCategoryThumbSize,
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(12),
      ),
      alignment: Alignment.center,
      child: loading
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(Icons.category, color: Colors.grey.shade500, size: 26),
    );
  }
}

/// Titre de section avec petit trait orange décoratif à gauche.
class _SectionTitle extends StatelessWidget {
  final String title;

  const _SectionTitle(this.title);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 20,
            decoration: BoxDecoration(
              color: AppColors.orangeAccent,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            title,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}

class _BrandAsset {
  final String name;
  final String assetPath;

  const _BrandAsset(this.name, this.assetPath);
}

const _kBrands = [
  _BrandAsset('Legrand', 'assets/images/logo_legrand.png'),
  _BrandAsset('Schneider', 'assets/images/logo_schneider.png'),
  _BrandAsset('Philips', 'assets/images/logo_philips.png'),
  _BrandAsset('Vatan Kablo', 'assets/images/logo_vatan.jpg'),
  _BrandAsset('Ingelec', 'assets/images/logo_ingelec.png'),
  _BrandAsset('V-TAC', 'assets/images/logo_vtac.png'),
];

/// Grille statique (non défilante) des logos des marques partenaires,
/// 4 par ligne. Remplace l'ancien carrousel auto-défilant.
class _BrandsGrid extends StatelessWidget {
  const _BrandsGrid();

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      childAspectRatio: 1.6,
      children: [
        for (final brand in _kBrands) _BrandCard(brand: brand),
      ],
    );
  }
}

class _BrandCard extends StatelessWidget {
  final _BrandAsset brand;

  const _BrandCard({required this.brand});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(6),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Image.asset(
        brand.assetPath,
        height: 20,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) => Text(
          brand.name,
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 10,
            color: AppColors.navy,
          ),
        ),
      ),
    );
  }
}

enum _FeaturedKind { newProduct, promo }

/// Une entrée du carrousel fusionné : un produit et son étiquette
/// (nouveau/promo). Si un produit est présent à la fois dans les
/// nouveautés et les promotions, seule l'étiquette « promo » est retenue
/// (voir [_buildFeaturedEntries]).
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
  final maxLen = newItems.length > promoItems.length
      ? newItems.length
      : promoItems.length;
  for (var i = 0; i < maxLen; i++) {
    if (i < newItems.length) merged.add(newItems[i]);
    if (i < promoItems.length) merged.add(promoItems[i]);
  }
  return merged;
}

/// Section « Mis en avant », affichée juste sous la bannière de slogan :
/// un unique carrousel pleine largeur mélangeant nouveautés et
/// promotions, alimenté par `GET /catalog/featured`. Masquée si la liste
/// fusionnée est vide ou en cas d'échec réseau (échec silencieux, pas de
/// bannière d'erreur).
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
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: SizedBox(
            width: 24,
            height: 24,
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
/// les 4 secondes, se met en pause pendant une interaction manuelle et
/// reprend après ~5 secondes d'inactivité ; boucle en fin de liste. Pas de
/// défilement auto si 0 ou 1 entrée.
class _FeaturedCombinedCarousel extends StatefulWidget {
  final List<_FeaturedEntry> entries;

  const _FeaturedCombinedCarousel({required this.entries});

  @override
  State<_FeaturedCombinedCarousel> createState() =>
      _FeaturedCombinedCarouselState();
}

class _FeaturedCombinedCarouselState extends State<_FeaturedCombinedCarousel> {
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
    final color = isPromo ? AppColors.featuredPromo : AppColors.featuredNew;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: double.infinity,
          color: color,
          padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 16),
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
        ),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: SizedBox(
            height: 100,
            child: NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification is ScrollStartNotification &&
                    notification.dragDetails != null) {
                  _onManualInteraction();
                }
                return false;
              },
              child: PageView.builder(
                controller: _controller,
                itemCount: widget.entries.length,
                onPageChanged: (index) => setState(() => _page = index),
                itemBuilder: (context, index) {
                  final entry = widget.entries[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: _FeaturedProductCard(
                      product: entry.product,
                      accentColor: entry.kind == _FeaturedKind.promo
                          ? AppColors.featuredPromo
                          : AppColors.featuredNew,
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
    final reducedPrice =
        kind == _FeaturedKind.promo ? product.promoPrice : null;
    final imageUrl = product.image?.medium ?? product.image?.thumb;

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _openDetail(context),
      child: Container(
        height: 100,
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: accentColor.withOpacity(0.3)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: 84,
                height: 84,
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
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  if (reducedPrice != null && product.price != null) ...[
                    Text(
                      _formatPrice(product.price!),
                      style: const TextStyle(
                        fontSize: 10,
                        color: Colors.grey,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                    Text(
                      _formatPrice(reducedPrice),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: accentColor,
                      ),
                    ),
                  ] else if (product.price != null)
                    Text(
                      _formatPrice(product.price!),
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
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

class _Footer extends StatelessWidget {
  const _Footer();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: Text(
          'ESOF — Ouagadougou, Burkina Faso',
          style: TextStyle(color: Colors.grey, fontSize: 12),
        ),
      ),
    );
  }
}
