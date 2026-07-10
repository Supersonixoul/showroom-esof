-- AlterTable
ALTER TABLE "products" ADD COLUMN     "display_order" INTEGER NOT NULL DEFAULT 0;

-- Initialise l'ordre des produits existants (regroupés par catégorie), ordre alphabétique.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY category_id ORDER BY name
  ) - 1 AS rn
  FROM "products"
)
UPDATE "products" p
SET display_order = ranked.rn
FROM ranked
WHERE p.id = ranked.id;
