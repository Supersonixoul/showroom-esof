import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
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

export type TrimStatus =
  | 'détourée'
  | 'ignorée — seuil dépassé'
  | 'ignorée — déjà optimale'
  | 'erreur';

export interface TrimResult {
  /** Image (buffer) à utiliser comme source pour le redimensionnement des variantes. */
  buffer: Buffer;
  status: TrimStatus;
  errorMessage?: string;
  beforeWidth: number;
  beforeHeight: number;
  afterWidth: number;
  afterHeight: number;
  /** Proportion (0-1) de la surface d'origine retirée par le détourage. */
  percentRemoved: number;
}

/**
 * Génère, à côté d'une image produit originale, 3 variantes webp
 * (thumb/medium/full) redimensionnées — jamais agrandies
 * (`withoutEnlargement: true`). Convention de nommage par suffixe
 * (`<nom>_thumb.webp`, etc.), sans toucher au schéma de base de données :
 * les URLs des variantes se déduisent de l'URL de l'original (voir
 * `image-variants.util.ts`). L'original n'est jamais supprimé ni modifié.
 *
 * Avant redimensionnement, un détourage automatique (`sharp().trim()`)
 * retire les marges uniformes (fond blanc/uni) baked-in dans certaines
 * photos catalogue, avec un garde-fou anti-rognage du produit (voir
 * `computeTrim`) — mission qualité images, cadrage produit.
 */
@Injectable()
export class ImageOptimizationService {
  private readonly logger = new Logger(ImageOptimizationService.name);

  /// Détourage automatique des marges blanches/unies : paramètres conservateurs,
  /// ajustables via variables d'environnement sans redéploiement de code.
  private readonly trimThreshold = Number(process.env.IMAGE_TRIM_THRESHOLD ?? 10);
  /// Garde-fou NON NÉGOCIABLE : au-delà de cette proportion de surface retirée,
  /// le détourage est jugé suspect (risque de rognage du produit lui-même,
  /// ex. interrupteurs/coffrets blancs) et l'image d'origine est conservée telle quelle.
  private readonly maxTrimRatio = Number(process.env.IMAGE_TRIM_MAX_RATIO ?? 0.6);
  private readonly minTrimmedDimension = Number(process.env.IMAGE_TRIM_MIN_DIMENSION ?? 200);
  /// Marge uniforme réintroduite après détourage, en proportion de la plus grande
  /// dimension de l'image détourée (2 à 3 % ⇒ valeur par défaut 2,5 %).
  private readonly trimMarginRatio = Number(process.env.IMAGE_TRIM_MARGIN_RATIO ?? 0.025);
  /// En dessous de ce seuil de surface retirée, le détourage n'apporte rien de
  /// significatif : on considère l'image déjà correctement cadrée.
  private readonly negligibleTrimRatio = 0.01;

  variantFilename(originalFilename: string, suffix: ImageVariantSuffix): string {
    const ext = extname(originalFilename);
    const base = basename(originalFilename, ext);
    return `${base}_${suffix}.webp`;
  }

