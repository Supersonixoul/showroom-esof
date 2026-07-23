import 'dart:async';

import 'package:flutter/material.dart';

import '../services/auth_session.dart';
import '../services/catalog_repository.dart';
import '../theme/app_colors.dart';
import 'brands_screen.dart';
import 'categories_screen.dart';
import 'characteristics_screen.dart';
import 'clients_list_screen.dart';
import 'login_screen.dart';
import 'server_settings_screen.dart';

/// Écran d'accueil du mode client (spec §6.2) : hero de marque, accès
/// rapides (Catégories / Marques / Caractéristiques) et bandeau des marques
/// partenaires.
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
      appBar: AppBar(
        title: const Text('ESOF Showroom'),
        actions: [
          IconButton(
            icon: const Icon(Icons.work_outline),
            tooltip: 'Espace commercial',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => AuthSession.instance.currentUser.value != null
                    ? const ClientsListScreen()
                    : const LoginScreen(),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Réglages du serveur',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ServerSettingsScreen()),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: const [
            _HeroHeader(),
            _QuickAccessSection(),
            _SectionTitle('Nos grandes marques'),
            Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: _BrandsCarousel(),
            ),
            _Footer(),
          ],
        ),
      ),
    );
  }
}

/// En-tête héro : dégradé navy → bleu, logo ESOF sur carte blanche, slogan.
/// Animation d'entrée (fondu + léger slide vers le haut) jouée une seule fois.
class _HeroHeader extends StatefulWidget {
  const _HeroHeader();

  @override
  State<_HeroHeader> createState() => _HeroHeaderState();
}

class _HeroHeaderState extends State<_HeroHeader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(
        position: _slide,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 40),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: AppColors.heroGradient,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.only(
              bottomLeft: Radius.circular(24),
              bottomRight: Radius.circular(24),
            ),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.15),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Image.asset(
                  'assets/images/logo_esof.png',
                  height: 72,
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) => const Text(
                    'ESOF',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: AppColors.navy,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                "Distributeur agréé d'équipements électriques de grandes marques",
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w300,
                  letterSpacing: 2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Rangée des 3 accès rapides (Catégories / Marques / Caractéristiques),
/// branchée sur les écrans existants.
class _QuickAccessSection extends StatelessWidget {
  const _QuickAccessSection();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: _QuickAccessCard(
              icon: Icons.category,
              label: 'Catégories',
              color: AppColors.blueAccent,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const CategoriesScreen(
                    parentId: null,
                    title: 'Catégories',
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _QuickAccessCard(
              icon: Icons.business,
              label: 'Marques',
              color: AppColors.orangeAccent,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const BrandsScreen()),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _QuickAccessCard(
              icon: Icons.tune,
              label: 'Caractéristiques',
              color: AppColors.blueAccent,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const CharacteristicsScreen(),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickAccessCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAccessCard({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      elevation: 2,
      shadowColor: Colors.black26,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 26),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
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

/// Carrousel horizontal auto-défilant (lent, continu, en boucle) des logos
/// des marques partenaires. Se met en pause quand l'utilisateur touche/scroll
/// manuellement, reprend après un court délai d'inactivité.
class _BrandsCarousel extends StatefulWidget {
  const _BrandsCarousel();

  @override
  State<_BrandsCarousel> createState() => _BrandsCarouselState();
}

class _BrandsCarouselState extends State<_BrandsCarousel> {
  static const _brands = [
    _BrandAsset('Legrand', 'assets/images/logo_legrand.png'),
    _BrandAsset('Schneider', 'assets/images/logo_schneider.png'),
    _BrandAsset('Philips', 'assets/images/logo_philips.png'),
    _BrandAsset('Vatan Kablo', 'assets/images/logo_vatan.jpg'),
    _BrandAsset('Ingelec', 'assets/images/logo_ingelec.png'),
    _BrandAsset('V-TAC', 'assets/images/logo_vtac.png'),
  ];

  static const double _cardWidth = 130;
  static const double _cardMargin = 8;
  static const double _itemExtent = _cardWidth + _cardMargin * 2;
  // Grand mais fini (~16 h de défilement continu avant répétition réelle) :
  // suffisant pour donner l'illusion d'une boucle infinie sans souci de
  // précision flottante sur `jumpTo`.
  static const int _loopMultiplier = 2000;

  final ScrollController _controller = ScrollController();
  Timer? _timer;
  bool _paused = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 30), (_) {
      if (_paused || !_controller.hasClients) return;
      _controller.jumpTo(_controller.offset + 0.6);
    });
  }

  void _pause() => setState(() => _paused = true);

  void _scheduleResume() {
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _paused = false);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 96,
      child: NotificationListener<ScrollNotification>(
        onNotification: (notification) {
          if (notification is ScrollStartNotification &&
              notification.dragDetails != null) {
            _pause();
          } else if (notification is ScrollEndNotification) {
            _scheduleResume();
          }
          return false;
        },
        child: ListView.builder(
          controller: _controller,
          scrollDirection: Axis.horizontal,
          itemExtent: _itemExtent,
          itemCount: _brands.length * _loopMultiplier,
          itemBuilder: (context, index) {
            final brand = _brands[index % _brands.length];
            return _BrandCard(brand: brand, width: _cardWidth, margin: _cardMargin);
          },
        ),
      ),
    );
  }
}

class _BrandCard extends StatelessWidget {
  final _BrandAsset brand;
  final double width;
  final double margin;

  const _BrandCard({
    required this.brand,
    required this.width,
    required this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      margin: EdgeInsets.symmetric(horizontal: margin),
      padding: const EdgeInsets.all(16),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Image.asset(
        brand.assetPath,
        height: 48,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) => Text(
          brand.name,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 12,
            color: AppColors.navy,
          ),
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
