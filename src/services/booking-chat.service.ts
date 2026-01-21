import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/config/database";
import { Role } from "@/constants/constants";
import { AiService } from "@/services/ai.service";
import { toISO } from "@/utils/serialize";

interface ChatAttachment {
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  publicUrl?: string;
}

interface SendMessageDTO {
  bookingId: string;
  senderUserId: string;
  senderRole: string;
  content: string;
  attachments?: ChatAttachment[];
}

interface GetMessagesOptions {
  bookingId: string;
  cursor?: string;
  limit?: number;
}

type ChatMessageKind = "USER" | "ADMIN" | "AI_SUGGESTION" | "SYSTEM";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const AI_CONTEXT_MESSAGE_LIMIT = 20;

const chatPrisma = prisma as any;

export const BookingChatService = {
  async canAccessChat(bookingId: string, userId: string, userRole: string) {
    if (userRole === Role.ADMIN) return true;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        userId: true,
        itinerary: {
          select: {
            collaborators: {
              where: { userId },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!booking) return false;
    if (booking.userId === userId) return true;
    if ((booking.itinerary?.collaborators?.length ?? 0) > 0) return true;

    return false;
  },

  async getMessages({ bookingId, cursor, limit = DEFAULT_LIMIT }: GetMessagesOptions) {
    const take = Math.min(limit, MAX_LIMIT);

    const messages = await chatPrisma.bookingChatMessage.findMany({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const hasMore = messages.length > take;
    const items = hasMore ? messages.slice(0, take) : messages;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
      hasMore,
    };
  },

  async sendMessage({
    bookingId,
    senderUserId,
    senderRole,
    content,
    attachments = [],
  }: SendMessageDTO) {
    const kind: ChatMessageKind = senderRole === Role.ADMIN ? "ADMIN" : "USER";

    const message = await chatPrisma.bookingChatMessage.create({
      data: {
        bookingId,
        senderUserId,
        kind,
        content: content.trim(),
        attachments: attachments as unknown as Prisma.JsonArray,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return message;
  },

  async generateAiSuggestion(bookingId: string, actorUserId: string, actorRole: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        itinerary: {
          include: {
            days: {
              orderBy: { dayNumber: "asc" },
              include: { activities: { orderBy: { order: "asc" } } },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new Error("BOOKING_NOT_FOUND");
    }

    const recentMessages = await chatPrisma.bookingChatMessage.findMany({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
      take: AI_CONTEXT_MESSAGE_LIMIT,
      include: {
        sender: { select: { firstName: true, lastName: true, role: true } },
      },
    });

    const context = buildAiContext(booking, recentMessages.reverse(), actorRole as UserRole);

    let suggestionContent: string;

    try {
      suggestionContent = await AiService.generateRefinementSuggestion(context);
    } catch (error) {
      console.warn("AI suggestion generation failed. Using fallback.");
      suggestionContent = buildFallbackSuggestion(booking, actorRole);
    }

    const message = await chatPrisma.bookingChatMessage.create({
      data: {
        bookingId,
        senderUserId: actorUserId,
        kind: "AI_SUGGESTION",
        content: suggestionContent,
        attachments: [],
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return message;
  },

  async markAsRead(bookingId: string, userId: string, userRole: string) {
    const kindToMark: ChatMessageKind[] =
      userRole === Role.ADMIN ? ["USER"] : ["ADMIN", "AI_SUGGESTION"];

    await chatPrisma.bookingChatMessage.updateMany({
      where: {
        bookingId,
        kind: { in: kindToMark },
        isRead: false,
        senderUserId: { not: userId },
      },
      data: { isRead: true },
    });

    return { success: true };
  },

  async getUnreadCount(bookingId: string, userId: string, userRole: string) {
    const kindToCount: ChatMessageKind[] =
      userRole === Role.ADMIN ? ["USER"] : ["ADMIN", "AI_SUGGESTION"];

    const count = await chatPrisma.bookingChatMessage.count({
      where: {
        bookingId,
        kind: { in: kindToCount },
        isRead: false,
        senderUserId: { not: userId },
      },
    });

    return { unreadCount: count };
  },
};

const buildAiContext = (booking: any, messages: any[], actorRole: UserRole) => {
  return {
    perspective: actorRole === Role.ADMIN ? "travel_agent" : "customer",
    booking: {
      destination: booking.destination,
      startDate: toISO(booking.startDate),
      endDate: toISO(booking.endDate),
      travelers: booking.travelers,
      totalPrice:
        booking.totalPrice !== null && booking.totalPrice !== undefined
          ? Number((booking.totalPrice as any).toString?.() ?? booking.totalPrice)
          : null,
      userBudget:
        booking.userBudget !== null && booking.userBudget !== undefined
          ? Number((booking.userBudget as any).toString?.() ?? booking.userBudget)
          : null,
      type: booking.type,
      tourType: booking.tourType,
      status: booking.status,
      customerName: `${booking.user?.firstName ?? ""} ${booking.user?.lastName ?? ""}`.trim(),
      customerEmail: booking.user?.email ?? null,
      rejectionReason: booking.rejectionReason ?? null,
    },
    itinerary: booking.itinerary
      ? {
          title: booking.itinerary.title ?? null,
          destination: booking.itinerary.destination,
          startDate: toISO(booking.itinerary.startDate),
          endDate: toISO(booking.itinerary.endDate),
          days:
            booking.itinerary.days?.map((day: any) => ({
              dayNumber: day.dayNumber,
              title: day.title ?? null,
              date: toISO(day.date),
              activities:
                day.activities?.map((activity: any) => ({
                  time: activity.time,
                  title: activity.title,
                  description: activity.description ?? null,
                  location: activity.location ?? null,
                })) ?? [],
            })) ?? [],
        }
      : null,
    chatHistory: messages.map((message: any) => {
      const senderName =
        message.kind === "AI_SUGGESTION"
          ? "AI"
          : `${message.sender?.firstName ?? ""} ${message.sender?.lastName ?? ""}`.trim() ||
            message.sender?.role ||
            message.kind;
      return `[${senderName}]: ${message.content}`;
    }),
  };
};

const buildFallbackSuggestion = (booking: any, actorRole: string) => {
  const destination = booking.destination ?? "your destination";
  const travelers = booking.travelers ?? 1;

  if (actorRole === Role.ADMIN) {
    return `## Agent Refinement Suggestions for ${destination}\n\n` +
      `1. **Timing Review**: Check activity sequencing for smoother logistics.\n` +
      `2. **Budget Alignment**: Confirm pricing for ${travelers} traveler(s) vs. current inclusions.\n` +
      `3. **Pace Adjustment**: Consider rest gaps between major activities.\n` +
      `4. **Client Preferences**: Verify preferences from the chat and update the plan accordingly.\n\n` +
      `*Auto-generated suggestion. Please verify with the client.*`;
  }

  return `## Suggestions for Your ${destination} Trip\n\n` +
    `1. **Timing**: Consider starting popular activities earlier to avoid crowds.\n` +
    `2. **Budget Tips**: With ${travelers} traveler(s), group activities can be more cost-effective.\n` +
    `3. **Local Experiences**: Ask for local dining or cultural options to enrich the trip.\n` +
    `4. **Pace**: Make sure there’s enough rest time between activities.\n\n` +
    `*AI-generated suggestion. Discuss any changes with your travel agent.*`;
};
