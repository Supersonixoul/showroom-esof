-- AlterTable
ALTER TABLE "products" ADD COLUMN     "is_new" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "on_promotion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "on_sale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promo_price" DECIMAL(12,2),
ADD COLUMN     "sale_price" DECIMAL(12,2);
