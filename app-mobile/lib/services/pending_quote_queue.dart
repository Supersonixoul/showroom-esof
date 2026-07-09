import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'auth_session.dart';
import 'commercial_api_service.dart';
import 'database_service.dart';

/// File d'attente hors-ligne pour les devis (spec §6.3, Sprint 10) : un
/// devis créé sans réseau est conservé localement (SQLite) puis envoyé
/// automatiquement dès le retour de la connexion. Pas de détection réseau
/// native (pour rester simple) : un cycle périodique retente l'envoi, et
/// s'arrête au premier échec du lot (probablement encore hors-ligne).
class PendingQuoteQueue {
  PendingQuoteQueue._internal();
  static final PendingQuoteQueue instance = PendingQuoteQueue._internal();

  static const _flushInterval = Duration(seconds: 30);

  final CommercialApiService _api = CommercialApiService();
  final DatabaseService _db = DatabaseService.instance;

  final ValueNotifier<int> pendingCount = ValueNotifier<int>(0);

  Timer? _timer;

  Future<void> enqueue({
    required String clientId,
    required List<Map<String, dynamic>> items,
  }) async {
    final id = 'local-${DateTime.now().microsecondsSinceEpoch}';
    await _db.enqueuePendingQuote(
      id: id,
      clientId: clientId,
      itemsJson: jsonEncode(items),
    );
    await _refreshCount();
  }

  /// Démarre le cycle de purge périodique. Idempotent : un seul timer actif.
  void startFlushLoop() {
    _timer ??= Timer.periodic(_flushInterval, (_) => flush());
    flush();
  }

  Future<void> flush() async {
    final token = AuthSession.instance.currentUser.value?.token;
    if (token == null) {
      await _refreshCount();
      return;
    }
    final pending = await _db.getPendingQuotes();
    for (final row in pending) {
      try {
        final items = (jsonDecode(row['itemsJson'] as String) as List<dynamic>)
            .cast<Map<String, dynamic>>();
        await _api.createQuote(
          token,
          clientId: row['clientId'] as String,
          items: items,
        );
        await _db.removePendingQuote(row['id'] as String);
      } catch (_) {
        // Toujours hors-ligne (ou serveur indisponible) : on arrête ce cycle,
        // le prochain réessaiera l'intégralité de la file.
        break;
      }
    }
    await _refreshCount();
  }

  Future<void> _refreshCount() async {
    pendingCount.value = (await _db.getPendingQuotes()).length;
  }
}
