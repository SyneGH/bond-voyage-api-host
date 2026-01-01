import {
  BookingStatus,
  BookingType,
  ItineraryType,
  Prisma,
  TourType,
} from "@prisma/client";
import { Role } from "@/constants/constants";
import { prisma } from "@/config/database";
import { logActivity } from "@/services/activity-log.service";
import { NotificationService } from "@/services/notification.service";

const BOOKING_CODE_PREFIX = "BV";
const BOOKING_CODE_PADDING = 3;

const buildBookingCode = (year: number, sequence: number) =>
  `${BOOKING_CODE_PREFIX}-${year}-${String(sequence).padStart(BOOKING_CODE_PADDING, "0")}`;

const ensureBookingSequence = async (
  tx: Prisma.TransactionClient,
  year: number
) => {
  const latestBookingForYear = await tx.booking.findFirst({
    where: { bookingCode: { startsWith: `${BOOKING_CODE_PREFIX}-${year}-` } },
    orderBy: { bookingCode: "desc" },
    select: { bookingCode: true },
  });

  const latestNumber = latestBookingForYear?.bookingCode?.split("-").at(2);
  const seedNumber = latestNumber ? Number.parseInt(latestNumber, 10) || 0 : 0;

  const sequence = await tx.bookingSequence.upsert({
    where: { year },
    update: {},
    create: {
      year,
      currentNumber: seedNumber,
      lastIssuedCode: latestBookingForYear?.bookingCode,
    },
    select: { id: true, currentNumber: true, lastIssuedCode: true },
  });

  const targetNumber = Math.max(sequence.currentNumber ?? 0, seedNumber);
  const shouldRefreshSeed =
    sequence.currentNumber < targetNumber ||
    (!sequence.lastIssuedCode && latestBookingForYear?.bookingCode);

  if (!shouldRefreshSeed) {
    return sequence;
  }

  return tx.bookingSequence.update({
    where: { id: sequence.id },
    data: {
      currentNumber: targetNumber,
      lastIssuedCode: latestBookingForYear?.bookingCode ?? sequence.lastIssuedCode,
    },
  });
};

const generateBookingCode = async (tx: Prisma.TransactionClient) => {
  const year = new Date().getFullYear();
  const sequence = await ensureBookingSequence(tx, year);

  const incremented = await tx.bookingSequence.update({
    where: { id: sequence.id },
    data: { currentNumber: { increment: 1 } },
    select: { currentNumber: true },
  });

  const bookingCode = buildBookingCode(year, incremented.currentNumber);

  await tx.bookingSequence.update({
    where: { id: sequence.id },
    data: { lastIssuedCode: bookingCode },
  });

  return bookingCode;
};

interface CreateBookingDTO {
  userId: string;
  role: string;
  itineraryId?: string;
  itinerary?: InlineItineraryDTO;
  totalPrice: number;
  type?: BookingType;
  tourType?: TourType;
}

interface InlineItineraryDTO {
  title?: string | null;
  destination: string;
  startDate?: Date | null;
  endDate?: Date | null;
  travelers: number;
  type?: ItineraryType;
  tourType?: TourType;
  days?: {
    dayNumber: number;
    date?: Date | null;
    activities: {
      time: string;
      title: string;
      description?: string | null;
      location?: string | null;
      icon?: string | null;
      order: number;
    }[];
  }[];
}

interface UpdateBookingItineraryDTO {
  destination: string;
  startDate: Date;
  endDate: Date;
  travelers: number;
  totalPrice: number;
  itinerary: {
    dayNumber: number;
    date?: Date | null;
    activities: {
      time: string;
      title: string;
      description?: string | null;
      location?: string | null;
      icon?: string | null;
      order: number;
    }[];
  }[];
}

