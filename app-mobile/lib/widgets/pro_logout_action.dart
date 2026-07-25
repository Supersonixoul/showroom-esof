import 'package:flutter/material.dart';

import '../screens/pro_login_screen.dart';
import '../services/order_cart.dart';
import '../services/pro_session.dart';

/// Bouton de déconnexion de l'Espace Pro ("Passer commande"), présent dans
/// l'AppBar de tous les écrans de la rubrique — spec « Déconnexion de
/// l'Espace Pro ».
class ProLogoutAction extends StatelessWidget {
  const ProLogoutAction({super.key});

  Future<void> _confirmAndLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Déconnexion'),
        content: const Text(
          'Voulez-vous vraiment vous déconnecter ? Le panier en cours sera vidé.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Se déconnecter'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await performProLogout(context, message: 'Vous êtes déconnecté.');
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.logout),
      tooltip: 'Se déconnecter',
      onPressed: () => _confirmAndLogout(context),
    );
  }
}

/// Nettoie la session Pro (jeton + infos) et le panier en cours, puis
/// redirige vers l'écran de connexion Pro en vidant la pile de navigation.
/// Utilisé pour la déconnexion explicite comme pour l'expiration de session
/// (401).
Future<void> performProLogout(BuildContext context, {required String message}) async {
  await ProSession.instance.logout();
  OrderCart.instance.clear();
  if (!context.mounted) return;
  Navigator.of(context).pushAndRemoveUntil(
    MaterialPageRoute(builder: (_) => const ProLoginScreen()),
    (route) => false,
  );
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

/// Vérifie qu'une session Pro est active au chargement d'un écran de
/// "Passer commande" ; sinon redirige immédiatement vers l'écran de
/// connexion (aucune commande ne doit être possible sans authentification).
void requireProSession(BuildContext context) {
  if (ProSession.instance.currentPro.value != null) return;
  WidgetsBinding.instance.addPostFrameCallback((_) {
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const ProLoginScreen()),
      (route) => false,
    );
  });
}
