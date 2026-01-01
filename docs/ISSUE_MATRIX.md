# ISSUE_MATRIX

Maps each requirement to current repo state, impacted areas, and risks.

| Requirement | Current State | Impacted Areas | Notes / Risks |
| --- | --- | --- | --- |
| Itinerary (planning) vs Booking (transaction) separation | Itinerary CRUD/collab endpoints exist; booking creation now requires owner (or admin) on the linked itinerary, snapshots plan data, and inline itinerary creation is deprecated but still available. | `prisma/schema.prisma`, `src/services/booking.service.ts`, `src/controllers/booking.controller.ts`, itinerary modules/routes | Collaborators cannot create bookings; ensure frontend uses itinerary-first flow before removing inline path. |
| Four itinerary flows (STANDARD/CUSTOMIZED/REQUESTED/SMART_TRIP) | Validators/DTOs allow all types; REQUESTED send/confirm stubs exist; SMART_TRIP has no special logic beyond type flag and draft generation via chatbot. | Validators/DTOs, itinerary + booking controllers/services | Requested flow still stubbed; SMART_TRIP relies on Roaman draft output and manual creation. |
| BV-YEAR-NUMBER bookingCode | Booking code generator issues BV-<YEAR>-<NNN> with padding 3 using transactional sequence upserts; seeding aligns sequences to current year codes. | `src/services/booking.service.ts`, Booking DTOs/responses, Prisma migrations, any scripts using BookingSequence | Maintain sequence correctness when backfilling legacy records; ensure DTO responses expose bookingCode consistently. |
| Permissions fixes for self-scope (/users/me stats, activity logs) | Self endpoints added for stats and activity logs using authenticated user scope; admin dashboards/logs remain restricted. | `src/routes/user.route.ts`, `src/controllers/user.controller.ts`, `src/services/dashboard.service.ts`, `src/services/activity-log.service.ts` | Ensure self routes ignore foreign actorId; admin routes stay admin-only. |
| Normalized date/time responses | Controllers return raw Date objects (e.g., booking listings) and format dates inconsistently (e.g., `split('T')[0]` in admin list). | Response DTOs/serializers, booking controllers/services, shared date utility | Align on ISO 8601 serialization; consider timezone handling to avoid frontend parsing issues. |
| Missing endpoints (FAQ, upload thumbnail, weather forecast normalization) | FAQ now DB-backed via `FaqEntry` with seed + fallback stub; upload thumbnail stub returns URL; weather forecast normalized mock/live. | `src/controllers/faq.controller.ts`, `src/controllers/upload.controller.ts`, `src/controllers/weather.controller.ts`, Prisma migration/seed | FAQ relies on new migration; upload still placeholder storage. |
| Notification payload corrections | NotificationService stores generic message/data without structured payloads; key flows (booking status/payment) do not emit typed notifications. | `src/services/notification.service.ts`, booking/payment/inquiry controllers | Deferred (Phase F skipped per scope); TODO for future structured notifications. |
| Refresh token via request body | Refresh endpoint now accepts body token with cookie fallback and validation. | `src/controllers/auth.controller.ts`, auth routes/validators | Implemented; ensure clients send body or rely on cookie. |
| Optional chatbot transport stub | Chatbot endpoints now use Gemini: Roameo (FAQ RAG) and Roaman (travel assistant draft JSON). No queue/transport yet. | `src/controllers/chatbot.controller.ts`, `src/services/chatbot.service.ts`, new env vars | RAG uses keyword search only; returns 501 when Gemini key missing. |

## Phase D closures
- Separated itinerary endpoints from bookings with collaborator support.
- Booking DTOs normalized with ISO dates and numeric totals.
- Added weather/faq/upload stubs to unblock frontend.
