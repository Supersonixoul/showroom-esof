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

// Toutes les ressources sauf `promo-videos` (vidéos) ne reçoivent que des images.
const IMAGE_RESOURCES: UploadResource[] = ['products', 'brands', 'categories', 'subcategories', 'gammes'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 Mo
export const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 Mo

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
  fileFilter: (req, file, callback) => {
    const resource = (req.params as Record<string, string>).resource as UploadResource;
    if (IMAGE_RESOURCES.includes(resource)) {
      const ext = extname(file.originalname).toLowerCase();
      const isAllowed =
        file.mimetype.startsWith('image/') &&
        ALLOWED_IMAGE_EXTENSIONS.includes(ext);
      if (!isAllowed) {
        callback(
          new BadRequestException(
            'Formats acceptés : jpg, jpeg, png, webp uniquement',
          ),
          false,
        );
        return;
      }
      callback(null, true);
      return;
    }
    // promo-videos
    if (!file.mimetype.startsWith('video/')) {
      callback(
        new BadRequestException('Seuls les fichiers vidéo sont acceptés'),
        false,
      );
      return;
    }
    callback(null, true);
  },
  limits: {
    // Limite globale la plus haute (vidéos) ; les images sont recontrôlées
    // à MAX_IMAGE_SIZE après upload dans MediaController — une limite par
    // ressource n'est pas exprimable nativement dans les options multer.
    fileSize: MAX_VIDEO_SIZE,
  },
};
