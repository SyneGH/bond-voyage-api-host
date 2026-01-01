# BondVoyage Backend – Frontend Handoff

**Production Base URL:** `https://bond-voyage-api-host.onrender.com/api/v1`

**Health Check:** `https://bond-voyage-api-host.onrender.com/api/v1/health`

---

## 1) Overview
BondVoyage is a Node.js + TypeScript + Express + Prisma API that powers authentication, user management, bookings, tour packages, payments, inquiries/messages, feedback, notifications, activity logs, weather, route optimization, and chatbot interactions.

**Major modules:**
- Auth
- Users
- Bookings
- Booking Collaboration
- Tour Packages
- Payments
- Inquiries + Messages
- Feedback
- Notifications
- Activity Logs
- Weather
- Route Optimization
- Chatbots
- Dashboard (Admin stats)

**Environments:**
- **Production:** `https://bond-voyage-api-host.onrender.com/api/v1`
- **Local:** `http://localhost:<PORT>/api/v1` (default `PORT=8087` in `.env`)

---

## 2) Quick Start for Frontend Developers

### Verify backend is up
```
GET https://bond-voyage-api-host.onrender.com/api/v1/health
```
Expected: `{ "success": true, "message": "API is healthy", ... }`

### Authenticate
1) **Login**
```
POST /auth/login
```
- Returns `data.accessToken` and `data.user` with `role`.
- A `refreshToken` is set as an **HTTP-only cookie**.

2) **Attach access token**
Use in all protected requests:
```
Authorization: Bearer <accessToken>
```

3) **Refresh token**
```
POST /auth/refresh
```
- Uses the `refreshToken` cookie.
- Returns a **new access token**.

### Standard headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

---

## 3) Response & Error Standardization (Mandatory)
All responses use a consistent envelope from `createResponse()`:

### Success envelope
```json
{
  "success": true,
  "message": "...",
  "data": {},
  "meta": {}
}
```
- `data` and `meta` only appear when present.

### Error envelope
```json
{
  "success": false,
  "message": "...",
  "data": {
    "details": ...
  }
}
```

#### Success example
```json
{
  "success": true,
  "message": "Bookings retrieved",
  "data": [
    {
      "id": "bkg_123",
      "destination": "Bohol",
      "status": "DRAFT"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

#### Validation error example (Zod)
```json
{
  "success": false,
  "message": "Validation failed",
  "data": {
    "details": [
      {
        "code": "invalid_type",
        "expected": "string",
        "received": "undefined",
        "path": ["email"],
        "message": "Required"
      }
    ]
  }
}
```

#### Authorization error example
```json
{
  "success": false,
  "message": "Access token is required"
}
```

---

## 4) Auth & RBAC Model

### Roles
- `USER`
- `ADMIN`

### Auth Requirements
- Most non-public routes require a valid **access token** in `Authorization: Bearer <token>`.
- `authorize()` middleware enforces **role-based access** on admin-only endpoints.

### Ownership & Collaboration Rules
- Users can only access their own bookings unless they are **collaborators** on a booking.
- Collaborators **can edit only while booking is in DRAFT**; owners can edit in DRAFT/PENDING/REJECTED.
- Admins can list/update any booking status.

**Frontend dependency:** Login response includes `data.user.role`. This determines UI permissions.

---

## 5) Environment Variables (for awareness)
These are backend-only but affect frontend behavior if missing.

**Core:**
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

**External APIs:**
- `OPENWEATHER_API_KEY` → required by `/weather`
- `GEOAPIFY_API_KEY` → required by `/routes/optimize`
- `GEMINI_API_KEY` + `GEMINI_MODEL` → required by `/chatbots/roaman`

If missing, endpoints return `400` with a `missing` key.

---

## 6) Endpoint Inventory (Core Deliverable)

### Health
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/health` | Public | Health check | - | `{ success, message, timestamp }` | - |

