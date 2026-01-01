import { Request, Response } from "express";
import { createResponse } from "@/utils/responseHandler";
import { HTTP_STATUS } from "@/constants/constants";

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
    createResponse(res, HTTP_STATUS.OK, "FAQs retrieved", defaultFaqs);
  },
};
