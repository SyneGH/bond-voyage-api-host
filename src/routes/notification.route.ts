import { Router } from "express";
import { NotificationController } from "@/controllers/notification.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/middlewares/async.middleware";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(NotificationController.list));
router.patch("/mark-all-read", asyncHandler(NotificationController.markAllRead));
router.delete("/clear-read", asyncHandler(NotificationController.clearRead));
router.patch("/:id/read", asyncHandler(NotificationController.markRead));
router.patch("/:id/unread", asyncHandler(NotificationController.markUnread));
router.delete("/:id", asyncHandler(NotificationController.deleteOne));

export default router;