### Auth
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | Public | Register user | body | `data.user`, `data.accessToken` | sets refresh cookie |
| POST | `/auth/login` | Public | Login | body | `data.user`, `data.accessToken` | sets refresh cookie |
| POST | `/auth/refresh` | Public (cookie/body) | Refresh access token | cookie or body `refreshToken` | `data.accessToken` | - |
| POST | `/auth/reset-password` | Public | Reset with OTP | body | success | requires OTP in Redis |
| POST | `/auth/send-otp` | Public | Send OTP | body | success | requires Brevo API key |
| POST | `/auth/verify-otp` | Public | Verify OTP | body | success | - |
| POST | `/auth/logout` | User | Logout | cookie | success | clears refresh cookie |
| POST | `/auth/logout-all` | User | Logout all devices | - | success | - |
| GET | `/auth/profile` | User | Profile | - | `data.user` | - |

### Users
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| PUT | `/users/profile` | User | Update profile | body | `data.user` | - |
| PUT | `/users/change-password` | User | Change password | body | success | - |
| POST | `/users` | Admin | Create user | body | `data.user` | - |
| GET | `/users` | Admin | List users | query | `data.users`, `meta` | supports search/role/isActive |
| GET | `/users/:id` | Admin | User detail | params | `data.user` | cached |
| PATCH | `/users/:id` | Admin | Update user | body | `data.user` | - |
| PATCH | `/users/:id/deactivate` | Admin | Deactivate user | - | success | - |
| DELETE | `/users/:id` | Admin | Delete user | - | success | - |

### Bookings
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/bookings/my-bookings` | User | List my bookings | query | `data[]`, `meta` | page/limit/status |
| POST | `/bookings` | User | Create booking | body | booking | rate-limited |
| PUT | `/bookings/:id` | User/Collaborator | Update itinerary | body | booking | collaborators only if DRAFT |
| PATCH | `/bookings/:id/submit` | User | Submit booking | - | booking | only DRAFT |
| PATCH | `/bookings/:id/cancel` | User | Cancel booking | - | booking | not completed/cancelled |
| DELETE | `/bookings/:id` | User | Delete draft | - | success | only DRAFT |
| GET | `/bookings/:id` | User/Admin | Booking detail | params | booking | owner/collaborator/admin |
| GET | `/bookings/admin/bookings` | Admin | List all bookings | query | `data[]`, `meta` | status/type/date/q/sort |
| PATCH | `/bookings/:id/status` | Admin | Update status | body | booking | requires rejection reason/resolution when REJECTED |

### Booking Collaboration
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/bookings/:id/collaborators` | User | Add collaborator | body | collaborator | by userId or email |
| GET | `/bookings/:id/collaborators` | User | List collaborators | - | list | owner or collaborator |
| DELETE | `/bookings/:id/collaborators/:collaboratorId` | User | Remove collaborator | - | success | owner only |

### Tour Packages
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/tour-packages` | Public | List packages | query | `data[]`, `meta` | page/limit/q/isActive |
| GET | `/tour-packages/:id` | Public | Package detail | params | package | - |
| POST | `/tour-packages` | Admin | Create package | body | package | - |
| PUT | `/tour-packages/:id` | Admin | Update package | body | package | - |
| DELETE | `/tour-packages/:id` | Admin | Delete package | - | success | - |

### Payments
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/bookings/:id/payments` | User | Submit payment proof | body | payment | base64 proof allowed |
| GET | `/payments/:id/proof` | User/Admin | Fetch proof | params | binary | owner/admin/submitter |
| PATCH | `/payments/:id/status` | Admin | Verify/reject | body | payment | status: VERIFIED/REJECTED |

### Inquiries & Messages
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/inquiries` | User/Admin | List inquiries | query | `data[]`, `meta` | user filtered by role |
| POST | `/inquiries` | User | Create inquiry | body | inquiry | booking optional |
| POST | `/inquiries/:id/messages` | User/Admin | Add message | body | message | admin vs user flag |

### Feedback
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/feedback` | User | Submit feedback | body | feedback | rating 1-5 |
| GET | `/feedback` | Admin | List feedback | query | `data[]`, `meta` | - |
| PATCH | `/feedback/:id/respond` | Admin | Respond to feedback | body | feedback | - |

### Notifications
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/notifications` | User | List notifications | - | `data[]` | - |
| PATCH | `/notifications/:id/read` | User | Mark read | - | success | - |

### Activity Logs
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/activity-logs` | Admin | List logs | query | `data[]`, `meta` | page/limit/actorId/type/dateFrom/dateTo |

