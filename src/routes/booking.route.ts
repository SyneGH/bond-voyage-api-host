import { Router } from "express";
import { BookingController } from "@/controllers/booking.controller";
import { BookingChatController } from "@/controllers/booking-chat.controller";
import { PaymentController } from "@/controllers/payment.controller";
import { authenticate, authorize } from "@/middlewares/auth.middleware";
import { Role } from "@/constants/constants";
import { bookingRateLimit } from "@/middlewares/rate-limit.middleware";
import { asyncHandler } from "@/middlewares/async.middleware";
import { upload } from "@/middlewares/upload.middleware";

const router = Router();

router.use(authenticate);

// USER: list
router.get("/my-bookings", asyncHandler(BookingController.getMyBookings));
router.get("/shared-with-me", asyncHandler(BookingController.getSharedBookings));

// USER: create
router.post("/", bookingRateLimit, asyncHandler(BookingController.create));

// USER: join via Booking Code (QR code)
router.post("/join/:code", asyncHandler(BookingController.joinBooking));

// USER: submit, cancel
router.patch("/:id/submit", bookingRateLimit, asyncHandler(BookingController.submit));
router.patch("/:id/confirm", asyncHandler(BookingController.confirm));
router.patch("/:id/cancel", asyncHandler(BookingController.cancel));

// USER: edit itinerary
router.put("/:id", asyncHandler(BookingController.updateItinerary));

// USER: add payment proof
router.post("/:id/payments", asyncHandler(PaymentController.create));
router.get("/:id/payments", asyncHandler(BookingController.getPayments));

// USER: delete draft
router.delete("/:id", asyncHandler(BookingController.deleteDraft));

// USER/ADMIN: detail
router.get("/:id", asyncHandler(BookingController.getOne));

// BOOKING CHAT
router.get("/:id/chat/messages", asyncHandler(BookingChatController.getMessages));
router.post(
  "/:id/chat/messages",
  upload.array("files", parseInt(process.env.MAX_FILES || "5", 10)),
  asyncHandler(BookingChatController.sendMessage)
);
router.post("/:id/chat/ai-suggest", asyncHandler(BookingChatController.generateAiSuggestion));
router.post("/:id/chat/mark-read", asyncHandler(BookingChatController.markAsRead));
router.get("/:id/chat/unread-count", asyncHandler(BookingChatController.getUnreadCount));

// USER: version history
router.get("/:id/versions", asyncHandler(BookingController.getVersionHistory));

// ADMIN: list all (with optional status filter)
router.get(
  "/admin/bookings",
  authorize([Role.ADMIN]),
  asyncHandler(BookingController.getAllBookings)
);

// ADMIN: approve/reject
router.patch(
  "/:id/status",
  authorize([Role.ADMIN]),
  asyncHandler(BookingController.updateStatus)
);

router.post(
  "/:id/book-requested",
  authorize([Role.ADMIN]),
  asyncHandler(BookingController.bookRequested)
);
router.post(
  "/:id/move-to-requested",
  authorize([Role.ADMIN]),
  asyncHandler(BookingController.moveToRequested)
);

// COLLABORATION
router.post("/:id/collaborators", asyncHandler(BookingController.addCollaborator));
router.get("/:id/collaborators", asyncHandler(BookingController.listCollaborators));
router.delete(
  "/:id/collaborators/:collaboratorUserId",
  asyncHandler(BookingController.removeCollaborator)
);

export default router;
