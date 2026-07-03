import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const UPLOADS_ROOT = 'uploads';

const ALLOWED_MIME_PREFIXES = ['image/', 'video/'];

export const multerConfig: MulterOptions = {
  storage: diskStorage({
    destination: UPLOADS_ROOT,
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
