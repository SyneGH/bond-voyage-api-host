# Requested Itinerary — Frontend Hook & Integration Guide

## Assumptions

- Frontend base URL points to the backend mounted at `/api/v1`.
- The frontend keeps using existing admin/user flows; this guide documents how to wire to backend.

## Brief plan

- Confirm API base path and core DTO shapes from backend.
- Document endpoints + exact request/response shapes.
- Provide tag rules + error handling table.
- Provide wiring checklist + runtime prerequisites.

---

## 0) API Base Path

- **Base path:** `/api/v1` (all routes below are under this prefix).

---

## 1) Endpoint Reference (Requested Itinerary lifecycle)

All endpoints require:

- `Authorization: Bearer <token>`

### Admin: Create Requested Itinerary

**POST** `/api/v1/bookings`  
**Auth:** `ADMIN`  
**Purpose:** Create a requested itinerary targeted to a user.

**Request JSON (frontend source-of-truth shape):**

```json
{
  "destination": "Boracay",
  "startDate": "2026-05-01",
  "endDate": "2026-05-05",
  "totalPrice": 50000,
  "type": "REQUESTED",
  "tourType": "PRIVATE",
  "customerName": "Juan Dela Cruz",
  "customerEmail": "juan@example.com",
  "customerMobile": "09170000000",
  "userId": "TARGET_USER_UUID",
  "itinerary": {
    "destination": "Boracay",
    "travelers": 2,
    "totalDays": 5,
    "days": [
      {
        "dayNumber": 1,
        "date": "2026-05-01",
        "title": "Arrival",
        "activities": [
          {
            "time": "09:00",
            "title": "Arrival",
            "description": "Check in",
            "location": "Station 1",
            "locationData": { "name": "Station 1", "lat": 0, "lng": 0 },
            "order": 0
          }
        ]
      }
    ]
  },
  "status": "PENDING"
}
```

**Notes**

- `userId` is accepted for admin targeting. Backend will override customer contact fields from the target user if available.
- `locationData` is ignored by the backend (not persisted), but safe to send; backend only stores `location`.

**Response JSON (Booking DTO):**

```json
{
  "success": true,
  "message": "Booking created",
  "data": {
    "id": "BOOKING_UUID",
    "bookingCode": "BV-2026-001",
    "itineraryId": "ITINERARY_UUID",
    "userId": "TARGET_USER_UUID",
    "destination": "Boracay",
    "startDate": "2026-05-01T00:00:00.000Z",
    "endDate": "2026-05-05T00:00:00.000Z",
    "travelers": 2,
    "totalPrice": 50000,
    "type": "REQUESTED",
    "status": "DRAFT",
    "tourType": "PRIVATE",
    "paymentStatus": "PENDING",
    "customerName": "Juan Dela Cruz",
    "customerEmail": "juan@example.com",
    "customerMobile": "09170000000",
    "itinerary": { "id": "ITINERARY_UUID", "days": [/* ... */] },
    "ownership": "REQUESTED"
  }
}
```

### Admin: List Requested (Requested tab)

**GET** `/api/v1/bookings/admin/bookings?type=REQUESTED`  
**Auth:** `ADMIN`  
**Purpose:** Populate Admin Requested tab (list view).  
**Response:** Array of Booking DTOs.  
**Filtered behavior:** excludes requested items that were already booked (`requestedBookedAt` set) to avoid duplicates.

### Admin: Send to Client (Delivery state)

**PATCH** `/api/v1/bookings/:id/submit`  
**Auth:** `ADMIN`  
**Purpose:** For `REQUESTED` only: transition `DRAFT → SENT`.  
**Idempotent:** If already `SENT/CONFIRMED`, returns `200` with current state; if `CANCELLED`, returns `409`.  
**Resulting fields:** `itinerary.requestedStatus = SENT`, `itinerary.sentAt` set, `itinerary.sentStatus = "Sent"`.

**Response JSON:** Booking DTO (same shape as create).

### User: Travels list inclusion

**GET** `/api/v1/bookings/my-bookings`  
**Auth:** `USER`  
**Purpose:** User Travels list.

**Inclusion rules:**

