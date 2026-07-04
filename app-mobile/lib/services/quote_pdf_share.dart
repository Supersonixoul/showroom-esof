import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'commercial_api_service.dart';

/// Télécharge le PDF généré côté serveur (spec §5.4, GET /quotes/:id/pdf)
/// et ouvre le menu de partage natif (WhatsApp, email, enregistrement local
/// — spec §6.3, "un seul mécanisme couvre les deux besoins de diffusion").
Future<void> shareQuotePdf(String token, String quoteId) async {
  final bytes = await CommercialApiService().fetchQuotePdf(token, quoteId);
  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}/devis-$quoteId.pdf');
  await file.writeAsBytes(bytes, flush: true);
  await Share.shareXFiles([XFile(file.path)], text: 'Devis ESOF');
}
