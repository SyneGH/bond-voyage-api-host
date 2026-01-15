# 🗺️ Backend API Review: Itinerary, Booking, Collaboration, Version Control & Payments

> **Generated:** January 15, 2026  
> **Scope:** Complete endpoint and flow analysis for all itinerary types

---

## Table of Contents

1. [Overview](#overview)
2. [Itinerary Types & Creation Flows](#itinerary-types--creation-flows)
   - [1.a. Standard Itinerary](#1a-standard-itinerary-tour-package-based)
   - [1.b. Requested Itinerary](#1b-requested-itinerary-admin-to-user-flow)
   - [1.c. Customized Itinerary](#1c-customized-itinerary-user-built)
   - [1.d. Smart Trip Itinerary](#1d-smart-trip-itinerary-ai-powered)
   - [1.d.1. Roaman Chat](#1d1-roaman-chat-based-ai-itinerary)
3. [Collaboration System](#collaboration-system)
4. [Version Control](#version-control)
5. [Payment System](#payment-system)
6. [Booking Status Flow](#booking-status-flow)
7. [Notification Triggers](#notification-triggers)
8. [Access Control Matrix](#access-control-matrix)
9. [Key Nuances Summary](#key-nuances-summary)

---

## Overview

The Bond Voyage backend implements a sophisticated travel booking system supporting **4 distinct itinerary types**, each with unique creation flows, collaboration models, and payment workflows.

### Tech Stack
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Cache:** Redis
- **AI:** Google Gemini API

### Core Entities Relationship

```
TourPackage (Template)
       │
       ▼ (cloned to)
  Itinerary ◄─────────────────┐
       │                      │
       ├── ItineraryDay       │
       │      └── Activity    │
       │                      │
       ├── ItineraryVersion   │
       ├── ItineraryCollaborator
       ├── ItineraryShare     │
       │                      │
       ▼                      │
   Booking ───────────────────┘
       │
       └── Payment
```

---

## Itinerary Types & Creation Flows

### 1.a. Standard Itinerary (Tour Package-based)

**Data Source:** Admin-created `TourPackage` templates in the database.

#### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/tour-packages` | Public | List available tour packages |
| `GET` | `/api/tour-packages/:id` | Public | Get package details with days/activities |
| `POST` | `/api/bookings` | User | Create booking from `tourPackageId` |

#### Admin Management Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/tour-packages` | Admin | Create tour package |
| `PUT` | `/api/tour-packages/:id` | Admin | Update tour package |
| `DELETE` | `/api/tour-packages/:id` | Admin | Delete tour package |

#### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     STANDARD ITINERARY FLOW                      │
└─────────────────────────────────────────────────────────────────┘

Frontend                          Backend
   │                                 │
   │  GET /tour-packages             │
   │────────────────────────────────►│
   │                                 │ Query TourPackage + Days + Activities
   │◄────────────────────────────────│
   │  [{ id, title, destination,     │
   │     price, days: [...] }]       │
   │                                 │
   │  User selects package           │
   │                                 │
   │  POST /bookings                 │
   │  {                              │
   │    tourPackageId: "uuid",       │
   │    customerName: "John Doe",    │ ◄── REQUIRED for Standard
   │    customerEmail: "...",        │ ◄── REQUIRED for Standard
   │    customerMobile: "...",       │ ◄── REQUIRED for Standard
   │    totalPrice: 15000,           │
   │    startDate: "2026-02-01",     │
   │    travelers: 2                 │
   │  }                              │
   │────────────────────────────────►│
   │                                 │
   │                                 │ ┌─────────────────────────────┐
   │                                 │ │ 1. Clone TourPackage →      │
   │                                 │ │    Itinerary (STANDARD)     │
   │                                 │ │ 2. Clone TourPackageDays →  │
   │                                 │ │    ItineraryDays            │
   │                                 │ │ 3. Clone Activities         │
   │                                 │ │ 4. Create ItineraryVersion  │
   │                                 │ │ 5. Generate BookingCode     │
   │                                 │ │ 6. Create Booking (DRAFT)   │
   │                                 │ │ 7. Send Notifications       │
   │                                 │ └─────────────────────────────┘
   │                                 │
   │◄────────────────────────────────│
   │  { booking with itinerary }     │
   │                                 │
```

#### Request Payload Schema

```typescript
// POST /api/bookings (Standard)
{
  tourPackageId: string;        // Required - UUID of tour package
  customerName: string;         // Required - Customer full name
  customerEmail: string;        // Required - Valid email
  customerMobile: string;       // Required - Phone number
  totalPrice: number;           // Required - Final price
  startDate?: string;           // Optional - ISO date
  endDate?: string;             // Optional - ISO date
  travelers?: number;           // Optional - Default: 1
  tourType?: "JOINER" | "PRIVATE"; // Optional - Default: PRIVATE
}
```

#### Response Structure

```typescript
{
  success: true,
  message: "Booking created",
  data: {
    id: "uuid",
    bookingCode: "BV-2026-001",
    type: "STANDARD",
    status: "DRAFT",
    destination: "Cebu",
    startDate: "2026-02-01",
    endDate: "2026-02-03",
    travelers: 2,
    totalPrice: 15000,
    customerName: "John Doe",
    customerEmail: "john@example.com",
    customerMobile: "+639123456789",
    itinerary: {
      id: "uuid",
      type: "STANDARD",
      days: [
        {
          dayNumber: 1,
          title: "Arrival Day",
          activities: [...]
        }
      ]
    }
  }
}
```

#### Nuances

- **Customer fields validation**: Required only when `type === "STANDARD"` or `tourPackageId` is provided
- **Image field aliases**: `thumbUrl` is returned as both `imageUrl` and `image` for frontend compatibility
- **Tour packages are templates**: Users can customize the cloned itinerary after booking
- **Price inheritance**: `estimatedCost` on itinerary comes from `TourPackage.price`

---

### 1.b. Requested Itinerary (Admin-to-User Flow)

**Data Source:** Admin creates a custom itinerary FOR a specific user.

#### Endpoints

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/api/bookings` | Admin | Create requested booking targeting a user |
| `PATCH` | `/api/bookings/:id/submit` | Admin | Send itinerary to user |
| `PATCH` | `/api/bookings/:id/confirm` | User | User confirms the itinerary |
| `PATCH` | `/api/bookings/:id/cancel` | User | User cancels (after SENT) |
| `POST` | `/api/bookings/:id/book-requested` | Admin | Convert to active booking |
| `POST` | `/api/bookings/:id/move-to-requested` | Admin | Revert booked back to request |

#### State Machine

```
                    ┌─────────────────────────────────────────────┐
                    │         REQUESTED ITINERARY STATES          │
                    └─────────────────────────────────────────────┘

    Itinerary.requestedStatus        Booking.status
    ─────────────────────────        ──────────────

         ┌─────────┐                  ┌─────────┐
         │  DRAFT  │                  │  DRAFT  │
         └────┬────┘                  └────┬────┘
              │                            │
              │ Admin: PATCH /submit       │
              ▼                            │
         ┌─────────┐                       │
         │  SENT   │                       │
         └────┬────┘                       │
              │                            │
      ┌───────┴───────┐                    │
      │               │                    │
      ▼               ▼                    │
┌───────────┐   ┌───────────┐              │
│ CONFIRMED │   │ CANCELLED │              │
└─────┬─────┘   └───────────┘              │
      │                                    │
      │ Admin: POST /book-requested        │
      ▼                                    ▼
                                    ┌───────────┐
      New Booking Created ─────────►│ CONFIRMED │
      (requestedSourceBookingId)    └───────────┘
```

#### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUESTED ITINERARY FLOW                      │
└─────────────────────────────────────────────────────────────────┘

Admin                            Backend                         User
  │                                 │                              │
  │  POST /bookings                 │                              │
  │  {                              │                              │
  │    type: "REQUESTED",           │                              │
  │    userId: "<target-user>",  ◄──┼── Key: specifies recipient   │
  │    itinerary: {...},            │                              │
  │    totalPrice: 25000            │                              │
  │  }                              │                              │
  │────────────────────────────────►│                              │
  │                                 │                              │
  │                                 │ Create Itinerary (REQUESTED) │
  │                                 │ requestedStatus: DRAFT       │
  │                                 │ Create Booking (REQUESTED)   │
  │                                 │ status: DRAFT                │
  │                                 │                              │
  │◄────────────────────────────────│                              │
  │                                 │                              │
  │  PATCH /bookings/:id/submit     │                              │
  │────────────────────────────────►│                              │
  │                                 │                              │
  │                                 │ Itinerary.requestedStatus    │
  │                                 │   = SENT                     │
  │                                 │ Itinerary.sentAt = now()     │
  │                                 │                              │
  │                                 │ ─────── Notification ───────►│
  │                                 │                              │
  │                                 │                              │
  │                                 │  PATCH /bookings/:id/confirm │
  │                                 │◄─────────────────────────────│
  │                                 │                              │
  │                                 │ Itinerary.requestedStatus    │
  │                                 │   = CONFIRMED                │
  │                                 │ Booking.status = CONFIRMED   │
  │                                 │                              │
  │  POST /bookings/:id/book-requested                             │
  │────────────────────────────────►│                              │
  │                                 │                              │
  │                                 │ Create NEW Booking           │
  │                                 │ requestedSourceBookingId     │
  │                                 │   = original.id              │
  │                                 │ status: CONFIRMED            │
  │                                 │                              │
  │◄────────────────────────────────│                              │
```

#### Request Payload - Create Requested

```typescript
// POST /api/bookings (Admin creating for user)
{
  type: "REQUESTED",
  userId: "target-user-uuid",      // Target user ID
  totalPrice: 25000,
  itinerary: {
    destination: "Palawan",
    startDate: "2026-03-15",
    endDate: "2026-03-18",
    travelers: 4,
    days: [
      {
        dayNumber: 1,
        title: "Island Hopping",
        activities: [
          {
            time: "09:00",
            title: "El Nido Tour A",
            description: "Visit Big Lagoon, Small Lagoon...",
            location: "El Nido, Palawan",
            icon: "beach",
            order: 0
          }
        ]
      }
    ]
  }
}
```

#### Nuances

- **Target user resolution**: Backend looks up user by `userId` and auto-fills `customerName`, `customerEmail`, `customerMobile`
- **State tracking**: `requestedStatus` lives on **Itinerary**, not Booking
- **Dual status fields**: `confirmStatus` enum provides secondary confirmation tracking
- **Booking creation on confirm**: `bookFromRequested` creates a **separate** booking linked via `requestedSourceBookingId`
- **Revert capability**: Admin can "move back" via `/move-to-requested` if:
  - No payments have been made (`paymentStatus === "PENDING"`)
  - Trip hasn't started (`startDate > now`)
- **Cancellation rules**: User can only cancel after SENT, before CONFIRMED

---

### 1.c. Customized Itinerary (User-built)

**Data Source:** User creates their own itinerary from scratch.

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/itineraries` | Create standalone itinerary |
| `GET` | `/api/itineraries` | List user's itineraries |
| `GET` | `/api/itineraries/:id` | Get single itinerary |
| `PATCH` | `/api/itineraries/:id` | Update itinerary (with versioning) |
| `DELETE` | `/api/itineraries/:id` | Archive itinerary |
| `POST` | `/api/bookings` | Convert itinerary to booking |
| `PUT` | `/api/bookings/:id` | Update booking's itinerary |

#### Two Creation Paths

##### Path A: Itinerary First (Planning Mode)

```
┌─────────────────────────────────────────────────────────────────┐
│                  CUSTOMIZED FLOW - PATH A                        │
│                  (Itinerary First)                               │
└─────────────────────────────────────────────────────────────────┘

User                             Backend
  │                                 │
  │  POST /itineraries              │
  │  {                              │
  │    destination: "Boracay",      │
  │    startDate: "2026-04-01",     │
  │    travelers: 2,                │
  │    days: [...]                  │
  │  }                              │
  │────────────────────────────────►│
  │                                 │
  │                                 │ Create Itinerary (CUSTOMIZED)
  │                                 │ status: DRAFT
  │                                 │ Create ItineraryVersion (v1)
  │                                 │
  │◄────────────────────────────────│
  │  { itinerary }                  │
  │                                 │
  │  ... User plans over time ...   │
  │                                 │
  │  PATCH /itineraries/:id         │
  │  { version: 1, days: [...] }    │ ◄── Optimistic locking
  │────────────────────────────────►│
  │                                 │
  │                                 │ Validate version match
  │                                 │ Update + increment version
  │                                 │ Create ItineraryVersion (v2)
  │                                 │
  │◄────────────────────────────────│
  │                                 │
  │  Ready to book!                 │
  │                                 │
  │  POST /bookings                 │
  │  {                              │
  │    itineraryId: "existing-id",  │
  │    totalPrice: 18000            │
  │  }                              │
  │────────────────────────────────►│
  │                                 │
  │                                 │ Link existing Itinerary
  │                                 │ Create Booking (DRAFT)
  │                                 │
  │◄────────────────────────────────│
```

##### Path B: Inline with Booking

```typescript
// POST /api/bookings (Inline itinerary creation)
{
  totalPrice: 18000,
  itinerary: {                      // Inline creation
    destination: "Boracay",
    startDate: "2026-04-01",
    endDate: "2026-04-03",
    travelers: 2,
    days: [
      {
        dayNumber: 1,
        title: "Beach Day",
        activities: [
          {
            time: "10:00",
            title: "Island Hopping",
            order: 0
          }
        ]
      }
    ]
  }
}
```

#### Update Payload Normalization

The backend accepts multiple payload formats for itinerary updates:

```typescript
// Format 1: Direct days array
{
  version: 2,
  days: [{ dayNumber: 1, ... }]
}

// Format 2: Wrapped itinerary object
{
  version: 2,
  itinerary: {
    days: [{ dayNumber: 1, ... }]
  }
}

// Format 3: Array wrapper (legacy)
{
  version: 2,
  itinerary: [{
    destination: "...",
    days: [...]
  }]
}

// Format 4: Activities with dayNumber (denormalized)
{
  version: 2,
  itinerary: {
    activities: [
      { dayNumber: 1, time: "09:00", title: "...", order: 0 }
    ]
  }
}
```

All formats are normalized by `normalizeItineraryPayload()` in booking.service.ts.

#### Nuances

- **Optimistic locking**: Updates MUST include `version` field; mismatch throws `ITINERARY_VERSION_CONFLICT` (HTTP 409)
- **Customer fields**: Optional for CUSTOMIZED bookings
- **Itinerary without booking**: Itineraries can exist in planning phase without a booking
- **Archive vs Delete**: DELETE endpoint sets `status: ARCHIVED`, doesn't remove data
- **Tour type normalization**: `"GROUP"` auto-converts to `"JOINER"`

---

### 1.d. Smart Trip Itinerary (AI-Powered)

**Data Source:** AI generates itinerary from user preferences via Gemini API.

#### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/ai/itinerary` | Public | Generate AI itinerary (preview) |
| `POST` | `/api/bookings` | User | Persist AI-generated itinerary |

#### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SMART TRIP FLOW                               │
└─────────────────────────────────────────────────────────────────┘

Frontend                         Backend                      Gemini API
   │                                │                              │
   │  POST /ai/itinerary            │                              │
   │  {                             │                              │
   │    destination: "Cebu",        │                              │
   │    startDate: "2026-05-01",    │                              │
   │    endDate: "2026-05-03",      │                              │
   │    travelers: 2,               │                              │
   │    budget: 20000,              │                              │
   │    travelPace: "moderate",     │                              │
   │    preferences: ["beach",      │                              │
   │      "food", "culture"]        │                              │
   │  }                             │                              │
   │───────────────────────────────►│                              │
   │                                │                              │
   │                                │  Structured Prompt           │
   │                                │─────────────────────────────►│
   │                                │                              │
   │                                │◄─────────────────────────────│
   │                                │  JSON Response               │
   │                                │                              │
   │◄───────────────────────────────│                              │
   │  {                             │                              │
   │    itinerary: [...days],       │  ◄── NOT persisted yet       │
   │    metadata: {...}             │                              │
   │  }                             │                              │
   │                                │                              │
   │  User reviews/modifies         │                              │
   │                                │                              │
   │  POST /bookings                │                              │
   │  {                             │                              │
   │    itineraryType: "SMART_TRIP",│                              │
   │    itineraryData: [            │  ◄── AI output passed here   │
   │      { day: 1, title: "...",   │                              │
   │        activities: [...] }     │                              │
   │    ],                          │                              │
   │    destination: "Cebu",        │                              │
   │    startDate: "2026-05-01",    │                              │
   │    budget: 20000,              │                              │
   │    travelPace: "moderate",     │                              │
   │    preferences: ["beach"],     │                              │
   │    totalPrice: 18500           │                              │
   │  }                             │                              │
   │───────────────────────────────►│                              │
   │                                │                              │
   │                                │ Create Itinerary (SMART_TRIP)│
   │                                │ Store travelPace, preferences│
   │                                │ Create Days + Activities     │
   │                                │ Create ItineraryVersion      │
   │                                │ Create Booking               │
   │                                │                              │
   │◄───────────────────────────────│                              │
```

#### AI Generation Request

```typescript
// POST /api/ai/itinerary
{
  destination: string;           // Required - Philippine destination
  startDate: Date;               // Required - ISO date
  endDate: Date;                 // Required - ISO date
  travelers?: number;            // Optional - Default: 2
  budget?: number;               // Optional - In PHP
  travelPace?: "relaxed" | "moderate" | "packed" | "own_pace";
  preferences?: string[];        // Optional - ["beach", "culture", "food", ...]
}
```

#### AI Generation Response

```typescript
{
  itinerary: [
    {
      day: 1,
      date: "2026-05-01",
      title: "Cebu City Historical Tour",
      activities: [
        {
          order: 1,
          time: "09:00",
          title: "Visit Magellan's Cross",
          locationName: "Magellan's Cross, P. Burgos St, Cebu City, Cebu, Philippines",
          coordinates: { lat: 10.2934, lng: 123.9021 },
          description: "Start your day at this historic landmark...",
          iconKey: "culture"
        }
      ]
    }
  ],
  metadata: {
    destination: "Cebu",
    startDate: "2026-05-01",
    endDate: "2026-05-03",
    travelers: 2,
    budget: 20000,
    travelPace: "moderate",
    preferences: ["beach", "culture", "food"]
  }
}
```

#### Valid Icon Keys

```typescript
const SMART_TRIP_ICON_KEYS = [
  "sightseeing",
  "food",
  "beach",
  "nature",
  "culture",
  "adventure",
  "shopping",
  "relaxation",
  "transport",
  "museum",
  "cafe",
  "nightlife",
  "hiking"
] as const;
```

#### Booking Payload for Smart Trip

```typescript
// POST /api/bookings
{
  itineraryType: "SMART_TRIP",
  itineraryData: [                // Required for Smart Trip
    {
      day: 1,
      title: "Day Title",
      activities: [
        {
          time: "09:00",
          title: "Activity Name",
          iconKey: "culture",
          location: "Location Name",
          description: "Description"
        }
      ]
    }
  ],
  destination: "Cebu",
  startDate: "2026-05-01",
  endDate: "2026-05-03",
  travelers: 2,
  budget: 20000,
  travelPace: "moderate",
  preferences: ["beach", "culture"],
  totalPrice: 18500,
  tourType: "PRIVATE"
}
```

#### Nuances

- **AI endpoint is unauthenticated**: Allows preview before login
- **Two-step process**: Generate (preview) → Book (persist)
- **Fallback template**: Used when `GEMINI_API_KEY` is missing
- **Coordinates included**: Each activity has `lat/lng` for map display
- **Metadata preservation**: `travelPace` and `preferences` stored on Itinerary
- **Scope limitation**: AI only generates for Philippine destinations
- **Activity minimums**: 4+ activities per day based on pace

---

### 1.d.1. Roaman (Chat-based AI Itinerary)

**Data Source:** Conversational AI assistant for iterative itinerary building.

#### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/chatbot/roaman` | Public | Conversational itinerary building |
| `POST` | `/api/chatbot/roameo` | Public | FAQ/Support chatbot (different purpose) |

#### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      ROAMAN CHAT FLOW                            │
└─────────────────────────────────────────────────────────────────┘

Frontend (Chat UI)               Backend                      Gemini
      │                             │                            │
      │  POST /chatbot/roaman       │                            │
      │  {                          │                            │
      │    prompt: "Plan a 3-day    │                            │
      │      trip to Cebu with      │                            │
      │      beach activities",     │                            │
      │    preferences: {           │ ◄── Current context        │
      │      destination: "Cebu",   │                            │
      │      travelers: 2           │                            │
      │    }                        │                            │
      │  }                          │                            │
      │────────────────────────────►│                            │
      │                             │                            │
      │                             │  Build context-aware prompt│
      │                             │───────────────────────────►│
      │                             │                            │
      │                             │◄───────────────────────────│
      │                             │  JSON with message + draft │
      │                             │                            │
      │◄────────────────────────────│                            │
      │  {                          │                            │
      │    message: "I've curated   │ ◄── Conversational         │
      │      a special route...",   │                            │
      │    draft: {                 │ ◄── Structured data        │
      │      type: "SMART_TRIP",    │                            │
      │      destination: "Cebu",   │                            │
      │      days: [...]            │                            │
      │    }                        │                            │
      │  }                          │                            │
      │                             │                            │
      │  User: "Add more food       │                            │
      │   activities to day 2"      │                            │
      │                             │                            │
      │  POST /chatbot/roaman       │                            │
      │  {                          │                            │
      │    prompt: "Add more food   │                            │
      │      activities to day 2",  │                            │
      │    preferences: {           │                            │
      │      selectedDay: 2,        │ ◄── Context for refinement │
      │      currentDayActivities:  │                            │
      │        [...]                │                            │
      │    }                        │                            │
      │  }                          │                            │
      │────────────────────────────►│                            │
      │                             │                            │
      │  ... iterative refinement   │                            │
      │                             │                            │
      │  User satisfied → Book      │                            │
      │                             │                            │
      │  POST /bookings             │                            │
      │  { itineraryData: draft.days, ... }                      │
      │────────────────────────────►│                            │
```

#### Request Payload

```typescript
// POST /api/chatbot/roaman
{
  prompt: string;                // User's natural language request
  preferences?: {
    destination?: string;
    startDate?: string;          // ISO date
    endDate?: string;            // ISO date
    travelers?: number;
    tourType?: "JOINER" | "PRIVATE";
    budget?: number;
    pace?: string;               // or travelPace
    preferences?: string[];      // Activity preferences
    selectedDay?: number;        // For day-specific edits
    currentDayActivities?: any[];// Current activities for context
    totalDays?: number;
  }
}
```

#### Response Structure

```typescript
{
  message: string;               // Conversational response
  draft: {
    type: "SMART_TRIP",
    destination: string,
    startDate: string | null,
    endDate: string | null,
    travelers: number,
    days: [
      {
        dayNumber: number,
        date: string | null,
        title: string,
        activities: [
          {
            order: number,
            time: string,
            title: string,
            locationName: string,
            coordinates: { lat: number, lng: number },
            description: string,
            iconKey: string
          }
        ]
      }
    ]
  }
}
```

#### Nuances

- **Context-aware**: Accepts `preferences` object with current planning state
- **Iterative refinement**: User can ask to modify specific days/activities
- **Same booking flow**: `draft` structure matches SMART_TRIP for direct booking
- **Scope limited to Philippines**: Destinations outside PH return explanation
- **Field normalization**: `normalizeRoamanResponse()` fixes Gemini inconsistencies:
  - `day` → `dayNumber`
  - Various coordinate key formats
  - Missing activity fields
- **Fallback behavior**: Returns template itinerary if Gemini fails

---

## Collaboration System

### Itinerary Collaboration Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/itineraries/:id/collaborators` | Add collaborator by userId |
| `GET` | `/api/itineraries/:id/collaborators` | List collaborators |
| `DELETE` | `/api/itineraries/:id/collaborators/:userId` | Remove collaborator |

### Share Token System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/itineraries/:id/shares` | Generate share token |
| `POST` | `/api/itineraries/shares/:token/accept` | Accept share invite |
| `PATCH` | `/api/itineraries/shares/:token/revoke` | Revoke share token |

### Booking Collaboration Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bookings/:id/collaborators` | Add collaborator |
| `GET` | `/api/bookings/:id/collaborators` | List collaborators |
| `DELETE` | `/api/bookings/:id/collaborators/:collaboratorUserId` | Remove collaborator |
| `GET` | `/api/bookings/shared-with-me` | List bookings shared with user |

### Share Token Mechanics

```typescript
// Token Generation
const SHARE_TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No O, 0, I, 1
const SHARE_TOKEN_LENGTH = 8;
const SHARE_TOKEN_MAX_USES = 5;

// Example token: "A3B7K9XZ"
```

#### Share Token Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHARE TOKEN FLOW                              │
└─────────────────────────────────────────────────────────────────┘

Owner                           Backend                     Invitee
  │                                │                            │
  │  POST /itineraries/:id/shares  │                            │
  │───────────────────────────────►│                            │
  │                                │                            │
  │                                │ Generate unique token      │
  │                                │ maxUses: 5, uses: 0        │
  │                                │                            │
  │◄───────────────────────────────│                            │
  │  { token: "A3B7K9XZ" }         │                            │
  │                                │                            │
  │  Share via link/QR/message ────┼───────────────────────────►│
  │                                │                            │
  │                                │                            │
  │                                │  POST /shares/:token/accept│
  │                                │◄───────────────────────────│
  │                                │                            │
  │                                │ Validate:                  │
  │                                │  - Token exists            │
  │                                │  - Not revoked             │
  │                                │  - uses < maxUses          │
  │                                │  - Not already collaborator│
  │                                │                            │
  │                                │ Add to collaborators       │
  │                                │ Increment uses             │
  │                                │                            │
  │                                │───────────────────────────►│
  │                                │  { collaborator }          │
  │                                │                            │
  │  Can revoke anytime            │                            │
  │  PATCH /shares/:token/revoke   │                            │
  │───────────────────────────────►│                            │
  │                                │                            │
  │                                │ Set revokedAt = now()      │
```

### Collaborator Permission Matrix

| Permission | Owner | Collaborator | Admin |
|------------|:-----:|:------------:|:-----:|
| View itinerary | ✅ | ✅ | ✅ |
| Edit in DRAFT status | ✅ | ✅ | ✅ |
| Edit after DRAFT | ✅ | ❌ | ✅ |
| Add collaborators | ✅ | ❌ | ❌ |
| Remove collaborators | ✅ | ❌ | ❌ |
| Generate share token | ✅ | ❌ | ❌ |
| Delete/Archive itinerary | ✅ | ❌ | ❌ |
| View version history | ✅ | ✅ | ✅ |
| Restore versions | ✅ | ❌ | ✅ |
| Submit booking | ✅ | ❌ | ✅ |

---

## Version Control

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/itineraries/:id/versions` | List all versions |
| `GET` | `/api/itineraries/:id/versions/:versionId` | Get version detail |
| `POST` | `/api/itineraries/:id/versions/:versionId/restore` | Restore to version |
| `GET` | `/api/bookings/:id/versions` | List booking's itinerary versions |

### Version Snapshot Schema

```typescript
interface ItinerarySnapshot {
  id: string;
  userId: string;
  title: string | null;
  destination: string;
  startDate: string | null;      // ISO string
  endDate: string | null;        // ISO string
  travelers: number;
  estimatedCost: number | null;  // Converted from Decimal
  type: ItineraryType;
  status: ItineraryStatus;
  tourType: TourType;
  days: Array<{
    dayNumber: number;
    date: string | null;
    title: string | null;
    activities: Array<{
      time: string;
      title: string;
      description: string | null;
      location: string | null;
      icon: string | null;
      order: number;
    }>;
  }>;
}
```

### Version Creation Triggers

| Action | Creates Version? |
|--------|:----------------:|
| Create itinerary | ✅ |
| Update itinerary | ✅ |
| Restore version | ✅ (new version with restored content) |
| Update booking itinerary | ✅ |
| Delete/Archive | ❌ |

### Optimistic Locking Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   OPTIMISTIC LOCKING                             │
└─────────────────────────────────────────────────────────────────┘

User A                          Backend                      User B
  │                                │                            │
  │  GET /itineraries/:id          │                            │
  │───────────────────────────────►│                            │
  │                                │                            │
  │◄───────────────────────────────│   GET /itineraries/:id     │
  │  { version: 3, ... }           │◄───────────────────────────│
  │                                │                            │
  │                                │───────────────────────────►│
  │                                │   { version: 3, ... }      │
  │                                │                            │
  │                                │   PATCH (version: 3)       │
  │                                │◄───────────────────────────│
  │                                │                            │
  │                                │   Update successful        │
  │                                │   New version: 4           │
  │                                │───────────────────────────►│
  │                                │                            │
  │  PATCH (version: 3)            │                            │
  │───────────────────────────────►│                            │
  │                                │                            │
  │                                │   Version mismatch!        │
  │                                │   Current: 4, Sent: 3      │
  │                                │                            │
  │◄───────────────────────────────│                            │
  │  409 Conflict                  │                            │
  │  "ITINERARY_VERSION_CONFLICT"  │                            │
  │                                │                            │
  │  Must refresh and retry        │                            │
```

### Restore Version Flow

```typescript
// POST /api/itineraries/:id/versions/:versionId/restore
{
  version: 4     // Current expected version (for conflict detection)
}

// Response: Restored itinerary with version: 5
```

The restore process:
1. Validates expected version matches current
2. Loads snapshot from target version
3. Overwrites itinerary fields
4. Deletes all current days
5. Recreates days/activities from snapshot
6. Increments version
7. Creates new version entry (with restored content)

---

## Payment System

### Endpoints

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/api/bookings/:id/payments` | User | Submit payment proof |
| `POST` | `/api/payments/booking/:bookingId` | User | Alternative submit route |
| `GET` | `/api/bookings/:id/payments` | User/Admin | List booking payments |
| `GET` | `/api/payments` | Admin | List all payments (filterable) |
| `GET` | `/api/payments/:id/proof` | User/Admin | Download proof image |
| `PATCH` | `/api/payments/:id/status` | Admin | Verify/Reject payment |

### Payment Creation

```typescript
// POST /api/bookings/:id/payments
{
  amount: number;                    // Required - Payment amount
  method?: "CASH" | "GCASH";         // Optional - Default: GCASH
  type?: "FULL" | "PARTIAL";         // Optional - Default: PARTIAL
  proofOfPayment?: string;           // Optional - Base64 encoded image
  proofMimeType?: string;            // Optional - e.g., "image/jpeg"
  transactionId?: string;            // Optional - Reference number
}
```

### Proof Image Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                   PROOF IMAGE FLOW                               │
└─────────────────────────────────────────────────────────────────┘

Frontend                         Backend                      Database
   │                                │                             │
   │  Base64 encode image           │                             │
   │  (with data URI prefix)        │                             │
   │                                │                             │
   │  POST /bookings/:id/payments   │                             │
   │  {                             │                             │
   │    amount: 5000,               │                             │
   │    proofOfPayment:             │                             │
   │      "data:image/jpeg;base64,  │                             │
   │       /9j/4AAQSkZJRg...",      │                             │
   │    proofMimeType: "image/jpeg" │                             │
   │  }                             │                             │
   │───────────────────────────────►│                             │
   │                                │                             │
   │                                │ Extract base64 content      │
   │                                │ Convert to Buffer           │
   │                                │ Validate size <= 5MB        │
   │                                │                             │
   │                                │ Store as Bytes ────────────►│
   │                                │                             │
   │                                │                             │
   │  GET /payments/:id/proof       │                             │
   │───────────────────────────────►│                             │
   │                                │                             │
   │                                │◄────────────────────────────│
   │                                │  Retrieve binary            │
   │                                │                             │
   │◄───────────────────────────────│                             │
   │  Binary response               │                             │
   │  Content-Type: image/jpeg      │                             │
   │  Content-Length: 123456        │                             │
```

### Payment Status Flow

```
         ┌─────────────┐
         │   PENDING   │ ← Initial state
         └──────┬──────┘
                │
       Admin verifies/rejects
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
  ┌──────────┐    ┌──────────┐
  │ VERIFIED │    │ REJECTED │
  └──────────┘    └─────┬────┘
                        │
                 (with rejectionReason)
```

### Payment Status Update

```typescript
// PATCH /api/payments/:id/status
{
  status: "VERIFIED" | "REJECTED";
  rejectionReason?: string;          // Required if status === "REJECTED"
}
```

### Payment Access Control

| Action | Owner | Submitter | Collaborator | Admin |
|--------|:-----:|:---------:|:------------:|:-----:|
| Submit payment | ✅ | - | ❌ | ❌ |
| View payments list | ✅ | ❌ | ❌ | ✅ |
| View proof image | ✅ | ✅ | ❌ | ✅ |
| Verify/Reject | ❌ | ❌ | ❌ | ✅ |

---

## Booking Status Flow

### Status Transition Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │            BOOKING STATUS FLOW               │
                         └─────────────────────────────────────────────┘

                              ┌─────────────┐
                              │    DRAFT    │ ← Initial state
                              └──────┬──────┘
                                     │
                                     │ User: PATCH /submit
                                     │ (validates activities exist)
                                     ▼
                              ┌─────────────┐
             ┌───────────────►│   PENDING   │◄───────────────┐
             │                └──────┬──────┘                │
             │                       │                       │
             │                ┌──────┴──────┐                │
             │                │             │                │
             │           reject         approve              │
             │           (Admin)        (Admin)              │
             │                │             │                │
             │                ▼             ▼                │
             │         ┌──────────┐  ┌──────────────┐        │
             │         │ REJECTED │  │  CONFIRMED   │        │
             │         └────┬─────┘  └──────┬───────┘        │
             │              │               │                │
             │          resubmit         complete            │
             │          (User)           (Admin)             │
             └──────────────┘               │                │
                                           ▼                │
                                    ┌──────────────┐         │
                                    │  COMPLETED   │         │
                                    └──────────────┘         │
                                                             │
                 ┌───────────────────────────────────────────┘
                 │  cancel (from DRAFT, PENDING, CONFIRMED, REJECTED)
                 ▼
          ┌──────────────┐
          │  CANCELLED   │
          └──────────────┘
```

### Allowed Transitions

```typescript
const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  REJECTED: ["PENDING", "CANCELLED"],
  COMPLETED: [],      // Terminal state
  CANCELLED: [],      // Terminal state
};
```

### Status Endpoints

| Endpoint | Who | From Status | To Status |
|----------|-----|-------------|-----------|
| `PATCH /:id/submit` | User | DRAFT, REJECTED | PENDING |
| `PATCH /:id/status` | Admin | Any (per rules) | Any (per rules) |
| `PATCH /:id/cancel` | User | DRAFT, PENDING, CONFIRMED, REJECTED | CANCELLED |
| `PATCH /:id/confirm` | User | (REQUESTED only) | CONFIRMED |

---

## Notification Triggers

### Booking Notifications

| Event | User Notified | Admin Notified | Message Example |
|-------|:-------------:|:--------------:|-----------------|
| Booking created | ✅ | ✅ | "Your booking to Cebu has been created" |
| Booking submitted | ✅ | ✅ | "Booking BV-2026-001 submitted for approval" |
| Booking approved | ✅ | ❌ | "Your booking BV-2026-001 status is now CONFIRMED" |
| Booking rejected | ✅ | ❌ | "Your booking BV-2026-001 was rejected" |
| Booking cancelled | ✅ | ❌ | "Your booking BV-2026-001 status is now CANCELLED" |

### Payment Notifications

| Event | User Notified | Admin Notified | Message Example |
|-------|:-------------:|:--------------:|-----------------|
| Payment submitted | ✅ | ✅ | "Your payment for booking BV-2026-001 has been submitted" |
| Payment verified | ✅ | ❌ | "Your payment for booking BV-2026-001 was verified" |
| Payment rejected | ✅ | ❌ | "Your payment for booking BV-2026-001 was rejected" |

### Notification Data Structure

```typescript
// Notification payload
{
  userId: string;
  type: "BOOKING" | "PAYMENT" | "INQUIRY" | "FEEDBACK" | "SYSTEM";
  title: string;
  message: string;
  data: {
    bookingId?: string;
    bookingCode?: string;
    paymentId?: string;
    itineraryId?: string;
    destination?: string;
    status?: string;
    amount?: number;
  };
}
```

---

## Access Control Matrix

### Booking Access

| Action | Owner | Collaborator | Admin |
|--------|:-----:|:------------:|:-----:|
| View booking | ✅ | ✅ | ✅ |
| Edit booking (DRAFT) | ✅ | ✅ | ✅ |
| Edit booking (PENDING+) | ✅ | ❌ | ✅ |
| Submit booking | ✅ | ❌ | ✅ |
| Cancel booking | ✅ | ❌ | ❌ |
| Delete draft | ✅ | ❌ | ❌ |
| View payments | ✅ | ❌ | ✅ |
| Submit payment | ✅ | ❌ | ❌ |
| Approve/Reject booking | ❌ | ❌ | ✅ |
| Complete booking | ❌ | ❌ | ✅ |

### Itinerary Access

| Action | Owner | Collaborator | Admin |
|--------|:-----:|:------------:|:-----:|
| View itinerary | ✅ | ✅ | ✅ |
| Edit (DRAFT status) | ✅ | ✅ | ✅ |
| Edit (other statuses) | ✅ | ❌ | ✅ |
| Archive/Delete | ✅ | ❌ | ❌ |
| Add collaborators | ✅ | ❌ | ❌ |
| Generate share token | ✅ | ❌ | ❌ |
| View versions | ✅ | ✅ | ✅ |
| Restore versions | ✅ | ❌ | ✅ |

---

## Key Nuances Summary

### 1. Requested vs Customized Status Tracking

| Type | Status Field | Location |
|------|--------------|----------|
| REQUESTED | `requestedStatus` | Itinerary model |
| CUSTOMIZED | `status` | Booking model |
| STANDARD | `status` | Booking model |
| SMART_TRIP | `status` | Booking model |

### 2. Smart Trip Persistence

```
AI generates JSON → Frontend displays preview → User books → Backend persists
                    (NO database entry)                      (Creates records)
```

### 3. Collaborator Editing Window

- **DRAFT status**: Both owner and collaborators can edit
- **After DRAFT**: Only owner (and Admin) can edit
- This applies to both Itinerary and Booking updates

### 4. Version Conflict Handling

Always include `version` in update payloads:
```typescript
// Request
{ version: 3, days: [...] }

// If version mismatch → 409 Conflict
// Frontend should refresh data and prompt user
```

### 5. Customer Fields Requirements

| Booking Type | customerName | customerEmail | customerMobile |
|--------------|:------------:|:-------------:|:--------------:|
| STANDARD | Required | Required | Required |
| CUSTOMIZED | Optional | Optional | Optional |
| REQUESTED | Auto-filled | Auto-filled | Auto-filled |
| SMART_TRIP | Optional | Optional | Optional |

### 6. Tour Type Normalization

Backend accepts multiple formats:
- `"JOINER"` → JOINER
- `"GROUP"` → JOINER (auto-converted)
- `"PRIVATE"` → PRIVATE

### 7. Date Handling

Backend accepts:
- ISO strings: `"2026-05-01"`
- Date objects
- Unix timestamps
- All normalized via `normalizeDate()` utility

### 8. Booking Code Format

```
BV-{YEAR}-{SEQUENCE}
Examples: BV-2026-001, BV-2026-042, BV-2027-001
```

- Year-scoped sequences via `BookingSequence` table
- Auto-seeded from existing bookings
- Atomic increment with `$transaction`

### 9. Rate Limiting

- Booking creation: Rate limited via `bookingRateLimit` middleware
- Booking submission: Rate limited
- Prevents abuse of booking code generation

---

## API Quick Reference

### Authentication Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Common Response Format

```typescript
// Success
{
  success: true,
  message: string,
  data: any,
  meta?: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}

// Error
{
  success: false,
  message: string,
  error?: any
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation failed) |
| 401 | Unauthorized |
| 403 | Forbidden (no permission) |
| 404 | Not Found |
| 409 | Conflict (version mismatch, invalid transition) |
| 500 | Internal Server Error |

---

## Related Documentation

- [API_HANDOFF.md](./API_HANDOFF.md) - Original API handoff document
- [PHASE_J_FINAL_HANDOFF.md](./PHASE_J_FINAL_HANDOFF.md) - Final phase handoff
- [frontend_integration_handoff_itinerary_booking_payments.md](./frontend_integration_handoff_itinerary_booking_payments.md) - Frontend integration guide
- [smart-trip.md](./smart-trip.md) - Smart Trip feature documentation
