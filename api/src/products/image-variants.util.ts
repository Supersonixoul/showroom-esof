import { existsSync } from 'fs';
import { extname, join } from 'path';
import { UPLOADS_ROOT } from '../media/multer.config';

export interface ImageVariants {
  thumb: string;
  medium: string;
  full: string;
  original: string;
}

const VARIANT_SUFFIXES = ['thumb', 'medium', 'full'] as const;

/**
 * Construit les URLs des 3 variantes optimisées d'une image produit à
 * partir de l'URL de l'original (ex. `/uploads/products/<uuid>.jpg`),
 * générée par `ImageOptimizationService`. Retombe sur l'URL de l'original
 * si une variante n'existe pas encore sur le disque (upload antérieur au
 * pipeline sharp, script `optimize:images` pas encore lancé) — jamais
 * d'URL cassée.
 */
export function buildImageVariants(url: string): ImageVariants {
  const ext = extname(url);
  const base = url.slice(0, url.length - ext.length);

  const result = { original: url } as ImageVariants;
  for (const suffix of VARIANT_SUFFIXES) {
    const variantUrl = `${base}_${suffix}.webp`;
    const diskPath = join(UPLOADS_ROOT, variantUrl.replace(/^\/uploads\//, ''));
    result[suffix] = existsSync(diskPath) ? variantUrl : url;
  }
  return result;
}
