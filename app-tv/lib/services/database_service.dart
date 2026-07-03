import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import '../models/promo_video.dart';

/// Cache local (SQLite) des vidéos promotionnelles, pour un fonctionnement
/// hors-ligne de l'app TV (mode ordinaire) entre deux synchronisations.
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
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE promo_videos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            position INTEGER NOT NULL,
            isActive INTEGER NOT NULL,
            updatedAt TEXT NOT NULL
          )
        ''');
      },
    );
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
}
