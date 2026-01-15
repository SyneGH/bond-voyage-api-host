import {
  CollaboratorRole,
  ItineraryStatus,
  ItineraryType,
  Prisma,
  RequestStatus,
  TourType,
  UserRole,
} from "@prisma/client";
import crypto from "crypto";
import { prisma } from "@/config/database";
import { serializeItinerary, toISO } from "@/utils/serialize";
import { logAudit, ActivityAction } from "@/services/activity-log.service";
import { serializeVersion } from "@/utils/serialize";

interface UpsertItineraryInput {
  userId?: string;
  title?: string | null;
  destination?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  travelers?: number;
  estimatedCost?: number | null;
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

const itineraryIncludes: Prisma.ItineraryInclude = {
  collaborators: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  days: { include: { activities: true }, orderBy: { dayNumber: "asc" } },
};

const SHARE_TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SHARE_TOKEN_LENGTH = 8;
const SHARE_TOKEN_MAX_USES = 5;

const generateShareToken = () => {
  let token = "";
  const alphabetLength = SHARE_TOKEN_ALPHABET.length;
  const maxValue = Math.floor(256 / alphabetLength) * alphabetLength;

  while (token.length < SHARE_TOKEN_LENGTH) {
    const bytes = crypto.randomBytes(SHARE_TOKEN_LENGTH);
    for (const byte of bytes) {
      if (byte >= maxValue) continue;
      token += SHARE_TOKEN_ALPHABET[byte % alphabetLength];
      if (token.length === SHARE_TOKEN_LENGTH) break;
    }
  }

  return token;
};

const generateUniqueShareToken = async (tx: Prisma.TransactionClient) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateShareToken();
    const existing = await tx.itineraryShare.findUnique({
      where: { token },
      select: { id: true },
    });
    if (!existing) return token;
  }

  throw new Error("SHARE_TOKEN_CONFLICT");
};

type ItinerarySnapshot = {
  id: string;
  userId: string;
  title?: string | null;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  estimatedCost: number | null;
  type: ItineraryType;
  status: ItineraryStatus;
  tourType: TourType;
  days: {
    dayNumber: number;
    date: string | null;
    title?: string | null;
    activities: {
      time: string;
      title: string;
      description?: string | null;
      location?: string | null;
      icon?: string | null;
      order: number;
    }[];
  }[];
};

