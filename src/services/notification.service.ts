import { prisma } from "@/config/database";
import { NotificationType, Prisma, PrismaClient } from "@prisma/client";

type NotificationClient = Prisma.TransactionClient | PrismaClient;

export const NotificationService = {
  async create(
    input: {
      userId: string;
      type: NotificationType;
      title?: string | null;
      message: string;
      data?: Prisma.InputJsonValue;
    },
    tx: NotificationClient = prisma
  ) {
    return tx.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title ?? null,
        message: input.message,
        data: input.data ?? undefined,
      },
    });
  },

  async list(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async markRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  },
};
