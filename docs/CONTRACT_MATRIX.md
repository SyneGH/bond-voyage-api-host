# CONTRACT_MATRIX

Canonical request/response contracts for frontend integration. All responses use the envelope `{ success, message, data?, meta? }` with ISO date strings and numeric decimals.

| Endpoint | Auth | Request (minimal) | Response (minimal) | Notes |
| --- | --- | --- | --- | --- |
| POST `/auth/login` | None | `{ email, password }` | `{ user, accessToken, refreshToken }` | Sets `refreshToken` cookie; user includes `yearsInOperation` and ISO dates. |
| POST `/auth/refresh-token` | Optional cookie | `{ refreshToken }` (body preferred) | `{ accessToken }` | Body token takes precedence over cookie. |
| GET `/auth/profile` | Bearer | — | `{ user }` | Self profile. |
| PATCH `/users/profile` | Bearer | Profile fields incl. `yearsInOperation` | `{ user }` | Self update. |
| GET `/users/me/stats` | Bearer | — | `{ cards, trends, distributions }` | Cards currently zeroed per product request. |
| GET `/users/me/activity-logs` | Bearer | `?page&limit&action&dateFrom&dateTo` | `{ items: ActivityLogDTO[], meta }` | Self-scope logs. |
| POST `/users` | Admin | `{ name,email,password,role }` | `{ user }` | Admin create. |
| GET `/users` | Admin | `?search&role&isActive&dateFrom&dateTo&page&limit` | `{ items: UserDTO[], meta }` | Excludes admin users by design. |
| GET `/users/:id` | Admin | — | `{ user }` | Admin fetch. |
| PATCH `/users/:id` | Admin | Partial user fields | `{ user }` | — |
| PATCH `/users/:id/deactivate` | Admin | — | `{ user }` | Soft deactivate. |
| DELETE `/users/:id` | Admin | — | `{ message }` | Hard delete. |
| POST `/itineraries` | Bearer | `{ destination, travelers, startDate, endDate, days[] }` | `{ itinerary }` | Days include ordered activities; dates ISO. |
| GET `/itineraries` | Bearer | `?page&limit&search&status&type` | `{ items: ItineraryDTO[], meta }` | Caller-owned itineraries. |
| GET `/itineraries/:id` | Bearer | — | `{ itinerary }` | Includes collaborators/days/activities. |
| PATCH `/itineraries/:id` | Bearer | Partial itinerary fields | `{ itinerary }` | Owner/collaborator access control. |
| DELETE `/itineraries/:id` | Bearer | — | `{ message }` | Archive/delete per service rules. |
| PATCH `/itineraries/:id/send` | Bearer | `{ sentAt? }` | `{ itinerary }` | Requested flow stub; marks sent. |
| PATCH `/itineraries/:id/confirm` | Bearer | `{ confirmedAt? }` | `{ itinerary }` | Requested flow stub; owner confirm. |
| POST `/itineraries/:id/collaborators` | Bearer | `{ userId }` | `{ collaborator }` | Inviter recorded; collaborator can edit itinerary. |
| GET `/itineraries/:id/collaborators` | Bearer | — | `{ items: CollaboratorDTO[] }` | — |
| DELETE `/itineraries/:id/collaborators/:userId` | Bearer | — | `{ message }` | Removes collaborator. |
| POST `/bookings` | Bearer (owner/admin) | `{ itineraryId, totalPrice, type?, tourType? }` (legacy inline itinerary allowed) | `{ booking }` | Generates `bookingCode` BV-YYYY-NNN; captures itinerary snapshot. |
| GET `/bookings/:id` | Bearer | — | `{ booking }` | Owner/admin; collaborators see if attached/requested. |
| PUT `/bookings/:id` | Bearer | Partial booking/itinerary fields | `{ booking }` | Draft edits with collaborator rules. |
| PATCH `/bookings/:id/submit` | Bearer | — | `{ booking }` | Submits booking. |
| PATCH `/bookings/:id/cancel` | Bearer | — | `{ booking }` | Cancels booking. |
| DELETE `/bookings/:id` | Bearer | — | `{ message }` | Deletes draft. |
| GET `/bookings/my-bookings` | Bearer | `?page&limit&status` | `{ items: BookingDTO[], meta }` | Caller-owned bookings. |
| GET `/bookings/shared-with-me` | Bearer | `?page&limit` | `{ items: BookingDTO[], meta }` | Collaborator-shared bookings. |
| POST `/bookings/:id/collaborators` | Bearer | `{ userId }` | `{ collaborator }` | Booking-level collaborators. |
| GET `/bookings/:id/collaborators` | Bearer | — | `{ items: CollaboratorDTO[] }` | — |
| DELETE `/bookings/:id/collaborators/:collaboratorUserId` | Bearer | — | `{ message }` | — |
| PATCH `/bookings/:id/status` | Admin | `{ status, rejectionReason?, rejectionResolution? }` | `{ booking }` | Admin approve/reject; notifications emitted. |
| GET `/bookings/admin/bookings` | Admin | `?status&page&limit&search` | `{ items: BookingDTO[], meta }` | Flattened admin view. |
| POST `/bookings/:id/payments` | Bearer | `{ amount, method, reference?, attachmentUrl? }` | `{ payment }` | Delegates to payment controller. |
| GET `/bookings/:id/payments` | Bearer | — | `{ items: PaymentDTO[] }` | — |
| POST `/payments/:id` | Bearer | `{ amount, method, reference?, attachmentUrl? }` | `{ payment }` | Equivalent payment submit. |
| GET `/payments` | Bearer | `?bookingId&page&limit` | `{ items: PaymentDTO[], meta }` | Admin filters available in service. |
| GET `/payments/:id/proof` | Bearer | — | File/stream or `{ url }` | Proof retrieval. |
| PATCH `/payments/:id/status` | Admin | `{ status, rejectionReason? }` | `{ payment }` | Verify/reject; emits notifications. |
| GET `/notifications` | Bearer | `?isRead&page&limit` | `{ items: NotificationDTO[], meta }` | Pagination meta reused. |
| PATCH `/notifications/:id/read` | Bearer | — | `{ notification }` | Mark read. |
| PATCH `/notifications/read-all` | Bearer | — | `{ count }` | Mark all read. |
| GET `/faqs` | None (public) | `?search&page&limit` | `{ items: FaqDTO[], meta }` | Used by Roameo RAG and User FAQ UI. |
| POST `/faqs` | Admin | `{ question, answer, tags[], ... }` | `{ faq }` | Creates new FAQ entry. |
| PUT `/faqs/:id` | Admin | Partial FAQ fields | `{ faq }` | Updates content. |
| DELETE `/faqs/:id` | Admin | — | `{ message }` | Hard deletes entry. |
| POST `/chatbots/roameo` | None (public) | `{ question }` | `{ answer, confidence, sources[] }` | FAQ-only; returns 501 if Gemini key missing; rejects out-of-scope. |
| POST `/chatbots/roaman` | None (public) | `{ prompt, preferences? }` | `{ message, draftItinerary }` | SMART_TRIP draft JSON, no DB write; 501 if Gemini key missing. |
| GET `/activity-logs` | Admin | `?actorId&action&entityType&entityId&dateFrom&dateTo&page&limit` | `{ items: ActivityLogDTO[], meta }` | Action filter is substring-based; legacy strings may not match enums. |
| GET `/activity-logs/:id` | Admin | — | `{ activityLog }` | — |
| GET `/health` | None | — | `{ status: 'ok' }` | Liveness. |