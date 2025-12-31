# MIGRATION_NOTES

## 2025-12-31: Itinerary + Booking split
- Added `Itinerary` and `ItineraryCollaborator` tables to own planning data and collaborators independently of transactional bookings.
- Moved itinerary structure to reference `Itinerary` (`itinerary_days` and `activities` now cascade from itineraries).
- Refactored `Booking` to reference `Itinerary`, added unique `bookingCode`, and defaulted status to `PENDING` for transactional flows.
- Introduced `BookingSequence` to track yearly booking code counters.
- Dropped legacy `booking_collaborators` relation and added optional itinerary linkage on `inquiries`.

### Deployment considerations
- Existing data must be migrated: move booking-owned itinerary rows into the new `itineraries` table before applying the schema changes; otherwise foreign-key constraints will fail.
- Generate `bookingCode` values for historical bookings or set temporary placeholders to satisfy the new NOT NULL + unique constraint.
- Update application code to use `itineraryId` for itinerary structure queries and to create bookings linked to itineraries.
