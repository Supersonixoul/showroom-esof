-- AlterTable
ALTER TABLE "products" ADD COLUMN     "gamme_id" UUID;

-- CreateTable
CREATE TABLE "gammes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "brand_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gammes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gammes_brand_id_name_key" ON "gammes"("brand_id", "name");

-- AddForeignKey
ALTER TABLE "gammes" ADD CONSTRAINT "gammes_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_gamme_id_fkey" FOREIGN KEY ("gamme_id") REFERENCES "gammes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
