import { Router } from "express";
import { asyncHandler } from "@/middlewares/async.middleware";
import { authenticate, authorize } from "@/middlewares/auth.middleware";
import { Role } from "@/constants/constants";
import { PaymentSettingsController } from "@/controllers/payment-settings.controller";

const router = Router();

// Users will typically be authenticated when viewing payment info
router.get("/", authenticate, asyncHandler(PaymentSettingsController.get));

// Admin-only update
router.put(
  "/",
  authenticate,
  authorize([Role.ADMIN]),
  asyncHandler(PaymentSettingsController.update)
);

export default router;