  /**
   * Détoure les marges uniformes d'une image source puis réintroduit une petite
   * marge de confort, avec garde-fou anti-rognage du produit. Ne touche jamais
   * au fichier d'origine sur disque : renvoie un buffer en mémoire à utiliser
   * comme source pour le redimensionnement des variantes.
   *
   * `sharp().trim()` détoure automatiquement sur le canal alpha (pixels
   * transparents) quand l'image en possède un, sinon sur la couleur du pixel
   * en haut à gauche — ce qui correspond exactement au comportement attendu
   * (transparence prioritaire sur la couleur pour les images avec alpha).
   */
  async computeTrim(originalPath: string): Promise<TrimResult> {
    let beforeWidth = 0;
    let beforeHeight = 0;

    try {
      const originalMeta = await sharp(originalPath).metadata();
      beforeWidth = originalMeta.width ?? 0;
      beforeHeight = originalMeta.height ?? 0;

      const { data, info } = await sharp(originalPath)
        .trim({ threshold: this.trimThreshold })
        .toBuffer({ resolveWithObject: true });

      const trimmedWidth = info.width;
      const trimmedHeight = info.height;
      const beforeSurface = beforeWidth * beforeHeight;
      const trimmedSurface = trimmedWidth * trimmedHeight;
      const percentRemoved = beforeSurface > 0 ? 1 - trimmedSurface / beforeSurface : 0;

      // Le garde-fou de dimension minimale ne doit sanctionner que les cas où
      // le détourage est LA CAUSE du rétrécissement — pas les images dont la
      // source est déjà naturellement petite dans une dimension (ex. bandeaux).
      const widthShrunkBelowMin =
        trimmedWidth < this.minTrimmedDimension && beforeWidth >= this.minTrimmedDimension;
      const heightShrunkBelowMin =
        trimmedHeight < this.minTrimmedDimension && beforeHeight >= this.minTrimmedDimension;

      if (percentRemoved > this.maxTrimRatio || widthShrunkBelowMin || heightShrunkBelowMin) {
        this.logger.warn(
          `Détourage suspect ignoré pour ${originalPath} (${(percentRemoved * 100).toFixed(1)}% de surface retirée, résultat ${trimmedWidth}x${trimmedHeight}) — image d'origine conservée`,
        );
        return {
          buffer: await sharp(originalPath).toBuffer(),
          status: 'ignorée — seuil dépassé',
          beforeWidth,
          beforeHeight,
          afterWidth: beforeWidth,
          afterHeight: beforeHeight,
          percentRemoved,
        };
      }

      if (percentRemoved < this.negligibleTrimRatio) {
        return {
          buffer: await sharp(originalPath).toBuffer(),
          status: 'ignorée — déjà optimale',
          beforeWidth,
          beforeHeight,
          afterWidth: beforeWidth,
          afterHeight: beforeHeight,
          percentRemoved,
        };
      }

      const marginPx = Math.round(this.trimMarginRatio * Math.max(trimmedWidth, trimmedHeight));
      const hasAlpha = originalMeta.hasAlpha ?? false;
      const background = hasAlpha
        ? { r: 0, g: 0, b: 0, alpha: 0 }
        : { r: 255, g: 255, b: 255, alpha: 1 };

      const margined = await sharp(data)
        .extend({ top: marginPx, bottom: marginPx, left: marginPx, right: marginPx, background })
        .toBuffer();

      return {
        buffer: margined,
        status: 'détourée',
        beforeWidth,
        beforeHeight,
        afterWidth: trimmedWidth + marginPx * 2,
        afterHeight: trimmedHeight + marginPx * 2,
        percentRemoved,
      };
    } catch (err) {
      this.logger.error(`Échec du détourage pour ${originalPath} : ${(err as Error).message}`);
      // Lecture brute (sans repasser par sharp, qui vient d'échouer) : évite qu'une
      // image corrompue fasse échouer aussi ce fallback et interrompe le lot appelant.
      let rawBuffer = Buffer.alloc(0);
      try {
        rawBuffer = readFileSync(originalPath);
      } catch {
        // Fichier illisible : buffer vide, l'appelant (writeVariantsFromBuffer)
        // échouera proprement variante par variante sans planter le lot.
      }
      return {
        buffer: rawBuffer,
        status: 'erreur',
        errorMessage: (err as Error).message,
        beforeWidth,
        beforeHeight,
        afterWidth: beforeWidth,
        afterHeight: beforeHeight,
        percentRemoved: 0,
      };
    }
  }

  /** Génère les variantes à partir d'un buffer déjà préparé (détouré ou non). */
  async writeVariantsFromBuffer(
    buffer: Buffer,
    dir: string,
    filename: string,
    force = false,
  ): Promise<boolean> {
    let generatedAny = false;

    for (const variant of VARIANTS) {
      const outPath = join(dir, this.variantFilename(filename, variant.suffix));
      if (!force && existsSync(outPath)) {
        continue;
      }
      try {
        await sharp(buffer)
          .resize({ width: variant.width, withoutEnlargement: true })
          .webp({ quality: variant.quality })
          .toFile(outPath);
        generatedAny = true;
      } catch (err) {
        this.logger.error(
          `Échec de génération de la variante "${variant.suffix}" pour ${join(dir, filename)} : ${(err as Error).message}`,
        );
      }
    }

    return generatedAny;
  }

  /**
   * Génère les variantes manquantes pour `originalPath`. Idempotent : une
   * variante déjà présente sur le disque n'est pas régénérée. Renvoie
   * `true` si au moins une variante a été (re)générée.
   */
  async generateVariants(originalPath: string): Promise<boolean> {
    const dir = dirname(originalPath);
    const filename = basename(originalPath);
    const trimResult = await this.computeTrim(originalPath);
    return this.writeVariantsFromBuffer(trimResult.buffer, dir, filename, false);
  }
}
