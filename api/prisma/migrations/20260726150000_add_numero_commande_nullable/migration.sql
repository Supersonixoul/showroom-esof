-- AlterTable
ALTER TABLE "commandes" ADD COLUMN     "numero" VARCHAR(10);

-- CreateIndex
CREATE UNIQUE INDEX "commandes_numero_key" ON "commandes"("numero");

-- CreateTable
CREATE TABLE "compteurs_commandes" (
    "annee" INTEGER NOT NULL,
    "dernier_numero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "compteurs_commandes_pkey" PRIMARY KEY ("annee")
);
