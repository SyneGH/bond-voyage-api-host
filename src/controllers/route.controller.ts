import { Request, Response } from "express";
import axios from "axios";
import { ZodError } from "zod";
import { optimizeRouteDto } from "@/validators/route.dto";
import { AppError, createResponse, throwError } from "@/utils/responseHandler";
import { HTTP_STATUS } from "@/constants/constants";

export const RouteController = {
  optimize: async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = optimizeRouteDto.parse(req.body);
      const apiKey = process.env.GEOAPIFY_API_KEY;

      const points = [
        payload.origin,
        ...(payload.waypoints ?? []),
        payload.destination,
      ];
      const waypoints = points.map((point) => `${point.lat},${point.lng}`).join("|");

      if (!apiKey) {
        const fallback = buildFallbackRoute(points);
        createResponse(res, HTTP_STATUS.OK, "Route optimized", fallback);
        return;
      }

      const response = await axios.get(
        "https://api.geoapify.com/v1/routing",
        {
          params: {
            waypoints,
            mode: "drive",
            apiKey,
          },
        }
      );

      createResponse(res, HTTP_STATUS.OK, "Route optimized", response.data);
    } catch (error) {
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

const buildFallbackRoute = (points: { lat: number; lng: number }[]) => {
  const distanceMeters = points.reduce((total, point, index) => {
    if (index === 0) return total;
    return total + haversineDistance(points[index - 1], point);
  }, 0);

  const averageSpeedMetersPerSecond = 16.67; // ~60 km/h
  const durationSeconds = Math.round(distanceMeters / averageSpeedMetersPerSecond);

  return {
    mode: "drive",
    distanceMeters,
    durationSeconds,
    points,
  };
};

const haversineDistance = (
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(end.lat - start.lat);
  const dLng = toRadians(end.lng - start.lng);
  const lat1 = toRadians(start.lat);
  const lat2 = toRadians(end.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};
