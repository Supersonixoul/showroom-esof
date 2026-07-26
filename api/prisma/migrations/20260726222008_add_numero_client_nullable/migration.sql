-- AlterTable
ALTER TABLE "commandes" ADD COLUMN     "numero_client" INTEGER;

-- Backfill : numérotation 1..n par client, dans l'ordre chronologique de
-- création (date_commande croissante), pour les commandes existantes.
UPDATE "commandes" c
SET "numero_client" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "professionnel_id" ORDER BY "date_commande" ASC
  ) AS rn
  FROM "commandes"
) sub
WHERE c.id = sub.id;
