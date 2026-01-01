import { Router } from "express";
import { asyncHandler } from "@/middlewares/async.middleware";
import { FaqController } from "@/controllers/faq.controller";

const router = Router();

router.get("/", asyncHandler(FaqController.list));

export default router;