export const BookingService = {
  async createBooking(data: CreateBookingDTO) {
    return prisma.$transaction(async (tx) => {
      const shouldCreateItinerary = !data.itineraryId && data.itinerary;

      const itinerary = shouldCreateItinerary
        ? await tx.itinerary.create({
            // Deprecated inline creation path; kept for backward compatibility with legacy clients
            data: {
              userId: data.userId,
              title: data.itinerary?.title ?? "Itinerary",
              destination: data.itinerary?.destination ?? "",
              startDate: data.itinerary?.startDate ?? undefined,
              endDate: data.itinerary?.endDate ?? undefined,
              travelers: data.itinerary?.travelers ?? 1,
              type: data.itinerary?.type ?? ItineraryType.CUSTOMIZED,
              tourType: data.itinerary?.tourType ?? data.tourType ?? TourType.PRIVATE,
              days: data.itinerary?.days
                ? {
                    create: data.itinerary.days.map((day) => ({
                      dayNumber: day.dayNumber,
                      date: day.date ?? undefined,
                      activities: { create: day.activities },
                    })),
                  }
                : undefined,
            },
            include: {
              collaborators: true,
              days: { include: { activities: true }, orderBy: { dayNumber: "asc" } },
            },
          })
        : await tx.itinerary.findUnique({
            where: { id: data.itineraryId },
            include: {
              collaborators: true,
              days: { include: { activities: true }, orderBy: { dayNumber: "asc" } },
            },
          });

      if (!itinerary) {
        throw new Error("ITINERARY_NOT_FOUND");
      }

      const isOwner = itinerary.userId === data.userId;
      const isAdmin = data.role === Role.ADMIN;

      if (!isOwner && !isAdmin) {
        throw new Error("ITINERARY_FORBIDDEN");
      }

      const bookingCode = await generateBookingCode(tx);

      const booking = await tx.booking.create({
        data: {
          bookingCode,
          userId: data.userId,
          itineraryId: itinerary.id,
          destination: itinerary.destination,
          startDate: itinerary.startDate ?? undefined,
          endDate: itinerary.endDate ?? undefined,
          travelers: itinerary.travelers,
          // Prisma Decimal accepts number for many common setups; keep as-is for MVP
          totalPrice: data.totalPrice as unknown as Prisma.Decimal,
          type: data.type ?? (itinerary.type as BookingType),
          tourType: data.tourType ?? itinerary.tourType ?? TourType.PRIVATE,
          status: BookingStatus.DRAFT,
        },
        include: {
          itinerary: {
            include: {
              collaborators: true,
              days: { include: { activities: true }, orderBy: { dayNumber: "asc" } },
            },
          },
        },
      });

      await logActivity(
        tx,
        data.userId,
        "Created Booking",
        `Created booking ${booking.id} for ${booking.destination}`
      );
      await NotificationService.create(
        {
          userId: data.userId,
          type: "BOOKING",
          title: "Booking created",
          message: `Your booking to ${booking.destination} has been created.`,
          data: {
            bookingId: booking.id,
            bookingCode: booking.bookingCode,
            status: booking.status,
            itineraryId: booking.itineraryId,
            destination: booking.destination ?? undefined,
          },
        },
        tx
      );

      await NotificationService.notifyAdmins({
        type: "BOOKING",
        title: "New booking created",
        message: `Booking ${booking.bookingCode} requires review`,
        data: {
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          status: booking.status,
          itineraryId: booking.itineraryId,
          destination: booking.destination ?? undefined,
        },
      });

      return booking;
    });
  },

  async getBookingById(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        payments: true,
        itinerary: {
          include: {
            collaborators: {
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, email: true },
                },
              },
            },
            days: {
              orderBy: { dayNumber: "asc" },
              include: { activities: { orderBy: { order: "asc" } } },
            },
          },
        },
      },
    });
  },

  async getBookingOwner(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true },
    });
  },

  async updateItinerary(
    bookingId: string,
    userId: string,
    data: UpdateBookingItineraryDTO
  ) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { itinerary: { include: { collaborators: true } } },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      const isOwner = booking.userId === userId;
      const isCollaborator = booking.itinerary.collaborators.some(
        (collab) => collab.userId === userId
      );

      if (!isOwner && !isCollaborator) {
        throw new Error("BOOKING_FORBIDDEN");
      }

      if (isCollaborator && booking.status !== "DRAFT") {
        throw new Error("BOOKING_COLLABORATOR_NOT_ALLOWED");
      }

      if (isOwner && !["DRAFT", "PENDING", "REJECTED"].includes(booking.status)) {
        throw new Error("BOOKING_NOT_EDITABLE");
      }

      await tx.itineraryDay.deleteMany({ where: { itineraryId: booking.itineraryId } });

      await tx.itinerary.update({
        where: { id: booking.itineraryId },
        data: {
          destination: data.destination,
          startDate: data.startDate,
          endDate: data.endDate,
          travelers: data.travelers,
          days: {
            create: data.itinerary.map((day) => ({
              dayNumber: day.dayNumber,
              date: day.date,
              activities: { create: day.activities },
            })),
          },
        },
      });

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          destination: data.destination,
          startDate: data.startDate,
          endDate: data.endDate,
          travelers: data.travelers,
          totalPrice: data.totalPrice as unknown as Prisma.Decimal,
          isResolved: false,
        },
      });

      await logActivity(
        tx,
        userId,
        "Updated Booking",
        `Updated itinerary for booking ${bookingId}`
      );

      return updated;
    });
  },

  async updateStatus(
    bookingId: string,
    status: BookingStatus,
    reason?: string,
    resolution?: string,
    actorId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { status: true, userId: true, bookingCode: true, itineraryId: true, destination: true },
      });

      if (!booking) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
        DRAFT: ["PENDING", "CANCELLED"],
        PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
        CONFIRMED: ["COMPLETED", "CANCELLED"],
        REJECTED: ["PENDING", "CANCELLED"],
        COMPLETED: [],
        CANCELLED: [],
      };

      if (
        booking.status !== status &&
        !allowedTransitions[booking.status].includes(status)
      ) {
        throw new Error("INVALID_STATUS_TRANSITION");
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status,
          rejectionReason: status === "REJECTED" ? reason : null,
          rejectionResolution: status === "REJECTED" ? resolution : null,
          isResolved: ["CONFIRMED", "REJECTED", "CANCELLED", "COMPLETED"].includes(
            status
          ),
        },
      });

      if (actorId) {
        const action =
          status === "CONFIRMED"
            ? "Approved Booking"
            : status === "REJECTED"
              ? "Rejected Booking"
              : status === "COMPLETED"
                ? "Completed Booking"
                : "Updated Booking Status";
        await logActivity(
          tx,
          actorId,
          action,
          `Status set to ${status} for booking ${bookingId}`
        );
      }

      await NotificationService.create(
        {
          userId: booking.userId,
          type: "BOOKING",
          title: "Booking status updated",
          message:
            status === "REJECTED"
              ? `Your booking ${booking.bookingCode} was rejected.`
              : `Your booking ${booking.bookingCode} status is now ${status}.`,
          data: {
            bookingId: bookingId,
            bookingCode: booking.bookingCode ?? undefined,
            status,
            itineraryId: booking.itineraryId ?? undefined,
            destination: booking.destination ?? undefined,
          },
        },
        tx
      );

      return updated;
    });
  },

  // =========================
  // MVP NAVIGATION ENDPOINTS
  // =========================

  async getUserBookings(userId: string) {
    return prisma.booking.findMany({
      where: { userId },
      select: {
        id: true,
        destination: true,
        startDate: true,
        endDate: true,
        totalPrice: true,
        status: true,
        type: true,
        tourType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getUserBookingsPaginated(
    userId: string,
    page = 1,
    limit = 10,
    status?: BookingStatus
  ) {
    const skip = (page - 1) * limit;
    const whereClause: Prisma.BookingWhereInput = { userId };

    if (status) {
      whereClause.status = status;
    }

    const [items, total] = await prisma.$transaction([
      prisma.booking.findMany({
        where: whereClause,
        include: {
          itinerary: {
            include: {
              collaborators: true,
              days: { include: { activities: true }, orderBy: { dayNumber: "asc" } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where: whereClause }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getSharedBookingsPaginated(
    userId: string,
    page = 1,
    limit = 10,
    status?: BookingStatus
  ) {
    const skip = (page - 1) * limit;
    const whereClause: Prisma.BookingWhereInput = {
      userId: { not: userId },
      itinerary: { collaborators: { some: { userId } } },
    };

    if (status) {
      whereClause.status = status;
    }

    const [items, total] = await prisma.$transaction([
      prisma.booking.findMany({
        where: whereClause,
        include: {
          itinerary: {
            include: {
              collaborators: true,
              days: { include: { activities: true }, orderBy: { dayNumber: "asc" } },
            },
          },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where: whereClause }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getAllBookingsPaginated(
    filters: {
      status?: BookingStatus;
      type?: "STANDARD" | "CUSTOMIZED" | "REQUESTED";
      dateFrom?: Date;
      dateTo?: Date;
      q?: string;
      sort?: "createdAt:asc" | "createdAt:desc" | "startDate:asc" | "startDate:desc";
    },
    page = 1,
    limit = 10
  ) {
    const skip = (page - 1) * limit;
    const whereClause: Prisma.BookingWhereInput = {};

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.type) {
      whereClause.type = filters.type;
    }

    if (filters.dateFrom || filters.dateTo) {
      whereClause.startDate = {
        gte: filters.dateFrom,
        lte: filters.dateTo,
      };
    }

    if (filters.q) {
      whereClause.OR = [
        { destination: { contains: filters.q, mode: "insensitive" } },
        {
          user: {
            firstName: { contains: filters.q, mode: "insensitive" },
          },
        },
        {
          user: {
            lastName: { contains: filters.q, mode: "insensitive" },
          },
        },
        {
          user: {
            email: { contains: filters.q, mode: "insensitive" },
          },
        },
      ];
    }

    const orderBy = (() => {
      switch (filters.sort) {
        case "createdAt:asc":
          return { createdAt: "asc" } as const;
        case "startDate:asc":
          return { startDate: "asc" } as const;
        case "startDate:desc":
          return { startDate: "desc" } as const;
        default:
          return { createdAt: "desc" } as const;
      }
    })();

    const [items, total] = await prisma.$transaction([
      prisma.booking.findMany({
        where: whereClause,
        include: {
          itinerary: {
            include: {
              collaborators: true,
              days: { include: { activities: true }, orderBy: { dayNumber: "asc" } },
            },
          },
          user: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.booking.count({ where: whereClause }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async deleteBookingDraft(bookingId: string, userId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: { id: true, status: true },
    });

    if (!booking) throw new Error("BOOKING_NOT_FOUND");
    if (booking.status !== "DRAFT") throw new Error("CANNOT_DELETE_NON_DRAFT");

    return prisma.booking.delete({ where: { id: bookingId } });
  },

  async submitBooking(bookingId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, userId },
        select: { id: true, status: true },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");
      if (!["DRAFT", "REJECTED"].includes(booking.status)) {
        throw new Error("CANNOT_SUBMIT");
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "PENDING",
          rejectionReason: null,
          rejectionResolution: null,
          isResolved: false,
        },
      });

      await logActivity(
        tx,
        userId,
        "Submitted Booking",
        `Submitted booking ${bookingId} for approval`
      );
      await NotificationService.create(
        {
          userId,
          type: "BOOKING",
          title: "Booking submitted",
          message: `Your booking ${bookingId} has been submitted for approval.`,
          data: { bookingId },
        },
        tx
      );

      return updated;
    });
  },

  async cancelBooking(bookingId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, userId },
        select: { id: true, status: true },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      // common rule: allow cancel if not completed
      if (["COMPLETED", "CANCELLED"].includes(booking.status)) {
        throw new Error("CANNOT_CANCEL");
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED", isResolved: true },
      });

      await logActivity(
        tx,
        userId,
        "Cancelled Booking",
        `Cancelled booking ${bookingId}`
      );

      return updated;
    });
  },

  async addCollaborator(
    bookingId: string,
    ownerId: string,
    collaboratorId: string
  ) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, userId: ownerId },
        select: { id: true, itineraryId: true, userId: true },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      if (booking.userId === collaboratorId) {
        throw new Error("CANNOT_ADD_OWNER");
      }

      const existing = await tx.itineraryCollaborator.findUnique({
        where: {
          itineraryId_userId: {
            itineraryId: booking.itineraryId,
            userId: collaboratorId,
          },
        },
      });

      if (existing) {
        throw new Error("COLLABORATOR_EXISTS");
      }

      const collaborator = await tx.itineraryCollaborator.create({
        data: {
          itineraryId: booking.itineraryId,
          userId: collaboratorId,
        },
      });

      await logActivity(
        tx,
        ownerId,
        "Added Collaborator",
        `Added collaborator ${collaboratorId} to booking ${bookingId}`
      );

      return collaborator;
    });
  },

  async listCollaborators(bookingId: string, userId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        itinerary: {
          include: {
            collaborators: {
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    if (!booking) throw new Error("BOOKING_NOT_FOUND");

    const isOwner = booking.userId === userId;
    const isCollaborator = booking.itinerary.collaborators.some(
      (collab) => collab.userId === userId
    );

    if (!isOwner && !isCollaborator) {
      throw new Error("BOOKING_FORBIDDEN");
    }

    return booking.itinerary.collaborators;
  },

  async removeCollaborator(
    bookingId: string,
    ownerId: string,
    collaboratorUserId: string
  ) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, userId: ownerId },
        select: { id: true, itineraryId: true, userId: true },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      const removed = await tx.itineraryCollaborator.deleteMany({
        where: {
          userId: collaboratorUserId,
          itineraryId: booking.itineraryId,
        },
      });

      await logActivity(
        tx,
        ownerId,
        "Removed Collaborator",
        `Removed collaborator ${collaboratorUserId} from booking ${bookingId}`
      );

      return removed;
    });
  },
};
