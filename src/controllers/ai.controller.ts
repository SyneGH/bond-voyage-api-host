import { Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, createResponse, throwError } from "@/utils/responseHandler";
import { HTTP_STATUS } from "@/constants/constants";
import { smartTripGenerateDto } from "@/validators/ai.dto";
import { AiService } from "@/services/ai.service";

export const AiController = {
  generateItinerary: async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = smartTripGenerateDto.parse(req.body);
      const itinerary = AiService.buildSmartTripItinerary(payload);
      createResponse(res, HTTP_STATUS.OK, "Itinerary generated", {
        itinerary,
        metadata: {
          destination: payload.destination,
          startDate: payload.startDate,
          endDate: payload.endDate,
          travelers: payload.travelers,
          budget: payload.budget,
          travelPace: payload.travelPace,
          preferences: payload.preferences ?? [],
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throwError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Itinerary generation failed", error);
    }
  },
};
