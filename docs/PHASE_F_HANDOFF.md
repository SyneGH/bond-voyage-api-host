# Phase F Handoff — Notifications

## What changed
- Added structured notification payload validation and serialization.
- **Notifications are ONLY for transaction processes between USER and ADMIN** (distinct from activity logs).
- Emitted notifications for booking approval requests, payment verification requests/responses, booking status changes, and inquiry replies.
- Added notification endpoints with pagination and mark-read/read-all actions.

## Endpoints
- `GET /api/v1/notifications?page=1&limit=10&isRead=true|false`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`

## Notification payload shape
```json
{
  "id": "uuid",
  "userId": "uuid",
  "type": "BOOKING|PAYMENT|INQUIRY|SYSTEM|FEEDBACK",
  "title": "string|null",
  "message": "string",
  "data": { "bookingId": "uuid", "bookingCode": "BV-2025-001", "status": "PENDING" },
  "isRead": false,
  "createdAt": "2025-02-14T00:00:00.000Z"
}
```

## Sample flows
**Principle: Notifications are ONLY for transactions between USER ↔ ADMIN, not user self-actions**

- **Booking created by user** → No user notification (logged in activity); ADMIN notified for review.
- **Booking submitted by user** → No user notification (they know they submitted); ADMIN notified for approval.
- **Booking approved/rejected by admin** → USER notified (transaction complete); status + rejection reason embedded in message.
- **Payment submitted by user** → No user notification (they know they paid); ADMIN notified for verification.
- **Payment verified/rejected by admin** → USER notified (transaction complete).
- **Inquiry created by user** → No user notification (they know they inquired); ADMIN notified.
- **Inquiry replied by admin** → USER notified (admin response to inquiry).

## Validation rules
- Payloads validated per type (booking/payment/inquiry/system/feedback) before insert; invalid payloads throw `INVALID_NOTIFICATION_PAYLOAD`.

## Deployment/migration notes
- No new DB schema for Phase F; run standard deploy:
  - `npx prisma migrate deploy`
  - `npm run build`

## Smoke checks
- Create a booking, submit payment, and verify payment; confirm notifications via `GET /api/v1/notifications` with your token.
- Mark as read via `PATCH /api/v1/notifications/:id/read` or `PATCH /api/v1/notifications/read-all`.
