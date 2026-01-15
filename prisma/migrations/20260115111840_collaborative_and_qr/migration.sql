-- CreateTable
CREATE TABLE "itinerary_shares" (
    "id" TEXT NOT NULL,
    "token" VARCHAR(8) NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "role" "CollaboratorRole" NOT NULL DEFAULT 'COLLABORATOR',
    "maxUses" INTEGER NOT NULL DEFAULT 5,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itinerary_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "itinerary_shares_token_key" ON "itinerary_shares"("token");

-- AddForeignKey
ALTER TABLE "itinerary_shares" ADD CONSTRAINT "itinerary_shares_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_shares" ADD CONSTRAINT "itinerary_shares_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
