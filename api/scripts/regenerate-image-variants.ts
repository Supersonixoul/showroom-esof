import 'dotenv/config';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, extname, join, relative } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { UPLOADS_ROOT } from '../src/media/multer.config';
import { ImageOptimizationService } from '../src/products/image-optimization.service';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
const VARIANT_SUFFIXES = ['_thumb.webp', '_medium.webp', '_full.webp'];

// Mode simulation par défaut : aucun fichier n'est écrit tant que --write
// n'est pas explicitement passé en argument (voir mission qualité images).
const WRITE_MODE = process.argv.includes('--write');

// Racine du projet api/ (ce script est compilé vers dist/scripts/, donc deux
// niveaux au-dessus de dist/scripts/regenerate-image-variants.js).
const API_ROOT = join(__dirname, '..', '..');
const REPORT_PATH = join(API_ROOT, 'rapport_detourage.csv');
const PROGRESS_PATH = join(API_ROOT, '.regenerate-image-variants-progress.json');

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

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[";\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface ReportRow {
  reference: string;
  filename: string;
  beforeWidth: number;
  beforeHeight: number;
  afterWidth: number;
  afterHeight: number;
  percentRemoved: number;
  status: string;
  errorMessage: string;
}

/** Rapport CSV en français, couvrant 100% des images traitées (voir mission qualité images). */
function writeCsvReport(rows: ReportRow[]): void {
  const header = [
    'Référence produit',
    'Nom fichier',
    'Largeur avant (px)',
    'Hauteur avant (px)',
    'Largeur après (px)',
    'Hauteur après (px)',
    'Pourcentage surface retirée',
    'Statut',
    'Motif erreur',
  ];
  const lines = [header.map(csvEscape).join(';')];
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.reference),
        csvEscape(row.filename),
        csvEscape(row.beforeWidth),
        csvEscape(row.beforeHeight),
        csvEscape(row.afterWidth),
        csvEscape(row.afterHeight),
        csvEscape(`${(row.percentRemoved * 100).toFixed(1)}%`),
        csvEscape(row.status),
        csvEscape(row.errorMessage),
      ].join(';'),
    );
  }
  // BOM UTF-8 : Excel (locale française) interprète correctement les accents avec ce préfixe.
  writeFileSync(REPORT_PATH, '\uFEFF' + lines.join('\n') + '\n', 'utf-8');
}

/**
 * Sauvegarde les variantes actuellement présentes sur le disque dans un
 * dossier horodaté, avant tout écrasement. Ne copie jamais les fichiers
 * originaux (jamais modifiés par ce script). Complète et exécutée avant la
 * moindre écriture — voir mission qualité images, garde-fou obligatoire.
 */
