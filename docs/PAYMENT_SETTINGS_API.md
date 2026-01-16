# Payment Settings API (GCash QR)

## Overview
This API stores and serves the payment configuration used on the user payment UI (GCash number + QR image).

- Base path: `/api/v1`
- Auth: Bearer token via `Authorization: Bearer <token>`
- QR upload storage: server filesystem under `/uploads/*` and served publicly by the backend.

## Data Model

**PaymentSettings** (singleton)
- `accountName`: string
- `gcashMobile`: string
- `gcashQrCodeUrl`: string | null

The backend enforces a single row (keyed as `default`).

---

## 1) Upload GCash QR (Admin)

**POST** `/upload/gcash-qr`

### Access
- Requires authentication
- Requires admin role

### Request
- Headers:
  - `Authorization: Bearer <admin_token>`
  - `Content-Type: multipart/form-data`
- Body (multipart form fields):
  - `file` (required): image file (`png`, `jpg`, etc.)

### Example (curl)
```bash
curl -X POST "https://<host>/api/v1/upload/gcash-qr" \
  -H "Authorization: Bearer <admin_token>" \
  -F "file=@/absolute/path/to/gcash-qr.png"
```

### Success Response (200)
```json
{
  "success": true,
  "message": "GCash QR uploaded",
  "data": {
    "url": "https://<host>/uploads/<filename>.png"
  }
}
```

### Error Responses
- 400 (missing file)
```json
{
  "success": false,
  "message": "QR file is required"
}
```

- 401 (missing/invalid token)
```json
{
  "success": false,
  "message": "Access token is required"
}
```

- 403 (not admin)
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

---

## 2) Get Payment Settings (Authenticated)

**GET** `/payment-settings`

### Access
- Requires authentication

### Request
- Headers:
  - `Authorization: Bearer <token>`

### Success Response (200)
```json
{
  "success": true,
  "message": "Payment settings fetched",
  "data": {
    "settings": {
      "accountName": "4B'S TRAVEL AND TOURS",
      "gcashMobile": "09946311233",
      "gcashQrCodeUrl": "https://<host>/uploads/<filename>.png"
    }
  }
}
```

Notes:
- `gcashQrCodeUrl` can be `null` if no QR has been uploaded yet.

---

## 3) Update Payment Settings (Admin)

**PUT** `/payment-settings`

### Access
- Requires authentication
- Requires admin role

### Request
- Headers:
  - `Authorization: Bearer <admin_token>`
  - `Content-Type: application/json`

- JSON body (any subset allowed):
```json
{
  "accountName": "4B'S TRAVEL AND TOURS",
  "gcashMobile": "09946311233",
  "gcashQrCodeUrl": "https://<host>/uploads/<filename>.png"
}
```

To clear the QR code:
```json
{ "gcashQrCodeUrl": null }
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Payment settings updated",
  "data": {
    "settings": {
      "accountName": "4B'S TRAVEL AND TOURS",
      "gcashMobile": "09946311233",
      "gcashQrCodeUrl": "https://<host>/uploads/<filename>.png"
    }
  }
}
```

### Validation Errors (400)
Example:
```json
{
  "success": false,
  "message": "Validation failed",
  "data": [
    {
      "code": "invalid_string",
      "message": "Invalid url",
      "path": ["gcashQrCodeUrl"]
    }
  ]
}
```

---

## Integration Notes (Frontend)

- User UI should call `GET /api/v1/payment-settings` and display:
  - `settings.gcashMobile`
  - `settings.gcashQrCodeUrl` (as `<img src="..." />`)

- Admin UI should:
  1) upload QR via `POST /api/v1/upload/gcash-qr` (multipart `file`)
  2) optionally update name/number via `PUT /api/v1/payment-settings`

---

## Static File Serving

Uploaded files are served by the backend at:
- `GET /uploads/<filename>`

The upload endpoint returns an absolute URL:
- `https://<host>/uploads/<filename>`

Ensure your production hosting (Render) allows serving `/uploads` from the running service.
