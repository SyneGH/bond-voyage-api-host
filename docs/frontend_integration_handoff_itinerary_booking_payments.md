# Frontend Integration Handoff — Itinerary (Tour Packages) + Booking + Payments

## A) What Changed (for frontend)

- **PUT `/bookings/:id` now accepts patch-style (partial) updates** and multiple itinerary payload shapes; normalization happens in the booking service and validator now permits optional fields and multiple itinerary structures.
- **Itinerary payload normalization** supports:
  - `days[]` arrays
  - nested itinerary objects (with `days` + optional `activities`)
  - wrapper arrays (first element used)
  - Dates are normalized when provided.
- **`tourType` aliasing:** frontend `tourType="GROUP"` is accepted and normalized to backend `JOINER`. Validator and service both handle aliasing safely.
- **PATCH `/payments/:id/status` now accepts `rejectionReason`** when status is `REJECTED` and persists it to the DB (new column).
- **DB migration added** for `payments.rejectionReason` to support payment rejection reasons end-to-end.

---

## B) Environment Setup (Frontend + Backend)

### Frontend env vars & auth

- `VITE_API_BASE_URL` is used for the API base URL and proof image URLs. It should include `/api/v1` because the backend mounts routes under `/api/v1`.
- **Auth:** Bearer tokens stored in `localStorage` (`accessToken` / `refreshToken`), injected into `Authorization` header; `withCredentials` is enabled in Axios.
- Proof URLs are constructed using `VITE_API_BASE_URL + /payments/:id/proof`.

### Backend env vars

