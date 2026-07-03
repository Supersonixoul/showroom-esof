import 'package:flutter/material.dart';

import '../services/catalog_repository.dart';
import 'brands_screen.dart';
import 'categories_screen.dart';
import 'characteristics_screen.dart';

/// Écran d'accueil du mode client (spec §6.2) : accès direct aux trois axes
/// de navigation du catalogue (Marques / Catégories / Caractéristiques).
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
      appBar: AppBar(title: const Text('ESOF Showroom')),
      body: Center(
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
        width: 160,
        height: 160,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 48, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 12),
            Text(label, style: const TextStyle(fontSize: 18)),
          ],
        ),
      ),
    );
  }
}