function backupExistingVariants(productsDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(UPLOADS_ROOT, '_backups', `products_${timestamp}`);
  mkdirSync(backupDir, { recursive: true });

  const files = walk(productsDir);
  let copied = 0;
  for (const filePath of files) {
    const filename = filePath.split(/[\\/]/).pop() as string;
    if (!isVariantFile(filename)) {
      continue;
    }
    const rel = relative(productsDir, filePath);
    const dest = join(backupDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(filePath, dest);
    copied++;
  }
  console.log(`Sauvegarde effectuée : ${copied} variante(s) copiée(s) vers ${backupDir}`);
  return backupDir;
}

interface Progress {
  completed: string[];
}

function loadProgress(): Set<string> {
  if (!existsSync(PROGRESS_PATH)) {
    return new Set();
  }
  try {
    const data = JSON.parse(readFileSync(PROGRESS_PATH, 'utf-8')) as Progress;
    return new Set(data.completed ?? []);
  } catch {
    return new Set();
  }
}

function saveProgress(completed: Set<string>): void {
  const data: Progress = { completed: Array.from(completed) };
  writeFileSync(PROGRESS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Régénère (ou simule la régénération de) les variantes thumb/medium/full de
 * chaque image produit, en repartant TOUJOURS du fichier original — jamais
 * d'une variante déjà générée. Mode simulation par défaut (`--dry-run`
 * implicite) ; mode écriture activé uniquement via `--write`, avec sauvegarde
 * horodatée préalable des variantes existantes. Idempotent et relançable
 * après interruption : en mode écriture, un fichier de progression évite de
 * retraiter une image déjà régénérée lors d'une exécution précédente.
 * Chaque image est traitée dans son propre try/catch : une image corrompue
 * n'interrompt jamais le lot.
 */
async function main() {
  const productsDir = join(UPLOADS_ROOT, 'products');
  if (!existsSync(productsDir)) {
    console.log(`Dossier introuvable, rien à faire : ${productsDir}`);
    return;
  }

  console.log(
    WRITE_MODE
      ? '=== MODE ÉCRITURE (--write) ==='
      : '=== MODE SIMULATION (par défaut, aucun fichier ne sera écrit) ===',
  );

  if (WRITE_MODE) {
    backupExistingVariants(productsDir);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  // Table de correspondance nom de fichier -> référence produit, pour le rapport.
  const referenceByFilename = new Map<string, string>();
  try {
    const productImages = await prisma.productImage.findMany({
      include: { product: { select: { reference: true, name: true } } },
    });
    for (const img of productImages) {
      const filename = img.url.split(/[\\/]/).pop() as string;
      referenceByFilename.set(filename, img.product.reference ?? img.product.name);
    }
  } finally {
    await prisma.$disconnect();
  }

  const service = new ImageOptimizationService();
  const files = walk(productsDir).filter((path) => {
    const filename = path.split(/[\\/]/).pop() as string;
    return !isVariantFile(filename) && IMAGE_EXTENSIONS.has(extname(filename).toLowerCase());
  });

  const progress = loadProgress();
  const rows: ReportRow[] = [];
  let treatedThisRun = 0;
  let resumedSkips = 0;

  for (const filePath of files) {
    const filename = filePath.split(/[\\/]/).pop() as string;
    const dir = dirname(filePath);
    const reference = referenceByFilename.get(filename) ?? '(orphelin — aucun produit associé)';

    if (WRITE_MODE && progress.has(filename)) {
      resumedSkips++;
      continue; // déjà régénérée lors d'une exécution précédente interrompue
    }

    try {
      const trimResult = await service.computeTrim(filePath);

      if (WRITE_MODE) {
        await service.writeVariantsFromBuffer(trimResult.buffer, dir, filename, true);
        progress.add(filename);
        saveProgress(progress);
      }

      rows.push({
        reference,
        filename,
        beforeWidth: trimResult.beforeWidth,
        beforeHeight: trimResult.beforeHeight,
        afterWidth: trimResult.afterWidth,
        afterHeight: trimResult.afterHeight,
        percentRemoved: trimResult.percentRemoved,
        status: trimResult.status,
        errorMessage: trimResult.errorMessage ?? '',
      });
      treatedThisRun++;
    } catch (err) {
      rows.push({
        reference,
        filename,
        beforeWidth: 0,
        beforeHeight: 0,
        afterWidth: 0,
        afterHeight: 0,
        percentRemoved: 0,
        status: 'erreur',
        errorMessage: (err as Error).message,
      });
      console.error(`Erreur sur ${filePath} :`, (err as Error).message);
    }
  }

  writeCsvReport(rows);

  const countByStatus = (status: string) => rows.filter((r) => r.status === status).length;

  console.log('--- Rapport détourage des images produits ---');
  console.log(`Images trouvées : ${files.length}`);
  console.log(`Traitées cette exécution : ${treatedThisRun}`);
  if (WRITE_MODE) {
    console.log(`Ignorées (déjà régénérées lors d'une exécution précédente) : ${resumedSkips}`);
  }
  console.log(`Détourées : ${countByStatus('détourée')}`);
  console.log(`Ignorées — seuil dépassé : ${countByStatus('ignorée — seuil dépassé')}`);
  console.log(`Ignorées — déjà optimale : ${countByStatus('ignorée — déjà optimale')}`);
  console.log(`Erreurs : ${countByStatus('erreur')}`);
  console.log(`Rapport écrit : ${REPORT_PATH}`);

  if (!WRITE_MODE) {
    console.log(
      "Mode simulation : aucun fichier image n'a été écrit. Relancer avec --write après validation du rapport pour appliquer.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
