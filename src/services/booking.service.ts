import {
  BookingStatus,
  BookingType,
  ItineraryStatus,
  ItineraryType,
  Prisma,
  TourType,
} from "@prisma/client";
import { Role } from "@/constants/constants";
import { prisma } from "@/config/database";
import { logAudit, ActivityAction } from "@/services/activity-log.service";
import { NotificationService } from "@/services/notification.service";
import { toISO } from "@/utils/serialize";

const BOOKING_CODE_PREFIX = "BV";
const BOOKING_CODE_PADDING = 3;

const buildBookingCode = (year: number, sequence: number) =>
  `${BOOKING_CODE_PREFIX}-${year}-${String(sequence).padStart(BOOKING_CODE_PADDING, "0")}`;

const buildItinerarySnapshot = (itinerary: {
  id: string;
  userId: string;
  title?: string | null;
  destination: string;
  startDate?: Date | null;
  endDate?: Date | null;
  travelers: number;
  estimatedCost?: Prisma.Decimal | number | null;
  travelPace?: string | null;
  preferences?: string[] | null;
  type: ItineraryType;
  status: ItineraryStatus;
  tourType: TourType;
  days?: { dayNumber: number; title?: string | null; date?: Date | null; activities?: { time: string; title: string; description?: string | null; location?: string | null; icon?: string | null; order: number }[] }[];
}) => ({
  id: itinerary.id,
  userId: itinerary.userId,
  title: itinerary.title ?? null,
  destination: itinerary.destination,
  startDate: toISO(itinerary.startDate),
  endDate: toISO(itinerary.endDate),
  travelers: itinerary.travelers,
  estimatedCost:
    itinerary.estimatedCost !== null && itinerary.estimatedCost !== undefined
      ? Number((itinerary.estimatedCost as any).toString?.() ?? itinerary.estimatedCost)
      : null,
  travelPace: itinerary.travelPace ?? null,
  preferences: itinerary.preferences ?? [],
  type: itinerary.type,
  status: itinerary.status,
  tourType: itinerary.tourType,
  days:
    itinerary.days?.map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title ?? null,
      date: toISO(day.date),
      activities:
        day.activities?.map((activity) => ({
          time: activity.time,
          title: activity.title,
          description: activity.description ?? null,
          location: activity.location ?? null,
          icon: activity.icon ?? null,
          order: activity.order,
        })) ?? [],
    })) ?? [],
});

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
  targetUserId?: string;
  itineraryId?: string;
  tourPackageId?: string;
  itinerary?: InlineItineraryDTO;
  itineraryType?: ItineraryType;
  destination?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  budget?: number;
  travelPace?: string;
  preferences?: string[];
  itineraryData?: SmartTripDayInput[];
  totalPrice: number;
  userBudget?: number;
  type?: BookingType;
  tourType?: TourType;

  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
}

interface SmartTripActivityInput {
  time: string;
  title: string;
  iconKey: string;
  location?: string;
  description?: string;
}

interface SmartTripDayInput {
  day: number;
  title: string;
  activities: SmartTripActivityInput[];
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
    title?: string | null;
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
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  destination?: string;
  startDate?: Date | null | undefined;
  endDate?: Date | null | undefined;
  travelers?: number;
  totalPrice?: number;
  userBudget?: number;
  version?: number;
  type?: BookingType;
  status?: BookingStatus;
  tourType?: TourType;
  isResolved?: boolean;
  rejectionReason?: string | null;
  rejectionResolution?: string | null;
  sendStatus?: string;
  itinerary?: unknown;
  /*
  itinerary: {
    dayNumber: number;
    title?: string | null;
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
  */
}

const normalizeTourType = (value?: string | null): TourType | undefined => {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  if (normalized === "GROUP") return TourType.JOINER;
  if (normalized === "JOINER") return TourType.JOINER;
  if (normalized === "PRIVATE") return TourType.PRIVATE;
  return undefined;
};

const normalizeDate = (value?: string | Date | null): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
};

type NormalizedItineraryDay = {
  dayNumber: number;
  title?: string | null;
  date?: Date | null;
  activities: {
    time: string;
    title: string;
    description?: string | null;
    location?: string | null;
    icon?: string | null;
    order: number;
  }[];
};

