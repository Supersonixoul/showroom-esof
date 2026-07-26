-- AlterTable : ajout des colonnes annee/sequence (nullable le temps du
-- backfill).
ALTER TABLE "commandes" ADD COLUMN     "annee" INTEGER;
ALTER TABLE "commandes" ADD COLUMN     "sequence" INTEGER;

-- On retire temporairement la contrainte d'unicite sur "numero" : les
-- valeurs vont etre recalculees (sequence par client/annee au lieu de
-- l'ancien compteur global) et pourraient transitoirement entrer en
-- collision avec d'anciennes valeurs le temps du backfill.
DROP INDEX "commandes_numero_key";

-- Backfill : annee = annee civile de date_commande, sequence = rang
-- chronologique (date_commande croissante) par client et par annee.
UPDATE "commandes" c
SET "annee" = sub.annee, "sequence" = sub.seq
FROM (
  SELECT id,
    EXTRACT(YEAR FROM "date_commande")::int AS annee,
    ROW_NUMBER() OVER (
      PARTITION BY "professionnel_id", EXTRACT(YEAR FROM "date_commande")
      ORDER BY "date_commande" ASC
    ) AS seq
  FROM "commandes"
) sub
WHERE c.id = sub.id;

-- Recalcul de "numero" a partir du code client (3 lettres) + annee sur 2
-- chiffres + sequence zero-paddee sur 4 chiffres, ex: AMN26-0001.
UPDATE "commandes" c
SET "numero" = p."code" || TO_CHAR(c."annee" % 100, 'FM00') || '-' || LPAD(c."sequence"::text, 4, '0')
FROM "professionnels" p
WHERE c."professionnel_id" = p."id";

-- AlterTable : colonnes desormais obligatoires + contraintes d'unicite.
ALTER TABLE "commandes" ALTER COLUMN "annee" SET NOT NULL;
ALTER TABLE "commandes" ALTER COLUMN "sequence" SET NOT NULL;
CREATE UNIQUE INDEX "commandes_numero_key" ON "commandes"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_professionnel_id_annee_sequence_key" ON "commandes"("professionnel_id", "annee", "sequence");

-- DropTable : l'ancien compteur global par annee n'est plus utilise, la
-- sequence etant desormais calculee par client (voir CommandesService).
DROP TABLE "compteurs_commandes";
