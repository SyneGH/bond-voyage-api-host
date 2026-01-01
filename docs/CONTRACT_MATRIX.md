# CONTRACT_MATRIX

Endpoint contracts, required fields, and current gaps.

| Endpoint | Current Request/Response | Required Fields | Gap to Address |
| --- | --- | --- | --- |
| POST `/api/bookings` | Accepts `{ itineraryId, totalPrice, type?, tourType? }` (preferred) or a deprecated inline itinerary payload; response includes bookingCode and itinerary snapshot. | bookingCode (BV-YEAR-NUMBER with 3-digit padding), itineraryId linkage, normalized ISO dates/times, itinerary vs booking separation | Inline itinerary creation remains for backward compatibility; ensure itinerary access control (owner/collaborator/admin) and surface bookingCode in DTOs. |
| GET `/api/bookings/:id` | Returns booking with user, payments, collaborators, itinerary days/activities; ownership check allows owner/collaborators/admin. | bookingCode, itinerary status/type fields, normalized dates, notification payload for status changes | bookingCode absent; date fields returned as raw Date objects; no DTO enforcing required fields for frontend. |
| GET `/api/bookings/admin/bookings` | Admin list returns flattened rows (customer, destination, dates string via `split('T')[0]`, total, rejection fields, status). | bookingCode, itinerary reference, consistent ISO dates, payment status badges, itinerary/booking type distinctions | Booking code not included; date formatting inconsistent; lacks itinerary linkage and SMART_TRIP/REQUESTED flow context. |
| PATCH `/api/bookings/:id/status` | Accepts `{ status, rejectionReason?, rejectionResolution? }`; transitions validated in service. | audit/notification payload, bookingCode in responses, actor attribution | No structured notification emitted; response not normalized to DTO with bookingCode. |
| POST `/api/auth/refresh` | Accepts `{ refreshToken }` in body or cookie fallback; returns `{ accessToken }`. | Body token precedence over cookie for mobile/SPA; validator enforced; 401 on missing/invalid | Implemented. |
| GET `/api/weather/forecast` | Returns normalized shape `{lat,lng,unit,forecast:[{date,temperatureC,description}]}` with mock fallback when no API key. | Stable forecast array structure, normalized date strings, location metadata | Implemented normalization/mocks. |
| GET `/api/faqs` | Returns DB-backed FAQs (`FaqEntry`) ordered by `order` with fallback stub if table empty. | id, question, answer, order fields in stable array | Implemented with Prisma model + seed. |
| POST `/api/upload/itinerary-thumbnail` | Accepts `{ url }` JSON or multipart file; returns `{ url }` (placeholder when storage absent). | file/URL payload, validation, returned thumbnail URL | Implemented stub with placeholder URL. |
| GET `/api/users/me/activity-logs` | Returns paginated activity logs scoped to the authenticated user with optional type/date filters; admin `/activity-logs` remains for full access. | scoped activity entries for authenticated user, pagination meta | Implemented. |
| GET `/api/users/me/stats` | Returns booking stats for the authenticated user with trend/distribution cards; card counts currently zeroed per product ask. | user profile snippet, cards (total/pending/active/completed), trend labels, status/type distributions | Cards intentionally zeroed; trends/distributions remain. |
| POST `/api/chatbots/roameo` | `{ question }` -> Gemini-backed FAQ RAG response `{answer,confidence,sources[]}` using `FaqEntry` keyword search. | Requires GEMINI_API_KEY, GEMINI_MODEL (default `gemini-1.5-flash`); strict FAQ-only answers | Implemented; returns 501 if Gemini key missing. |
| POST `/api/chatbots/roaman` | `{ prompt, preferences? }` -> friendly message + SMART_TRIP draft JSON (no DB writes). | GEMINI_API_KEY/GEMINI_MODEL envs; draft shape compatible with itinerary days/activities | Implemented; best-effort JSON repair; 501 if Gemini key missing. |
| GET `/api/notifications` | Returns `{ items: NotificationDTO[], meta }` with pagination and optional `isRead` filter. | ISO timestamps, validated payloads per type, data payload persisted | Implemented; mark-read/read-all supported. |

## Phase D updates
- Added itinerary endpoints (CRUD, send/confirm) returning ItineraryDTO with ISO dates and numeric costs.
- Bookings return BookingDTO with BV codes, ownership, paymentStatus, itinerary nested days/activities.
- Weather forecast normalized to {lat,lng,unit,forecast[]} shape.
- FAQ endpoint serves stub list; upload thumbnail returns URL payload.
