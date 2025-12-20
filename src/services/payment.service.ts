import { prisma } from "@/config/database";
import { Prisma } from "@prisma/client";
import { logActivity } from "@/services/activity-log.service";
import { NotificationService } from "@/services/notification.service";

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
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: data.bookingId, userId: data.userId },
      });

      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      const payment = await tx.payment.create({
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

      await logActivity(
        tx,
        data.userId,
        "Submitted Payment",
        `Submitted payment ${payment.id} for booking ${booking.id}`
      );
      await NotificationService.create(
        {
          userId: data.userId,
          type: "PAYMENT",
          title: "Payment submitted",
          message: `Your payment for booking ${booking.id} has been submitted.`,
          data: { bookingId: booking.id, paymentId: payment.id },
        },
        tx
      );

      return payment;
    });
  },

  async updatePaymentStatus(paymentId: string, status: "VERIFIED" | "REJECTED") {
    return prisma.payment.update({
      where: { id: paymentId },
      data: { status },
    });
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
