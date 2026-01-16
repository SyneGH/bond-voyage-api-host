import { Response } from "express";
import { ZodError } from "zod";
import { HTTP_STATUS } from "@/constants/constants";
import { AuthenticatedRequest } from "@/types";
import { AppError, createResponse, throwError } from "@/utils/responseHandler";
import { PaymentSettingsService } from "@/services/payment-settings.service";
import { updatePaymentSettingsDto } from "@/validators/payment-settings.dto";

export class PaymentSettingsController {
  static get = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const settings = await PaymentSettingsService.getOrCreateDefault();
      createResponse(res, HTTP_STATUS.OK, "Payment settings fetched", {
        settings,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Failed to fetch payment settings",
        error instanceof Error ? { message: error.message } : undefined
      );
    }
  };

  static update = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const payload = updatePaymentSettingsDto.parse(req.body);
      const settings = await PaymentSettingsService.updateDefault(payload);
      createResponse(res, HTTP_STATUS.OK, "Payment settings updated", {
        settings,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) throw error;
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Failed to update payment settings",
        error instanceof Error ? { message: error.message } : undefined
      );
    }
  };
}
