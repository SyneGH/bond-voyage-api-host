# Execution Plan

## Stack Scan (Phase 0)
- **Framework:** Express (TypeScript) with route/controller structure under `src/`.
- **ORM/DB:** Prisma ORM targeting PostgreSQL; migrations stored in `prisma/migrations/` and run via `npm run db:migrate`.
- **Booking Logic:** Service-layer logic in `src/services/booking.service.ts`; HTTP handlers in `src/controllers/booking.controller.ts`; DTO/validation in `src/validators/booking.dto.ts`; routes wired in `src/routes/booking.route.ts`.
- **Migration Strategy:** Prisma migrations with optional seeding via `prisma/seed.ts`; generated client via `npm run db:generate`.

## Phased Roadmap (A–J)
Each phase lists the primary repo areas and a short implementation guide to keep scope tight.

| Phase | Focus | Repo Areas | Implementation Guide |
| --- | --- | --- | --- |
| A | Repo audit; draft Issue & Contract matrices | `docs/ISSUE_MATRIX.md`, `docs/CONTRACT_MATRIX.md` | Read controllers/services for current behavior; map requirements to files and note gaps in tables. |
| B | DB refactor (Itinerary + Booking tables) | `prisma/schema.prisma`, `prisma/migrations/*`, `docs/MIGRATION_NOTES.md` | Add/adjust models and enums; generate migration; document deployment notes. |
| C | BV-YEAR-NUMBER booking code generator | `src/services/booking.service.ts`, possible `src/utils/*`, tests/scripts | Implement transaction-safe generator using Prisma, ensure format and uniqueness. |
| D1 | DTO contracts + date serializer | `src/dtos/*`, `src/utils/date.ts` | Define canonical response DTOs and shared ISO serialization helper. |
| D2 | Itinerary endpoints (CRUD + requested flow stubs) | `src/controllers/itinerary.controller.ts`, `src/routes/itinerary.route.ts`, services/validators | Implement CRUD + collaborator/request send/confirm (stub if needed) returning DTOs. |
| D3 | Booking endpoints core | `src/controllers/booking.controller.ts`, `src/routes/booking.route.ts`, validators/services | POST booking + GET my bookings/by id using new DTOs and booking codes. |
| D4 | Booking admin + payment lifecycle | Booking/payment controllers & services, validators | Admin approve/reject, payment receipt/verify, cancel/complete flows with notifications hooks. |
| D5 | Weather forecast endpoint | `src/controllers/weather.controller.ts`, `src/routes/weather.route.ts`, services | Standardize forecast array; stub allowed if external API unavailable. |
| D6 | FAQ endpoint | New controller/route/service; possible Prisma model | Add GET /faqs (stub or backed by DB), return ordered list. |
| D7 | Upload endpoint (itinerary thumbnail) | Upload middleware, `src/controllers/itinerary.controller.ts`, `src/routes/*` | Accept thumbnail upload (or stub URL) and attach to itinerary DTO. |
| E | Permissions fixes (self-scope + admin) | `src/routes/user.route.ts`, `src/controllers/user.controller.ts`, `src/routes/activity-log.route.ts` | Add `/users/me` stats/activity endpoints with proper authz while keeping admin visibility. |
| F | Structured notifications | `src/services/notification.service.ts`, booking/payment/inquiry controllers | Enforce typed payloads and emit notifications in key flows. |
| G | Refresh token via request body | `src/controllers/auth.controller.ts`, auth routes/validators | Accept token from body (and cookie fallback) for `/auth/refresh`. |
| H | Years in operation + datetime normalization | `prisma/schema.prisma`, DTO serializers, relevant controllers | Add numeric `yearsInOperation`; ensure ISO date/time across responses. |
| I | Response completeness audit | `docs/RESPONSE_AUDIT.md` | Capture sample JSON per endpoint proving required fields. |
| J | Final integration handoff | `docs/API_HANDOFF.md` | Summarize payloads, stubs, flows for frontend integration. |

## Risks & Notes
- Prisma migrations must stay in sync with code changes; coordinate schema refactors with data backfills.
- Booking/itinerary separation may require data migration to avoid breaking references.
- ISO serialization changes can affect existing consumers; keep backward compatibility where possible.
- External-dependent endpoints (weather/upload) may need stubs—document them clearly for follow-up.
