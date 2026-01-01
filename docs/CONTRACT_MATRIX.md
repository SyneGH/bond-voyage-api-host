# CONTRACT_MATRIX

Endpoint contracts, required fields, and current gaps.

| Endpoint | Current Request/Response | Required Fields | Gap to Address |
| --- | --- | --- | --- |
| POST `/api/v1/bookings` | Accepts `{ itineraryId, totalPrice, type?, tourType? }` (preferred) or a deprecated inline itinerary payload; response includes bookingCode and itinerary snapshot. | bookingCode (BV-YEAR-NUMBER with 3-digit padding), itineraryId linkage, normalized ISO dates/times, itinerary vs booking separation | Inline itinerary creation remains for backward compatibility; ensure itinerary access control (owner/collaborator/admin) and surface bookingCode in DTOs. |
| GET `/api/v1/bookings/:id` | Returns booking with user, payments, collaborators, itinerary days/activities; ownership check allows owner/collaborators/admin. | bookingCode, itinerary status/type fields, normalized dates, notification payload for status changes | bookingCode absent; date fields returned as raw Date objects; no DTO enforcing required fields for frontend. |
| GET `/api/v1/bookings/admin/bookings` | Admin list returns flattened rows (customer, destination, dates string via `split('T')[0]`, total, rejection fields, status). | bookingCode, itinerary reference, consistent ISO dates, payment status badges, itinerary/booking type distinctions | Booking code not included; date formatting inconsistent; lacks itinerary linkage and SMART_TRIP/REQUESTED flow context. |
| PATCH `/api/v1/bookings/:id/status` | Accepts `{ status, rejectionReason?, rejectionResolution? }`; transitions validated in service. | audit/notification payload, bookingCode in responses, actor attribution | No structured notification emitted; response not normalized to DTO with bookingCode. |
| POST `/api/v1/auth/refresh` | Reads `refreshToken` cookie only; returns `{ accessToken }`. | Accept refresh token from body (and cookie fallback) for compatibility with mobile clients | Body token unsupported; request validator absent. |
| GET `/api/v1/weather/forecast` | Proxies OpenWeather forecast when API key exists; mock returns `{lat,lng,unit,forecast:[{date,temperatureC,description}]}`. | Stable forecast array structure, normalized date strings, location metadata | Live path returns raw OpenWeather payload (list of 3-hour entries) without normalization; mock/live shapes diverge. |
| GET `/api/v1/faqs` | Not implemented. | id, question, answer, order fields in stable array | Endpoint missing; add stub or DB-backed implementation. |
| POST `/api/v1/upload/itinerary-thumbnail` | Not implemented. | file/URL payload, validation, returned thumbnail URL | Missing route/controller/storage wiring; needs stub with safe placeholder URL if storage pending. |
| GET `/api/v1/users/me/activity-logs` | Not implemented; activity logs are admin-only. | scoped activity entries for authenticated user, pagination meta | Requires self-scope route/guard; current query DTO allows admin actorId filter only. |

## Phase D updates
- Added itinerary endpoints (CRUD, send/confirm) returning ItineraryDTO with ISO dates and numeric costs.
- Bookings return BookingDTO with BV codes, ownership, paymentStatus, itinerary nested days/activities.
- Weather forecast normalized to {lat,lng,unit,forecast[]} shape.
- FAQ endpoint serves stub list; upload thumbnail returns URL payload.
