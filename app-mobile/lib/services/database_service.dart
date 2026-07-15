import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import '../models/catalog_models.dart';

/// Cache local (SQLite) du catalogue, pour une consultation hors-ligne du
/// mode client entre deux synchronisations (spec §2.2).
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
    final path = join(dbPath, 'showroom_mobile.db');
    return openDatabase(
      path,
      version: 3,
      onCreate: (db, version) async {
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
            price REAL,
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
        await _createSyncMetaTable(db);
        await _createPendingQuotesTable(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await _createSyncMetaTable(db);
          await _createPendingQuotesTable(db);
        }
        if (oldVersion < 3) {
          await db.execute('ALTER TABLE products ADD COLUMN price REAL');
        }
      },
    );
  }

  Future<void> _createSyncMetaTable(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');
  }

  /// File d'attente hors-ligne des devis (spec §6.3, Sprint 10) : un devis
  /// créé sans réseau est conservé ici jusqu'à son envoi réussi.
  Future<void> _createPendingQuotesTable(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS pending_quotes (
        id TEXT PRIMARY KEY,
        clientId TEXT NOT NULL,
        itemsJson TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )
    ''');
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

  /// Fusionne un lot différentiel (`/catalog/sync`) dans le cache local : les
  /// marques/catégories/produits touchés sont mis à jour en place (upsert),
  /// et pour chaque produit modifié, ses spécifications/images sont
  /// entièrement remplacées (l'API renvoie leur état complet, pas leur diff).
  Future<void> mergeCatalog(CatalogSnapshot diff) async {
    final db = await _database;
    await db.transaction((txn) async {
      for (final brand in diff.brands) {
        await txn.insert('brands', brand.toMap(),
            conflictAlgorithm: ConflictAlgorithm.replace);
      }
      for (final category in diff.categories) {
        await txn.insert('categories', category.toMap(),
            conflictAlgorithm: ConflictAlgorithm.replace);
      }
      for (final product in diff.products) {
        await txn.insert('products', product.toMap(),
            conflictAlgorithm: ConflictAlgorithm.replace);
        await txn.delete('product_specs',
            where: 'productId = ?', whereArgs: [product.id]);
        await txn.delete('product_images',
            where: 'productId = ?', whereArgs: [product.id]);
        for (final spec in product.specs) {
          await txn.insert('product_specs', spec.toMap());
        }
        for (final image in product.images) {
          await txn.insert('product_images', image.toMap());
        }
      }
    });
  }

  Future<String?> getLastSyncedAt() async {
    final db = await _database;
    final rows =
        await db.query('sync_meta', where: 'key = ?', whereArgs: ['catalogSyncedAt']);
    if (rows.isEmpty) return null;
    return rows.first['value'] as String;
  }

  Future<void> setLastSyncedAt(String value) async {
    final db = await _database;
    await db.insert(
      'sync_meta',
      {'key': 'catalogSyncedAt', 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> enqueuePendingQuote({
    required String id,
    required String clientId,
    required String itemsJson,
  }) async {
    final db = await _database;
    await db.insert('pending_quotes', {
      'id': id,
      'clientId': clientId,
      'itemsJson': itemsJson,
      'createdAt': DateTime.now().toIso8601String(),
    });
  }

  Future<List<Map<String, dynamic>>> getPendingQuotes() async {
    final db = await _database;
    return db.query('pending_quotes', orderBy: 'createdAt ASC');
  }

  Future<void> removePendingQuote(String id) async {
    final db = await _database;
    await db.delete('pending_quotes', where: 'id = ?', whereArgs: [id]);
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
