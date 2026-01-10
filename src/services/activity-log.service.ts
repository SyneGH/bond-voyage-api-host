import { prisma } from "@/config/database";
import { PrismaClient, Prisma, UserRole } from "@prisma/client";
import { ActivityEventCode } from "@/constants/activity-events";

type ActivityLogClient = Prisma.TransactionClient | PrismaClient;

type AuditMetadata = Record<string, unknown> | undefined;

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

interface AuditLogPayload {
  actorUserId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: AuditMetadata;
  message?: string;
  eventCode?: ActivityEventCode | string;
  actorRole?: UserRole;
  targetUserId?: string | null;
  reqContext?: RequestContext;
}

interface ActivityLogPayload {
  actorId: string;
  eventCode: ActivityEventCode | string;
  action?: string;
  entityType?: string;
  entityId?: string;
  targetUserId?: string | null;
  actorRole?: UserRole;
  metadata?: AuditMetadata;
  details?: string;
  reqContext?: RequestContext;
}

const SENSITIVE_KEYS = /password|token|secret|otp|card|cvv|pin/i;
const MAX_METADATA_BYTES = 8000;
const MAX_STRING_LENGTH = 500;

const sanitizeValue = (value: unknown, depth = 0): unknown => {
  if (depth > 6) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) {
      return `${value.slice(0, MAX_STRING_LENGTH)}…`;
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.test(key)) {
        result[key] = "[REDACTED]";
        continue;
      }
      result[key] = sanitizeValue(entry, depth + 1);
    }
    return result;
  }
  return String(value);
};

const sanitizeMetadata = (metadata?: AuditMetadata) => {
  if (!metadata) return undefined;
  const sanitized = sanitizeValue(metadata) as Record<string, unknown>;
  const serialized = JSON.stringify(sanitized);
  if (serialized.length > MAX_METADATA_BYTES) {
    return {
      truncated: true,
      originalSize: serialized.length,
    };
  }
  return sanitized;
};

const parseLegacyDetails = (details?: string | null) => {
  if (!details) return {};
  try {
    const parsed = JSON.parse(details) as {
      entityType?: string;
      entityId?: string;
      metadata?: AuditMetadata;
      message?: string;
    };
    return parsed;
  } catch {
    return { message: details };
  }
};

const deriveAction = (eventCode: string) => {
  const candidates = [
    "CREATED",
    "UPDATED",
    "CANCELLED",
    "VIEWED",
    "COMPLETED",
    "APPROVED",
    "REJECTED",
    "DELETED",
    "SENT",
    "SAVED",
    "SUBMITTED",
    "ADDED",
    "REMOVED",
    "LOGIN",
    "DOWNLOADED",
    "REQUESTED",
    "FLAGGED",
    "RESET",
    "SUSPENDED",
    "BANNED",
    "ENABLED",
    "DISABLED",
    "CHANGED",
  ];
  for (const candidate of candidates) {
    if (eventCode.endsWith(candidate) || eventCode.includes(`_${candidate}`)) {
      return candidate;
    }
  }
  return "ACTIVITY";
};

const shouldDedupe = (eventCode: string) => eventCode.includes("_VIEWED");

const resolveActorRole = async (
  tx: ActivityLogClient,
  actorId: string,
  actorRole?: UserRole
) => {
  if (actorRole) return actorRole;
  const user = await tx.user.findUnique({
    where: { id: actorId },
    select: { role: true },
  });
  return user?.role ?? UserRole.USER;
};

export async function logActivity(tx: ActivityLogClient, payload: ActivityLogPayload) {
  try {
    const actorRole = await resolveActorRole(tx, payload.actorId, payload.actorRole);
    const metadata = sanitizeMetadata(payload.metadata);

    if (shouldDedupe(payload.eventCode)) {
      const windowStart = new Date(Date.now() - 5 * 60 * 1000);
      const existing = await tx.activityLog.findFirst({
        where: {
          actorId: payload.actorId,
          eventCode: payload.eventCode,
          entityType: payload.entityType ?? null,
          entityId: payload.entityId ?? null,
          createdAt: { gte: windowStart },
        },
        select: { id: true },
      });
      if (existing) return;
    }

    await tx.activityLog.create({
      data: {
        actorId: payload.actorId,
        actorRole,
        eventCode: payload.eventCode,
        action: payload.action ?? deriveAction(payload.eventCode),
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
        targetUserId: payload.targetUserId ?? null,
        metadata: metadata ?? Prisma.DbNull,
        details: payload.details ?? null,
        ipAddress: payload.reqContext?.ipAddress ?? null,
        userAgent: payload.reqContext?.userAgent ?? null,
      },
    });
  } catch (error) {
    console.warn("⚠️ Failed to write activity log:", error);
  }
}

export async function logAudit(tx: ActivityLogClient, payload: AuditLogPayload) {
  await logActivity(tx, {
    actorId: payload.actorUserId,
    eventCode: payload.eventCode ?? `LEGACY_${payload.action}`,
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId,
    metadata: payload.metadata,
    details: payload.message,
    actorRole: payload.actorRole,
    targetUserId: payload.targetUserId ?? null,
    reqContext: payload.reqContext,
  });
}

const mapLog = (log: any) => {
  const legacy = parseLegacyDetails(log.details);
  return {
    id: log.id,
    createdAt: log.createdAt,
    actorId: log.actorId,
    actorRole: log.actorRole,
    actor: log.actor,
    targetUserId: log.targetUserId,
    targetUser: log.targetUser,
    eventCode: log.eventCode,
    action: log.action,
    entityType: log.entityType ?? legacy.entityType,
    entityId: log.entityId ?? legacy.entityId,
    metadata: log.metadata ?? legacy.metadata,
    ipAddress: log.ipAddress ?? undefined,
    userAgent: log.userAgent ?? undefined,
    details: log.details ?? legacy.message ?? undefined,
  };
};

export const ActivityLogService = {
  async list(params: {
    page: number;
    limit: number;
    actorId?: string;
    actorRole?: UserRole;
    action?: string;
    eventCode?: string;
    entityType?: string;
    entityId?: string;
    targetUserId?: string;
    scopeUserId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const {
      page,
      limit,
      actorId,
      actorRole,
      action,
      eventCode,
      entityType,
      entityId,
      targetUserId,
      scopeUserId,
      dateFrom,
      dateTo,
    } = params;
    const skip = (page - 1) * limit;

    const scopedFilter = scopeUserId
      ? {
          OR: [{ actorId: scopeUserId }, { targetUserId: scopeUserId }],
        }
      : {};

    const where = {
      ...scopedFilter,
      ...(actorId ? { actorId } : {}),
      ...(actorRole ? { actorRole } : {}),
      ...(eventCode ? { eventCode } : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(targetUserId ? { targetUserId } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              gte: dateFrom ? new Date(dateFrom) : undefined,
              lte: dateTo ? new Date(dateTo) : undefined,
            },
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
          targetUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
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
        actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        targetUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!log) return null;

    return mapLog(log);
  },
};
