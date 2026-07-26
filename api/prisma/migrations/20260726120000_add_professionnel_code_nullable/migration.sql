-- AlterTable
ALTER TABLE "professionnels" ADD COLUMN     "code" VARCHAR(3);

-- CreateIndex
CREATE UNIQUE INDEX "professionnels_code_key" ON "professionnels"("code");