### Weather
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/weather` | Public | Weather lookup | query | OpenWeather response | requires `OPENWEATHER_API_KEY` |

### Route Optimization
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/routes/optimize` | Public | Optimize route | body | Geoapify response | requires `GEOAPIFY_API_KEY` |

### Chatbots
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/chatbots/roameo` | Public | FAQ bot | body | `{ message }` | rules-based |
| POST | `/chatbots/roaman` | Public | Gemini bot | body | Gemini response | requires `GEMINI_API_KEY` |

### Dashboard (Admin)
| Method | Path | Auth | Purpose | Request | Response | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/dashboard/stats` | Admin | Admin stats | query | stats object | query: `year` |

---

## 7) Detailed API Specs per Module

> All examples use base: `https://bond-voyage-api-host.onrender.com/api/v1`

### Auth

#### Register
**UI mapping:** Sign-up form

**Request**
```
POST https://bond-voyage-api-host.onrender.com/api/v1/auth/register
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "mobile": "09171234567",
  "password": "Password@123",
  "employeeId": "EMP100",
  "birthday": "1995-01-01",
  "role": "USER"
}
```

**Response (201)**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "jane@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "mobile": "09171234567",
      "role": "USER",
      "companyName": null
    },
    "accessToken": "<jwt>"
  }
}
```

**Errors**
- 400 validation
- 409 user exists

#### Login + Profile (deep example)
**UI mapping:** Login screen → profile screen

**Login Request**
```
POST https://bond-voyage-api-host.onrender.com/api/v1/auth/login
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "Password@123"
}
```

**Login Response (200)**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "jane@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "mobile": "09171234567",
      "role": "USER",
      "avatarUrl": null,
      "companyName": null,
      "customerRating": null
    },
    "accessToken": "<jwt>"
  }
}
```

**Profile Request**
```
GET https://bond-voyage-api-host.onrender.com/api/v1/auth/profile
Authorization: Bearer <jwt>
```

**Profile Response (200)**
```json
{
  "success": true,
  "message": "Profile retrieved",
  "data": {
    "user": {
      "id": "uuid",
      "email": "jane@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "mobile": "09171234567",
      "role": "USER"
    }
  }
}
```

---

### Tour Packages (deep example)

#### List packages
```
GET https://bond-voyage-api-host.onrender.com/api/v1/tour-packages?page=1&limit=10&q=bohol
```

**Response**
```json
{
  "success": true,
  "message": "Tour packages retrieved",
  "data": [
    {
      "id": "uuid",
      "title": "Bohol Getaway",
      "destination": "Bohol",
      "price": 4999,
      "duration": 3,
      "isActive": true
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

#### Get package detail
```
GET https://bond-voyage-api-host.onrender.com/api/v1/tour-packages/<id>
```

---

### Bookings (deep examples)

#### Create booking with nested itinerary
```
POST https://bond-voyage-api-host.onrender.com/api/v1/bookings
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "destination": "Bohol",
  "startDate": "2025-05-01",
  "endDate": "2025-05-03",
  "travelers": 2,
  "totalPrice": 9999,
  "type": "CUSTOMIZED",
  "tourType": "PRIVATE",
  "itinerary": [
    {
      "dayNumber": 1,
      "date": "2025-05-01",
      "activities": [
        { "time": "09:00", "title": "Check-in", "order": 1 },
        { "time": "12:00", "title": "Lunch", "order": 2 }
      ]
    }
  ]
}
```

**Response**
```json
{
  "success": true,
  "message": "Booking created",
  "data": {
    "id": "uuid",
    "status": "DRAFT",
    "destination": "Bohol",
    "itinerary": [
      {
        "dayNumber": 1,
        "activities": [
          { "time": "09:00", "title": "Check-in", "order": 1 }
        ]
      }
    ]
  }
}
```

#### Update itinerary
```
PUT https://bond-voyage-api-host.onrender.com/api/v1/bookings/<id>
Authorization: Bearer <jwt>
Content-Type: application/json

