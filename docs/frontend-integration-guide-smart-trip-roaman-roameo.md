# Frontend Integration Guide — Smart Trip + Roaman Chatbot

## 0. Source-of-Truth Policy

This guide treats the **frontend contract as authoritative** by deriving all routes, payloads, and response shapes from the frontend hooks/components/types that make the calls and render the data (e.g., `useChatBot`, `useFaqs`, and the shared API/types definitions).

---

## 1. Repo Map for Integrators

### 1.1 Frontend entry points (with file paths)

#### Smart Trip

- Route entry: `/user/smart-trip` renders `SmartTrip` in `App.tsx`.
- UI page & flow: `src/pages/user/SmartTrip.tsx`.
- Booking state integration (local-only): `src/components/BookingContext.tsx` (used to store Smart Trip results in local state).
- Sidebar entry: `src/components/UserSidebar.tsx` (menu item for Smart Trip).

#### Roameo (FAQ Assistant)

- UI entry: `src/components/FAQAssistant.tsx` (floating chat assistant, localStorage cache, quick actions, Roameo calls).
- Hook for API calls: `src/hooks/useChatBot.ts` (`useRoameoChatbot`).
- Types: `ChatbotRequest`, `ChatbotResponse`, `FAQSource`, `FAQAction` in `src/types/types.ts`.

#### Roaman (AI Travel Assistant)

- UI entry: `src/components/AITravelAssistant.tsx` (Roaman assistant for itinerary drafting and application).
- Hook for API calls: `src/hooks/useChatBot.ts` (`useRoamanChatbot`).
- Types: `RoamanRequest`, `RoamanResponse`, `DraftItinerary` in `src/types/types.ts`.

#### Pages embedding Roaman `AITravelAssistant`

- `CreateStandardItinerary` uses `<AITravelAssistant />`.
- `CreateRequestedItinerary` uses `<AITravelAssistant />`.
- `EditRequestedItinerary` uses `<AITravelAssistant />`.
- `CreateNewTravel` uses `<AITravelAssistant />`.
- `EditCustomizedBooking` uses `<AITravelAssistant />`.
- `EditStandardItinerary` imports `AITravelAssistant` but does not render it (current integration appears unused).

#### FAQ Management (supporting Roameo content)

- Page: `src/pages/FaqPage.tsx` (FAQ CRUD UI).
- Hooks: `src/hooks/useFaqs.ts` (list/create/update/delete).

### 1.2 Backend entry points (with file paths)

- API base prefix: `/api/v1` is mounted in `src/app.ts`.
- Route registration: `/chatbots` and `/faqs` in `src/routes/index.ts`.
- Chatbot routes: `src/routes/chatbot.route.ts` (`POST /roameo`, `POST /roaman`).
- Chatbot controller: `src/controllers/chatbot.controller.ts` (validates payloads + returns `createResponse`).
- Chatbot validators: `src/validators/chatbot.dto.ts` (Roameo question, Roaman prompt + preferences).
- Chatbot service (response shaping + Gemini flow): `src/services/chatbot.service.ts`.
- FAQ routes: `src/routes/faq.route.ts` (public list; admin-only create/update/delete).
- FAQ controller/service: `src/controllers/faq.controller.ts`, `src/services/faq.service.ts`.

---

## 2. Smart Trip Module (Frontend Contract)

### 2.1 User flow (step-by-step)

1. Input trip details in the Smart Trip form (`destination`, `startDate`, `endDate`, optional `budget`, `travelers`, `travelPace`, `preferences`, etc.).
2. Generate itinerary: when required fields are present, the UI calculates day count and generates a **local itinerary** after a 3-second delay (**no API call**).
3. Preview the generated trip summary (title, duration, total cost, inclusions, day-by-day activities).
4. Save to “My Travels”: the trip is stored in `BookingContext` with status `in-progress`, source `Generated`, and then navigates to `/user/travels`.
5. FAQ assistant is always available on the page (Roameo).

### 2.2 Frontend data model (authoritative)

#### Input shape (Smart Trip form)

- `destination`, `startDate`, `endDate`, `travelers` (string), `budget` (string)
- `preferences: string[]`
- `accommodationType`, `travelPace`

Preference IDs used by UI:
- `beach`, `mountain`, `culture`, `food`, `adventure`, `relaxation`

#### Generated output shape (client-side)

- `generatedTrip` includes: `title`, `duration`, `totalCost`, `itinerary`, `inclusions`
- Each itinerary item includes: `day`, `title`, `activities[]`
- Each activity includes: `time`, `icon` (Lucide component), `title`, `description`, `location`

#### Saved travel structure (local state)

