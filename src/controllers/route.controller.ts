import { Request, Response } from "express";
import { ZodError } from "zod";
import { optimizeRouteDto } from "@/validators/route.dto";
import { AppError, createResponse, throwError } from "@/utils/responseHandler";
import { HTTP_STATUS } from "@/constants/constants";
import { GeoapifyService } from "@/services/geoapify.service";

const ROUTE_CANDIDATE_TYPES = ["balanced", "short", "less_maneuvers"] as const;

// ---------------------------------------------------------
// Types for Route Comparison
// ---------------------------------------------------------
interface RouteGeometry {
  type: "MultiLineString";
  coordinates: number[][][];
}

interface RouteResult {
  activities: any[];
  geometry: RouteGeometry;
  distance: number; // meters
  time: number; // seconds
}

interface RouteLegCandidate {
  type: (typeof ROUTE_CANDIDATE_TYPES)[number];
  typeIndex: number;
  geometry: any;
  distance: number;
  time: number;
}

interface LegCandidatesResult {
  candidates: RouteLegCandidate[];
  chosenPair: {
    shorter: RouteLegCandidate;
    longer: RouteLegCandidate;
  };
  alreadyOptimizedLeg: boolean;
}

interface RouteMeta {
  alreadyOptimized?: boolean;
  legsAlreadyOptimizedCount?: number;
  optimizationFallbackUsed?: boolean;
}

// ---------------------------------------------------------
// Helper: Ensures every activity has valid lat/lng
// ---------------------------------------------------------
const resolveActivityCoordinates = async (activities: any[]) => {
  return Promise.all(
    activities.map(async (activity) => {
      // 1. If we already have valid coordinates, use them
      if (typeof activity.lat === "number" && typeof activity.lng === "number") {
        return { ...activity, lat: activity.lat, lng: activity.lng };
      }

      // 2. If we have a location string, fetch coordinates
      if (activity.location) {
        try {
          const coords = await GeoapifyService.getCoordinates(activity.location);
          return { ...activity, lat: coords.lat, lng: coords.lng };
        } catch (error) {
          console.warn(`Failed to geocode location: ${activity.location}`, error);
        }
      }

      // 3. Fallback: Throw error if we can't find coordinates
      throwError(
        HTTP_STATUS.BAD_REQUEST,
        `Missing coordinates for activity: ${activity.id || "Unknown"}`
      );
    })
  );
};

// ---------------------------------------------------------
// Helper: Extract route data from Geoapify response
// ---------------------------------------------------------
const extractRouteData = (routingResponse: any): { geometry: any; distance: number; time: number } => {
  const feature = routingResponse?.features?.[0];
  const geometry = feature?.geometry;
  const props = feature?.properties;

  if (!geometry) {
    throwError(HTTP_STATUS.BAD_GATEWAY, "Routing service returned no geometry");
  }

  return {
    geometry,
    distance: typeof props?.distance === "number" ? props.distance : 0,
    time: typeof props?.time === "number" ? props.time : 0,
  };
};

// ---------------------------------------------------------
// Helper: Route a single leg with a specific Geoapify type
// ---------------------------------------------------------
const routeLegCandidate = async (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: string,
  routeType: (typeof ROUTE_CANDIDATE_TYPES)[number],
  typeIndex: number
): Promise<RouteLegCandidate> => {
  const routingResponse = await GeoapifyService.route([from, to], mode, routeType);
  const { geometry, distance, time } = extractRouteData(routingResponse);
  return {
    type: routeType,
    typeIndex,
    geometry,
    distance,
    time,
  };
};

// ---------------------------------------------------------
// Helper: Collect and pick distinct candidates per leg
// ---------------------------------------------------------
const getLegCandidatesDistinct = async (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: string
): Promise<LegCandidatesResult> => {
  const results = await Promise.allSettled(
    ROUTE_CANDIDATE_TYPES.map((routeType, typeIndex) =>
      routeLegCandidate(from, to, mode, routeType, typeIndex)
    )
  );

  const candidates = results.flatMap((result) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }
    console.warn("Route candidate failed", result.reason);
    return [];
  });

  if (candidates.length === 0) {
    throwError(HTTP_STATUS.BAD_GATEWAY, "Routing service returned no routes");
  }

  const byDistanceAsc = [...candidates].sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return a.typeIndex - b.typeIndex;
  });

  const byDistanceDesc = [...candidates].sort((a, b) => {
    if (a.distance !== b.distance) {
      return b.distance - a.distance;
    }
    return a.typeIndex - b.typeIndex;
  });

  const shorter = byDistanceAsc[0];
  const longer = byDistanceDesc[0];
  const alreadyOptimizedLeg = shorter.distance === longer.distance;

  return {
    candidates,
    chosenPair: alreadyOptimizedLeg ? { shorter, longer: shorter } : { shorter, longer },
    alreadyOptimizedLeg,
  };
};

// ---------------------------------------------------------
// Helper: Append GeoJSON geometry into a MultiLineString
// ---------------------------------------------------------
const appendGeometrySegment = (geometry: any, target: number[][][]): void => {
  if (!geometry) return;

  if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
    target.push(geometry.coordinates as number[][]);
    return;
  }

  if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
    const merged: number[][] = [];
    geometry.coordinates.forEach((segment: number[][]) => {
      if (!Array.isArray(segment)) return;
      segment.forEach((point: number[]) => {
        if (!Array.isArray(point) || point.length < 2) return;
        const last = merged[merged.length - 1];
        if (!last || last[0] !== point[0] || last[1] !== point[1]) {
          merged.push([point[0], point[1]]);
        }
      });
    });
    if (merged.length > 0) {
      target.push(merged);
    }
  }
};

