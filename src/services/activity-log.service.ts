import { prisma } from "@/config/database";
import { PrismaClient, Prisma } from "@prisma/client";

type ActivityLogClient = Prisma.TransactionClient | PrismaClient;

type AuditMetadata = Record<string, unknown> | undefined;

// Standardized action types for activity logging
export const ActivityAction = {
  // Booking Management
  BOOKING_CREATED: "BOOKING_CREATED",
  BOOKING_UPDATED: "BOOKING_UPDATED",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  BOOKING_COMPLETED: "BOOKING_COMPLETED",
  BOOKING_VIEWED: "BOOKING_VIEWED",

  // Approval & Workflow
  BOOKING_APPROVED: "BOOKING_APPROVED",
  BOOKING_REJECTED: "BOOKING_REJECTED",

  // Itinerary Management
  ITINERARY_CREATED: "ITINERARY_CREATED",
  ITINERARY_UPDATED: "ITINERARY_UPDATED",
  ITINERARY_DELETED: "ITINERARY_DELETED",
  ITINERARY_DRAFT_SAVED: "ITINERARY_DRAFT_SAVED",
  ITINERARY_SENT: "ITINERARY_SENT",
  ITINERARY_CONFIRMED: "ITINERARY_CONFIRMED",
  ITINERARY_REJECTED: "ITINERARY_REJECTED",

  // User Management
  USER_CREATED: "USER_CREATED",
  USER_DELETED: "USER_DELETED",
  USER_UPDATED: "USER_UPDATED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_PROFILE_UPDATED: "USER_PROFILE_UPDATED",

  // Authentication & System
  AUTH_LOGIN: "AUTH_LOGIN",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  AUTH_PASSWORD_RESET: "AUTH_PASSWORD_RESET",
  AUTH_PASSWORD_CHANGED: "AUTH_PASSWORD_CHANGED",

  // Inquiry Management
  INQUIRY_CREATED: "INQUIRY_CREATED",
  INQUIRY_MESSAGE_SENT: "INQUIRY_MESSAGE_SENT",
  INQUIRY_RESOLVED: "INQUIRY_RESOLVED",

  // Payment
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  PAYMENT_VERIFIED: "PAYMENT_VERIFIED",

  // FAQ Management
  FAQ_CREATED: "FAQ_CREATED",
  FAQ_UPDATED: "FAQ_UPDATED",
  FAQ_DELETED: "FAQ_DELETED",
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
