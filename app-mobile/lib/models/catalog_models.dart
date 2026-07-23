class Brand {
  final String id;
  final String name;
  final String? logoUrl;

  Brand({required this.id, required this.name, this.logoUrl});

  factory Brand.fromJson(Map<String, dynamic> json) => Brand(
        id: json['id'] as String,
        name: json['name'] as String,
        logoUrl: json['logoUrl'] as String?,
      );

  factory Brand.fromMap(Map<String, dynamic> map) => Brand(
        id: map['id'] as String,
        name: map['name'] as String,
        logoUrl: map['logoUrl'] as String?,
      );

  Map<String, dynamic> toMap() => {'id': id, 'name': name, 'logoUrl': logoUrl};
}

class Category {
  final String id;
  final String name;
  final String? parentId;
  final String? imageUrl;
  final int displayOrder;

  Category({
    required this.id,
    required this.name,
    this.parentId,
    this.imageUrl,
    this.displayOrder = 0,
  });

  factory Category.fromJson(Map<String, dynamic> json) => Category(
        id: json['id'] as String,
        name: json['name'] as String,
        parentId: json['parentId'] as String?,
        imageUrl: json['imageUrl'] as String?,
        displayOrder: json['displayOrder'] as int? ?? 0,
      );

  factory Category.fromMap(Map<String, dynamic> map) => Category(
        id: map['id'] as String,
        name: map['name'] as String,
        parentId: map['parentId'] as String?,
        imageUrl: map['imageUrl'] as String?,
        displayOrder: (map['displayOrder'] as int?) ?? 0,
      );

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'parentId': parentId,
        'imageUrl': imageUrl,
        'displayOrder': displayOrder,
      };
}

class ProductSpec {
  final String id;
  final String productId;
  final String label;
  final String value;

  ProductSpec({
    required this.id,
    required this.productId,
    required this.label,
    required this.value,
  });

  factory ProductSpec.fromJson(Map<String, dynamic> json) => ProductSpec(
        id: json['id'] as String,
        productId: json['productId'] as String,
        label: json['label'] as String,
        value: json['value'] as String,
      );

  factory ProductSpec.fromMap(Map<String, dynamic> map) => ProductSpec(
        id: map['id'] as String,
        productId: map['productId'] as String,
        label: map['label'] as String,
        value: map['value'] as String,
      );

  Map<String, dynamic> toMap() =>
      {'id': id, 'productId': productId, 'label': label, 'value': value};
}

class ProductImage {
  final String id;
  final String productId;
  final String url;
  final int position;

  ProductImage({
    required this.id,
    required this.productId,
    required this.url,
    required this.position,
  });

  factory ProductImage.fromJson(Map<String, dynamic> json) => ProductImage(
        id: json['id'] as String,
        productId: json['productId'] as String,
        url: json['url'] as String,
        position: json['position'] as int,
      );

  factory ProductImage.fromMap(Map<String, dynamic> map) => ProductImage(
        id: map['id'] as String,
        productId: map['productId'] as String,
        url: map['url'] as String,
        position: map['position'] as int,
      );

  Map<String, dynamic> toMap() => {
        'id': id,
        'productId': productId,
        'url': url,
        'position': position,
      };
}

class Product {
  final String id;
  final String name;
  final String? reference;
  final String? description;
  final double? price;
  final bool isActive;
  final String? brandId;
  final String categoryId;
  final List<ProductSpec> specs;
  final List<ProductImage> images;

  Product({
    required this.id,
    required this.name,
    this.reference,
    this.description,
    this.price,
    required this.isActive,
    this.brandId,
    required this.categoryId,
    this.specs = const [],
    this.images = const [],
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    final specs = (json['specs'] as List<dynamic>? ?? [])
        .map((s) => ProductSpec.fromJson(s as Map<String, dynamic>))
        .toList();
    final images = (json['images'] as List<dynamic>? ?? [])
        .map((i) => ProductImage.fromJson(i as Map<String, dynamic>))
        .toList()
      ..sort((a, b) => a.position.compareTo(b.position));
    return Product(
      id: json['id'] as String,
      name: json['name'] as String,
      reference: json['reference'] as String?,
      description: json['description'] as String?,
      // Prisma Decimal est sérialisé en JSON sous forme de chaîne.
      price: json['price'] != null
          ? double.tryParse(json['price'].toString())
          : null,
      isActive: json['isActive'] as bool,
      brandId: json['brandId'] as String?,
      categoryId: json['categoryId'] as String,
      specs: specs,
      images: images,
    );
  }

  factory Product.fromMap(
    Map<String, dynamic> map, {
    required List<ProductSpec> specs,
    required List<ProductImage> images,
  }) {
    return Product(
      id: map['id'] as String,
      name: map['name'] as String,
      reference: map['reference'] as String?,
      description: map['description'] as String?,
      price: (map['price'] as num?)?.toDouble(),
      isActive: (map['isActive'] as int) == 1,
      brandId: map['brandId'] as String?,
      categoryId: map['categoryId'] as String,
      specs: specs,
      images: images,
    );
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'reference': reference,
        'description': description,
        'price': price,
        'isActive': isActive ? 1 : 0,
        'brandId': brandId,
        'categoryId': categoryId,
      };
}

/// Instantané complet du catalogue (marques, catégories, produits), tel que
/// renvoyé par `GET /catalog/full` ou reconstruit depuis le cache local. Sert
/// aussi de conteneur pour un lot de différences (`GET /catalog/sync`).
class CatalogSnapshot {
  final List<Brand> brands;
  final List<Category> categories;
  final List<Product> products;

  const CatalogSnapshot({
    required this.brands,
    required this.categories,
    required this.products,
  });

  static const empty =
      CatalogSnapshot(brands: [], categories: [], products: []);

  bool get isEmpty => brands.isEmpty && categories.isEmpty && products.isEmpty;

  factory CatalogSnapshot.fromJson(Map<String, dynamic> json) {
    return CatalogSnapshot(
      brands: (json['brands'] as List<dynamic>)
          .map((b) => Brand.fromJson(b as Map<String, dynamic>))
          .toList(),
      categories: (json['categories'] as List<dynamic>)
          .map((c) => Category.fromJson(c as Map<String, dynamic>))
          .toList(),
      products: (json['products'] as List<dynamic>)
          .map((p) => Product.fromJson(p as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// Résultat d'un appel `/catalog/full` ou `/catalog/sync` : le lot de données
/// (complet ou différentiel selon l'appel) et l'horodatage serveur à
/// conserver comme prochain curseur `since` (spec §2.2, §5.3).
class CatalogSyncResult {
  final CatalogSnapshot snapshot;
  final String syncedAt;

  CatalogSyncResult({required this.snapshot, required this.syncedAt});
}
