import { prisma } from "@/config/database";
import { Prisma } from "@prisma/client";

interface CreatePaymentInput {
  bookingId: string;
  userId: string;
  amount: number;
  method?: "CASH" | "GCASH";
  type?: "FULL" | "PARTIAL";
  proofImage?: Buffer;
  proofMimeType?: string;
  proofSize?: number;
  transactionId?: string | null;
}

export const PaymentService = {
  async createPayment(data: CreatePaymentInput) {
    const booking = await prisma.booking.findFirst({
      where: { id: data.bookingId, userId: data.userId },
    });

    if (!booking) throw new Error("BOOKING_NOT_FOUND");

    return prisma.payment.create({
      data: {
        bookingId: data.bookingId,
        submittedById: data.userId,
        amount: data.amount as unknown as Prisma.Decimal,
        method: data.method ?? "GCASH",
        type: data.type ?? "PARTIAL",
        proofImage: data.proofImage,
        proofMimeType: data.proofMimeType ?? null,
        proofSize: data.proofSize ?? null,
        transactionId: data.transactionId ?? null,
      },
    });
  },

  async updatePaymentStatus(paymentId: string, status: "VERIFIED" | "REJECTED") {
    return prisma.payment.update({
      where: { id: paymentId },
      data: { status },
    });
  },

  async getPaymentsPaginated(
    filters: {
      status?: "PENDING" | "VERIFIED" | "REJECTED";
      bookingId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    page = 1,
    limit = 10
  ) {
    const skip = (page - 1) * limit;
    const whereClause: Prisma.PaymentWhereInput = {};

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.bookingId) {
      whereClause.bookingId = filters.bookingId;
    }

    if (filters.dateFrom || filters.dateTo) {
      whereClause.createdAt = {
        gte: filters.dateFrom,
        lte: filters.dateTo,
      };
    }

    const [items, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where: whereClause,
        select: {
          id: true,
          bookingId: true,
          submittedById: true,
          amount: true,
          method: true,
          status: true,
          type: true,
          transactionId: true,
          createdAt: true,
          updatedAt: true,
          booking: {
            select: {
              id: true,
              destination: true,
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
          submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: whereClause }),
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

  async getBookingPaymentsPaginated(
    bookingId: string,
    page = 1,
    limit = 10,
    filters?: {
      status?: "PENDING" | "VERIFIED" | "REJECTED";
      dateFrom?: Date;
      dateTo?: Date;
    }
  ) {
    const skip = (page - 1) * limit;
    const whereClause: Prisma.PaymentWhereInput = { bookingId };

    if (filters?.status) {
      whereClause.status = filters.status;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      whereClause.createdAt = {
        gte: filters?.dateFrom,
        lte: filters?.dateTo,
      };
    }

    const [items, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where: whereClause,
        select: {
          id: true,
          bookingId: true,
          submittedById: true,
          amount: true,
          method: true,
          status: true,
          type: true,
          transactionId: true,
          createdAt: true,
          updatedAt: true,
          submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: whereClause }),
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

  async getPaymentProof(paymentId: string) {
    return prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        proofImage: true,
        proofMimeType: true,
        proofSize: true,
        submittedById: true,
        booking: {
          select: {
            userId: true,
          },
        },
      },
    });
  },
};
