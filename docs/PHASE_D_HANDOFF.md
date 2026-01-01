# Phase D Handoff

## Endpoints
- POST /api/v1/itineraries
- GET /api/v1/itineraries/:id
- GET /api/v1/itineraries
- PATCH /api/v1/itineraries/:id
- DELETE /api/v1/itineraries/:id
- PATCH /api/v1/itineraries/:id/send
- PATCH /api/v1/itineraries/:id/confirm
- POST /api/v1/itineraries/:id/collaborators
- GET /api/v1/itineraries/:id/collaborators
- DELETE /api/v1/itineraries/:id/collaborators/:userId
- POST /api/v1/bookings
- GET /api/v1/bookings/:id
- GET /api/v1/bookings/my-bookings
- GET /api/v1/bookings/shared-with-me
- GET /api/v1/bookings/admin/bookings
- PATCH /api/v1/bookings/:id/status
- PATCH /api/v1/bookings/:id/payment
- GET /api/v1/weather/forecast
- GET /api/v1/faqs
- POST /api/v1/upload/itinerary-thumbnail

## Samples
- **POST /api/v1/bookings**
```json
{
  "itineraryId": "<itinerary-id>",
  "totalPrice": 45000,
  "type": "CUSTOMIZED"
}
```
Response snippet:
```json
{
  "bookingCode": "BV-2025-001",
  "paymentStatus": "PENDING",
  "itinerary": { "id": "...", "days": [] }
}
```

- **GET /api/v1/itineraries**
```json
{
  "data": [
    { "id": "...", "destination": "Cebu", "days": [] }
  ]
}
```

- **GET /api/v1/faqs**
```json
{
  "data": [
    { "id": "faq-1", "question": "How do I create an itinerary?", "order": 1 }
  ]
}
```

- **GET /api/v1/weather/forecast**
```json
{
  "data": {
    "lat": 10.3,
    "lng": 123.9,
    "unit": "metric",
    "forecast": [
      { "date": "2025-02-10T00:00:00.000Z", "temperatureC": 26, "description": "Sunny" }
    ]
  }
}
```

- **POST /api/v1/upload/itinerary-thumbnail**
```json
{
  "url": "https://example.com/thumbnail.png"
}
```
Response:
```json
{ "data": { "url": "https://example.com/thumbnail.png" } }
```

## Known Stubs / TODOs
- FAQ uses in-memory stub (no DB table).
- Upload endpoint returns placeholder URL when no file/url provided.
- Inline itinerary creation during booking is deprecated but still supported.
- Weather forecast collapses first five OpenWeather entries when API key present; deterministic mock otherwise.
