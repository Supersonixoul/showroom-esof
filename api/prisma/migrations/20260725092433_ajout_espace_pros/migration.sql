-- CreateTable
CREATE TABLE "professionnels" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(150) NOT NULL,
    "identifiant" VARCHAR(50) NOT NULL,
    "mot_de_passe" VARCHAR(255) NOT NULL,
    "telephone_1" VARCHAR(20) NOT NULL,
    "telephone_2" VARCHAR(20),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professionnels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents_commerciaux" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "prenom" VARCHAR(100) NOT NULL,
    "telephone_1" VARCHAR(20) NOT NULL,
    "telephone_2" VARCHAR(20),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_commerciaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commandes" (
    "id" UUID NOT NULL,
    "professionnel_id" UUID NOT NULL,
    "commercial_id" UUID NOT NULL,
    "date_commande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'ENVOYEE',

    CONSTRAINT "commandes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_commande" (
    "id" UUID NOT NULL,
    "commande_id" UUID NOT NULL,
    "produit_id" UUID NOT NULL,
    "quantite" INTEGER NOT NULL,
    "libelle_produit" VARCHAR(255) NOT NULL,

    CONSTRAINT "lignes_commande_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "professionnels_identifiant_key" ON "professionnels"("identifiant");

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_professionnel_id_fkey" FOREIGN KEY ("professionnel_id") REFERENCES "professionnels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_commercial_id_fkey" FOREIGN KEY ("commercial_id") REFERENCES "agents_commerciaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
