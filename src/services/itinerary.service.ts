import {
  ItineraryStatus,
  ItineraryType,
  Prisma,
  RequestStatus,
  TourType,
} from "@prisma/client";
import { prisma } from "@/config/database";
import { serializeItinerary } from "@/utils/serialize";
import { logAudit } from "@/services/activity-log.service";

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

export const ItineraryService = {
  async create(data: UpsertItineraryInput & { userId: string; destination: string }) {
    const itinerary = await prisma.itinerary.create({
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

                date: day.date ? new Date(day.date) : undefined,
                activities: { create: day.activities },
              })),
            }
          : undefined,
      },
      include: itineraryIncludes,
    });

    await logAudit(prisma, {
      actorUserId: data.userId,
      action: "ITINERARY_CREATED",
      entityType: "ITINERARY",
      entityId: itinerary.id,
      metadata: { destination: data.destination },
      message: `Created itinerary ${itinerary.id}`,
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

  async update(id: string, userId: string, data: UpsertItineraryInput) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.itinerary.findUnique({
        where: { id },
        include: { collaborators: true },
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

      await tx.itineraryDay.deleteMany({ where: { itineraryId: id } });

      const destination = data.destination ?? existing.destination;
      const travelers = data.travelers ?? existing.travelers;
      const startDate = data.startDate ?? existing.startDate ?? undefined;
      const endDate = data.endDate ?? existing.endDate ?? undefined;

      const updated = await tx.itinerary.update({
        where: { id },
        data: {
          title: data.title,
          destination,
          startDate,
          endDate,
          travelers,
          estimatedCost: data.estimatedCost as unknown as Prisma.Decimal,
          type: data.type ?? undefined,
          tourType: data.tourType ?? undefined,
          days: data.days
            ? {
                create: data.days.map((day) => ({
                  dayNumber: day.dayNumber,
                  date: day.date ?? undefined,
                  activities: { create: day.activities },
                })),
              }
            : undefined,
        },
        include: itineraryIncludes,
      });

      await logAudit(tx, {
        actorUserId: userId,
        action: "ITINERARY_UPDATED",
        entityType: "ITINERARY",
        entityId: id,
        metadata: { destination, travelers },
        message: `Updated itinerary ${id}`,
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
      action: "ITINERARY_SENT",
      entityType: "ITINERARY",
      entityId: id,
      message: `Sent itinerary ${id}`,
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
      action: "ITINERARY_CONFIRMED",
      entityType: "ITINERARY",
      entityId: id,
      message: `Confirmed itinerary ${id}`,
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
        action: "ITINERARY_COLLABORATOR_ADDED",
        entityType: "ITINERARY",
        entityId: id,
        metadata: { collaboratorId },
        message: `Added collaborator ${collaboratorId} to itinerary ${id}`,
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
      action: "ITINERARY_COLLABORATOR_REMOVED",
      entityType: "ITINERARY",
      entityId: id,
      metadata: { collaboratorId },
      message: `Removed collaborator ${collaboratorId} from itinerary ${id}`,
    });
    return removed;
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
};