const normalizeItineraryPayload = (
  payload?: any
): {
  days?: NormalizedItineraryDay[];
  destination?: string;
  travelers?: number;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  tourType?: TourType | undefined;
  type?: ItineraryType | undefined;
} => {
  if (!payload) return {};

  const buildDays = (days: any[], activities?: any[]) => {
    const activityByDay = new Map<number, any[]>();
    if (activities) {
      for (const activity of activities) {
        if (!activity?.dayNumber) continue;
        const list = activityByDay.get(activity.dayNumber) ?? [];
        list.push({
          time: activity.time ?? "00:00",
          title: activity.title ?? "Activity",
          description: activity.description ?? null,
          location: activity.location ?? null,
          icon: activity.icon ?? null,
          order: activity.order ?? 0,
        });
        activityByDay.set(activity.dayNumber, list);
      }
    }

    return days.map((day: any) => ({
      dayNumber: day.dayNumber,
      title: day.title ?? null,
      date: normalizeDate(day.date),
      activities:
        day.activities?.map((activity: any) => ({
          time: activity.time ?? "00:00",
          title: activity.title ?? "Activity",
          description: activity.description ?? null,
          location: activity.location ?? null,
          icon: activity.icon ?? null,
          order: activity.order ?? 0,
        })) ?? activityByDay.get(day.dayNumber) ?? [],
    }));
  };

  if (Array.isArray(payload)) {
    const looksLikeDayArray = payload.every(
      (item) => typeof item?.dayNumber === "number"
    );
    if (looksLikeDayArray) {
      return { days: buildDays(payload) };
    }

    const itineraryWrapper = payload[0];
    if (itineraryWrapper) {
      return {
        days: itineraryWrapper.days
          ? buildDays(itineraryWrapper.days, itineraryWrapper.activities)
          : undefined,
        destination: itineraryWrapper.destination,
        travelers: itineraryWrapper.travelers,
        startDate: normalizeDate(itineraryWrapper.startDate),
        endDate: normalizeDate(itineraryWrapper.endDate),
        tourType: normalizeTourType(itineraryWrapper.tourType),
        type: itineraryWrapper.type as ItineraryType | undefined,
      };
    }
  }

  if (payload.days) {
    return {
      days: buildDays(payload.days, payload.activities),
      destination: payload.destination,
      travelers: payload.travelers,
      startDate: normalizeDate(payload.startDate),
      endDate: normalizeDate(payload.endDate),
      tourType: normalizeTourType(payload.tourType),
      type: payload.type as ItineraryType | undefined,
    };
  }

  return {};
};

