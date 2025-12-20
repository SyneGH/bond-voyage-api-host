import { Response } from "express";
import { AuthenticatedRequest } from "@/types";
import { BookingService } from "@/services/booking.service";
import { PaymentService } from "@/services/payment.service";
import {
  bookingIdParamDto,
  bookingListQueryDto,
  bookingAdminListQueryDto,
  bookingMyListQueryDto,
  collaboratorIdParamDto,
  createBookingDto,
  updateItineraryDto,
  updateStatusDto,
} from "@/validators/booking.dto";
import { BookingStatus } from "@prisma/client";
import { AppError, createResponse, throwError } from "@/utils/responseHandler";
import { HTTP_STATUS, Role } from "@/constants/constants";
import { ZodError } from "zod";
import { addCollaboratorDto } from "@/validators/collaboration.dto";
import userService from "@/services/user.service";
import { requireAuthUser } from "@/utils/requestGuards";
import { bookingPaymentListQueryDto } from "@/validators/payment.dto";

export const BookingController = {
  // POST /api/bookings
  create: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const payload = createBookingDto.parse(req.body);

      const authUser = requireAuthUser(req);

      const booking = await BookingService.createBooking({
        ...payload,
        userId: authUser.userId,
      });

      createResponse(res, HTTP_STATUS.CREATED, "Booking created", booking);
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Internal Server Error",
        error
      );
    }
  },

  // GET /api/bookings/:id
  getOne: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = bookingIdParamDto.parse(req.params);
      const booking = await BookingService.getBookingById(id);
      if (!booking) {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }

      const authUser = requireAuthUser(req);
      const bookingRecord = booking as NonNullable<typeof booking>;

      if (authUser.role !== "ADMIN" && bookingRecord.userId !== authUser.userId) {
        const isCollaborator = bookingRecord.collaborators?.some(
          (collab) => collab.userId === authUser.userId
        );

        if (!isCollaborator) {
          throwError(HTTP_STATUS.FORBIDDEN, "Forbidden");
        }
      }

      createResponse(res, HTTP_STATUS.OK, "Booking retrieved", bookingRecord);
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Internal Server Error",
        error
      );
    }
  },

  // PUT /api/bookings/:id
  updateItinerary: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = bookingIdParamDto.parse(req.params);
      const payload = updateItineraryDto.parse(req.body);

      const authUser = requireAuthUser(req);

      await BookingService.updateItinerary(id, authUser.userId, payload);

      const updated = await BookingService.getBookingById(id);
      createResponse(res, HTTP_STATUS.OK, "Booking updated", updated);
    } catch (error: any) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      if (error?.message === "BOOKING_NOT_EDITABLE") {
        throwError(HTTP_STATUS.CONFLICT, "Booking cannot be modified");
      }
      if (error?.message === "BOOKING_COLLABORATOR_NOT_ALLOWED") {
        throwError(HTTP_STATUS.CONFLICT, "Collaborators can edit only in draft");
      }
      if (error?.message === "BOOKING_FORBIDDEN") {
        throwError(HTTP_STATUS.FORBIDDEN, "Forbidden");
      }
      if (error?.message === "BOOKING_NOT_FOUND") {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Internal Server Error",
        error
      );
    }
  },

  // PATCH /api/bookings/:id/status (Admin)
  updateStatus: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = bookingIdParamDto.parse(req.params);
      const payload = updateStatusDto.parse(req.body);

      const actorId = req.user?.userId;
      const updated = await BookingService.updateStatus(
        id,
        payload.status as BookingStatus,
        payload.rejectionReason,
        payload.rejectionResolution,
        actorId
      );
      createResponse(res, HTTP_STATUS.OK, "Booking status updated", updated);
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Internal Server Error",
        error
      );
    }
  },

  // GET /api/bookings/my-bookings?page=1&limit=10
  getMyBookings: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const authUser = requireAuthUser(req);

      const { page, limit, status } = bookingMyListQueryDto.parse(req.query);

      const result = await BookingService.getUserBookingsPaginated(
        authUser.userId,
        page,
        limit,
        status as BookingStatus | undefined
      );

      createResponse(res, HTTP_STATUS.OK, "Bookings retrieved", result.items, result.meta);
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Internal Server Error",
        error
      );
    }
  },

  // GET /api/bookings/shared-with-me
  getSharedBookings: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const authUser = requireAuthUser(req);

      const { page, limit, status } = bookingListQueryDto.parse(req.query);

      const result = await BookingService.getSharedBookingsPaginated(
        authUser.userId,
        page,
        limit,
        status as BookingStatus | undefined
      );

      createResponse(res, HTTP_STATUS.OK, "Shared bookings retrieved", {
        items: result.items,
        meta: result.meta,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Internal Server Error",
        error
      );
    }
  },

  // GET /api/bookings/admin/bookings?status=PENDING
  getAllBookings: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const {
        page,
        limit,
        status,
        type,
        dateFrom,
        dateTo,
        q,
        sort,
      } = bookingAdminListQueryDto.parse(req.query);
      const result = await BookingService.getAllBookingsPaginated(
        {
          status: status as BookingStatus | undefined,
          type,
          dateFrom,
          dateTo,
          q,
          sort,
        },
        page,
        limit
      );
      createResponse(res, HTTP_STATUS.OK, "Bookings retrieved", result.items, result.meta);
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Internal Server Error",
        error
      );
    }
  },

  // GET /api/bookings/:id/payments
  getPayments: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const authUser = requireAuthUser(req);
      const { id } = bookingIdParamDto.parse(req.params);
      const { page, limit, status, dateFrom, dateTo } =
        bookingPaymentListQueryDto.parse(req.query);

      const booking = await BookingService.getBookingOwner(id);
      if (!booking) {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }

      const bookingRecord = booking as NonNullable<typeof booking>;
      const isAdmin = authUser.role === Role.ADMIN;
      const isOwner = bookingRecord.userId === authUser.userId;

      if (!isAdmin && !isOwner) {
        throwError(HTTP_STATUS.FORBIDDEN, "Forbidden");
      }

      const result = await PaymentService.getBookingPaymentsPaginated(
        id,
        page,
        limit,
        {
          status: status ?? undefined,
          dateFrom,
          dateTo,
        }
      );

      createResponse(res, HTTP_STATUS.OK, "Payments retrieved", {
        items: result.items,
        meta: result.meta,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Internal Server Error",
        error
      );
    }
  },

  // DELETE /api/bookings/:id (user can delete DRAFT only)
  deleteDraft: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const authUser = requireAuthUser(req);

      const { id } = bookingIdParamDto.parse(req.params);
      await BookingService.deleteBookingDraft(id, authUser.userId);
      createResponse(res, HTTP_STATUS.OK, "Booking deleted");
    } catch (error: any) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      if (error?.message === "CANNOT_DELETE_NON_DRAFT") {
        throwError(HTTP_STATUS.CONFLICT, "Only drafts can be deleted");
      }
      if (error?.message === "BOOKING_NOT_FOUND") {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Internal Server Error",
        error
      );
    }
  },

  // PATCH /api/bookings/:id/submit  (DRAFT -> PENDING)
  submit: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const authUser = requireAuthUser(req);

      const { id } = bookingIdParamDto.parse(req.params);
      const updated = await BookingService.submitBooking(id, authUser.userId);
      createResponse(res, HTTP_STATUS.OK, "Booking submitted", updated);
    } catch (error: any) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      if (error?.message === "CANNOT_SUBMIT") {
        throwError(HTTP_STATUS.CONFLICT, "Only drafts can be submitted");
      }
      if (error?.message === "BOOKING_NOT_FOUND") {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Internal Server Error",
        error
      );
    }
  },

  // PATCH /api/bookings/:id/cancel
  cancel: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const authUser = requireAuthUser(req);

      const { id } = bookingIdParamDto.parse(req.params);
      const updated = await BookingService.cancelBooking(id, authUser.userId);
      createResponse(res, HTTP_STATUS.OK, "Booking cancelled", updated);
    } catch (error: any) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      if (error?.message === "CANNOT_CANCEL") {
        throwError(HTTP_STATUS.CONFLICT, "Booking cannot be cancelled");
      }
      if (error?.message === "BOOKING_NOT_FOUND") {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Internal Server Error",
        error
      );
    }
  },

  // POST /api/bookings/:id/collaborators
  addCollaborator: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const authUser = requireAuthUser(req);

      const { id } = bookingIdParamDto.parse(req.params);
      const payload = addCollaboratorDto.parse(req.body);

      let collaboratorId = payload.userId;

      if (!collaboratorId && payload.email) {
        const user = await userService.findByEmail(payload.email);
        if (!user) {
          throwError(HTTP_STATUS.NOT_FOUND, "Collaborator not found");
        }
        const collaboratorUser = user as NonNullable<typeof user>;
        collaboratorId = collaboratorUser.id;
      }

      if (!collaboratorId) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Collaborator identifier required");
      }

      const collaboratorUserId = collaboratorId as string;
      const collaborator = await BookingService.addCollaborator(
        id,
        authUser.userId,
        collaboratorUserId
      );

      createResponse(res, HTTP_STATUS.CREATED, "Collaborator added", collaborator);
    } catch (error: any) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      if (error?.message === "BOOKING_NOT_FOUND") {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }
      if (error?.message === "COLLABORATOR_EXISTS") {
        throwError(HTTP_STATUS.CONFLICT, "Collaborator already added");
      }
      if (error?.message === "CANNOT_ADD_OWNER") {
        throwError(HTTP_STATUS.CONFLICT, "Owner cannot be collaborator");
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Failed to add collaborator",
        error
      );
    }
  },

  // GET /api/bookings/:id/collaborators
  listCollaborators: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const authUser = requireAuthUser(req);

      const { id } = bookingIdParamDto.parse(req.params);
      const collaborators = await BookingService.listCollaborators(
        id,
        authUser.userId
      );

      createResponse(res, HTTP_STATUS.OK, "Collaborators retrieved", collaborators);
    } catch (error: any) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      if (error?.message === "BOOKING_NOT_FOUND") {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }
      if (error?.message === "BOOKING_FORBIDDEN") {
        throwError(HTTP_STATUS.FORBIDDEN, "Forbidden");
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Failed to fetch collaborators",
        error
      );
    }
  },

  // DELETE /api/bookings/:id/collaborators/:collaboratorId
  removeCollaborator: async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const authUser = requireAuthUser(req);

      const { id } = bookingIdParamDto.parse(req.params);
      const { collaboratorId } = collaboratorIdParamDto.parse(req.params);

      await BookingService.removeCollaborator(
        id,
        authUser.userId,
        collaboratorId
      );

      createResponse(res, HTTP_STATUS.OK, "Collaborator removed");
    } catch (error: any) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      if (error?.message === "BOOKING_NOT_FOUND") {
        throwError(HTTP_STATUS.NOT_FOUND, "Booking not found");
      }
      throwError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Failed to remove collaborator",
        error
      );
    }
  },
};
