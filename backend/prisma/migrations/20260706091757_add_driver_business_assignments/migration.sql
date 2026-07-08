-- CreateTable
CREATE TABLE "DriverBusiness" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "businessId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DriverBusiness_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverBusiness_driverId_businessId_key" ON "DriverBusiness"("driverId", "businessId");

-- AddForeignKey
ALTER TABLE "DriverBusiness" ADD CONSTRAINT "DriverBusiness_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverBusiness" ADD CONSTRAINT "DriverBusiness_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