export const BookingService = {
  async createBooking(data: CreateBookingDTO) {
    const booking = await prisma.$transaction(async (tx) => {
      const bookingInclude = {
        itinerary: {
          include: {
            collaborators: true,
            days: { include: { activities: true }, orderBy: { dayNumber: "asc" } },
          },
        },
      } as const;

      const isRequested =
        data.type === BookingType.REQUESTED ||
        data.itinerary?.type === ItineraryType.REQUESTED;
      const canTargetUser =
        data.role === Role.ADMIN &&
        data.targetUserId &&
        data.targetUserId !== data.userId;
      const resolvedTargetUserId = canTargetUser ? data.targetUserId! : data.userId;
      const targetUser = canTargetUser
        ? await tx.user.findUnique({
            where: { id: resolvedTargetUserId },
            select: { id: true, firstName: true, lastName: true, email: true, mobile: true },
          })
        : null;
      if (canTargetUser && !targetUser) {
        throw new Error("TARGET_USER_NOT_FOUND");
      }
      const targetName = targetUser
        ? `${targetUser.firstName ?? ""} ${targetUser.lastName ?? ""}`.trim()
        : undefined;
      const resolvedCustomerName =
        targetUser && targetName ? targetName : data.customerName;
      const resolvedCustomerEmail = targetUser?.email ?? data.customerEmail;
      const resolvedCustomerMobile = targetUser?.mobile ?? data.customerMobile;

      // Backward compatibility: some clients send the tour package id in `itineraryId`
      // for STANDARD bookings. If `itineraryId` doesn't exist as an Itinerary, treat it
      // as `tourPackageId`.
      let tourPackageId = data.tourPackageId;
      let itineraryId = data.itineraryId;
      if (!tourPackageId && data.type === BookingType.STANDARD && itineraryId) {
        const maybeItinerary = await tx.itinerary.findUnique({
          where: { id: itineraryId },
          select: { id: true },
        });
        if (!maybeItinerary) {
          tourPackageId = itineraryId;
          itineraryId = undefined;
        }
      }

      const isSmartTrip =
        data.itineraryType === ItineraryType.SMART_TRIP || data.itineraryData;

      if (isSmartTrip) {
        const startDate = data.startDate ? new Date(data.startDate) : undefined;
        const endDate = data.endDate ? new Date(data.endDate) : undefined;

        const itinerary = await tx.itinerary.create({
          data: {
            userId: resolvedTargetUserId,
            title:
              data.destination && data.destination.trim().length > 0
                ? `Smart Trip: ${data.destination}`
                : "Smart Trip",
            destination: data.destination ?? "",
            startDate,
            endDate,
            travelers: data.travelers ?? 1,
            estimatedCost: data.budget as unknown as Prisma.Decimal,
            type: ItineraryType.SMART_TRIP,
            status: ItineraryStatus.DRAFT,
            tourType: data.tourType ?? TourType.PRIVATE,
            travelPace: data.travelPace ?? undefined,
            preferences: data.preferences ?? [],
          },
        });

        const sortedDays = [...(data.itineraryData ?? [])].sort(
          (a, b) => a.day - b.day
        );

        for (const day of sortedDays) {
          const itineraryDay = await tx.itineraryDay.create({
            data: {
              itineraryId: itinerary.id,
              dayNumber: day.day,
              title: day.title,
            },
          });

          if (day.activities.length > 0) {
            await tx.activity.createMany({
              data: day.activities.map((activity, idx) => ({
                itineraryDayId: itineraryDay.id,
                time: activity.time,
                title: activity.title,
                description: activity.description ?? null,
                location: activity.location ?? null,
                icon: activity.iconKey,
                order: idx,
              })),
            });
          }
        }

        const itineraryWithRelations = await tx.itinerary.findUnique({
          where: { id: itinerary.id },
          include: bookingInclude.itinerary.include,
        });

        if (itineraryWithRelations) {
          await tx.itineraryVersion.create({
            data: {
              itineraryId: itineraryWithRelations.id,
              version: itineraryWithRelations.version,
              snapshot: buildItinerarySnapshot(itineraryWithRelations),
              createdById: data.userId,
            },
          });
        }

        const bookingCode = await generateBookingCode(tx);

        const booking = await tx.booking.create({
          data: {
            bookingCode,
            userId: resolvedTargetUserId,
            itineraryId: itinerary.id,
            destination: itinerary.destination,
            startDate: startDate ?? undefined,
            endDate: endDate ?? undefined,
            travelers: data.travelers ?? 1,
            totalPrice: data.totalPrice as unknown as Prisma.Decimal,
            userBudget:
              data.userBudget !== undefined
                ? (data.userBudget as unknown as Prisma.Decimal)
                : undefined,
            type: isRequested ? BookingType.REQUESTED :data.type ?? BookingType.CUSTOMIZED,
            tourType: data.tourType ?? TourType.PRIVATE,
            status: BookingStatus.DRAFT,
            customerName: resolvedCustomerName ?? undefined,
            customerEmail: resolvedCustomerEmail ?? undefined,
            customerMobile: resolvedCustomerMobile ?? undefined,
          },
          include: bookingInclude,
        });

        await logAudit(tx, {
          actorUserId: data.userId,
          action: ActivityAction.BOOKING_CREATED,
          entityType: "BOOKING",
          entityId: booking.id,
          metadata: {
            bookingCode: booking.bookingCode,
            destination: booking.destination,
            status: booking.status,
            type: isRequested ? "REQUESTED" : "CUSTOMIZED",
          },
          message: "Booking created",
        });

        return booking;
      }

      if (tourPackageId) {
        const tourPackage = await tx.tourPackage.findUnique({
          where: { id: tourPackageId },
          include: {
            days: {
              orderBy: { dayNumber: "asc" },
              include: { activities: { orderBy: { order: "asc" } } },
            },
          },
        });

        if (!tourPackage) {
          throw new Error("TOUR_PACKAGE_NOT_FOUND");
        }

        const startDate = data.startDate ? new Date(data.startDate) : undefined;
        const endDate = data.endDate ? new Date(data.endDate) : undefined;

        // Create itinerary from tour package
        const itinerary = await tx.itinerary.create({
          data: {
            userId: resolvedTargetUserId,
            title: tourPackage.title,
            destination: tourPackage.destination,
            startDate,
            endDate,
            travelers: data.travelers ?? 1,
            estimatedCost: tourPackage.price,
            type: ItineraryType.STANDARD,
            status: ItineraryStatus.DRAFT,
            tourType: data.tourType ?? TourType.PRIVATE,
            days: {
              create: tourPackage.days.map((day, dayIndex) => ({
                dayNumber: day.dayNumber,
                title: day.title,
                date: startDate
                  ? new Date(startDate.getTime() + dayIndex * 24 * 60 * 60 * 1000)
                  : undefined,
                activities: {
                  create: day.activities.map((activity) => ({
                    time: activity.time,
                    title: activity.title,
                    description: activity.description,
                    location: activity.location,
                    icon: activity.icon,
                    order: activity.order,
                  })),
                },
              })),
            },
          },
          include: {
            collaborators: true,
            days: { include: { activities: true }, orderBy: { dayNumber: "asc" } },
          },
        });

        await tx.itineraryVersion.create({
          data: {
            itineraryId: itinerary.id,
            version: itinerary.version,
            snapshot: buildItinerarySnapshot(itinerary),
            createdById: data.userId,
          },
        });

        const bookingCode = await generateBookingCode(tx);

        const booking = await tx.booking.create({
          data: {
            bookingCode,
            userId: resolvedTargetUserId,
            itineraryId: itinerary.id,
            destination: itinerary.destination,
            startDate: startDate ?? undefined,
            endDate: endDate ?? undefined,
            travelers: data.travelers ?? 1,
            totalPrice: data.totalPrice as unknown as Prisma.Decimal,
            userBudget:
              data.userBudget !== undefined
                ? (data.userBudget as unknown as Prisma.Decimal)
                : undefined,
            type: BookingType.STANDARD,
            tourType: data.tourType ?? TourType.PRIVATE,
            status: BookingStatus.DRAFT,
            customerName: resolvedCustomerName ?? undefined,
            customerEmail: resolvedCustomerEmail ?? undefined,
            customerMobile: resolvedCustomerMobile ?? undefined,
          },
          include: bookingInclude,
        });

        await logAudit(tx, {
          actorUserId: data.userId,
          action: ActivityAction.BOOKING_CREATED,
          entityType: "BOOKING",
          entityId: booking.id,
          metadata: {
            bookingCode: booking.bookingCode,
            destination: booking.destination,
            status: booking.status,
            tourPackageId,
            type: isRequested ? "REQUESTED" : "STANDARD",
          },
          message: "Booking created",
        });

        return booking;
      }

      const shouldCreateItinerary = !itineraryId && data.itinerary;

      // Resolve dates: prefer top-level dates, fallback to inline itinerary dates
      const resolvedStartDate = data.startDate
        ? new Date(data.startDate)
        : data.itinerary?.startDate
          ? new Date(data.itinerary.startDate)
          : undefined;
      const resolvedEndDate = data.endDate
        ? new Date(data.endDate)
        : data.itinerary?.endDate
          ? new Date(data.itinerary.endDate)
          : undefined;

      const itinerary = shouldCreateItinerary
        ? await tx.itinerary.create({
            // Deprecated inline creation path; kept for backward compatibility with legacy clients
            data: {
              userId: resolvedTargetUserId,
              title: data.itinerary?.title ?? "Itinerary",
              destination: data.itinerary?.destination ?? "",

              startDate: resolvedStartDate,
              endDate: resolvedEndDate,

              travelers: data.itinerary?.travelers ?? 1,
              type: isRequested
                ? ItineraryType.REQUESTED
                : data.itinerary?.type ?? ItineraryType.CUSTOMIZED,
              tourType: data.itinerary?.tourType ?? data.tourType ?? TourType.PRIVATE,
              days: data.itinerary?.days
                ? {
                    create: data.itinerary.days.map((day) => ({
                      dayNumber: day.dayNumber,
                      title: day.title ?? null,
                      date: day.date ? new Date(day.date) : undefined,
                        activities: {
                          create: (day.activities ?? []).map((activity) => ({
                            time: activity.time ?? "00:00",
                            title: activity.title ?? "Activity",
                            description: activity.description ?? null,
                            location: activity.location ?? null,
                            icon: activity.icon ?? null,
                            order: activity.order ?? 0,
                          })),
                        },
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
            where: { id: itineraryId },
            include: {
              collaborators: true,
              days: { include: { activities: true }, orderBy: { dayNumber: "asc" } },
            },
          });

      if (!itinerary) {
        throw new Error("ITINERARY_NOT_FOUND");
      }

      if (shouldCreateItinerary) {
        await tx.itineraryVersion.create({
          data: {
            itineraryId: itinerary.id,
            version: itinerary.version,
            snapshot: buildItinerarySnapshot(itinerary),
            createdById: data.userId,
          },
        });
      }

      const isOwner = itinerary.userId === data.userId;
      const isAdmin = data.role === Role.ADMIN;

      if (!isOwner && !isAdmin) {
        throw new Error("ITINERARY_FORBIDDEN");
      }

      if (
        itineraryId &&
        itinerary.type === ItineraryType.REQUESTED &&
        itinerary.requestedStatus !== "CONFIRMED"
      ) {
        throw new Error("ITINERARY_NOT_CONFIRMED");
      }

      const bookingCode = await generateBookingCode(tx);

      // ✅ CORRECT FIX: Use resolved dates with fallback to itinerary dates
      const booking = await tx.booking.create({
        data: {
          bookingCode,
          userId: resolvedTargetUserId,
          itineraryId: itinerary.id,
          destination: itinerary.destination,
          startDate: itinerary.startDate ?? resolvedStartDate ?? undefined,
          endDate: itinerary.endDate ?? resolvedEndDate ?? undefined,
          travelers: itinerary.travelers,

          totalPrice: data.totalPrice as unknown as Prisma.Decimal,
          userBudget:
            data.userBudget !== undefined
              ? (data.userBudget as unknown as Prisma.Decimal)
              : undefined,
          type: isRequested ? BookingType.REQUESTED : data.type ?? (itinerary.type as BookingType),
          tourType: data.tourType ?? itinerary.tourType ?? TourType.PRIVATE,
          status: BookingStatus.DRAFT,

          // ✅ FIX: Use undefined fallback (not null)
          customerName: resolvedCustomerName ?? undefined,
          customerEmail: resolvedCustomerEmail ?? undefined,
          customerMobile: resolvedCustomerMobile ?? undefined,
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

      await logAudit(tx, {
        actorUserId: data.userId,
        action: ActivityAction.BOOKING_CREATED,
        entityType: "BOOKING",
        entityId: booking.id,
        metadata: {
          bookingCode: booking.bookingCode,
          destination: booking.destination,
          status: booking.status,
          type: isRequested ? "REQUESTED" : "CUSTOMIZED",
        },
        message: "Booking created",
      });

      return booking;
    }, {
      timeout: 15000, // Increase timeout for complex booking operations
    });

    // Send notification outside the transaction to prevent timeout
    // Notification failure should not roll back the booking
    NotificationService.notifyAdmins({
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
    }).catch((err) => {
      console.error("Failed to notify admins about new booking:", err);
    });

    return booking;
  },

  async getBookingById(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, firstName: true, lastName: true, mobile: true } },
        payments: true,
        itinerary: {
          include: {
            collaborators: {
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, email: true, mobile: true},
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
    data: UpdateBookingItineraryDTO,
    actorRole?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          itinerary: {
            include: { collaborators: true, days: { include: { activities: true } } },
          },
        },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      const isAdmin = actorRole === Role.ADMIN;
      const isOwner = booking.userId === userId;
      const isCollaborator =
        booking.visibleToCollaborators === true &&
        booking.itinerary.collaborators.some((collab) => collab.userId === userId);

      if (!isAdmin && !isOwner && !isCollaborator) {
        throw new Error("BOOKING_FORBIDDEN");
      }

      if (!isAdmin && isCollaborator && booking.status !== "DRAFT") {
        throw new Error("BOOKING_COLLABORATOR_NOT_ALLOWED");
      }

      if (
        !isAdmin &&
        isOwner &&
        !["DRAFT", "PENDING", "REJECTED"].includes(booking.status)
      ) {
        throw new Error("BOOKING_NOT_EDITABLE");
      }

      const normalizedItinerary = normalizeItineraryPayload(data.itinerary);
      const destination =
        data.destination ??
        normalizedItinerary.destination ??
        booking.destination ??
        undefined;
      const travelers =
        data.travelers ??
        normalizedItinerary.travelers ??
        booking.travelers ??
        undefined;
      const startDate =
        normalizeDate(data.startDate ?? undefined) ??
        normalizedItinerary.startDate ??
        booking.startDate ??
        undefined;
      const endDate =
        normalizeDate(data.endDate ?? undefined) ??
        normalizedItinerary.endDate ??
        booking.endDate ??
        undefined;

      const tourType =
        data.tourType ??
        normalizedItinerary.tourType ??
        booking.tourType ??
        undefined;

      const itineraryData = normalizedItinerary.days;
      const itineraryType =
        booking.type === BookingType.REQUESTED
          ? ItineraryType.REQUESTED
          : normalizedItinerary.type ?? undefined;      

      if (itineraryData) {
        if (data.version) {
          const itineraryUpdateResult = await tx.itinerary.updateMany({
            where: { id: booking.itineraryId, version: data.version },
            data: {
              destination,
              startDate,
              endDate,
              travelers,
              type: itineraryType,
              tourType,
              version: { increment: 1 },
            },
          });

          if (itineraryUpdateResult.count === 0) {
            throw new Error("ITINERARY_VERSION_CONFLICT");
          }
        } else {
          await tx.itinerary.update({
            where: { id: booking.itineraryId },
            data: {
              destination,
              startDate,
              endDate,
              travelers,
              type: itineraryType,
              tourType,
              version: { increment: 1 },
            },
          });
        }

        await tx.itineraryDay.deleteMany({
          where: { itineraryId: booking.itineraryId },
        });

        for (const day of itineraryData) {
          await tx.itineraryDay.create({
            data: {
              itineraryId: booking.itineraryId,
              dayNumber: day.dayNumber,
              title: day.title ?? undefined,
              date: day.date ?? undefined,
                activities: {
                  create: (day.activities ?? []).map((activity) => ({
                    time: activity.time ?? "00:00",
                    title: activity.title ?? "Activity",
                    description: activity.description ?? null,
                    location: activity.location ?? null,
                    icon: activity.icon ?? null,
                    order: activity.order ?? 0,
                  })),
                },
            },
          });
        }
      }

      const refreshedItinerary = await tx.itinerary.findUnique({
        where: { id: booking.itineraryId },
        include: { collaborators: true, days: { include: { activities: true } } },
      });

      if (refreshedItinerary && itineraryData) {
        // Use upsert to avoid duplicate version creation on retries or race conditions
        await tx.itineraryVersion.upsert({
          where: {
            itineraryId_version: {
              itineraryId: refreshedItinerary.id,
              version: refreshedItinerary.version,
            },
          },
          update: {
            snapshot: buildItinerarySnapshot(refreshedItinerary),
            createdById: userId,
          },
          create: {
            itineraryId: refreshedItinerary.id,
            version: refreshedItinerary.version,
            snapshot: buildItinerarySnapshot(refreshedItinerary),
            createdById: userId,
          },
        });
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          ...(destination !== undefined && { destination }),
          ...(startDate !== undefined && { startDate }),
          ...(endDate !== undefined && { endDate }),
          ...(travelers !== undefined && { travelers }),
          ...(data.totalPrice !== undefined && {
            totalPrice: data.totalPrice as unknown as Prisma.Decimal,
          }),
          ...(data.type !== undefined && { type: data.type }),
          ...(data.status !== undefined && { status: data.status }),
          ...(tourType !== undefined && { tourType }),
          ...(data.isResolved !== undefined && { isResolved: data.isResolved }),
          ...(data.rejectionReason !== undefined && {
            rejectionReason: data.rejectionReason,
          }),
          ...(data.rejectionResolution !== undefined && {
            rejectionResolution: data.rejectionResolution,
          }),
          ...(data.userBudget !== undefined && {
            userBudget: data.userBudget as unknown as Prisma.Decimal,
          }),

          ...(data.customerName !== undefined && { customerName: data.customerName }),
          ...(data.customerEmail !== undefined && { customerEmail: data.customerEmail }),
          ...(data.customerMobile !== undefined && { customerMobile: data.customerMobile }),
          ...(data.sendStatus !== undefined && { sendStatus: data.sendStatus }),
        },
      });

      await logAudit(tx, {
        actorUserId: userId,
        action: ActivityAction.BOOKING_UPDATED,
        entityType: "BOOKING",
        entityId: bookingId,
        metadata: {
          destination,
          travelers,
          customerUpdated: !!(data.customerName || data.customerEmail || data.customerMobile),
        },
        message: "Booking updated",
      });

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
        CONFIRMED: ["BOOKED", "COMPLETED", "CANCELLED"],
        BOOKED: ["COMPLETED", "CANCELLED"],
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
            ? ActivityAction.BOOKING_APPROVED
            : status === "REJECTED"
              ? ActivityAction.BOOKING_REJECTED
              : status === "COMPLETED"
                ? ActivityAction.BOOKING_COMPLETED
                : status === "CANCELLED"
                  ? ActivityAction.BOOKING_CANCELLED
                  : ActivityAction.BOOKING_UPDATED;
        const message =
          status === "CONFIRMED"
            ? "Booking approved"
            : status === "REJECTED"
              ? "Booking rejected"
              : status === "COMPLETED"
                ? "Booking completed"
                : status === "CANCELLED"
                  ? "Booking cancelled"
                  : "Booking status updated";
        await logAudit(tx, {
          actorUserId: actorId,
          action,
          entityType: "BOOKING",
          entityId: bookingId,
          metadata: { status, reason, resolution },
          message,
        });
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
    const whereClause: Prisma.BookingWhereInput = {
      OR: [
        { userId },
        {
          type: BookingType.REQUESTED,
          itinerary: {
            userId,
            requestedStatus: { in: ["SENT", "CONFIRMED", "CANCELLED"] },
          },
        },
      ],
    };

    if (status) {
      whereClause.AND = [{ status }];
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
      visibleToCollaborators: true,
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
      if (filters.type === "REQUESTED") {
        whereClause.requestedBookedAt = null;
        whereClause.requestedSourceBookingId = null;
      }
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

  async submitBooking(bookingId: string, userId: string, role: string) {
    return prisma.$transaction(async (tx) => {
      const isAdmin = role === Role.ADMIN;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true }
      });
      const userName = `${user?.firstName} ${user?.lastName}`;

      const booking = await tx.booking.findFirst({
        where: { id: bookingId, ...(isAdmin ? {} : { userId }) },
        select: {
          id: true,
          status: true,
          bookingCode: true,
          destination: true,
          type: true,
          itinerary: {
            select: {
              id: true,
              userId: true,
              destination: true,
              requestedStatus: true,
              collaborators: { select: { userId: true } },
              days: {
                select: {
                  activities: { select: { id: true } },
                },
              },
            },
          },
        },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");
      if (booking.type === BookingType.REQUESTED && !isAdmin) {
        throw new Error("BOOKING_FORBIDDEN");
      }
      if (booking.type === BookingType.REQUESTED && isAdmin) {
        const requestedStatus = booking.itinerary?.requestedStatus;
        if (!booking.itinerary?.id) {
          throw new Error("ITINERARY_NOT_FOUND");
        }
        if (requestedStatus === "CANCELLED") {
          throw new Error("CANNOT_SEND_CANCELLED");
        }
        if (requestedStatus === "SENT" || requestedStatus === "CONFIRMED") {
          return booking;
        }

        await tx.itinerary.update({
          where: { id: booking.itinerary.id },
          data: {
            requestedStatus: "SENT",
            sentStatus: "Sent",
            sentAt: new Date(),
          },
        });

        await logAudit(tx, {
          actorUserId: userId,
          action: ActivityAction.ITINERARY_SENT,
          entityType: "BOOKING",
          entityId: bookingId,
          metadata: { status: "SENT", type: "REQUESTED" },
          message: "Itinerary sent to client",
        });

        return booking;
      }      
      if (
        booking.type !== BookingType.REQUESTED &&
        !["DRAFT", "REJECTED"].includes(booking.status)
      ) {
        throw new Error("CANNOT_SUBMIT");
      }

      const days = booking.itinerary?.days ?? [];
      const hasEmptyActivities =
        days.length === 0 || days.some((day) => day.activities.length === 0);
      if (hasEmptyActivities) {
        throw new Error("BOOKING_ACTIVITIES_REQUIRED");
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "PENDING",
          rejectionReason: null,
          rejectionResolution: null,
          isResolved: false,
          visibleToCollaborators: false,
        },
      });

      // End collaboration on submission: hide booking and itinerary from collaborators.
      // - Collaborators lose visibility immediately
      // - Existing share tokens are revoked
      // - Collaborator rows are deleted
      const itineraryId = booking.itinerary?.id;
      if (itineraryId) {
        const collaboratorIds = (booking.itinerary?.collaborators ?? [])
          .map((c) => c.userId)
          .filter((id) => id !== userId);

        if (collaboratorIds.length > 0) {
          const destinationForMessage =
            booking.destination ?? booking.itinerary?.destination ?? "your trip";

          await Promise.all(
            collaboratorIds.map((collaboratorUserId) =>
              NotificationService.create(
                {
                  userId: collaboratorUserId,
                  type: "BOOKING",
                  title: "Collaboration ended",
                  message: `The booking for ${destinationForMessage} has been submitted for approval. Your collaboration access has ended.`,
                  data: {
                    bookingId: booking.id,
                    bookingCode: booking.bookingCode ?? undefined,
                    status: "PENDING",
                    itineraryId,
                    destination: destinationForMessage,
                  },
                },
                tx
              )
            )
          );
        }

        await tx.itineraryShare.updateMany({
          where: { itineraryId, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await tx.itineraryCollaborator.deleteMany({
          where: {
            itineraryId,
            NOT: { userId },
          },
        });
      }

      await logAudit(tx, {
        actorUserId: userId,
        action: ActivityAction.BOOKING_UPDATED,
        entityType: "BOOKING",
        entityId: bookingId,
        metadata: { status: updated.status, action: "submitted" },
        message: "Booking submitted for approval",
      });
      // NOTE: Notifications only for transaction processes (USER <-> ADMIN)
      // Notify admin for booking approval - this is a transaction requiring admin action
      // User doesn't need notification for their own submission

      await NotificationService.notifyAdmins({
        type: "BOOKING",
        title: "Booking Submitted",
        message: `${userName} submitted booking ${booking.bookingCode} for approval`,
        data: { bookingId, status: "PENDING" }
      });
      return updated;
    });
  },

  async cancelBooking(bookingId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId },
        select: {
          id: true,
          status: true,
          type: true,
          itineraryId: true,
          userId: true,
          itinerary: { select: { userId: true, requestedStatus: true } },
        },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      // Only the booking owner can cancel.
      if (booking.userId !== userId) {
        throw new Error("BOOKING_FORBIDDEN");
      }

      if (booking.type === BookingType.REQUESTED) {
        if (booking.itinerary?.requestedStatus === "CANCELLED") {
          // Ensure collaboration is ended even if the request was already cancelled.
          await tx.booking.update({
            where: { id: bookingId },
            data: { visibleToCollaborators: false },
          });

          await tx.itineraryShare.updateMany({
            where: { itineraryId: booking.itineraryId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          await tx.itineraryCollaborator.deleteMany({
            where: {
              itineraryId: booking.itineraryId,
              NOT: { userId: booking.userId },
            },
          });

          return booking;
        }
        if (booking.itinerary?.requestedStatus !== "SENT") {
          throw new Error("CANNOT_CANCEL");
        }

        const updated = await tx.booking.update({
          where: { id: bookingId },
          data: { status: "CANCELLED", isResolved: true, visibleToCollaborators: false },
        });

        await tx.itinerary.update({
          where: { id: booking.itineraryId },
          data: {
            requestedStatus: "CANCELLED",
          },
        });

        await logAudit(tx, {
          actorUserId: userId,
          action: ActivityAction.BOOKING_CANCELLED,
          entityType: "BOOKING",
          entityId: bookingId,
          metadata: { status: "CANCELLED", type: "REQUESTED" },
          message: "Booking cancelled",
        });

        // End collaboration on cancel: hide itinerary from collaborators and revoke share tokens.
        await tx.itineraryShare.updateMany({
          where: { itineraryId: booking.itineraryId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.itineraryCollaborator.deleteMany({
          where: {
            itineraryId: booking.itineraryId,
            NOT: { userId: booking.userId },
          },
        });

        return updated;
      }

      // common rule: allow cancel if not completed
      if (["COMPLETED", "CANCELLED"].includes(booking.status)) {
        throw new Error("CANNOT_CANCEL");
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED", isResolved: true, visibleToCollaborators: false },
      });

      await logAudit(tx, {
        actorUserId: userId,
        action: ActivityAction.BOOKING_CANCELLED,
        entityType: "BOOKING",
        entityId: bookingId,
        metadata: { status: updated.status },
        message: "Booking cancelled",
      });

      // End collaboration on cancel: hide itinerary from collaborators and revoke share tokens.
      await tx.itineraryShare.updateMany({
        where: { itineraryId: booking.itineraryId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.itineraryCollaborator.deleteMany({
        where: {
          itineraryId: booking.itineraryId,
          NOT: { userId: booking.userId },
        },
      });

      return updated;
    });
  },

  async confirmRequestedBooking(bookingId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          status: true,
          type: true,
          itineraryId: true,
          itinerary: { select: { userId: true, requestedStatus: true } },
        },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");
      if (booking.type !== BookingType.REQUESTED) {
        throw new Error("NOT_REQUESTED");
      }
      if (booking.itinerary?.userId !== userId) {
        throw new Error("BOOKING_FORBIDDEN");
      }
      if (booking.itinerary?.requestedStatus === "CONFIRMED") {
        return booking;
      }
      if (booking.itinerary?.requestedStatus !== "SENT") {
        throw new Error("CANNOT_CONFIRM");
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: "CONFIRMED" },
      });

      await tx.itinerary.update({
        where: { id: booking.itineraryId },
        data: {
          requestedStatus: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });

      await logAudit(tx, {
        actorUserId: userId,
        action: ActivityAction.BOOKING_APPROVED,
        entityType: "BOOKING",
        entityId: bookingId,
        metadata: { status: "CONFIRMED", type: "REQUESTED" },
        message: "Booking confirmed",
      });

      return updated;
    });
  },

  async bookFromRequested(bookingId: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const requestedBooking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          itinerary: true,
        },
      });

      if (!requestedBooking) throw new Error("BOOKING_NOT_FOUND");
      if (requestedBooking.type !== BookingType.REQUESTED) {
        throw new Error("NOT_REQUESTED");
      }
      if (requestedBooking.itinerary?.requestedStatus === "CANCELLED") {
        throw new Error("REQUESTED_CANCELLED");
      }
      if (requestedBooking.itinerary?.requestedStatus !== "CONFIRMED") {
        throw new Error("REQUESTED_NOT_CONFIRMED");
      }

      const existingBooked = await tx.booking.findFirst({
        where: { requestedSourceBookingId: bookingId },
      });
      if (existingBooked) {
        return existingBooked;
      }

      const bookingCode = await generateBookingCode(tx);

      const booked = await tx.booking.create({
        data: {
          bookingCode,
          userId: requestedBooking.userId,
          itineraryId: requestedBooking.itineraryId,
          destination: requestedBooking.destination,
          startDate: requestedBooking.startDate ?? undefined,
          endDate: requestedBooking.endDate ?? undefined,
          travelers: requestedBooking.travelers ?? 1,
          totalPrice: requestedBooking.totalPrice as unknown as Prisma.Decimal,
          type: BookingType.REQUESTED,
          tourType: TourType.PRIVATE,
          status: BookingStatus.CONFIRMED,
          paymentStatus: "PENDING",
          customerName: requestedBooking.customerName ?? undefined,
          customerEmail: requestedBooking.customerEmail ?? undefined,
          customerMobile: requestedBooking.customerMobile ?? undefined,
          requestedSourceBookingId: bookingId,
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: { requestedBookedAt: new Date() },
      });

      await logAudit(tx, {
        actorUserId: actorId,
        action: ActivityAction.BOOKING_CREATED,
        entityType: "BOOKING",
        entityId: booked.id,
        metadata: { sourceBookingId: bookingId, type: "REQUESTED" },
        message: "Booking created from request",
      });

      return booked;
    });
  },

  async moveBookedToRequested(bookingId: string, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          requestedSourceBookingId: true,
          paymentStatus: true,
          startDate: true,
        },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");
      if (!booking.requestedSourceBookingId) {
        throw new Error("NOT_REQUESTED_ORIGIN");
      }
      if (booking.paymentStatus !== "PENDING") {
        throw new Error("BOOKING_PAID");
      }
      if (booking.startDate && booking.startDate <= new Date()) {
        throw new Error("BOOKING_ALREADY_STARTED");
      }

      await tx.booking.update({
        where: { id: booking.requestedSourceBookingId },
        data: { requestedBookedAt: null },
      });

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED", isResolved: true },
      });

      await logAudit(tx, {
        actorUserId: actorId,
        action: ActivityAction.BOOKING_CANCELLED,
        entityType: "BOOKING",
        entityId: bookingId,
        metadata: { sourceBookingId: booking.requestedSourceBookingId, action: "reverted" },
        message: "Booking reverted to request",
      });

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
        select: { id: true, itineraryId: true, userId: true, status: true, visibleToCollaborators: true },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      // Collaborations are only allowed while the booking is in DRAFT.
      if (booking.status !== "DRAFT" || booking.visibleToCollaborators !== true) {
        throw new Error("BOOKING_COLLABORATION_ENDED");
      }

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

      await logAudit(tx, {
        actorUserId: ownerId,
        action: ActivityAction.BOOKING_UPDATED,
        entityType: "BOOKING",
        entityId: bookingId,
        metadata: { collaboratorId, action: "collaborator_added" },
        message: "Collaborator added to booking",
      });

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
    const isCollaborator =
      booking.visibleToCollaborators === true &&
      booking.itinerary.collaborators.some((collab) => collab.userId === userId);

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

      await logAudit(tx, {
        actorUserId: ownerId,
        action: ActivityAction.BOOKING_UPDATED,
        entityType: "BOOKING",
        entityId: bookingId,
        metadata: { collaboratorId: collaboratorUserId, action: "collaborator_removed" },
        message: "Collaborator removed from booking",
      });

      return removed;
    });
  },

  async getVersionHistory(bookingId: string, userId: string, userRole: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        itinerary: {
          include: {
            collaborators: true,
          },
        },
      },
    });

    if (!booking) {
      throw new Error("BOOKING_NOT_FOUND");
    }

    const isOwner = booking.userId === userId;
    const isAdmin = userRole === "ADMIN";
    const isCollaborator =
      booking.visibleToCollaborators === true &&
      booking.itinerary?.collaborators?.some((c) => c.userId === userId);

    if (!isOwner && !isAdmin && !isCollaborator) {
      throw new Error("BOOKING_FORBIDDEN");
    }

    if (!booking.itineraryId) {
      return [];
    }

    const versions = await prisma.itineraryVersion.findMany({
      where: { itineraryId: booking.itineraryId },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { version: "asc" },
    });

    return versions;
  },

  async joinByBookingCode(bookingCode: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { bookingCode },
        include: {
          itinerary: {
            include: {
              collaborators: { select: { userId: true } },
            },
          },
        },
      });

      if (!booking) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      // Joining is only allowed while collaboration is active (DRAFT).
      if (booking.status !== "DRAFT" || booking.visibleToCollaborators !== true) {
        throw new Error("BOOKING_COLLABORATION_ENDED");
      }

      const isOwner = booking.userId === userId;
      const isCollaborator = booking.itinerary?.collaborators?.some(
        (collab) => collab.userId === userId
      );

      if (isOwner || isCollaborator) {
        return { collaborator: null, status: "ALREADY_COLLABORATOR" };
      }

      const collaborator = await tx.itineraryCollaborator.create({
        data: {
          itineraryId: booking.itineraryId,
          userId,
          invitedById: booking.userId,
        },
      });

      await logAudit(tx, {
        actorUserId: userId,
        action: ActivityAction.BOOKING_UPDATED,
        entityType: "BOOKING",
        entityId: booking.id,
        metadata: { action: "joined_via_booking_code", bookingCode },
        message: "User joined booking via QR code",
      });

      return { collaborator, status: "ADDED" };
    });
  },
};
