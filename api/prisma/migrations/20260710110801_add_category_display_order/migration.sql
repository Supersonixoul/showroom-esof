-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "display_order" INTEGER NOT NULL DEFAULT 0;

-- Initialise l'ordre des catégories existantes (regroupées par parent), ordre alphabétique.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY parent_id ORDER BY name
  ) - 1 AS rn
  FROM "categories"
)
UPDATE "categories" c
SET display_order = ranked.rn
FROM ranked
WHERE c.id = ranked.id;
