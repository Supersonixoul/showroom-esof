import 'dart:async';

import 'package:flutter/material.dart';

/// Clé de navigation globale, nécessaire pour pouvoir dépiler la pile de
/// routes (retour au mode ordinaire) depuis en dehors de l'arbre de widgets
/// (le timer d'inactivité).
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

/// Observe la pile de navigation pour savoir si l'app est en mode Catalogue
/// (profondeur > 1, on a quitté l'écran racine du carousel vidéo) ou en mode
/// ordinaire (racine).
class CatalogRouteObserver extends NavigatorObserver {
  final ValueNotifier<bool> inCatalogMode = ValueNotifier<bool>(false);
  int _depth = 1;

  void _update() => inCatalogMode.value = _depth > 1;

  @override
  void didPush(Route route, Route? previousRoute) {
    _depth++;
    _update();
  }

  @override
  void didPop(Route route, Route? previousRoute) {
    _depth--;
    _update();
  }

  @override
  void didRemove(Route route, Route? previousRoute) {
    _depth--;
    _update();
  }

  @override
  void didReplace({Route? newRoute, Route? oldRoute}) {
    _update();
  }
}

final CatalogRouteObserver catalogRouteObserver = CatalogRouteObserver();

/// Durée d'inactivité avant retour automatique au mode ordinaire, en mode
/// Catalogue (voir spec §6.1 : 90s par défaut, configurable).
const Duration catalogInactivityTimeout = Duration(seconds: 90);

/// Widget racine qui surveille l'activité utilisateur (tout appui/tap) et
/// ramène automatiquement au mode ordinaire après [catalogInactivityTimeout]
/// d'inactivité, tant que l'app est en mode Catalogue.
class InactivityGuard extends StatefulWidget {
  final Widget child;

  const InactivityGuard({super.key, required this.child});

  @override
  State<InactivityGuard> createState() => _InactivityGuardState();
}

class _InactivityGuardState extends State<InactivityGuard> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    catalogRouteObserver.inCatalogMode.addListener(_onModeChanged);
  }

  void _onModeChanged() {
    if (catalogRouteObserver.inCatalogMode.value) {
      _resetTimer();
    } else {
      _timer?.cancel();
    }
  }

  void _resetTimer() {
    _timer?.cancel();
    _timer = Timer(catalogInactivityTimeout, _returnToOrdinaryMode);
  }

  void _returnToOrdinaryMode() {
    final navigator = appNavigatorKey.currentState;
    navigator?.popUntil((route) => route.isFirst);
  }

  void _onUserActivity(PointerEvent _) {
    if (catalogRouteObserver.inCatalogMode.value) {
      _resetTimer();
    }
  }

  @override
  void dispose() {
    catalogRouteObserver.inCatalogMode.removeListener(_onModeChanged);
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: _onUserActivity,
      behavior: HitTestBehavior.translucent,
      child: widget.child,
    );
  }
}
