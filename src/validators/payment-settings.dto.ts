import { z } from "zod";

export const updatePaymentSettingsDto = z
  .object({
    accountName: z.string().min(2).max(100).optional(),
    gcashMobile: z.string().min(5).max(30).optional(),
    gcashQrCodeUrl: z.string().url().nullable().optional(),
  })
  .strict();
