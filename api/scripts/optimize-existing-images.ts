import 'dotenv/config';
import { existsSync, readdirSync, statSync } from 'fs';
import { extname, join } from 'path';
import { UPLOADS_ROOT } from '../src/media/multer.config';
import { ImageOptimizationService } from '../src/products/image-optimization.service';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
const VARIANT_SUFFIXES = ['_thumb.webp', '_medium.webp', '_full.webp'];

function isVariantFile(filename: string): boolean {
  return VARIANT_SUFFIXES.some((suffix) => filename.endsWith(suffix));
}

/** Parcourt récursivement un dossier et renvoie les chemins absolus de tous les fichiers. */
function walk(dir: string): string[] {
  let files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files = files.concat(walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Rattrape les images produits uploadées avant l'introduction du pipeline
 * d'optimisation sharp : génère les variantes thumb/medium/full manquantes
 * pour chaque image de `UPLOADS_ROOT/products`. Idempotent — relançable
 * sans dupliquer le travail (`ImageOptimizationService.generateVariants`
 * ignore les variantes déjà présentes sur le disque).
 */
async function main() {
  const productsDir = join(UPLOADS_ROOT, 'products');
  if (!existsSync(productsDir)) {
    console.log(`Dossier introuvable, rien à faire : ${productsDir}`);
    return;
  }

  const service = new ImageOptimizationService();
  const files = walk(productsDir).filter((path) => {
    const filename = path.split(/[\\/]/).pop() as string;
    return (
      !isVariantFile(filename) &&
      IMAGE_EXTENSIONS.has(extname(filename).toLowerCase())
    );
  });

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const filePath of files) {
    try {
      const generatedAny = await service.generateVariants(filePath);
      if (generatedAny) {
        processed++;
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      console.error(`Erreur sur ${filePath} :`, (err as Error).message);
    }
  }

  console.log('--- Rapport optimisation des images produits ---');
  console.log(`Images trouvées : ${files.length}`);
  console.log(`Traitées (au moins une variante générée) : ${processed}`);
  console.log(`Ignorées (variantes déjà présentes) : ${skipped}`);
  console.log(`Erreurs : ${errors}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
