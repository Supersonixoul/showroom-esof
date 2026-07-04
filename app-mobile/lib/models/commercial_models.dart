/// Note de visite associée à une fiche client (spec §4.4).
class ClientNote {
  final String id;
  final String note;
  final DateTime visitDate;
  final DateTime createdAt;

  ClientNote({
    required this.id,
    required this.note,
    required this.visitDate,
    required this.createdAt,
  });

  factory ClientNote.fromJson(Map<String, dynamic> json) => ClientNote(
        id: json['id'] as String,
        note: json['note'] as String,
        visitDate: DateTime.parse(json['visitDate'] as String),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

/// Ligne d'un devis (spec §4.5) — prix saisi librement par le commercial.
class QuoteItem {
  final String id;
  final String productId;
  final String productName;
  final String? productReference;
  final int quantity;
  final double unitPrice;
  final String? note;

  QuoteItem({
    required this.id,
    required this.productId,
    required this.productName,
    this.productReference,
    required this.quantity,
    required this.unitPrice,
    this.note,
  });

  double get lineTotal => unitPrice * quantity;

  factory QuoteItem.fromJson(Map<String, dynamic> json) {
    final product = json['product'] as Map<String, dynamic>?;
    return QuoteItem(
      id: json['id'] as String,
      productId: json['productId'] as String,
      productName: product?['name'] as String? ?? '',
      productReference: product?['reference'] as String?,
      quantity: json['quantity'] as int,
      unitPrice: double.parse(json['unitPrice'].toString()),
      note: json['note'] as String?,
    );
  }
}

/// Devis (spec §4.5) — modèle unique couvrant la vue liste (`_count.items`,
/// pas de lignes chargées) et la vue détail (`items` complets).
class Quote {
  final String id;
  final String clientId;
  final String status;
  final DateTime createdAt;
  final String? clientName;
  final int itemCount;
  final List<QuoteItem> items;

  Quote({
    required this.id,
    required this.clientId,
    required this.status,
    required this.createdAt,
    this.clientName,
    required this.itemCount,
    this.items = const [],
  });

  double get total =>
      items.fold(0.0, (sum, item) => sum + item.lineTotal);

  factory Quote.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'] as List<dynamic>?;
    final items = itemsJson
            ?.map((i) => QuoteItem.fromJson(i as Map<String, dynamic>))
            .toList() ??
        const <QuoteItem>[];
    final client = json['client'] as Map<String, dynamic>?;
    final count = json['_count'] as Map<String, dynamic>?;
    return Quote(
      id: json['id'] as String,
      clientId: json['clientId'] as String,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      clientName: client?['name'] as String?,
      itemCount: (count?['items'] as int?) ?? items.length,
      items: items,
    );
  }
}

/// Fiche client (spec §4.3) — `notes`/`quotes` ne sont peuplées que par
/// `GET /clients/:id` (fiche détaillée), pas par la liste.
class Client {
  final String id;
  final String name;
  final String phone;
  final String? email;
  final String? company;
  final DateTime createdAt;
  final List<ClientNote> notes;
  final List<Quote> quotes;

  Client({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    this.company,
    required this.createdAt,
    this.notes = const [],
    this.quotes = const [],
  });

  factory Client.fromJson(Map<String, dynamic> json) {
    final notesJson = json['notes'] as List<dynamic>?;
    final quotesJson = json['quotes'] as List<dynamic>?;
    return Client(
      id: json['id'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String,
      email: json['email'] as String?,
      company: json['company'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      notes: notesJson
              ?.map((n) => ClientNote.fromJson(n as Map<String, dynamic>))
              .toList() ??
          const [],
      quotes: quotesJson
              ?.map((q) => Quote.fromJson(q as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }
}
