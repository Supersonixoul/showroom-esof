-- AlterTable
ALTER TABLE "commandes" ALTER COLUMN "numero_client" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "commandes_professionnel_id_numero_client_key" ON "commandes"("professionnel_id", "numero_client");
