# MIGRATION_NOTES

_To be updated alongside schema changes. Capture applied migrations, backfill steps, and verification commands._

## 20250204120000_phase_b_itinerary_booking_refactor
- **Change set:**
  - Added `RequestStatus` enum to support requested itinerary flow tracking.
  - Itinerary gains `requestedStatus`, `sentAt`, and `confirmedAt` to record request/confirm timestamps.
  - Itinerary collaborators now track `invitedById` for auditability of collaborator additions.
  - Booking records capture `destination`, `startDate`, `endDate`, and `travelers` as transactional snapshots.
  - Booking sequences store the last issued code for visibility/backfill.
- **Apply:**
  ```bash
  npx prisma migrate deploy
  ```
- **Verification:**
  ```bash
  npx prisma db pull
  npx prisma studio # optional to inspect itineraries/bookings/booking_sequences
  ```
- **Backfill guidance:**
  - Populate booking `destination/startDate/endDate/travelers` using the linked itinerary data when present.
  - Seed collaborator `invitedById` with the itinerary owner for existing records if needed.
  - Ensure `booking_sequences.lastIssuedCode` aligns with the latest generated booking code per year.

## 20260210120000_phase_g2_faq_entry
- **Change set:** Adds `faq_entries` table for persistent FAQs used by Roameo RAG.
- **Apply:**
  ```bash
  npx prisma migrate deploy
  ```
- **Verification:**
  ```bash
  npx prisma db pull
  npx prisma studio # confirm faq_entries rows
  ```
- **Backfill guidance:**
  - Run `npm run db:seed` to upsert default FAQ entries.
  - Ensure `faq_entries.isActive` is true for visible entries; inactive rows are ignored by the chatbot.
