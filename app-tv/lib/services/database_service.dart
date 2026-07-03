import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import '../models/catalog_models.dart';
import '../models/promo_video.dart';

/// Cache local (SQLite) du catalogue et des vidéos promotionnelles, pour un
/// fonctionnement hors-ligne de l'app TV entre deux synchronisations.
class DatabaseService {
  DatabaseService._internal();
  static final DatabaseService instance = DatabaseService._internal();

  Database? _db;

  Future<Database> get _database async {
    _db ??= await _initDatabase();
    return _db!;
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'showroom_tv.db');
    return openDatabase(
      path,
      version: 2,
      onCreate: (db, version) async {
        await _createPromoVideosTable(db);
        await _createCatalogTables(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await _createCatalogTables(db);
        }
      },
    );
  }

  Future<void> _createPromoVideosTable(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS promo_videos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        position INTEGER NOT NULL,
        isActive INTEGER NOT NULL,
        updatedAt TEXT NOT NULL
      )
    ''');
  }

  Future<void> _createCatalogTables(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS brands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        logoUrl TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parentId TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        reference TEXT,
        description TEXT,
        isActive INTEGER NOT NULL,
        brandId TEXT NOT NULL,
        categoryId TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS product_specs (
        id TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        label TEXT NOT NULL,
        value TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS product_images (
        id TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        url TEXT NOT NULL,
        position INTEGER NOT NULL
      )
    ''');
  }

  Future<void> replacePromoVideos(List<PromoVideo> videos) async {
    final db = await _database;
    await db.transaction((txn) async {
      await txn.delete('promo_videos');
      for (final video in videos) {
        await txn.insert('promo_videos', video.toMap());
      }
    });
  }

  Future<List<PromoVideo>> getPromoVideos() async {
    final db = await _database;
    final maps = await db.query('promo_videos', orderBy: 'position ASC');
    return maps.map(PromoVideo.fromMap).toList();
  }

  Future<void> replaceCatalog(CatalogSnapshot snapshot) async {
    final db = await _database;
    await db.transaction((txn) async {
      await txn.delete('brands');
      await txn.delete('categories');
      await txn.delete('products');
      await txn.delete('product_specs');
      await txn.delete('product_images');
      for (final brand in snapshot.brands) {
        await txn.insert('brands', brand.toMap());
      }
      for (final category in snapshot.categories) {
        await txn.insert('categories', category.toMap());
      }
      for (final product in snapshot.products) {
        await txn.insert('products', product.toMap());
        for (final spec in product.specs) {
          await txn.insert('product_specs', spec.toMap());
        }
        for (final image in product.images) {
          await txn.insert('product_images', image.toMap());
        }
      }
    });
  }

  Future<CatalogSnapshot> getCatalog() async {
    final db = await _database;
    final brandMaps = await db.query('brands');
    final categoryMaps = await db.query('categories');
    final productMaps = await db.query('products');
    final specMaps = await db.query('product_specs');
    final imageMaps = await db.query('product_images', orderBy: 'position ASC');

    final specsByProduct = <String, List<ProductSpec>>{};
    for (final map in specMaps) {
      final spec = ProductSpec.fromMap(map);
      specsByProduct.putIfAbsent(spec.productId, () => []).add(spec);
    }
    final imagesByProduct = <String, List<ProductImage>>{};
    for (final map in imageMaps) {
      final image = ProductImage.fromMap(map);
      imagesByProduct.putIfAbsent(image.productId, () => []).add(image);
    }

    final products = productMaps.map((map) {
      final id = map['id'] as String;
      return Product.fromMap(
        map,
        specs: specsByProduct[id] ?? [],
        images: imagesByProduct[id] ?? [],
      );
    }).toList();

    return CatalogSnapshot(
      brands: brandMaps.map(Brand.fromMap).toList(),
      categories: categoryMaps.map(Category.fromMap).toList(),
      products: products,
    );
  }
}
