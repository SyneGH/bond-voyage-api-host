import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // This script is intended to be run ONCE after migrating the DB schema
  // that adds Booking.visibleToCollaborators.

  const nonDraftBookings = await prisma.booking.findMany({
    where: { status: { not: "DRAFT" } },
    select: { id: true, status: true, itineraryId: true, userId: true },
  });

  console.log("Non-draft bookings found:", nonDraftBookings.length);

  // Use raw SQL to avoid coupling this one-time script to regenerated Prisma types.
  // IMPORTANT: Run after applying the migration that adds the column.
  const updatedCount = await prisma.$executeRaw`
    UPDATE "bookings"
    SET "visibleToCollaborators" = false
    WHERE status <> 'DRAFT'
  `;

  console.log("Bookings updated (visibleToCollaborators=false):", Number(updatedCount));

  const itineraryOwnerByItineraryId = new Map<string, string>();
  for (const b of nonDraftBookings) {
    if (b.itineraryId) {
      // booking.userId is the booking owner in this system
      itineraryOwnerByItineraryId.set(b.itineraryId, b.userId);
    }
  }

  let revokedSharesTotal = 0;
  let removedCollaboratorsTotal = 0;

  for (const [itineraryId, ownerId] of itineraryOwnerByItineraryId.entries()) {
    const revokedShares = await prisma.itineraryShare.updateMany({
      where: { itineraryId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    revokedSharesTotal += revokedShares.count;

    const removedCollaborators = await prisma.itineraryCollaborator.deleteMany({
      where: {
        itineraryId,
        NOT: { userId: ownerId },
      },
    });
    removedCollaboratorsTotal += removedCollaborators.count;
  }

  console.log("Shares revoked:", revokedSharesTotal);
  console.log("Collaborators removed:", removedCollaboratorsTotal);
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error("Migration script failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
