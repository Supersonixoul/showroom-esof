import { Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import sharp from 'sharp';

export type ImageVariantSuffix = 'thumb' | 'medium' | 'full';

interface VariantSpec {
  suffix: ImageVariantSuffix;
  width: number;
  quality: number;
}

/** 3 variantes générées à chaque upload d'image produit (voir mission qualité images). */
const VARIANTS: VariantSpec[] = [
  { suffix: 'thumb', width: 400, quality: 80 },
  { suffix: 'medium', width: 800, quality: 85 },
  { suffix: 'full', width: 1600, quality: 90 },
];

/**
 * Génère, à côté d'une image produit originale, 3 variantes webp
 * (thumb/medium/full) redimensionnées — jamais agrandies
 * (`withoutEnlargement: true`). Convention de nommage par suffixe
 * (`<nom>_thumb.webp`, etc.), sans toucher au schéma de base de données :
 * les URLs des variantes se déduisent de l'URL de l'original (voir
 * `image-variants.util.ts`). L'original n'est jamais supprimé ni modifié.
 */
@Injectable()
export class ImageOptimizationService {
  private readonly logger = new Logger(ImageOptimizationService.name);

  variantFilename(originalFilename: string, suffix: ImageVariantSuffix): string {
    const ext = extname(originalFilename);
    const base = basename(originalFilename, ext);
    return `${base}_${suffix}.webp`;
  }

  /**
   * Génère les variantes manquantes pour `originalPath`. Idempotent : une
   * variante déjà présente sur le disque n'est pas régénérée. Renvoie
   * `true` si au moins une variante a été (re)générée.
   */
  async generateVariants(originalPath: string): Promise<boolean> {
    const dir = dirname(originalPath);
    const filename = basename(originalPath);
    let generatedAny = false;

    for (const variant of VARIANTS) {
      const outPath = join(dir, this.variantFilename(filename, variant.suffix));
      if (existsSync(outPath)) {
        continue;
      }
      try {
        await sharp(originalPath)
          .resize({ width: variant.width, withoutEnlargement: true })
          .webp({ quality: variant.quality })
          .toFile(outPath);
        generatedAny = true;
      } catch (err) {
        this.logger.error(
          `Échec de génération de la variante "${variant.suffix}" pour ${originalPath} : ${(err as Error).message}`,
        );
      }
    }

    return generatedAny;
  }
}
