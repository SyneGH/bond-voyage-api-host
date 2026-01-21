import { Response } from "express";
import { AuthenticatedRequest } from "@/types";
import { BookingChatService } from "@/services/booking-chat.service";
import { bookingChatMessagesQueryDto, bookingChatParamsDto, bookingChatSendMessageDto } from "@/validators/booking-chat.dto";
import { createResponse, throwError } from "@/utils/responseHandler";
import { HTTP_STATUS } from "@/constants/constants";
import { requireAuthUser } from "@/utils/requestGuards";
import { ZodError } from "zod";

export const BookingChatController = {
  // GET /api/v1/bookings/:id/chat/messages
  async getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = bookingChatParamsDto.parse(req.params);
      const { cursor, limit } = bookingChatMessagesQueryDto.parse(req.query);

      const authUser = requireAuthUser(req);
      const canAccess = await BookingChatService.canAccessChat(
        id,
        authUser.userId,
        authUser.role
      );

      if (!canAccess) {
        throwError(HTTP_STATUS.FORBIDDEN, "Forbidden");
      }

      const result = await BookingChatService.getMessages({
        bookingId: id,
        cursor,
        limit,
      });

      createResponse(res, HTTP_STATUS.OK, "Chat messages retrieved", result);
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }
      throw error;
    }
  },

  // POST /api/v1/bookings/:id/chat/messages
  async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = bookingChatParamsDto.parse(req.params);
      const { content } = bookingChatSendMessageDto.parse(req.body);

      const authUser = requireAuthUser(req);
      const canAccess = await BookingChatService.canAccessChat(
        id,
        authUser.userId,
        authUser.role
      );

      if (!canAccess) {
        throwError(HTTP_STATUS.FORBIDDEN, "Forbidden");
      }

      const files = Array.isArray((req as any).files) ? (req as any).files : [];
      const messageContent = content?.trim() ?? "";

      if (!messageContent && files.length === 0) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Message content or attachment is required");
      }

      const attachments = files.map((file: any) => ({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath: file.path,
        publicUrl: `/uploads/${file.filename}`,
      }));

      const message = await BookingChatService.sendMessage({
        bookingId: id,
        senderUserId: authUser.userId,
        senderRole: authUser.role,
        content: messageContent || "(attachment)",
        attachments,
      });

      createResponse(res, HTTP_STATUS.CREATED, "Message sent", message);
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }
      throw error;
    }
  },

  // POST /api/v1/bookings/:id/chat/ai-suggest
  async generateAiSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = bookingChatParamsDto.parse(req.params);
      const authUser = requireAuthUser(req);

      const canAccess = await BookingChatService.canAccessChat(
        id,
        authUser.userId,
        authUser.role
      );

      if (!canAccess) {
        throwError(HTTP_STATUS.FORBIDDEN, "Forbidden");
      }

      const message = await BookingChatService.generateAiSuggestion(
        id,
        authUser.userId,
        authUser.role
      );

      createResponse(res, HTTP_STATUS.CREATED, "AI suggestion generated", message);
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }
      throw error;
    }
  },

  // POST /api/v1/bookings/:id/chat/mark-read
  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = bookingChatParamsDto.parse(req.params);
      const authUser = requireAuthUser(req);

      const canAccess = await BookingChatService.canAccessChat(
        id,
        authUser.userId,
        authUser.role
      );

      if (!canAccess) {
        throwError(HTTP_STATUS.FORBIDDEN, "Forbidden");
      }

      const result = await BookingChatService.markAsRead(
        id,
        authUser.userId,
        authUser.role
      );

      createResponse(res, HTTP_STATUS.OK, "Chat messages marked as read", result);
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }
      throw error;
    }
  },

  // GET /api/v1/bookings/:id/chat/unread-count
  async getUnreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = bookingChatParamsDto.parse(req.params);
      const authUser = requireAuthUser(req);

      const canAccess = await BookingChatService.canAccessChat(
        id,
        authUser.userId,
        authUser.role
      );

      if (!canAccess) {
        throwError(HTTP_STATUS.FORBIDDEN, "Forbidden");
      }

      const result = await BookingChatService.getUnreadCount(
        id,
        authUser.userId,
        authUser.role
      );

      createResponse(res, HTTP_STATUS.OK, "Unread count retrieved", result);
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }
      throw error;
    }
  },
};
