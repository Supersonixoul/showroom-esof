import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../generated/prisma/client';

/// Crée le compte admin initial (email/mot de passe passés en variables
/// d'environnement, avec une valeur par défaut pour le développement local).
/// Idempotent : ne fait rien si le compte existe déjà.
async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@esof.bf';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Compte admin déjà présent : ${email}`);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name: 'Administrateur ESOF',
      email,
      passwordHash,
      role: Role.ADMIN,
    },
  });
  console.log(`Compte admin créé : ${email} / ${password}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
