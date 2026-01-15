import { prisma } from "@/config/database";
import { PrismaClient, Prisma } from "@prisma/client";

type ActivityLogClient = Prisma.TransactionClient | PrismaClient;

type AuditMetadata = Record<string, unknown> | undefined;

// Descriptive action messages for activity logging
// NOTE: These are human-readable, short descriptions - not error codes
export const ActivityAction = {
  // Booking Management
  BOOKING_CREATED: "Created booking",
  BOOKING_UPDATED: "Updated booking",
  BOOKING_CANCELLED: "Cancelled booking",
  BOOKING_COMPLETED: "Completed booking",
  BOOKING_VIEWED: "Viewed booking",

  // Approval & Workflow
  BOOKING_APPROVED: "Approved booking",
  BOOKING_REJECTED: "Rejected booking",

  // Itinerary Management
  ITINERARY_CREATED: "Created itinerary",
  ITINERARY_UPDATED: "Updated itinerary",
  ITINERARY_DELETED: "Deleted itinerary",
  ITINERARY_DRAFT_SAVED: "Saved itinerary draft",
  ITINERARY_SENT: "Sent itinerary",
  ITINERARY_CONFIRMED: "Confirmed itinerary",
  ITINERARY_REJECTED: "Rejected itinerary",

  // User Management
  USER_CREATED: "Created user account",
  USER_DELETED: "Deleted user account",
  USER_UPDATED: "Updated user account",
  USER_DEACTIVATED: "Deactivated user account",
  USER_PROFILE_UPDATED: "Updated profile",

  // Authentication & System
  AUTH_LOGIN: "Logged in",
  AUTH_LOGOUT: "Logged out",
  AUTH_PASSWORD_RESET: "Reset password",
  AUTH_PASSWORD_CHANGED: "Changed password",

  // Inquiry Management
  INQUIRY_CREATED: "Created inquiry",
  INQUIRY_MESSAGE_SENT: "Sent inquiry message",
  INQUIRY_RESOLVED: "Resolved inquiry",

  // Payment
  PAYMENT_RECEIVED: "Submitted payment",
  PAYMENT_VERIFIED: "Verified payment",

  // FAQ Management
  FAQ_CREATED: "Created FAQ",
  FAQ_UPDATED: "Updated FAQ",
  FAQ_DELETED: "Deleted FAQ",
} as const;

export type ActivityActionType = (typeof ActivityAction)[keyof typeof ActivityAction];

interface AuditLogPayload {
  actorUserId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: AuditMetadata;
  message?: string;
}

const toDetails = (payload: AuditLogPayload) => {
  const sanitizedMetadata = payload.metadata
    ? Object.fromEntries(
        Object.entries(payload.metadata).filter(([, value]) =>
          ["string", "number", "boolean"].includes(typeof value)
        )
      )
    : undefined;

  return JSON.stringify({
    entityType: payload.entityType ?? null,
    entityId: payload.entityId ?? null,
    metadata: sanitizedMetadata,
    message: payload.message,
  });
};

const parseDetails = (details?: string | null) => {
  if (!details) {
    return {} as {
      entityType?: string;
      entityId?: string;
      metadata?: AuditMetadata;
      message?: string;
    };
  }

  try {
    const parsed = JSON.parse(details) as {
      entityType?: string;
      entityId?: string;
      metadata?: AuditMetadata;
      message?: string;
    };
    return parsed;
  } catch (error) {
    return { message: details };
  }
};

export async function logAudit(tx: ActivityLogClient, payload: AuditLogPayload) {
  await tx.activityLog.create({
    data: {
      userId: payload.actorUserId,
      action: payload.action,
      details: toDetails(payload),
    },
  });
}

export async function logActivity(
  tx: ActivityLogClient,
  userId: string,
  action: string,
  details?: string
) {
  await logAudit(tx, {
    actorUserId: userId,
    action,
    message: details,
  });
}

const mapLog = (log: any) => {
  const parsed = parseDetails(log.details);
  return {
    id: log.id,
    userId: log.userId,
    user: log.user,
    action: log.action,
    timestamp: log.timestamp,
    entityType: parsed.entityType,
    entityId: parsed.entityId,
    metadata: parsed.metadata,
    message: parsed.message,
    details: parsed.message ?? log.details ?? undefined,
  };
};

export const ActivityLogService = {
  async list(params: {
    page: number;
    limit: number;
    actorId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const { page, limit, actorId, action, entityType, entityId, dateFrom, dateTo } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(actorId ? { userId: actorId } : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
      // Improved filtering for the stringified JSON "details" column
      ...(entityType ? { details: { contains: `"entityType":"${entityType}"` } } : {}),
      ...(entityId ? { details: { contains: `"entityId":"${entityId}"` } } : {}),
      ...(dateFrom || dateTo ? {
        timestamp: {
          gte: dateFrom ? new Date(dateFrom) : undefined,
          lte: dateTo ? new Date(dateTo) : undefined,
        },
      } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      items: items.map(mapLog),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getById(id: string) {
    const log = await prisma.activityLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!log) return null;

    return mapLog(log);
  },
};
