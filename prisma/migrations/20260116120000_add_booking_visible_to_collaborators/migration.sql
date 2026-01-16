-- Adds booking-level visibility flag for collaborator access cutoff

ALTER TABLE "bookings"
ADD COLUMN "visibleToCollaborators" BOOLEAN NOT NULL DEFAULT true;