{ "destination": "Bohol", "startDate": "2025-05-01", "endDate": "2025-05-03", "travelers": 2, "totalPrice": 9999,
  "itinerary": [
    { "dayNumber": 1, "activities": [ { "time": "10:00", "title": "Beach", "order": 1 } ] }
  ]
}
```

#### Submit booking for admin approval
```
PATCH https://bond-voyage-api-host.onrender.com/api/v1/bookings/<id>/submit
Authorization: Bearer <jwt>
```

#### Admin list bookings + update status
```
GET https://bond-voyage-api-host.onrender.com/api/v1/bookings/admin/bookings?status=PENDING&sort=createdAt:desc
Authorization: Bearer <admin-jwt>
```

```
PATCH https://bond-voyage-api-host.onrender.com/api/v1/bookings/<id>/status
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "status": "CONFIRMED"
}
```

If `REJECTED`, send:
```json
{ "status": "REJECTED", "rejectionReason": "...", "rejectionResolution": "..." }
```

---

### Collaboration (deep examples)

#### Add collaborator
```
POST https://bond-voyage-api-host.onrender.com/api/v1/bookings/<id>/collaborators
Authorization: Bearer <jwt>
Content-Type: application/json

{ "userId": "collab-uuid" }
```

#### List collaborators
```
GET https://bond-voyage-api-host.onrender.com/api/v1/bookings/<id>/collaborators
Authorization: Bearer <jwt>
```

#### Remove collaborator
```
DELETE https://bond-voyage-api-host.onrender.com/api/v1/bookings/<id>/collaborators/<collaboratorId>
Authorization: Bearer <jwt>
```

---

### Payments (deep examples)

#### Upload payment proof
```
POST https://bond-voyage-api-host.onrender.com/api/v1/bookings/<id>/payments
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "amount": 5000,
  "method": "GCASH",
  "type": "PARTIAL",
  "proofMimeType": "image/png",
  "proofImageBase64": "<base64 string>",
  "transactionId": "TXN-123"
}
```

#### Admin verify/reject
```
PATCH https://bond-voyage-api-host.onrender.com/api/v1/payments/<id>/status
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{ "status": "VERIFIED" }
```

#### Fetch proof (binary)
```
GET https://bond-voyage-api-host.onrender.com/api/v1/payments/<id>/proof
Authorization: Bearer <jwt>
```

---

### Inquiries + Messages (deep examples)

#### Create inquiry
```
POST https://bond-voyage-api-host.onrender.com/api/v1/inquiries
Authorization: Bearer <jwt>
Content-Type: application/json

{ "subject": "Need help", "message": "Can I reschedule?", "bookingId": "<uuid>" }
```

#### Add message
```
POST https://bond-voyage-api-host.onrender.com/api/v1/inquiries/<id>/messages
Authorization: Bearer <jwt>
Content-Type: application/json

{ "content": "Following up." }
```

---

### Feedback (deep examples)

#### Submit feedback
```
POST https://bond-voyage-api-host.onrender.com/api/v1/feedback
Authorization: Bearer <jwt>
Content-Type: application/json

{ "rating": 5, "comment": "Great service!" }
```

#### Admin respond
```
PATCH https://bond-voyage-api-host.onrender.com/api/v1/feedback/<id>/respond
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{ "response": "Thank you!" }
```

---

### Notifications (deep examples)

#### List
```
GET https://bond-voyage-api-host.onrender.com/api/v1/notifications
Authorization: Bearer <jwt>
```

#### Mark read
```
PATCH https://bond-voyage-api-host.onrender.com/api/v1/notifications/<id>/read
Authorization: Bearer <jwt>
```

---

### Weather (deep example)
```
GET https://bond-voyage-api-host.onrender.com/api/v1/weather?lat=9.65&lng=123.85
```

---

### Route Optimization (deep example)
```
POST https://bond-voyage-api-host.onrender.com/api/v1/routes/optimize
Content-Type: application/json

{
  "origin": { "lat": 9.65, "lng": 123.85 },
  "destination": { "lat": 9.70, "lng": 123.88 },
  "waypoints": [{ "lat": 9.66, "lng": 123.86 }]
}
```

---

### Chatbots (deep examples)

#### Roameo (rules-based)
```
POST https://bond-voyage-api-host.onrender.com/api/v1/chatbots/roameo
Content-Type: application/json

{ "message": "How do I book?" }
```

#### Roaman (Gemini)
```
POST https://bond-voyage-api-host.onrender.com/api/v1/chatbots/roaman
Content-Type: application/json

