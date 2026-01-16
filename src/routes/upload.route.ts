import { Router } from "express";
import { asyncHandler } from "@/middlewares/async.middleware";
import { UploadController } from "@/controllers/upload.controller";
import { authenticate, authorize } from "@/middlewares/auth.middleware";
import { Role } from "@/constants/constants";
import { upload } from "@/middlewares/upload.middleware";

const router = Router();

router.post(
  "/itinerary-thumbnail",
  asyncHandler(UploadController.uploadThumbnail)
);

router.post(
  "/gcash-qr",
  authenticate,
  authorize([Role.ADMIN]),
  upload.single("file"),
  asyncHandler(UploadController.uploadGcashQr)
);

export default router;