Uses `GeneratedTripBooking` shape:
- `id`, `destination`, `startDate`, `endDate`, `travelers`, `budget`
- `status`, `bookingType`, `bookingSource`, `ownership`, `owner`, `collaborators`, `createdOn`, `itinerary`

### 2.3 Required API endpoints (authoritative list)

None. The Smart Trip page generates and stores data locally (state + `BookingContext`) and does not call any API hooks or clients in this module.

### 2.4 Mapping to backend implementation (alignment report)

No backend integration currently required for Smart Trip because the UI is fully client-driven and stores results in local context only (no API call sites are present in the Smart Trip page).

### 2.5 Manual test checklist (Smart Trip)

- Required fields validation: leave `destination`, `startDate`, or `endDate` empty and verify error toast; then complete and re-submit.
- Generate itinerary: ensure 3s “Generating…” state and preview renders with day cards + activities.
- Preferences toggle: select/deselect preference chips and ensure local state updates (visual selection).
- Save to Travels: confirm saved trip appears in `BookingContext` and navigation to `/user/travels` fires.
- Regenerate: “Generate Another Trip” resets form + state (verify cleared fields).

---

## 3. Roaman / Roameo Chatbot Module (Frontend Contract)

### 3.1 User flow (step-by-step)

#### Roameo (FAQ Assistant)

1. Chat opens from floating button; welcome message is preloaded.
2. Cached messages load from `localStorage` (24h expiry, 20 messages max).
3. User sends message → `useRoameoChatbot` POSTs to `/chatbots/roameo` with `{ question }`.
4. Response displays answer, sources, quick actions, and suggestions; error path reads `error.response.data.message` if present.

#### Roaman (AI Travel Assistant)

1. Chat opens from floating button and starts with a welcome message + suggestions.
2. User sends message → `useRoamanChatbot` POSTs to `/chatbots/roaman` with `{ prompt, preferences }`, including `selectedDay`, `destination`, `currentDayActivities`, `totalDays`.
3. Response displays assistant message; if draft exists, a draft preview opens and can be applied to update itinerary days/activities.

### 3.2 Frontend message model (authoritative)

#### Roameo message model

- `Message`: `id`, `type` (`user|ai|system`), `content`, `timestamp`, optional `suggestions`, `quickActions`, `sources`, `confidence`

#### Roaman message model

- `Message`: `id`, `type` (`user|ai|system`), `content`, `timestamp`, optional `suggestions`

#### Request/response contracts

- Roameo request/response types:
  - `ChatbotRequest { question }`
  - `ChatbotResponse { answer, confidence, sources, actions }`
- Roaman request/response types:
  - `RoamanRequest { prompt, preferences? }`
  - `RoamanResponse { success, message, data: { message, draft?, suggestions? } }`
  - `DraftItinerary` shape for draft

Draft activities are expected to have:
- `time`, `title`, optional `location`, optional `description`, optional `order`

### 3.3 Required API endpoints (authoritative list)

#### POST `/api/v1/chatbots/roameo`

- **Purpose:** FAQ-backed assistant responses (Roameo).
- **Method + Path:** `POST /api/v1/chatbots/roameo` (frontend calls `/chatbots/roameo` relative to `VITE_API_BASE_URL`, so the base URL must include `/api/v1`).
- **Auth:** Public on backend; frontend still adds Bearer token if available via interceptor.

**Request**
- Headers: `Content-Type: application/json`, `Authorization: Bearer <token>` (if present)
- Body (JSON):
```json
{ "question": "How do I create a travel plan?" }
```

**Response (success)**
- Status: `200`
- Body (`ApiResponse<ChatbotResponse>`):
```json
{
  "success": true,
  "message": "Roameo response",
  "data": {
    "answer": "…",
    "confidence": "high|medium|low",
    "sources": [{ "id": "...", "question": "...", "order": 1 }],
    "actions": [{ "label": "...", "action": "...", "type": "NAVIGATION|QUERY" }]
  }
}
```

**Response (errors)**
- Status: `400/500/501` based on backend error handling + Gemini configuration (501 if `GEMINI_API_KEY` missing).
- Schema: `ApiResponse` with `success=false`, `message`, optional `data.details` via error middleware.

**Frontend call site**
- `useRoameoChatbot` hook (used by `FAQAssistant`).

---

#### POST `/api/v1/chatbots/roaman`

- **Purpose:** AI itinerary drafting (Roaman).
- **Method + Path:** `POST /api/v1/chatbots/roaman` (frontend calls `/chatbots/roaman` relative to `VITE_API_BASE_URL`).
- **Auth:** Public on backend; frontend still adds Bearer token if available via interceptor.

