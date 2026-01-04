import { z } from "zod";

const locationDto = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const optimizeRouteDto = z.object({
  dayId: z.string().optional(),
  mode: z.string().optional(),
  activities: z
    .array(
      z.object({
        id: z.string().min(1),
        location: z.string().optional(), // Added location string field
        ...locationDto.shape,
      })
      // Refine: Require either (lat+lng) OR (location string)
      .refine((data) => (data.lat !== undefined && data.lng !== undefined) || (data.location && data.location.length > 0), {
        message: "Activity must have either coordinates (lat, lng) or a location name.",
        path: ["location"],
      })
    )
    .min(2, "At least two activities are required"),
});
