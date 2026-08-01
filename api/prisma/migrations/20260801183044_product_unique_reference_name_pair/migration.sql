-- Deux produits distincts peuvent legitimement partager la meme reference
-- (ex. fils electriques : seule la couleur change dans le libelle) :
-- l'unicite ne doit donc pas porter sur la reference seule, mais sur le
-- couple (reference, name).
DROP INDEX "products_reference_key";

-- AlterTable
ALTER TABLE "products" ADD CONSTRAINT "products_reference_name_key" UNIQUE ("reference", "name");
