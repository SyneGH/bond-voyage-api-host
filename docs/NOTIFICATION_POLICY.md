# Notification Policy

## Core Principle
**Notifications are ONLY for transaction processes between USER ↔ ADMIN**

Notifications must be distinct from activity logs:
- **Activity Logs** = Comprehensive audit trail of ALL events
- **Notifications** = Only for transactions requiring cross-party action or response

## What Gets Notified

### ✅ Transactions Requiring Admin Action
- User submits booking for approval → **Notify ADMIN only**
- User submits payment for verification → **Notify ADMIN only**
- User creates inquiry → **Notify ADMIN only**

### ✅ Admin Responses to User
- Admin approves/rejects booking → **Notify USER only**
- Admin verifies/rejects payment → **Notify USER only**
- Admin replies to inquiry → **Notify USER only**

## What Does NOT Get Notified

### ❌ User Self-Actions
- User creates booking → **No notification** (user knows they created it)
- User submits payment → **No notification** (user knows they submitted it)
- User creates inquiry → **No notification** (user knows they created it)
- User updates profile → **No notification** (logged in activity logs)

### ❌ System Events
- Booking saved as draft → **No notification** (logged only)
- Auto-save operations → **No notification**
- Background processes → **No notification**

## Rationale

1. **Reduces noise**: Users don't need confirmation for actions they just performed
2. **Clear purpose**: Every notification requires action or provides important response
3. **Distinct from logs**: Activity logs = comprehensive history; Notifications = actionable items
4. **Better UX**: Notification center shows only important cross-party communications

## Implementation Guidelines

### Before Creating a Notification, Ask:
1. Is this a transaction between USER and ADMIN?
2. Does the recipient need to take action OR receive a response?
3. Is the recipient aware of this event already (did they trigger it)?

If any answer is "no", it should be logged in activity logs, not sent as a notification.

### Code Pattern
```typescript
// ❌ BAD: Notifying user about their own action
await NotificationService.create({
  userId: user.id,
  type: "BOOKING",
  title: "Booking created",
  message: "Your booking has been created."
});

// ✅ GOOD: Only notify the other party (admin)
await NotificationService.notifyAdmins({
  type: "BOOKING",
  title: "New booking requires review",
  message: `Booking ${bookingCode} submitted for approval`
});

// ✅ GOOD: Admin action notifies user
await NotificationService.create({
  userId: booking.userId,
  type: "BOOKING",
  title: "Booking approved",
  message: `Your booking ${bookingCode} has been approved.`
});
```

## Exception: SYSTEM Notifications
System-wide announcements or critical alerts may be sent to all users/admins when necessary, but should be rare and important (maintenance windows, policy changes, etc.).
