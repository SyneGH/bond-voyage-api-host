import { z } from "zod";

const dateSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  return value;
}, z.date());

export const aiItineraryDto = z
  .object({
    destination: z.string().min(1),
    startDate: dateSchema,
    endDate: dateSchema,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });
