import { z } from "zod";

const locationDto = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const optimizeRouteDto = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  
  dayId: z.string().optional(),
  mode: z.string().optional(),
  activities: z
    .array(
      z.object({
        id: z.string().min(1),
        ...locationDto.shape,
      })
    )
    .min(2, "At least two activities are required"),
});
