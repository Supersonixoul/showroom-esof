/**
 * Exemple de données de démonstration pour les sous-catégories : crée (ou
 * réutilise) la catégorie "Interrupteurs" et lui ajoute les sous-catégories
 * "Simple", "Double", "Simple va-et-vient", "Double va-et-vient".
 *
 * Script à exécuter MANUELLEMENT (n'est PAS branché sur `npm run seed`, qui
 * reste réservé au compte admin initial). Idempotent : peut être relancé sans
 * dupliquer la catégorie ni les sous-catégories.
 *
 * Exécution :
 *   npx ts-node -r tsconfig-paths/register prisma/seed-subcategories-example.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const SUBCATEGORY_NAMES = [
  'Simple',
  'Double',
  'Simple va-et-vient',
  'Double va-et-vient',
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  let category = await prisma.category.findFirst({
    where: { name: 'Interrupteurs' },
  });
  if (!category) {
    category = await prisma.category.create({ data: { name: 'Interrupteurs' } });
    console.log(`Catégorie créée : ${category.name}`);
  } else {
    console.log(`Catégorie déjà présente : ${category.name}`);
  }

  for (let i = 0; i < SUBCATEGORY_NAMES.length; i++) {
    const name = SUBCATEGORY_NAMES[i];
    const existing = await prisma.subcategory.findFirst({
      where: { categoryId: category.id, name },
    });
    if (existing) {
      console.log(`Sous-catégorie déjà présente : ${name}`);
      continue;
    }
    await prisma.subcategory.create({
      data: { name, categoryId: category.id, displayOrder: i },
    });
    console.log(`Sous-catégorie créée : ${name}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