const buildSnapshot = (itinerary: {
  id: string;
  userId: string;
  title?: string | null;
  destination: string;
  startDate?: Date | null;
  endDate?: Date | null;
  travelers: number;
  estimatedCost?: Prisma.Decimal | number | null;
  type: ItineraryType;
  status: ItineraryStatus;
  tourType: TourType;
  days?: { dayNumber: number; title?: string | null; date?: Date | null; activities?: { time: string; title: string; description?: string | null; location?: string | null; icon?: string | null; order: number }[] }[];
}): ItinerarySnapshot => ({
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

const ensureCanViewItinerary = (itinerary: {
  userId: string;
  collaborators: { userId: string }[];
}, viewerId: string) => {
  const isOwner = itinerary.userId === viewerId;
  const isCollaborator = itinerary.collaborators.some((c) => c.userId === viewerId);
  if (!isOwner && !isCollaborator) {
    const err: any = new Error("ITINERARY_FORBIDDEN");
    throw err;
  }
};

export const ItineraryService = {
  async create(data: UpsertItineraryInput & { userId: string; destination: string }) {
    const itinerary = await prisma.$transaction(async (tx) => {
      const created = await tx.itinerary.create({
        data: {
          userId: data.userId,
          title: data.title,
          destination: data.destination,

          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,

          travelers: data.travelers ?? 1,
          estimatedCost: data.estimatedCost as unknown as Prisma.Decimal,
          type: data.type ?? ItineraryType.CUSTOMIZED,
          tourType: data.tourType ?? TourType.PRIVATE,
          days: data.days
            ? {
                create: data.days.map((day) => ({
                  dayNumber: day.dayNumber,
                  title: day.title ?? null,

                  date: day.date ? new Date(day.date) : undefined,
                  activities: { create: day.activities },
                })),
              }
            : undefined,
        },
        include: itineraryIncludes,
      });

      await tx.itineraryVersion.create({
        data: {
          itineraryId: created.id,
          version: created.version,
          snapshot: buildSnapshot(created),
          createdById: data.userId,
        },
      });

      await logAudit(tx, {
        actorUserId: data.userId,
        action: ActivityAction.ITINERARY_CREATED,
        entityType: "ITINERARY",
        entityId: created.id,
        metadata: { destination: data.destination },
        message: "Itinerary created",
      });

      return created;
    });

    return serializeItinerary(itinerary);
  },

  async getById(id: string) {
    const itinerary = await prisma.itinerary.findUnique({
      where: { id },
      include: itineraryIncludes,
    });
    return serializeItinerary(itinerary);
  },

  async listByUser(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [items, total] = await prisma.$transaction([
      prisma.itinerary.findMany({
        where: { userId },
        include: itineraryIncludes,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.itinerary.count({ where: { userId } }),
    ]);

    return {
      items: items.map((it) => serializeItinerary(it)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async update(
    id: string,
    userId: string,
    data: UpsertItineraryInput & { version: number }
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.itinerary.findUnique({
        where: { id },
        include: { collaborators: true, days: { include: { activities: true } } },
      });

      if (!existing) return null;

      const isOwner = existing.userId === userId;
      const isCollaborator = existing.collaborators.some(
        (collab) => collab.userId === userId
      );

      if (!isOwner && !isCollaborator) {
        const err: any = new Error("ITINERARY_FORBIDDEN");
        throw err;
      }

      if (isCollaborator && existing.status !== ItineraryStatus.DRAFT) {
        const err: any = new Error("ITINERARY_FORBIDDEN");
        throw err;
      }

      const destination = data.destination ?? existing.destination;
      const travelers = data.travelers ?? existing.travelers;
      const startDate =
        data.startDate === undefined
          ? existing.startDate ?? undefined
          : data.startDate ?? null;
      const endDate =
        data.endDate === undefined ? existing.endDate ?? undefined : data.endDate ?? null;
      const estimatedCost =
        data.estimatedCost !== undefined
          ? (data.estimatedCost as unknown as Prisma.Decimal | null)
          : existing.estimatedCost;
      const title = data.title !== undefined ? data.title : existing.title;
      const type = data.type ?? existing.type;
      const tourType = data.tourType ?? existing.tourType;

      const result = await tx.itinerary.updateMany({
        where: { id, version: data.version },
        data: {
          title,
          destination,
          startDate,
          endDate,
          travelers,
          estimatedCost,
          type,
          tourType,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        const err: any = new Error("ITINERARY_VERSION_CONFLICT");
        throw err;
      }

      await tx.itineraryDay.deleteMany({ where: { itineraryId: id } });

      if (data.days) {
        for (const day of data.days) {
          await tx.itineraryDay.create({
            data: {
              itineraryId: id,
              dayNumber: day.dayNumber,
              title: day.title ?? null,
              date: day.date ?? undefined,
              activities: { create: day.activities },
            },
          });
        }
      }

      const updated = await tx.itinerary.findUnique({
        where: { id },
        include: itineraryIncludes,
      });

      if (!updated) return null;

      // Use upsert to avoid duplicate version creation on retries or race conditions
      await tx.itineraryVersion.upsert({
        where: {
          itineraryId_version: {
            itineraryId: id,
            version: updated.version,
          },
        },
        update: {
          snapshot: buildSnapshot({ ...updated, days: updated.days }),
          createdById: userId,
        },
        create: {
          itineraryId: id,
          version: updated.version,
          snapshot: buildSnapshot({ ...updated, days: updated.days }),
          createdById: userId,
        },
      });

      await logAudit(tx, {
        actorUserId: userId,
        action: ActivityAction.ITINERARY_UPDATED,
        entityType: "ITINERARY",
        entityId: id,
        metadata: { destination, travelers },
        message: "Itinerary updated",
      });

      return serializeItinerary(updated);
    });
  },

  async archive(id: string, userId: string) {
    const itinerary = await prisma.itinerary.findUnique({ where: { id } });
    if (!itinerary) return null;
    if (itinerary.userId !== userId) {
      const err: any = new Error("ITINERARY_FORBIDDEN");
      throw err;
    }

    const updated = await prisma.itinerary.update({
      where: { id },
      data: { status: ItineraryStatus.ARCHIVED },
      include: itineraryIncludes,
    });
    return serializeItinerary(updated);
  },

  async send(id: string, userId: string) {
    const itinerary = await prisma.itinerary.findUnique({
      where: { id },
      include: { collaborators: true },
    });
    if (!itinerary) return null;
    if (itinerary.userId !== userId) {
      const err: any = new Error("ITINERARY_FORBIDDEN");
      throw err;
    }

    const updated = await prisma.itinerary.update({
      where: { id },
      data: {
        requestedStatus: RequestStatus.SENT,
        sentStatus: "Sent",
        sentAt: new Date(),
      },
      include: itineraryIncludes,
    });

    await logAudit(prisma, {
      actorUserId: userId,
      action: ActivityAction.ITINERARY_SENT,
      entityType: "ITINERARY",
      entityId: id,
      message: "Itinerary sent to client",
    });
    return serializeItinerary(updated);
  },

  async confirm(id: string, userId: string) {
    const itinerary = await prisma.itinerary.findUnique({
      where: { id },
      include: { collaborators: true },
    });
    if (!itinerary) return null;

    const isOwner = itinerary.userId === userId;
    const isCollaborator = itinerary.collaborators.some(
      (collab) => collab.userId === userId
    );
    if (!isOwner && !isCollaborator) {
      const err: any = new Error("ITINERARY_FORBIDDEN");
      throw err;
    }

    const updated = await prisma.itinerary.update({
      where: { id },
      data: {
        requestedStatus: RequestStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
      include: itineraryIncludes,
    });

    await logAudit(prisma, {
      actorUserId: userId,
      action: ActivityAction.ITINERARY_CONFIRMED,
      entityType: "ITINERARY",
      entityId: id,
      message: "Itinerary confirmed",
    });
    return serializeItinerary(updated);
  },

  async addCollaborator(id: string, ownerId: string, collaboratorId: string) {
    return prisma.$transaction(async (tx) => {
      const itinerary = await tx.itinerary.findFirst({
        where: { id, userId: ownerId },
      });
      if (!itinerary) return null;

      const collab = await tx.itineraryCollaborator.upsert({
        where: { itineraryId_userId: { itineraryId: id, userId: collaboratorId } },
        update: {},
        create: { itineraryId: id, userId: collaboratorId, invitedById: ownerId },
      });
      await logAudit(tx, {
        actorUserId: ownerId,
        action: ActivityAction.ITINERARY_UPDATED,
        entityType: "ITINERARY",
        entityId: id,
        metadata: { collaboratorId, action: "collaborator_added" },
        message: "Collaborator added to itinerary",
      });
      return collab;
    });
  },

  async removeCollaborator(id: string, ownerId: string, collaboratorId: string) {
    const removed = await prisma.itineraryCollaborator.deleteMany({
      where: { itineraryId: id, userId: collaboratorId, itinerary: { userId: ownerId } },
    });
    await logAudit(prisma, {
      actorUserId: ownerId,
      action: ActivityAction.ITINERARY_UPDATED,
      entityType: "ITINERARY",
      entityId: id,
      metadata: { collaboratorId, action: "collaborator_removed" },
      message: "Collaborator removed from itinerary",
    });
    return removed;
  },

  async createShare(itineraryId: string, ownerId: string) {
    return prisma.$transaction(async (tx) => {
      const itinerary = await tx.itinerary.findUnique({
        where: { id: itineraryId },
        select: { id: true, userId: true },
      });

      if (!itinerary) {
        throw new Error("ITINERARY_NOT_FOUND");
      }

      if (itinerary.userId !== ownerId) {
        throw new Error("ITINERARY_FORBIDDEN");
      }

      const token = await generateUniqueShareToken(tx);

      const share = await tx.itineraryShare.create({
        data: {
          token,
          itineraryId,
          createdById: ownerId,
          role: CollaboratorRole.COLLABORATOR,
          maxUses: SHARE_TOKEN_MAX_USES,
        },
      });

      await logAudit(tx, {
        actorUserId: ownerId,
        action: ActivityAction.ITINERARY_UPDATED,
        entityType: "ITINERARY",
        entityId: itineraryId,
        metadata: { action: "share_created", token: share.token },
        message: "Itinerary share created",
      });

      return share;
    });
  },

  async acceptShare(token: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const share = await tx.itineraryShare.findUnique({
        where: { token },
        include: {
          itinerary: {
            select: {
              id: true,
              userId: true,
              collaborators: { select: { userId: true } },
            },
          },
        },
      });

      if (!share) {
        throw new Error("SHARE_NOT_FOUND");
      }

      const isOwner = share.itinerary.userId === userId;
      const isCollaborator = share.itinerary.collaborators.some(
        (collab: { userId: string }) => collab.userId === userId
      );

      if (isOwner || isCollaborator) {
        return { collaborator: null, status: "ALREADY_COLLABORATOR" };
      }

      if (share.revokedAt) {
        throw new Error("SHARE_REVOKED");
      }

      if (share.uses >= share.maxUses) {
        throw new Error("SHARE_MAX_USES");
      }

      const collaborator = await tx.itineraryCollaborator.create({
        data: {
          itineraryId: share.itineraryId,
          userId,
          invitedById: share.createdById,
          role: share.role,
        },
      });

      await tx.itineraryShare.update({
        where: { token },
        data: { uses: { increment: 1 } },
      });

      await logAudit(tx, {
        actorUserId: userId,
        action: ActivityAction.ITINERARY_UPDATED,
        entityType: "ITINERARY",
        entityId: share.itineraryId,
        metadata: { action: "share_accepted", token },
        message: "Itinerary share accepted",
      });

      return { collaborator, status: "ADDED" };
    });
  },

  async revokeShare(token: string, ownerId: string) {
    const share = await prisma.itineraryShare.findUnique({
      where: { token },
      select: { id: true, createdById: true },
    });

    if (!share) {
      throw new Error("SHARE_NOT_FOUND");
    }

    if (share.createdById !== ownerId) {
      throw new Error("ITINERARY_FORBIDDEN");
    }

    return prisma.itineraryShare.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
  },

  async listCollaborators(id: string, viewerId: string) {
    const itinerary = await prisma.itinerary.findUnique({
      where: { id },
      include: {
        user: true,
        collaborators: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!itinerary) return null;

    const isOwner = itinerary.userId === viewerId;
    const isCollaborator = itinerary.collaborators.some((c) => c.userId === viewerId);
    if (!isOwner && !isCollaborator) {
      const err: any = new Error("ITINERARY_FORBIDDEN");
      throw err;
    }

    return itinerary.collaborators;
  },

  async listVersions(itineraryId: string, viewerId: string) {
    const itinerary = await prisma.itinerary.findUnique({
      where: { id: itineraryId },
      include: { collaborators: true },
    });

    if (!itinerary) return null;

    ensureCanViewItinerary(itinerary, viewerId);

    const versions = await prisma.itineraryVersion.findMany({
      where: { itineraryId },
      include: {
        createdBy: { select: { firstName: true, lastName: true } }
      },
      orderBy: { version: 'desc' }
    });

    return versions.map(serializeVersion);
  },

  async getVersionDetail(itineraryId: string, versionId: string, userId: string) {
    // 1. Check Permissions first
    const itinerary = await prisma.itinerary.findUnique({
      where: { id: itineraryId },
      include: { collaborators: true },
    });

    if (!itinerary) return null;

    const isOwner = itinerary.userId === userId;
    const isCollaborator = itinerary.collaborators.some((c) => c.userId === userId);

    if (!isOwner && !isCollaborator) {
      const err: any = new Error("ITINERARY_FORBIDDEN");
      throw err;
    }

    // 2. Fetch the specific version
    const version = await prisma.itineraryVersion.findUnique({
      where: { 
        id: versionId,
        itineraryId: itineraryId // Security check: ensure version belongs to itinerary
      },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (!version) return null;

    // 3. Serialize (Rename columns for frontend)
    return serializeVersion(version);
  },

  async restoreVersion(
    itineraryId: string,
    versionId: string,
    userId: string,
    role: string,
    expectedVersion: number
  ) {
    return prisma.$transaction(async (tx) => {
      const itinerary = await tx.itinerary.findUnique({
        where: { id: itineraryId },
        include: { collaborators: true },
      });

      if (!itinerary) return null;

      const isOwner = itinerary.userId === userId;
      const isAdmin = role === UserRole.ADMIN;
      if (!isOwner && !isAdmin) {
        const err: any = new Error("ITINERARY_FORBIDDEN");
        throw err;
      }

      const version = await tx.itineraryVersion.findFirst({
        where: { id: versionId, itineraryId },
      });

      if (!version) return null;

      const snapshot = version.snapshot as ItinerarySnapshot;

      const result = await tx.itinerary.updateMany({
        where: { id: itineraryId, version: expectedVersion },
        data: {
          title: snapshot.title ?? null,
          destination: snapshot.destination,
          startDate: snapshot.startDate ? new Date(snapshot.startDate) : null,
          endDate: snapshot.endDate ? new Date(snapshot.endDate) : null,
          travelers: snapshot.travelers,
          estimatedCost: snapshot.estimatedCost as unknown as Prisma.Decimal | null,
          type: snapshot.type,
          status: snapshot.status,
          tourType: snapshot.tourType,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        const err: any = new Error("ITINERARY_VERSION_CONFLICT");
        throw err;
      }

      await tx.itineraryDay.deleteMany({ where: { itineraryId } });

      for (const day of snapshot.days) {
        const createdDay = await tx.itineraryDay.create({
          data: {
            itineraryId,
            dayNumber: day.dayNumber,
            title: day.title ?? undefined,
            date: day.date ? new Date(day.date) : undefined,
          },
        });

        if (day.activities?.length) {
          for (const activity of day.activities) {
            await tx.activity.create({
              data: {
                itineraryDayId: createdDay.id,
                time: activity.time,
                title: activity.title,
                description: activity.description ?? undefined,
                location: activity.location ?? undefined,
                icon: activity.icon ?? undefined,
                order: activity.order,
              },
            });
          }
        }
      }

      const restored = await tx.itinerary.findUnique({
        where: { id: itineraryId },
        include: itineraryIncludes,
      });

      if (!restored) return null;

      // Use upsert to avoid duplicate version creation on retries or race conditions
      await tx.itineraryVersion.upsert({
        where: {
          itineraryId_version: {
            itineraryId,
            version: restored.version,
          },
        },
        update: {
          snapshot: buildSnapshot({ ...restored, days: restored.days }),
          createdById: userId,
        },
        create: {
          itineraryId,
          version: restored.version,
          snapshot: buildSnapshot({ ...restored, days: restored.days }),
          createdById: userId,
        },
      });

      await logAudit(tx, {
        actorUserId: userId,
        action: ActivityAction.ITINERARY_UPDATED,
        entityType: "ITINERARY",
        entityId: itineraryId,
        metadata: { restoredFromVersion: version.version, action: "restored" },
        message: "Itinerary restored from previous version",
      });

      return serializeItinerary(restored);
    });
  },
};
