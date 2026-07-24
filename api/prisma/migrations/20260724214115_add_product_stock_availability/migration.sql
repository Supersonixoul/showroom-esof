-- AlterTable
ALTER TABLE "products" ADD COLUMN     "afficher_quantite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quantite_stock" INTEGER NOT NULL DEFAULT 0;
