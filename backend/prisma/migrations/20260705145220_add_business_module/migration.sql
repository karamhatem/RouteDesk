/*
  Warnings:

  - You are about to drop the column `restaurantId` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the `Restaurant` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('RESTAURANT', 'SUPERMARKET', 'PHARMACY', 'BAKERY', 'FLOWERS', 'STORE', 'OTHER');

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_restaurantId_fkey";

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "restaurantId",
ADD COLUMN     "businessId" INTEGER;

-- DropTable
DROP TABLE "Restaurant";

-- CreateTable
CREATE TABLE "Business" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BusinessType" NOT NULL DEFAULT 'OTHER',
    "phone" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
