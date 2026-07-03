import 'package:flutter/material.dart';

import '../services/catalog_repository.dart';
import 'brands_screen.dart';
import 'categories_screen.dart';
import 'characteristics_screen.dart';

/// Point d'entrée du mode Catalogue (spec §6.1) : Menu Général avec les
/// trois axes de navigation (Marques / Catégories / Caractéristiques).
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