- Always includes bookings where `booking.userId === viewerId`.
- Also includes requested bookings where `itinerary.userId === viewerId` and `requestedStatus` in `SENT|CONFIRMED|CANCELLED`.
- Does not include unsent requested (`DRAFT`).

### User: Confirm Requested

**PATCH** `/api/v1/bookings/:id/confirm`  
**Auth:** `USER`  
**Purpose:** `SENT → CONFIRMED`.

**Rules:**

- Only the targeted user (`itinerary.userId`) can confirm.
- Must be `SENT`; idempotent if already `CONFIRMED`.
- Sets `booking.status = CONFIRMED` (to enable “Book This Trip” in admin UI).

**Response JSON:** Booking DTO.

### User: Cancel Requested

**PATCH** `/api/v1/bookings/:id/cancel`  
**Auth:** `USER`  
**Purpose:** `SENT → CANCELLED` (requested only).

**Rules:**

- Only targeted user can cancel.
- Only if `requestedStatus = SENT`; idempotent if already `CANCELLED`.
- Also sets `booking.status = CANCELLED`.

**Response JSON:** Booking DTO.

### Admin: Book from Requested

**POST** `/api/v1/bookings/:id/book-requested`  
**Auth:** `ADMIN`  
**Purpose:** Create a booked record from a confirmed requested itinerary.

**Rules:** must be `REQUESTED + CONFIRMED` and not `CANCELLED`. Creates a new booking with:

- `requestedSourceBookingId` set to the original requested booking ID
- `status = CONFIRMED`
- `paymentStatus = PENDING`
- `tourType = PRIVATE`

Also marks the original requested booking as booked (`requestedBookedAt`).

**Response JSON:** Booking DTO for the new booked record.

### Admin: Move Back to Requested

**POST** `/api/v1/bookings/:id/move-to-requested`  
**Auth:** `ADMIN`  
**Purpose:** Revert a booked record back to requested (strict rules).

**Rules:**

- Only if booking has `requestedSourceBookingId`
- `paymentStatus` must be `PENDING`
- `startDate` must be in the future

Clears `requestedBookedAt` on the source requested booking and cancels the booked record.

---

## 2) Exact Response/DTO Shapes

### Booking DTO (all booking endpoints)

```json
{
  "id": "BOOKING_UUID",
  "bookingCode": "BV-2026-001",
  "itineraryId": "ITINERARY_UUID",
  "userId": "USER_UUID",
  "destination": "Boracay",
  "startDate": "2026-05-01T00:00:00.000Z",
  "endDate": "2026-05-05T00:00:00.000Z",
  "startDateDisplay": "May 1, 2026",
  "endDateDisplay": "May 5, 2026",
  "dateRangeDisplay": "May 1, 2026 – May 5, 2026",
  "travelers": 2,
  "totalPrice": 50000,
  "userBudget": null,
  "type": "REQUESTED",
  "status": "CONFIRMED",
  "tourType": "PRIVATE",
  "paymentStatus": "PENDING",
  "paymentReceiptUrl": null,
  "rejectionReason": null,
  "rejectionResolution": null,
  "isResolved": false,
  "customerName": "Juan Dela Cruz",
  "customerEmail": "juan@example.com",
  "customerMobile": "09170000000",
  "bookedDate": "2026-04-01T10:00:00.000Z",
  "createdAt": "2026-04-01T10:00:00.000Z",
  "updatedAt": "2026-04-01T10:00:00.000Z",
  "bookedDateDisplay": "Apr 1, 2026 10:00 AM",
  "createdAtDisplay": "Apr 1, 2026 10:00 AM",
  "updatedAtDisplay": "Apr 1, 2026 10:00 AM",
  "itinerary": { /* Itinerary DTO */ },
  "ownership": "REQUESTED"
}
```

Source: Booking DTO serialization fields.

### Itinerary DTO (nested in Booking DTO)

```json
{
  "id": "ITINERARY_UUID",
  "userId": "USER_UUID",
  "destination": "Boracay",
  "startDate": "2026-05-01T00:00:00.000Z",
  "endDate": "2026-05-05T00:00:00.000Z",
  "travelers": 2,
  "type": "REQUESTED",
  "status": "DRAFT",
  "tourType": "PRIVATE",
  "sentStatus": "Sent",
  "requestedStatus": "SENT",
  "sentAt": "2026-04-02T10:00:00.000Z",
  "confirmedAt": null,
  "days": [
    {
      "id": "DAY_UUID",
      "dayNumber": 1,
      "title": "Arrival",
      "date": "2026-05-01T00:00:00.000Z",
      "activities": [
        {
          "id": "ACT_UUID",
          "time": "09:00",
          "title": "Arrival",
          "description": "Check in",
          "location": "Station 1",
          "icon": "Plane",
          "order": 0
        }
      ]
    }
  ]
}
```