**Request**
- Headers: `Content-Type: application/json`, `Authorization: Bearer <token>` (if present)
- Body (JSON):
```json
{
  "prompt": "Plan Day 2",
  "preferences": {
    "selectedDay": 2,
    "destination": "Cebu",
    "currentDayActivities": [],
    "totalDays": 4
  }
}
```

**Response (success)**
- Status: `200`
- Body (`RoamanResponse`):
```json
{
  "success": true,
  "message": "Roaman response",
  "data": {
    "message": "…",
    "draft": {
      "type": "SMART_TRIP",
      "destination": "Cebu",
      "travelers": 2,
      "days": [
        {
          "dayNumber": 1,
          "date": "2025-03-01",
          "title": "…",
          "activities": [
            {
              "time": "09:00",
              "title": "…",
              "location": "…",
              "description": "…",
              "order": 1
            }
          ]
        }
      ]
    }
  }
}
```

**Response (errors)**
- Status: `400/500/501` (Gemini missing, validation failures, etc.)
- Schema: `ApiResponse` with `success=false`, `message`, optional `data.details`.

**Frontend call site**
- `useRoamanChatbot` hook, used by `AITravelAssistant`.

---

#### GET `/api/v1/faqs`

- **Purpose:** Fetch FAQs for the admin/user FAQ UI.
- **Method + Path:** `GET /api/v1/faqs` (frontend calls `/faqs` relative to `VITE_API_BASE_URL`).
- **Auth:** Public (backend route is unprotected).

**Request**
- Headers: `Content-Type: application/json`, `Authorization: Bearer <token>` (if present)
- Query params: `search`, `page`, `limit` are supported by the hook signature (currently unused by `FaqPage`).

**Response (success)**
- Status: `200`
- Body: `ApiResponse<FAQ[]>` where each FAQ includes `id`, `question`, `answer`, `order`, `isActive`, `tags`, `targetPages`, `pageKeywords`, `category`, timestamps.

**Response (errors)**
- Schema: `ApiResponse` with `success=false`, `message`, optional `data.details`.

**Frontend call site**
- `useFaqs` hook (used by `FaqPage`).

---

#### POST `/api/v1/faqs`

- **Purpose:** Create FAQ (admin).
- **Method + Path:** `POST /api/v1/faqs` (frontend calls `/faqs`).
- **Auth:** Requires authenticated admin role on backend.

**Request**
- Headers: `Content-Type: application/json`, `Authorization: Bearer <token>`
- Body (JSON):
```json
{
  "question": "…",
  "answer": "…",
  "tags": ["…"],
  "targetPages": ["…"],
  "pageKeywords": ["…"]
}
```

**Response (success)**
- `ApiResponse<FAQ>` with created FAQ object.

---

#### PUT `/api/v1/faqs/:id`

- **Purpose:** Update FAQ (admin).
- **Method + Path:** `PUT /api/v1/faqs/:id`
- **Auth:** Requires authenticated admin role.

**Request**
- Body matches FAQ form fields: `question`, `answer`, `tags`, `targetPages`, `pageKeywords`.

**Response (success)**
- `ApiResponse<FAQ>`.

---

#### DELETE `/api/v1/faqs/:id`

- **Purpose:** Delete FAQ (admin).
- **Method + Path:** `DELETE /api/v1/faqs/:id`
- **Auth:** Requires authenticated admin role.

**Response (success)**
- `ApiResponse` with success message.

### 3.4 Mapping to backend implementation (alignment report)

#### POST `/api/v1/chatbots/roameo`

- Matches FE contract: **Partial**
- Mismatches:
  - Backend returns `sources` with only `id`, `question`, `order`, while frontend `FAQSource` optionally supports `answer`, `tags`, `targetPages`, `pageKeywords`, etc. This limits the UI’s “Related Sources” content depth (optional fields never populate).
- Backend adjustments recommended:
  - Add optional fields (`answer`, `tags`, `targetPages`, `pageKeywords`) to `sources` in `ChatbotService.roameo` for richer UI display.
  - File: `src/services/chatbot.service.ts`.

#### POST `/api/v1/chatbots/roaman`

- Matches FE contract: **Partial**
- Mismatches:
  - Backend Roaman activities use `locationName` + `coordinates` + `iconKey`, while frontend `DraftItinerary` expects `location` (optional) and does not expect `locationName` or coordinates. UI mapping uses `activity.location`, so `locationName` currently lands as `undefined`.
- Backend adjustments recommended:
  - In `normalizeRoamanResponse`, copy `locationName` into `location` (or rename to `location` in output) and optionally preserve `locationName`/`coordinates` as extra fields if you want backward compatibility.
  - File: `src/services/chatbot.service.ts`.

