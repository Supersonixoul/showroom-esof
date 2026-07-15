import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { extname, join, resolve } from 'path';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

// Chemin absolu, en dehors du dépôt git par défaut sur les postes de dev
// (voir UPLOADS_ROOT dans .env) — évite de perdre les images uploadées
// (marques/catégories/sous-catégories/gammes/produits) lors d'un transfert
// du projet sur un autre PC, puisque `uploads/` est gitignore.
export const UPLOADS_ROOT = resolve(process.env.UPLOADS_ROOT ?? 'uploads');

export const ALLOWED_UPLOAD_RESOURCES = ['products', 'promo-videos', 'brands', 'categories', 'subcategories', 'gammes'] as const;
export type UploadResource = (typeof ALLOWED_UPLOAD_RESOURCES)[number];

const ALLOWED_MIME_PREFIXES = ['image/', 'video/'];

export const multerConfig: MulterOptions = {
  storage: diskStorage({
    destination: (req, _file, callback) => {
      const resource = (req.params as Record<string, string>).resource;
      if (
        !ALLOWED_UPLOAD_RESOURCES.includes(resource as UploadResource)
      ) {
        callback(
          new BadRequestException(
            `Ressource inconnue : ${resource}. Valeurs acceptées : ${ALLOWED_UPLOAD_RESOURCES.join(', ')}`,
          ),
          '',
        );
        return;
      }
      const dir = join(UPLOADS_ROOT, resource);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      callback(null, dir);
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req, file, callback) => {
    const isAllowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
      file.mimetype.startsWith(prefix),
    );
    if (!isAllowed) {
      callback(
        new BadRequestException(
          'Seuls les fichiers image ou vidéo sont acceptés',
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
  limits: {
    fileSize: 200 * 1024 * 1024, // 200 Mo (vidéos promo)
  },
};
