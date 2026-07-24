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

  Category({required this.id, required this.name, this.parentId});

  factory Category.fromJson(Map<String, dynamic> json) => Category(
        id: json['id'] as String,
        name: json['name'] as String,
        parentId: json['parentId'] as String?,
      );

  factory Category.fromMap(Map<String, dynamic> map) => Category(
        id: map['id'] as String,
        name: map['name'] as String,
        parentId: map['parentId'] as String?,
      );

  Map<String, dynamic> toMap() =>
      {'id': id, 'name': name, 'parentId': parentId};
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
  final bool isActive;
  final String brandId;
  final String categoryId;
  final List<ProductSpec> specs;
  final List<ProductImage> images;

  Product({
    required this.id,
    required this.name,
    this.reference,
    this.description,
    required this.isActive,
    required this.brandId,
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
      isActive: json['isActive'] as bool,
      brandId: json['brandId'] as String,
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
      isActive: (map['isActive'] as int) == 1,
      brandId: map['brandId'] as String,
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

/// Variantes optimisées d'une image produit (thumb/medium/full/original),
/// telles que renvoyées par `buildImageVariants()` côté API.
class ImageVariants {
  final String thumb;
  final String medium;
  final String full;
  final String original;

  ImageVariants({
    required this.thumb,
    required this.medium,
    required this.full,
    required this.original,
  });

  factory ImageVariants.fromJson(Map<String, dynamic> json) => ImageVariants(
        thumb: json['thumb'] as String,
        medium: json['medium'] as String,
        full: json['full'] as String,
        original: json['original'] as String,
      );
}

/// Produit mis en avant (nouveau / promo / solde), tel que renvoyé par
/// `GET /catalog/featured`.
class FeaturedProduct {
  final String id;
  final String name;
  final String? reference;
  final double? price;
  final double? promoPrice;
  final double? salePrice;
  final ImageVariants? image;
  final FeaturedBrand? brand;
  final FeaturedCategory category;

  FeaturedProduct({
    required this.id,
    required this.name,
    this.reference,
    this.price,
    this.promoPrice,
    this.salePrice,
    this.image,
    this.brand,
    required this.category,
  });

  factory FeaturedProduct.fromJson(Map<String, dynamic> json) {
    return FeaturedProduct(
      id: json['id'] as String,
      name: json['name'] as String,
      reference: json['reference'] as String?,
      // Prisma Decimal est sérialisé en JSON sous forme de chaîne.
      price: json['price'] != null
          ? double.tryParse(json['price'].toString())
          : null,
      promoPrice: json['promoPrice'] != null
          ? double.tryParse(json['promoPrice'].toString())
          : null,
      salePrice: json['salePrice'] != null
          ? double.tryParse(json['salePrice'].toString())
          : null,
      image: json['image'] != null
          ? ImageVariants.fromJson(json['image'] as Map<String, dynamic>)
          : null,
      brand: json['brand'] != null
          ? FeaturedBrand.fromJson(json['brand'] as Map<String, dynamic>)
          : null,
      category:
          FeaturedCategory.fromJson(json['category'] as Map<String, dynamic>),
    );
  }
}

class FeaturedBrand {
  final String id;
  final String name;

  FeaturedBrand({required this.id, required this.name});

  factory FeaturedBrand.fromJson(Map<String, dynamic> json) => FeaturedBrand(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

class FeaturedCategory {
  final String id;
  final String name;

  FeaturedCategory({required this.id, required this.name});

  factory FeaturedCategory.fromJson(Map<String, dynamic> json) =>
      FeaturedCategory(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

/// Regroupement des 3 blocs de produits mis en avant (spec §Mise en avant).
class FeaturedProducts {
  final List<FeaturedProduct> newProducts;
  final List<FeaturedProduct> promotions;
  final List<FeaturedProduct> sales;

  const FeaturedProducts({
    required this.newProducts,
    required this.promotions,
    required this.sales,
  });

  static const empty =
      FeaturedProducts(newProducts: [], promotions: [], sales: []);

  bool get isEmpty =>
      newProducts.isEmpty && promotions.isEmpty && sales.isEmpty;

  factory FeaturedProducts.fromJson(Map<String, dynamic> json) {
    List<FeaturedProduct> parse(String key) => (json[key] as List<dynamic>? ?? [])
        .map((p) => FeaturedProduct.fromJson(p as Map<String, dynamic>))
        .toList();
    return FeaturedProducts(
      newProducts: parse('newProducts'),
      promotions: parse('promotions'),
      sales: parse('sales'),
    );
  }
}
