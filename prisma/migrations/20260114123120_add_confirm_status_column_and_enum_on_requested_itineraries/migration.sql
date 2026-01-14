-- CreateEnum
CREATE TYPE "ConfirmStatus" AS ENUM ('UNCONFIRMED', 'CONFIRMED');

-- AlterTable
ALTER TABLE "itineraries" ADD COLUMN     "confirmStatus" "ConfirmStatus" NOT NULL DEFAULT 'UNCONFIRMED';
