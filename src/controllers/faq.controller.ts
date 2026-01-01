import { Request, Response } from "express";
import { createResponse, throwError } from "@/utils/responseHandler";
import { HTTP_STATUS } from "@/constants/constants";
import { prisma } from "@/config/database";

const defaultFaqs = [
  {
    id: "faq-1",
    question: "How do I create an itinerary?",
    answer: "Use the itinerary planner to add destinations, dates, and activities, then save.",
    order: 1,
  },
  {
    id: "faq-2",
    question: "How are booking codes generated?",
    answer: "Booking codes follow the BV-YYYY-NNN format at the time of booking creation.",
    order: 2,
  },
];

export const FaqController = {
  list: async (_req: Request, res: Response): Promise<void> => {
    try {
      const faqs = await prisma.faqEntry.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      });

      const payload = faqs.length > 0 ? faqs : defaultFaqs;

      createResponse(res, HTTP_STATUS.OK, "FAQs retrieved", payload);
    } catch (error) {
      throwError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch FAQs", error);
    }
  },
};