Source: Itinerary DTO schema.

---

## 3) Tag Computation Rules (UI)

### Admin Requested Tab

- **Unsent:** `itinerary.requestedStatus === "DRAFT"` AND `itinerary.sentAt == null`.
- **Sent:** `itinerary.requestedStatus === "SENT"` OR `itinerary.sentAt != null`.
- **Confirmed:** `itinerary.requestedStatus === "CONFIRMED"` AND `booking.status === "CONFIRMED"`.
- **Cancelled:** `itinerary.requestedStatus === "CANCELLED"` OR `booking.status === "CANCELLED"`.
- **Requested:** `booking.type === "REQUESTED"`.
- **Private:** `booking.tourType === "PRIVATE"`.
- **Unpaid:** `booking.paymentStatus === "PENDING"`.

### User Travels (Requested filter)

- Only show Requested items where `ownership === "REQUESTED"`, and `itinerary.requestedStatus` in `SENT|CONFIRMED|CANCELLED`.
- Ownership logic: `serializeBooking` assigns `REQUESTED` if `itinerary.type=REQUESTED` and `itinerary.userId=viewerId`.

---

## 4) Error Handling Table (Requested flow)

| Action | Condition | Status | Suggested UI Message |
|---|---|---:|---|
| Send (admin) | Requested already CANCELLED | 409 | “Requested itinerary was cancelled and cannot be sent.” |
| Confirm (user) | Not SENT | 409 | “Requested itinerary must be sent before confirming.” |
| Confirm (user) | Not owner | 403 | “You don’t have access to confirm this itinerary.” |
| Cancel (user) | Not SENT | 409 | “Requested itinerary cannot be cancelled yet.” |
| Book (admin) | Not CONFIRMED | 409 | “Requested itinerary must be confirmed before booking.” |
| Move back (admin) | Paid / started / not requested-origin | 409 | “Booking can’t be moved back to requested.” |

---

## 5) Frontend Wiring Checklist

### Admin (Requested tab)

- **Create:** `POST /api/v1/bookings`  
  Invalidate: `bookings.admin.bookings`, detail query if applicable.

- **Send to client:** `PATCH /api/v1/bookings/:id/submit`  
  Invalidate: requested list + detail.

- **Book this trip:** `POST /api/v1/bookings/:id/book-requested`  
  Invalidate: requested list + bookings list.

- **Move back:** `POST /api/v1/bookings/:id/move-to-requested`  
  Invalidate: requested list + bookings list.

### User (Travels)

- **List:** `GET /api/v1/bookings/my-bookings`
- **Confirm:** `PATCH /api/v1/bookings/:id/confirm`  
  Invalidate: my bookings list + detail.
- **Cancel:** `PATCH /api/v1/bookings/:id/cancel`  
  Invalidate: my bookings list + detail.

---

## 6) Known Runtime Prerequisites

### Required env vars

- `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (required at startup).
- `DIRECT_URL` required for Prisma migrations.  
  Source: env validation schema.

### Minimal smoke tests (curl)

```bash
# Admin create requested
curl -X POST http://localhost:8087/api/v1/bookings   -H "Authorization: Bearer <ADMIN_TOKEN>"   -H "Content-Type: application/json"   -d '{...}'

# Admin send
curl -X PATCH http://localhost:8087/api/v1/bookings/<ID>/submit   -H "Authorization: Bearer <ADMIN_TOKEN>"

# User confirm
curl -X PATCH http://localhost:8087/api/v1/bookings/<ID>/confirm   -H "Authorization: Bearer <USER_TOKEN>"

# User cancel
curl -X PATCH http://localhost:8087/api/v1/bookings/<ID>/cancel   -H "Authorization: Bearer <USER_TOKEN>"
```

Base path confirmation: `/api/v1` mount.
