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
  final ApiService _api = ApiService();
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  bool _searchLoading = false;
  List<FeaturedProduct>? _searchResults;

  @override
  void initState() {
    super.initState();
    CatalogRepository.instance.ensureInitialized();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    final query = value.trim();
    setState(() => _query = query);
    if (query.length < 2) {
      setState(() {
        _searchResults = null;
        _searchLoading = false;
      });
      return;
    }
    _debounce = Timer(
      const Duration(milliseconds: 400),
      () => _runSearch(query),
    );
  }

  Future<void> _runSearch(String query) async {
    setState(() => _searchLoading = true);
    try {
      final results = await _api.searchProducts(query);
      if (!mounted || query != _query) return;
      setState(() {
        _searchResults = results;
        _searchLoading = false;
      });
    } catch (_) {
      if (!mounted || query != _query) return;
      setState(() {
        _searchResults = [];
        _searchLoading = false;
      });
    }
  }

  void _clearSearch() {
    _debounce?.cancel();
    _searchController.clear();
    setState(() {
      _query = '';
      _searchResults = null;
      _searchLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final showResults = _query.length >= 2;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            _CompactHeader(
              controller: _searchController,
              onChanged: _onSearchChanged,
              onClear: _clearSearch,
            ),
            Expanded(
              child: showResults
                  ? _SearchResultsSection(
                      loading: _searchLoading,
                      results: _searchResults,
                    )
                  : SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: const [
                          _FeaturedSection(),
                          _CatalogCard(),
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

/// En-tête compact : logo (agrandi) à gauche, barre de recherche produit,
/// accès « plus » (espace commercial / marques / caractéristiques) et
/// réglages du serveur à droite.
class _CompactHeader extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  const _CompactHeader({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
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
          const SizedBox(width: 10),
          Expanded(
            child: SizedBox(
              height: 42,
              child: AnimatedBuilder(
                animation: controller,
                builder: (context, _) {
                  return TextField(
                    controller: controller,
                    onChanged: onChanged,
                    textAlignVertical: TextAlignVertical.center,
                    style: const TextStyle(fontSize: 14),
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: 'Rechercher un produit...',
                      hintStyle: TextStyle(
                        fontSize: 13,
                        color: Colors.grey.shade500,
                      ),
                      prefixIcon: const Icon(
                        Icons.search,
                        size: 20,
                        color: Colors.grey,
                      ),
                      suffixIcon: controller.text.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(
                                Icons.clear,
                                size: 18,
                                color: Colors.grey,
                              ),
                              onPressed: onClear,
                            ),
                      filled: true,
                      fillColor: Colors.grey.shade100,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(30),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
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
const int _kVisibleCategoryColumns = 3;
const double _kCatalogCardRadius = 12;

/// Padding horizontal partagé entre la carte « Catalogue » et le carrousel
/// « Nouveau »/« Promotion » afin que les deux sections soient parfaitement
/// alignées (mêmes bords gauche/droit).
const double kHorizontalPadding = 16;

/// Carte « Catalogue » : la grille des catégories encadrée d'un rectangle
/// arrondi (même rayon que les cartes du carrousel), avec le titre posé sur
/// la bordure supérieure façon <fieldset><legend>. Défilement horizontal
/// PAR COLONNE (3 colonnes visibles, 4 lignes chacune) piloté par deux
/// flèches discrètes posées sur les bordures gauche/droite, synchronisées
/// avec le scroll au doigt.
class _CatalogCard extends StatefulWidget {
  const _CatalogCard();

  @override
  State<_CatalogCard> createState() => _CatalogCardState();
}

class _CatalogCardState extends State<_CatalogCard> {
  static const _rows = 4;
  static const _columnGap = 8.0;
  static const _rowGap = 4.0;
  static const _cardPadding = 14.0;

  final ScrollController _scrollController = ScrollController();
  bool _timedOut = false;
  Timer? _timeoutTimer;
  int _columnIndex = 0;
  int _totalColumns = 0;
  double _columnStep = 0;

  @override
  void initState() {
    super.initState();
    _timeoutTimer = Timer(const Duration(seconds: 6), () {
      if (mounted) setState(() => _timedOut = true);
    });
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _timeoutTimer?.cancel();
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  int get _maxIndex {
    final max = _totalColumns - _kVisibleCategoryColumns;
    return max < 0 ? 0 : max;
  }

  int _clampIndex(int value) {
    if (value < 0) return 0;
    if (value > _maxIndex) return _maxIndex;
    return value;
  }

  void _onScroll() {
    if (_columnStep <= 0) return;
    final index = _clampIndex((_scrollController.offset / _columnStep).round());
    if (index != _columnIndex) {
      setState(() => _columnIndex = index);
    }
  }

  void _goToColumn(int index) {
    if (_columnStep <= 0 || !_scrollController.hasClients) return;
    final clamped = _clampIndex(index);
    _scrollController.animateTo(
      clamped * _columnStep,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(kHorizontalPadding, 4, kHorizontalPadding, 0),
      child: LayoutBuilder(
        builder: (context, outerConstraints) {
          // Largeur de tuile calculée pour que 3 colonnes soient toujours
          // entièrement visibles (pas de colonne tronquée).
          final contentWidth = outerConstraints.maxWidth - 2 * _cardPadding;
          final tileWidth = (contentWidth -
                  (_kVisibleCategoryColumns - 1) * _columnGap) /
              _kVisibleCategoryColumns;

          return ValueListenableBuilder<CatalogSnapshot>(
            valueListenable: CatalogRepository.instance.snapshot,
            builder: (context, catalog, _) {
              final categories = catalog.categories
                  .where((c) => c.parentId == null)
                  .toList();
              final totalColumns =
                  categories.isEmpty ? 0 : (categories.length / _rows).ceil();
              _columnStep = tileWidth + _columnGap;
              _totalColumns = totalColumns;
              final showArrows = totalColumns > _kVisibleCategoryColumns;
              final canGoLeft = _columnIndex > 0;
              final canGoRight = _columnIndex < _maxIndex;

              Widget content;
              if (categories.isEmpty) {
                content = Padding(
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
              } else {
                content = SizedBox(
                  height: _rows * _kCategoryTileHeight,
                  child: GridView.builder(
                    controller: _scrollController,
                    scrollDirection: Axis.horizontal,
                    padding: EdgeInsets.zero,
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: _rows,
                      mainAxisSpacing: _columnGap,
                      crossAxisSpacing: _rowGap,
                      childAspectRatio: tileWidth / _kCategoryTileHeight,
                    ),
                    itemCount: categories.length,
                    itemBuilder: (context, index) => _HomeCategoryTile(
                      category: categories[index],
                      width: tileWidth,
                    ),
                  ),
                );
              }

              return Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    padding: const EdgeInsets.all(_cardPadding),
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius:
                          BorderRadius.circular(_kCatalogCardRadius),
                      border:
                          Border.all(color: Colors.grey.shade300, width: 1.2),
                    ),
                    child: content,
                  ),
                  Positioned(
                    left: kHorizontalPadding,
                    top: 2,
                    child: Container(
                      color: AppColors.background,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: const Text(
                        'Catalogue',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          color: AppColors.navy,
                        ),
                      ),
                    ),
                  ),
                  if (showArrows) ...[
                    Positioned(
                      right: -4,
                      top: 12,
                      bottom: 0,
                      child: Center(
                        child: _NavArrow(
                          icon: Icons.chevron_right,
                          visible: canGoRight,
                          onTap: () => _goToColumn(_columnIndex + 1),
                        ),
                      ),
                    ),
                    Positioned(
                      left: -4,
                      top: 12,
                      bottom: 0,
                      child: Center(
                        child: _NavArrow(
                          icon: Icons.chevron_left,
                          visible: canGoLeft,
                          onTap: () => _goToColumn(_columnIndex - 1),
                        ),
                      ),
                    ),
                  ],
                ],
              );
            },
          );
        },
      ),
    );
  }
}

/// Flèche discrète (cercle semi-transparent) réutilisée par la carte
/// « Catalogue » et le carrousel « Nouveau »/« Promotion » pour avancer/
/// reculer d'un pas (colonne ou carte).
class _NavArrow extends StatelessWidget {
  final IconData icon;
  final bool visible;
  final VoidCallback onTap;

  const _NavArrow({
    required this.icon,
    required this.visible,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      opacity: visible ? 1 : 0,
      duration: const Duration(milliseconds: 200),
      child: IgnorePointer(
        ignoring: !visible,
        child: Material(
          color: Colors.white.withOpacity(0.8),
          shape: const CircleBorder(),
          elevation: 1.5,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(
              width: 34,
              height: 34,
              child: Icon(icon, size: 20, color: AppColors.navy),
            ),
          ),
        ),
      ),
    );
  }
}

class _HomeCategoryTile extends StatelessWidget {
  final Category category;
  final double width;

  const _HomeCategoryTile({required this.category, this.width = _kCategoryTileWidth});

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
        width: width,
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
    _controller = PageController();
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

  void _goToPage(int index) {
    if (!_controller.hasClients) return;
    final clamped = index.clamp(0, widget.entries.length - 1);
    _onManualInteraction();
    _controller.animateToPage(
      clamped,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
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
          padding: const EdgeInsets.symmetric(horizontal: kHorizontalPadding),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              SizedBox(
                height: 112,
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
                      return _FeaturedProductCard(
                        product: entry.product,
                        accentColor: entry.kind == _FeaturedKind.promo
                            ? AppColors.featuredPromo
                            : AppColors.featuredNew,
                        kind: entry.kind,
                      );
                    },
                  ),
                ),
              ),
              if (widget.entries.length > 1) ...[
                Positioned(
                  right: -4,
                  top: 0,
                  bottom: 0,
                  child: Center(
                    child: _NavArrow(
                      icon: Icons.chevron_right,
                      visible: _page < widget.entries.length - 1,
                      onTap: () => _goToPage(_page + 1),
                    ),
                  ),
                ),
                Positioned(
                  left: -4,
                  top: 0,
                  bottom: 0,
                  child: Center(
                    child: _NavArrow(
                      icon: Icons.chevron_left,
                      visible: _page > 0,
                      onTap: () => _goToPage(_page - 1),
                    ),
                  ),
                ),
              ],
            ],
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
        height: 112,
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

/// Résultats de la recherche produit (remplace temporairement le contenu de
/// la Home pendant que la barre de recherche est active — voir
/// [_HomeScreenState]). Affiche un indicateur discret pendant le chargement,
/// un message dédié si la recherche ne retourne rien.
class _SearchResultsSection extends StatelessWidget {
  final bool loading;
  final List<FeaturedProduct>? results;

  const _SearchResultsSection({required this.loading, required this.results});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        Expanded(child: _buildBody()),
      ],
    );
  }

  Widget _buildBody() {
    final items = results;
    if (items == null && loading) return const SizedBox.shrink();
    if (items == null || items.isEmpty) {
      return const Center(
        child: Text(
          'Aucun produit trouvé',
          style: TextStyle(color: Colors.grey, fontSize: 14),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      itemCount: items.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, index) => _SearchResultCard(product: items[index]),
    );
  }
}

/// Carte résultat de recherche, même format paysage que le carrousel mis en
/// avant : image à gauche, désignation + référence (sous-titre) à droite.
class _SearchResultCard extends StatelessWidget {
  final FeaturedProduct product;

  const _SearchResultCard({required this.product});

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
    final imageUrl = product.image?.medium ?? product.image?.thumb;

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => _openDetail(context),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
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
                width: 72,
                height: 72,
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
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                  if (product.reference != null && product.reference!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      product.reference!,
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                    ),
                  ],
                  const SizedBox(height: 4),
                  if (product.price != null)
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