#### GET `/api/v1/faqs`

- Matches FE contract: **Partial**
- Mismatches:
  - Frontend hook supports `search`, `page`, `limit` params, but backend list endpoint currently ignores query params and returns all active FAQs. If the frontend starts passing query params, pagination/search will not work as expected.
- Backend adjustments recommended:
  - Parse and apply `search`, `page`, `limit` in `FaqController.list` and/or `FaqService.listPublic`.
  - Files: `src/controllers/faq.controller.ts`, `src/services/faq.service.ts`.

### 3.5 Manual test checklist (Chatbot)

#### Roameo

- Open FAQ assistant and confirm welcome message + suggestions render.
- Send a question and verify response renders answer, sources, and quick actions.
- Clear chat history; ensure localStorage cache resets and welcome message returns.
- Verify localStorage cache expiry behavior (24h) and max 20 messages.
- Test missing Gemini key: expect 501 (documented) and FE error handling to show a toast.

#### Roaman

- Send a message with selected day and ensure `RoamanResponse.data.message` renders.
- Verify draft preview opens when draft exists and “Apply to Itinerary” updates itinerary days.
- Test error handling when chatbot fails (toast error).
- Validate preferences payload includes `selectedDay`, `destination`, `currentDayActivities`, `totalDays`.

---

## 4. Cross-cutting Integration Requirements

### 4.1 Authentication & roles

- Frontend attaches `Authorization: Bearer <accessToken>` from localStorage to all `apiClient` requests, and refreshes tokens via `/auth/refresh-token` on `401` responses (updates accessToken and retries).
- FAQ write endpoints require authenticated admin role on backend (`authenticate` + `authorize([ADMIN])`).
- Chatbot endpoints are public (no auth middleware on `/chatbots`).

### 4.2 Base URL & environment variables

- Frontend uses `VITE_API_BASE_URL` as `apiClient` base URL; all paths are relative to it.
- Backend serves APIs under `/api/v1`, so `VITE_API_BASE_URL` must include `/api/v1` (e.g., `http://localhost:8087/api/v1`).

### 4.3 Error handling contract

- Frontend expects the standard `ApiResponse` envelope with `success`, `message`, `data`, and optional `meta`.
- Backend uses `createResponse` for success and error responses, with `success` derived from status code and optional `data.details` for errors.

### 4.4 Performance considerations

- Roameo chat history is cached in localStorage (`roameo-chat-history`), capped at 20 messages with 24-hour expiry; this limits repeated API calls on reloads.
- FAQ data uses React Query with invalidation after create/update/delete; this implies short-lived cache and refetch behavior on mutations.
- No streaming or retry logic is implemented for chatbots; both use single-shot `useMutation` requests.

---

## 5. Backend “Must-Change” Delta List (Prioritized)

1. **Roaman response mapping: add `location` for activities.**
   - Affected endpoint: `POST /api/v1/chatbots/roaman`
   - Mismatch: Frontend expects `activity.location`, but backend returns `locationName` only.
   - Backend file to change: `src/services/chatbot.service.ts` (normalize output).
   - Expected behavior: Each activity should include `location` string (and may keep `locationName`/`coordinates` as extra fields).

2. **FAQ list query params support (`search`/`page`/`limit`).**
   - Affected endpoint: `GET /api/v1/faqs`
   - Mismatch: Frontend hook supports params, backend ignores them.
   - Backend files to change: `src/controllers/faq.controller.ts`, `src/services/faq.service.ts`.
   - Expected behavior: Honor `search`, `page`, `limit` (and return `meta` when paginating).

3. **Roameo sources enrichment (optional).**
   - Affected endpoint: `POST /api/v1/chatbots/roameo`
   - Mismatch: Frontend `FAQSource` supports optional `answer`, `tags`, etc., but backend returns only `id`, `question`, `order`.
   - Backend file to change: `src/services/chatbot.service.ts`.
   - Expected behavior: Include additional FAQ fields in sources to improve UI display.

---

## 6. Quick-start for Frontend Integrators

- Frontend dev server: `npm run dev` in `/bond-voyage-main`.
- Backend dev server: `npm run dev` in `/bond-voyage-api-host-main`.
- Required FE env var: `VITE_API_BASE_URL` (should include `/api/v1`).
- Chatbot dependency: `GEMINI_API_KEY` is required for chatbot endpoints; backend returns `501` if missing.
- Auth token handling: Ensure login flow populates localStorage `accessToken`/`refreshToken`; the client refreshes tokens via `/auth/refresh-token` on `401`s.