{ "message": "Plan a 3-day trip", "context": "Budget: 10k" }
```

---

## 8) Pagination, Filtering, Sorting Conventions

**Supported query params:**
- `page`, `limit` (common)
- `q` (search)
- `status` (bookings)
- `type` (bookings)
- `dateFrom`, `dateTo` (bookings/activity logs)
- `sort` (bookings): `createdAt:asc|desc`, `startDate:asc|desc`

**Examples**
```
GET /bookings/admin/bookings?page=1&limit=20&status=PENDING&sort=createdAt:desc
GET /tour-packages?page=1&limit=10&q=cebu&isActive=true
GET /activity-logs?page=1&limit=20&actorId=<uuid>&dateFrom=2025-01-01
```

If a module doesn’t support a filter, it is ignored by the validator.

---

## 9) Booking Status + Type Reference

### BookingStatus
- `DRAFT`, `PENDING`, `CONFIRMED`, `REJECTED`, `COMPLETED`, `CANCELLED`

### BookingType
- `STANDARD`, `CUSTOMIZED`, `REQUESTED`

### Transitions (as implemented)
- **User:** `DRAFT → PENDING` (submit)
- **Admin:** can set `CONFIRMED`, `REJECTED`, `COMPLETED`, etc.
- **User cancel:** not allowed if already `COMPLETED` or `CANCELLED`
- **Collaborators:** can edit only when `DRAFT`

---

## 10) Payment Proof Rendering Notes (Frontend)

### Option A: Binary endpoint (current implementation)
Use `/payments/:id/proof` and render as an image source:
```html
<img src="https://bond-voyage-api-host.onrender.com/api/v1/payments/<id>/proof" />
```

### Option B: Base64 conversion (if API returns raw Buffer)
If the API returns a JSON object with `proofImage` bytes, convert to base64 and render:
```
const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer.data)));
const src = `data:${mime};base64,${base64}`;
```

---

## 11) Testing Guide (Tool-Agnostic)

### curl
```
# Health
curl https://bond-voyage-api-host.onrender.com/api/v1/health

# Login
curl -X POST https://bond-voyage-api-host.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"Password@123"}'

# Profile (replace token)
curl https://bond-voyage-api-host.onrender.com/api/v1/auth/profile \
  -H "Authorization: Bearer <token>"
```

### Postman (high-level)
1. Create a collection with base URL.
2. Login → store access token in environment.
3. Add `Authorization: Bearer {{accessToken}}` to protected routes.

### Insomnia / Thunder Client
- Same as Postman: create an environment for base URL + token.

**Render cold starts:** first request may be slow; retry health check once.

---

## 12) Troubleshooting & Gotchas
- **401**: missing/invalid token. Re-login or refresh token.
- **403**: role restriction or ownership violation.
- **Token expired**: call `/auth/refresh`, then retry with new access token.
- **External API keys missing**: weather/route/chatbot return 400 with `{ missing: "KEY" }`.
- **Large base64 uploads**: proof images must be **≤ 5MB** and body limit is `8mb`.

---

## 13) Appendix

### Glossary
- **Booking**: A travel plan tied to a user; has dates, status, and itinerary.
- **Itinerary Day**: Day-by-day schedule for a booking.
- **Activity**: Item within an itinerary day.
- **Collaborator**: Another user allowed to view/edit a booking (DRAFT only).
- **Inquiry**: Support ticket with messages.

### Example JSON Templates
**Booking (Create)**
```json
{
  "destination": "Bohol",
  "startDate": "2025-05-01",
  "endDate": "2025-05-03",
  "travelers": 2,
  "totalPrice": 9999,
  "type": "CUSTOMIZED",
  "tourType": "PRIVATE",
  "itinerary": [
    {
      "dayNumber": 1,
      "date": "2025-05-01",
      "activities": [
        { "time": "09:00", "title": "Check-in", "order": 1 }
      ]
    }
  ]
}
```

### ERD Summary (Prisma)
- `User` → `Booking` (1:N)
- `Booking` → `ItineraryDay` → `Activity`
- `Booking` → `Payment`
- `Booking` ↔ `User` via `BookingCollaborator`
- `Inquiry` → `Message`
- `User` → `Feedback`, `Notification`, `ActivityLog`
