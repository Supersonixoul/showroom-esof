-- AlterTable
ALTER TABLE "agents_commerciaux" ADD COLUMN     "identifiant" VARCHAR(50),
ADD COLUMN     "mot_de_passe" VARCHAR(255);

-- AlterTable
ALTER TABLE "commandes" ADD COLUMN     "date_proforma" TIMESTAMP(3),
ADD COLUMN     "motif_annulation" TEXT,
ADD COLUMN     "numero_proforma" VARCHAR(20),
ADD COLUMN     "tva_applicable" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "statut" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "lignes_commande" ADD COLUMN     "prix_unitaire" DECIMAL(12,0);

-- CreateTable
CREATE TABLE "historique_commandes" (
    "id" UUID NOT NULL,
    "commande_id" UUID NOT NULL,
    "date_action" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" VARCHAR(30) NOT NULL,
    "details" TEXT,

    CONSTRAINT "historique_commandes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_commerciaux_identifiant_key" ON "agents_commerciaux"("identifiant");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_numero_proforma_key" ON "commandes"("numero_proforma");

-- AddForeignKey
ALTER TABLE "historique_commandes" ADD CONSTRAINT "historique_commandes_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

