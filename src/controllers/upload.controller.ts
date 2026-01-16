import { Request, Response } from "express";
import { HTTP_STATUS } from "@/constants/constants";
import { createResponse } from "@/utils/responseHandler";
import { PaymentSettingsService } from "@/services/payment-settings.service";

const PLACEHOLDER_URL = "https://placehold.co/600x400?text=itinerary-thumbnail";

export const UploadController = {
  uploadThumbnail: async (req: Request, res: Response): Promise<void> => {
    const file = (req as any).file;
    const bodyUrl = (req.body as any)?.url as string | undefined;
    const url = bodyUrl || file?.location || file?.url || PLACEHOLDER_URL;

    createResponse(res, HTTP_STATUS.OK, "Thumbnail uploaded", { url });
  },

  uploadGcashQr: async (req: Request, res: Response): Promise<void> => {
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      createResponse(res, HTTP_STATUS.BAD_REQUEST, "QR file is required");
      return;
    }

    const host = `${req.protocol}://${req.get("host")}`;
    const url = `${host}/uploads/${file.filename}`;

    await PaymentSettingsService.updateDefault({ gcashQrCodeUrl: url });

    createResponse(res, HTTP_STATUS.OK, "GCash QR uploaded", { url });
  },
};
