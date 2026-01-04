import { Request, Response } from "express";
import { ZodError } from "zod";
import { optimizeRouteDto } from "@/validators/route.dto";
import { AppError, createResponse, throwError } from "@/utils/responseHandler";
import { HTTP_STATUS } from "@/constants/constants";
import { GeoapifyService } from "@/services/geoapify.service";

const MAX_MATRIX_POINTS = 25;

export const RouteController = {
  optimize: async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = optimizeRouteDto.parse(req.body);
      let activities = payload.activities; // Mutable copy
      const mode = payload.mode ?? "drive";

      if (activities.length > MAX_MATRIX_POINTS) {
        throwError(
          HTTP_STATUS.BAD_REQUEST,
          `Too many activities. Maximum allowed is ${MAX_MATRIX_POINTS}.`
        );
      }

      // --- NEW: RESOLVE MISSING COORDINATES ---
      // We map over activities async to fetch coords for any that are missing them
      activities = await Promise.all(
        activities.map(async (activity) => {
          // If we already have coordinates, use them
          if (typeof activity.lat === "number" && typeof activity.lng === "number") {
            return { ...activity, lat: activity.lat, lng: activity.lng };
          }
          
          // Otherwise, resolve the location string
          if (activity.location) {
             const coords = await GeoapifyService.getCoordinates(activity.location);
             return { ...activity, lat: coords.lat, lng: coords.lng };
          }

          // Should be caught by Zod, but safe fallback
          throwError(HTTP_STATUS.BAD_REQUEST, `Invalid activity data for ID: ${activity.id}`);
          return activity as any; 
        })
      );
      // ----------------------------------------

      // Now 'activities' is guaranteed to have lat/lng. 
      // We pass this "hydrated" array to the matrix service.
      
      // Cast to ensure type safety for the service call
      const coordsOnly = activities.map(a => ({ lat: a.lat!, lng: a.lng! }));

      const matrix = await GeoapifyService.routeMatrix(coordsOnly, mode);
      const order = buildNearestNeighborOrder(matrix.times);
      const optimizedActivities = order.map((index) => activities[index]);

      const totalsFromMatrix = sumTotalsFromMatrix(
        order,
        matrix.distances,
        matrix.times
      );

      // Recalculate route geometry using the optimized order
      const optimizedCoords = optimizedActivities.map(a => ({ lat: a.lat!, lng: a.lng! }));
      
      const routingResponse = await GeoapifyService.route(
        optimizedCoords,
        mode
      );

      const routingFeature = (routingResponse as any)?.features?.[0];
      const routeGeometry = routingFeature?.geometry;
      const routeProps = routingFeature?.properties;

      if (!routeGeometry) {
        throwError(
          HTTP_STATUS.BAD_GATEWAY,
          "Geoapify routing response missing geometry"
        );
      }

      const totalDistance =
        typeof routeProps?.distance === "number"
          ? routeProps.distance
          : totalsFromMatrix.totalDistance;
      const totalTime =
        typeof routeProps?.time === "number"
          ? routeProps.time
          : totalsFromMatrix.totalTime;

      createResponse(res, HTTP_STATUS.OK, "Route optimized", {
        optimizedActivities,
        routeGeometry,
        totalDistance: typeof routeProps?.distance === "number" ? routeProps.distance : totalsFromMatrix.totalDistance,
        totalTime: typeof routeProps?.time === "number" ? routeProps.time : totalsFromMatrix.totalTime,
        matrixSummary: totalsFromMatrix,
      });

    } catch (error) {
      // ... (Keep existing Error Handling)
      if (error instanceof ZodError) {
        throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throwError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Route optimization failed", error);
    }
  },
};

const buildNearestNeighborOrder = (
  times: Array<Array<number | null>>
): number[] => {
  const total = times.length;
  if (total === 0) return [];
  if (total === 1) return [0];
  if (total === 2) return [0, 1];

  const startIndex = 0;
  const endIndex = total - 1;

  const remainingMiddle = new Set<number>();
  for (let i = 1; i < endIndex; i += 1) {
    remainingMiddle.add(i);
  }

  const order = [startIndex];
  while (remainingMiddle.size > 0) {
    const current = order[order.length - 1];
    let nextIndex: number | null = null;
    let bestTime = Number.POSITIVE_INFINITY;

    remainingMiddle.forEach((candidate) => {
      const time = times[current]?.[candidate];
      if (typeof time === "number" && time < bestTime) {
        bestTime = time;
        nextIndex = candidate;
      }
    });

    if (nextIndex === null) {
      const iter = remainingMiddle.values().next();
      if (iter.done || typeof iter.value !== "number") {
        break; // no valid next node
      }
      nextIndex = iter.value;
    }

    remainingMiddle.delete(nextIndex);
    order.push(nextIndex);
  }

  order.push(endIndex);
  return order;
};

const sumTotalsFromMatrix = (
  order: number[],
  distances: Array<Array<number | null>>,
  times: Array<Array<number | null>>
) => {
  return order.reduce(
    (totals, index, position) => {
      if (position === 0) {
        return totals;
      }
      const prevIndex = order[position - 1];
      const distance = distances[prevIndex]?.[index];
      const time = times[prevIndex]?.[index];
      return {
        totalDistance:
          totals.totalDistance + (typeof distance === "number" ? distance : 0),
        totalTime: totals.totalTime + (typeof time === "number" ? time : 0),
      };
    },
    { totalDistance: 0, totalTime: 0 }
  );
};
