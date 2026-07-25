import 'package:flutter/material.dart';

import '../screens/commercial_login_screen.dart';
import '../services/commercial_session.dart';

/// Bouton de déconnexion de la rubrique "Traitement", présent dans l'AppBar
/// de tous les écrans de la rubrique — même principe que [ProLogoutAction].
class CommercialLogoutAction extends StatelessWidget {
  const CommercialLogoutAction({super.key});

  Future<void> _confirmAndLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Déconnexion'),
        content: const Text('Voulez-vous vraiment vous déconnecter ?'),
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
    await performCommercialLogout(context, message: 'Vous êtes déconnecté.');
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

/// Nettoie la session commercial (jeton + infos), puis redirige vers l'écran
/// de connexion en vidant la pile de navigation. Utilisé pour la
/// déconnexion explicite comme pour l'expiration de session (401).
Future<void> performCommercialLogout(BuildContext context, {required String message}) async {
  await CommercialSession.instance.logout();
  if (!context.mounted) return;
  Navigator.of(context).pushAndRemoveUntil(
    MaterialPageRoute(builder: (_) => const CommercialLoginScreen()),
    (route) => false,
  );
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

/// Vérifie qu'une session commercial est active au chargement d'un écran de
/// "Traitement" ; sinon redirige immédiatement vers l'écran de connexion.
void requireCommercialSession(BuildContext context) {
  if (CommercialSession.instance.currentCommercial.value != null) return;
  WidgetsBinding.instance.addPostFrameCallback((_) {
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const CommercialLoginScreen()),
      (route) => false,
    );
  });
}