// ---------------------------------------------------------
// Helper: Aggregate per-leg routes into original vs optimized
// ---------------------------------------------------------
const buildRoutesByLegs = async (
  activities: any[],
  mode: string
): Promise<{
  original: RouteResult;
  optimized: RouteResult;
  alreadyOptimized: boolean;
  legsAlreadyOptimizedCount: number;
}> => {
  const originalSegments: number[][][] = [];
  const optimizedSegments: number[][][] = [];
  let originalDistance = 0;
  let optimizedDistance = 0;
  let originalTime = 0;
  let optimizedTime = 0;
  let legsAlreadyOptimizedCount = 0;

  for (let i = 0; i < activities.length - 1; i += 1) {
    const from = { lat: activities[i].lat, lng: activities[i].lng };
    const to = { lat: activities[i + 1].lat, lng: activities[i + 1].lng };

    const { chosenPair, alreadyOptimizedLeg } = await getLegCandidatesDistinct(from, to, mode);

    if (alreadyOptimizedLeg) {
      legsAlreadyOptimizedCount += 1;
    }

    const longer = chosenPair.longer;
    const shorter = chosenPair.shorter;

    originalDistance += longer.distance;
    originalTime += longer.time;
    optimizedDistance += shorter.distance;
    optimizedTime += shorter.time;

    appendGeometrySegment(longer.geometry, originalSegments);
    appendGeometrySegment(shorter.geometry, optimizedSegments);
  }

  const original: RouteResult = {
    activities,
    geometry: {
      type: "MultiLineString",
      coordinates: originalSegments,
    },
    distance: originalDistance,
    time: originalTime,
  };

  const optimized: RouteResult = {
    activities,
    geometry: {
      type: "MultiLineString",
      coordinates: optimizedSegments,
    },
    distance: optimizedDistance,
    time: optimizedTime,
  };

  const legCount = Math.max(activities.length - 1, 0);
  const alreadyOptimized =
    legCount > 0
      ? legsAlreadyOptimizedCount === legCount || originalDistance === optimizedDistance
      : true;

  return { original, optimized, alreadyOptimized, legsAlreadyOptimizedCount };
};

// ---------------------------------------------------------
// Error Handler
// ---------------------------------------------------------
const handleRouteError = (error: unknown) => {
  if (error instanceof ZodError) {
    throwError(HTTP_STATUS.BAD_REQUEST, "Validation failed", error.errors);
  }
  if (error instanceof AppError) {
    throw error;
  }
  throwError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "Route processing failed", error);
};

// ---------------------------------------------------------
// CONTROLLER
// ---------------------------------------------------------
export const RouteController = {
  // ---------------------------------------------------------
  // 1. CALCULATE (Lightweight, single route for given order)
  // ---------------------------------------------------------
  calculate: async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = optimizeRouteDto.parse(req.body);
      const rawActivities = payload.activities;
      const mode = payload.mode ?? "drive";

      const activities = await resolveActivityCoordinates(rawActivities);
      const { original, alreadyOptimized, legsAlreadyOptimizedCount } =
        await buildRoutesByLegs(activities, mode);
      const meta: RouteMeta = {
        alreadyOptimized,
        legsAlreadyOptimizedCount,
      };

      createResponse(res, HTTP_STATUS.OK, "Route calculated", {
        optimizedActivities: original.activities,
        routeGeometry: original.geometry,
        totalDistance: original.distance,
        totalTime: original.time,
      }, meta);
    } catch (error) {
      handleRouteError(error);
    }
  },

  // ---------------------------------------------------------
  // 2. OPTIMIZE (Full Comparison: Original vs Optimized)
  // ---------------------------------------------------------
  optimize: async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = optimizeRouteDto.parse(req.body);
      const rawActivities = payload.activities;
      const mode = payload.mode ?? "drive";

      // 1. Resolve coordinates for all activities
      const activities = await resolveActivityCoordinates(rawActivities);
      // 2. Build per-leg routes (longer vs shorter)
      const { original, optimized, alreadyOptimized, legsAlreadyOptimizedCount } =
        await buildRoutesByLegs(activities, mode);

      // 3. Ensure optimized is never longer than calculated (distance-based)
      let finalOptimized = optimized;
      let optimizationFallbackUsed = false;
      if (optimized.distance > original.distance) {
        finalOptimized = original;
        optimizationFallbackUsed = true;
      }

      const finalAlreadyOptimized =
        alreadyOptimized || finalOptimized.distance === original.distance;

      const distanceSaved = Math.max(0, original.distance - finalOptimized.distance);
      const distancePercent =
        original.distance > 0
          ? Math.round((distanceSaved / original.distance) * 100)
          : 0;

      const meta: RouteMeta = {
        alreadyOptimized: finalAlreadyOptimized,
        legsAlreadyOptimizedCount,
        ...(optimizationFallbackUsed ? { optimizationFallbackUsed: true } : {}),
      };

      // 4. Build response with BOTH routes
      createResponse(res, HTTP_STATUS.OK, "Route optimized", {
        // === PRIMARY FIELDS (backward compatible) ===
        optimizedActivities: finalOptimized.activities,
        routeGeometry: finalOptimized.geometry,
        totalDistance: finalOptimized.distance,
        totalTime: finalOptimized.time,

        // === COMPARISON DATA ===
        comparison: {
          original: {
            activities: original.activities,
            geometry: original.geometry,
            distance: original.distance,
            time: original.time,
          },
          optimized: {
            activities: finalOptimized.activities,
            geometry: finalOptimized.geometry,
            distance: finalOptimized.distance,
            time: finalOptimized.time,
          },
          savings: {
            distance: distanceSaved,
            time: 0,
            distancePercent,
            timePercent: 0,
          },
        },
      }, meta);
    } catch (error) {
      handleRouteError(error);
    }
  },
};
