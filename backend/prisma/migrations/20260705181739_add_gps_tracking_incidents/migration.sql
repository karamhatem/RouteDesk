-- CreateEnum
CREATE TYPE "TrackingIncidentType" AS ENUM ('LOCATION_DISABLED', 'CONNECTION_LOST', 'APP_INACTIVE');

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "locationSharingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationSharingStartedAt" TIMESTAMP(3),
ADD COLUMN     "locationSharingStoppedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TrackingIncident" (
    "id" SERIAL NOT NULL,
    "type" "TrackingIncidentType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "lastLatitude" DOUBLE PRECISION,
    "lastLongitude" DOUBLE PRECISION,
    "lastSeen" TIMESTAMP(3),
    "note" TEXT,
    "driverId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingIncident_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TrackingIncident" ADD CONSTRAINT "TrackingIncident_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
