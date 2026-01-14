import { z } from "zod";

const locationDto = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

const activityDto = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    location: z.string().optional(),
    time: z.string().optional().nullable(),
    ...locationDto.shape,
  })
  .refine(
    (data) =>
      (data.lat !== undefined && data.lng !== undefined) ||
      (data.location && data.location.length > 0),
    {
      message: "Activity must have either coordinates (lat, lng) or a location name.",
      path: ["location"],
    }
  );

export const optimizeRouteDto = z.object({
  dayId: z.string().optional(),
  mode: z.enum(["drive", "walk", "bicycle", "transit"]).optional().default("drive"),
  activities: z.array(activityDto).min(2, "At least two activities are required"),
});

export type OptimizeRouteInput = z.infer<typeof optimizeRouteDto>;