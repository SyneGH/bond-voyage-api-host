# Smart Trip quick checks

## Generate an AI itinerary (stateless)
```bash
curl -X POST http://localhost:3000/api/v1/ai/itinerary \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Cebu",
    "startDate": "2025-03-01",
    "endDate": "2025-03-03",
    "travelers": 2,
    "budget": 35000,
    "travelPace": "moderate",
    "preferences": ["food", "beach"]
  }'
```

## Save Smart Trip booking (requires auth)
```bash
curl -X POST http://localhost:3000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{
    "customerName": "Pat Traveler",
    "customerEmail": "pat@example.com",
    "customerMobile": "+639171234567",
    "totalPrice": 42000,
    "itineraryType": "SMART_TRIP",
    "destination": "Cebu",
    "startDate": "2025-03-01",
    "endDate": "2025-03-03",
    "travelers": 2,
    "budget": 35000,
    "travelPace": "moderate",
    "preferences": ["food", "beach"],
    "itineraryData": [
      {
        "day": 1,
        "title": "Arrival & Taste of Cebu",
        "activities": [
          {"time": "08:00", "title": "Check-in and settle", "iconKey": "relax"},
          {"time": "12:00", "title": "Seafood lunch", "iconKey": "food"}
        ]
      },
      {
        "day": 2,
        "title": "Island Highlights",
        "activities": [
          {"time": "09:00", "title": "Beach time", "iconKey": "beach"},
          {"time": "18:00", "title": "Night market crawl", "iconKey": "food"}
        ]
      }
    ]
  }'
```
