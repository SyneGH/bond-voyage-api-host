# Execution Plan

## Stack Scan (Phase 0)
- Framework: Express (TypeScript) with custom routing/controllers.
- ORM/DB: Prisma ORM targeting PostgreSQL; migrations via `prisma migrate` with SQL in `prisma/migrations/`.
- Booking logic: primarily in `src/services/booking.service.ts`, controllers in `src/controllers/booking.controller.ts`, validators in `src/validators/booking.dto.ts`, routes in `src/routes/booking.route.ts`.
- Migration strategy: Prisma migrations; seeding via `prisma/seed.ts`, generation via `npm run db:migrate`.

## Phases Overview
- **Phase A — Repo Audit & Issue + Contract Matrices**: Map requirements to code areas; identify endpoint gaps. Touch docs/ISSUE_MATRIX.md, docs/CONTRACT_MATRIX.md.
- **Phase B — DB Refactor (Itinerary + Booking Tables)**: Update Prisma schema/migrations for itinerary separation. Areas: `prisma/schema.prisma`, new migration, docs/MIGRATION_NOTES.md.
- **Phase C — Booking Code Generator BV-YEAR-NUMBER**: Transaction-safe generator in booking layer. Areas: `src/services/booking.service.ts` or utility, tests/scripts.
- **Phase D1 — DTOs + Shared Date Serializer**: Define DTO contracts and ISO date helper. Areas: `src/dtos/*`, `src/utils/date.ts`.
- **Phase D2 — Itinerary Endpoints**: CRUD + collaborator/request flow. Areas: `src/controllers/itinerary.controller.ts`, `src/routes/itinerary.route.ts`, services/validators.
- **Phase D3 — Booking Endpoints Core**: POST/GET bookings aligned with itinerary types. Areas: `src/controllers/booking.controller.ts`, service and validators.
- **Phase D4 — Booking Admin + Payment + Lifecycle**: Approve/reject/payment/cancel/complete. Areas: booking/payment controllers/services.
- **Phase D5 — Weather Forecast Endpoint**: Implement/stub forecast. Areas: new controller/route, service or integration.
- **Phase D6 — FAQ Endpoint**: GET /faqs. Areas: controller/route/service, possibly prisma model.
- **Phase D7 — Upload Endpoint (thumbnail)**: File upload handling. Areas: middleware/storage, itinerary controller/route.
- **Phase E — Permissions Fix**: Self-scope stats/activity logs. Areas: `src/controllers/user.controller.ts`, authz middleware.
- **Phase F — Notifications**: Structured notifications and dynamic messages. Areas: `src/services/notification.service.ts` and relevant controllers/services.
- **Phase G — Refresh Token Body Support**: Allow body token. Areas: `src/controllers/auth.controller.ts` or middleware.
- **Phase H — Years In Operation + Date Normalization**: Add numeric `yearsInOperation`; enforce ISO date handling. Areas: Prisma schema, related services/serializers.
- **Phase I — Response Completeness Audit**: Capture payload samples. Areas: docs/RESPONSE_AUDIT.md.
- **Phase J — Final Integration Handoff**: Populate docs/API_HANDOFF.md with flow/payload guidance.

## Risks & Notes
- Prisma migrations must stay consistent; coordinate schema refactors carefully.
- Booking logic tightly couples itinerary fields; refactor may require data migration scripts.
- Date normalization and serializer changes risk breaking existing consumers; ensure backward-compatible ISO formats.
- Adding upload/forecast may need stubs if infra unavailable; document TODOs.
- Permissions changes must consider admin vs self scopes; verify middleware paths.
