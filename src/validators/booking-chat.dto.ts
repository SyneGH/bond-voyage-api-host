import { z } from "zod";

export const bookingChatParamsDto = z.object({
  id: z.string().uuid(),
});

export const bookingChatMessagesQueryDto = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const bookingChatSendMessageDto = z.object({
  content: z.string().trim().optional(),
});
