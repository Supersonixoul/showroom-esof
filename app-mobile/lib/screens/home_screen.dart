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
            const _SloganBanner(),
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
/// Le slogan est porté par [_SloganBanner], juste en dessous.
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

/// Bannière fine (dégradé navy → bleu) portant le slogan, juste sous l'en-tête
/// logo. Ne défile pas avec le contenu.
class _SloganBanner extends StatelessWidget {
  const _SloganBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: AppColors.heroGradient,
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
      ),
      child: const Text(
        "Distributeur agréé d'équipements électriques de grandes marques",
        textAlign: TextAlign.center,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: Colors.white,
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
          height: 1.2,
        ),
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

enum _FeaturedKind { newProduct, promo, sale }

/// Section « Mis en avant », affichée juste sous la bannière de slogan :
/// jusqu'à 3 blocs (Nouveautés / Promotions / Soldes) alimentés par
/// `GET /catalog/featured`. Un bloc n'est affiché que s'il contient des
/// produits ; la section entière est masquée si les 3 blocs sont vides ou
/// en cas d'échec réseau (échec silencieux, pas de bannière d'erreur).
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (data.newProducts.isNotEmpty)
          _FeaturedBlock(
            title: 'Nouveautés',
            color: AppColors.featuredNew,
            products: data.newProducts,
            kind: _FeaturedKind.newProduct,
          ),
        if (data.promotions.isNotEmpty)
          _FeaturedBlock(
            title: 'Promotions',
            color: AppColors.featuredPromo,
            products: data.promotions,
            kind: _FeaturedKind.promo,
          ),
        if (data.sales.isNotEmpty)
          _FeaturedBlock(
            title: 'Soldes',
            color: AppColors.featuredSale,
            products: data.sales,
            kind: _FeaturedKind.sale,
          ),
        const SizedBox(height: 8),
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
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            children: [
              Container(
                width: 4,
                height: 20,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 190,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
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
        width: 130,
        margin: const EdgeInsets.only(right: 10),
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Container(
                height: 90,
                width: double.infinity,
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
            const SizedBox(height: 6),
            Text(
              product.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
            const Spacer(),
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
