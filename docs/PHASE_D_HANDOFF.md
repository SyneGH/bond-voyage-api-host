# Phase D Handoff

## Endpoints
- POST /api/itineraries
- GET /api/itineraries/:id
- GET /api/itineraries
- PATCH /api/itineraries/:id
- DELETE /api/itineraries/:id
- PATCH /api/itineraries/:id/send
- PATCH /api/itineraries/:id/confirm
- POST /api/itineraries/:id/collaborators
- GET /api/itineraries/:id/collaborators
- DELETE /api/itineraries/:id/collaborators/:userId
- POST /api/bookings
- GET /api/bookings/:id
- GET /api/bookings/my-bookings
- GET /api/bookings/shared-with-me
- GET /api/bookings/admin/bookings
- PATCH /api/bookings/:id/status
- PATCH /api/bookings/:id/payment
- GET /api/weather/forecast
- GET /api/faqs
- POST /api/upload/itinerary-thumbnail

## Samples
- **POST /api/bookings**
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

- **GET /api/itineraries**
```json
{
  "data": [
    { "id": "...", "destination": "Cebu", "days": [] }
  ]
}
```

- **GET /api/faqs**
```json
{
  "data": [
    { "id": "faq-1", "question": "How do I create an itinerary?", "order": 1 }
  ]
}
```

- **GET /api/weather/forecast**
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

- **POST /api/upload/itinerary-thumbnail**
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