- Required: `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (validated on boot).

### Tests

- Integration tests require a reachable PostgreSQL instance (DB is not mocked).

---

## C) Canonical Endpoint Catalog (UI → API mapping)

### Tour Packages (Standard Itineraries)

1) **GET `/tour-packages`**  
   - UI locations: `src/hooks/useTourPackages.ts` and listing screens.  
   - Auth: None required.  
   - Query params: `page`, `limit`, `q`, `isActive` (boolean).  
   - Response shape:
   ```json
   {
     "success": true,
     "message": "Tour packages retrieved",
     "data": [],
     "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
   }
   ```
   - Errors: `{ success: false, message, data?: { details } }` (see error middleware).

2) **GET `/tour-packages/:id`**  
   - UI locations: `useTourPackageDetail` hook.  
   - Auth: None required.

3) **POST `/tour-packages`**  
   - UI locations: `CreateStandardItinerary` submit handler.  
   - Auth/role: Admin.  
   - Request body (frontend sends): `title`, `destination`, `price`, `duration`, `description`, `thumbUrl`, `category`, `isActive`, and `days[].activities[]` (ordered).  
   - Response: `ApiResponse<TourPackage>`.

4) **PUT `/tour-packages/:id`**  
   - UI locations: `EditStandardItinerary` submit handler.  
   - Auth/role: Admin.  
   - Request body: Same shape as POST, with edits.

5) **DELETE `/tour-packages/:id`**  
   - UI locations: `useDeleteTourPackage` hook.  
   - Auth/role: Admin.

---

### Bookings

6) **GET `/bookings/my-bookings`**  
   - UI locations: `useMyBookings` hook for user lists.  
   - Auth: Yes.  
   - Query params: `page`, `limit`, `status`.

7) **GET `/bookings/admin/bookings`**  
   - UI locations: admin booking list and approvals list; filters in Bookings page.  
   - Auth/role: Admin.  
   - Query params: `page`, `limit`, `q`, `type`, `dateFrom`, `dateTo`, `sort`.  
     - Example: `sort=createdAt:desc` when “newest”.  
   - Response: `data + meta (page/limit/total/totalPages)`.

8) **GET `/bookings/:id`**  
   - UI locations: booking detail (admin and user).  
   - Auth: Yes.

9) **POST `/bookings`**  
   - UI locations: create requested itinerary booking, create booking from standard, create booking from requested itinerary.  
   - Auth: Yes.  
   - Request body variants (frontend sends):
     - **Requested itinerary:** includes itinerary object with `days[]` and `activities[]`, `type: "REQUESTED"`, `tourType: "PRIVATE"`, customer fields, and dates (string).
     - **Standard booking:** includes optional itinerary object built from tour package days; `type: "STANDARD"`; tourType uppercased; customer info.
     - **Requested → booking:** includes `itineraryId` or full itinerary with `type: "CUSTOMIZED"` plus customer data.

10) **PUT `/bookings/:id` (patch-style now)**  
   - UI locations: admin edit modal, approvals resolution, requested itinerary edit, custom booking edit.  
   - Auth: Yes.  
   - Request body variants: See Section D for a compatibility matrix.  
   - Backend normalization:
     - Accepts partial fields and multiple itinerary shapes
     - Ignores missing fields
     - Dates can be ISO or YYYY-MM-DD
     - `tourType="GROUP"` normalized to `JOINER`

11) **PATCH `/bookings/:id/status`**  
   - UI locations: Approvals and Bookings admin actions.  
   - Request body: `{ status, rejectionReason?, rejectionResolution? }` with rejection fields when status is `REJECTED`.

12) **PATCH `/bookings/:id/submit`**  
   - UI locations: Itinerary requested booking “send to client.”  
   - Request body: Frontend wraps in `{ data }` (opaque).

13) **PATCH `/bookings/:id/cancel`**  
   - UI locations: admin cancel flows.

14) **DELETE `/bookings/:id`**  
   - UI locations: delete draft booking.

15) **GET `/bookings/:id/payments`**  
   - UI locations: booking payment sections.

---

### Payments

16) **POST `/bookings/:id/payments`**  
   - UI locations: user payment submission (base64 proof).  
   - Request body: `{ amount, method, type, proofOfPayment? }` (proof base64).

17) **GET `/payments/:id/proof`**  
   - UI locations: proof download in user lists and detail; axios `responseType: "blob"`.

18) **PATCH `/payments/:id/status`**  
   - UI locations: admin payment verification flows.  
   - Request body: `{ status: "VERIFIED" | "REJECTED", rejectionReason? }`.  
   - Backend behavior: `rejectionReason` is required when status is `REJECTED`, persisted to DB and returned in list responses.

---

### Collaborators

19) **Booking Collaborators**
- `GET /bookings/:id/collaborators`
- `POST /bookings/:id/collaborators { userId?; email? }`
- `DELETE /bookings/:id/collaborators/:collaboratorId`

UI location: `useCollaborators` hook in user travels flow.

---

## D) Payload Compatibility Matrix (Booking Update)

| Frontend Update Payload | Example Frontend Location | Supported After Fix | Backend Normalization Notes |
|---|---|---:|---|
| Admin edit modal: `{ destination, startDate, endDate, travelers }` | `Bookings.tsx` edit modal save | Yes | Partial update; dates accept ISO or YYYY-MM-DD; only provided fields updated. |
| Approvals: `{ isResolved: true }` | `Approvals.tsx` resolve action | Yes | `isResolved` is optional and applied patch-style. |
| Approvals: `{ rejectionReason, rejectionResolution, isResolved: false }` | `Approvals.tsx` unresolved flow | Yes | `rejectionReason` + `rejectionResolution` optional; stored on booking. |
| Total price only: `{ totalPrice }` | `Approvals.tsx` amount edit flow | Yes | Partial update; only `totalPrice` touched. |
| Custom booking edit: `{ destination, startDate, endDate, travelers, totalPrice, itinerary: days[] }` | `EditCustomizedBooking.tsx` | Yes | `itinerary` can be `days[]` array; activities optional; dates normalized. |
| Requested itinerary edit: `{ destination, customer..., startDate, endDate, travelers, totalPrice, itinerary: [ { title, destination, days[], activities[] } ] }` | `EditRequestedItinerary.tsx` | Yes | Wrapper-array accepted; days + activities merged; date normalization on day and header fields. |
| Tour type alias: `{ tourType: "GROUP" }` | Any booking update flow sending GROUP | Yes | Mapped to `JOINER` in validator/service. |

---

## E) Smoke Test Checklist (Frontend Integrator)

### Tour Package list & detail
- Open itinerary list page → verify standard packages load (**GET** `/tour-packages`).
- Open detail modal → verify **GET** `/tour-packages/:id` data loads.

### Create Standard Itinerary
- Fill destination, price, duration, days + activities.
- Submit → **POST** `/tour-packages` succeeds; list updates.

### Edit / Delete Standard Itinerary
- Edit fields → **PUT** `/tour-packages/:id` succeeds.
- Delete → **DELETE** `/tour-packages/:id` succeeds.

### Admin booking list filters
- Search by `q`, filter `type`, date range (`dateFrom`/`dateTo`), sort `createdAt:desc`.
- Confirm pagination meta is used (`page/limit/total/totalPages`).

### Create Requested Itinerary Booking
- Create from itinerary builder → **POST** `/bookings` with `type=REQUESTED` and itinerary object.

### Update booking partials
- Admin edit modal update: only destination + travelers.
- Approvals: toggle `isResolved` or set rejection reasons.

### Status transitions
- Approve/Reject/Complete/Cancel via **PATCH** `/bookings/:id/status`.

### Submit payment + proof
- Submit payment with base64 proof → **POST** `/bookings/:id/payments`.
- Download proof image → **GET** `/payments/:id/proof` with blob handling.

### Reject payment
- **PATCH** `/payments/:id/status` with `status=REJECTED` + `rejectionReason` and verify reason persists.

---

## F) Known Risks / Integration Pitfalls

- **Date formats vary across screens:**  
  Some screens send ISO strings (`toISOString()`), others send `YYYY-MM-DD` (date-only). Backend accepts both but UI should be consistent where possible to avoid timezone drift in display.
- **Proof image handling:**  
  Proof is base64 on upload, binary blob on download. Ensure Axios uses `responseType: "blob"` for `/payments/:id/proof`.
- **Pagination meta shape:**  
  Frontend expects `meta.page`, `meta.limit`, `meta.total`, `meta.totalPages`. Ensure list endpoints return this format (backend already does).

---

## G) “How to Report Bugs” Template

**Title:**  
**Endpoint:**  
**Method:**  
**Frontend file path:**  
**Request payload:**  
**Response status + body:**  
**Expected behavior:**  
**Actual behavior:**  
**Screenshot / console log (if UI):**  
**Notes:**  

### Example
- Endpoint: `/api/v1/bookings/:id`  
- Frontend file path: `src/pages/Approvals.tsx`  
- Request payload: `{ "isResolved": true }`  
- Response: `500 / { "message": "..." }`
