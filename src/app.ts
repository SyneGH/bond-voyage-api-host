import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import routes from "@/routes";
import { HTTP_STATUS } from "@/constants/constants";
import { createResponse } from "@/utils/responseHandler";
import { errorMiddleware } from "@/middlewares/error.middleware";
import { env, resolveCorsOrigins } from "@/config/env";

const app = express();

// Security middleware
app.use(helmet());

const corsOrigins = resolveCorsOrigins();

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim()) 
  .filter((origin) => origin.length > 0);

// Log valid origins on startup so you can verify them immediately
console.log("✅ CORS Allowed Origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // 2. ALLOW SERVER-TO-SERVER: Allow requests with no origin 
      // (like Postman, mobile apps, or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      // 3. CHECK ORIGIN
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        // 4. LOUD FAILURE: Log exactly what was blocked to the server console
        console.error(`❌ CORS BLOCKED: Request from origin '${origin}' is not allowed.`);
        return callback(new Error(`CORS not allowed for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Logging middleware
// app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(morgan(':method :url :status :response-time ms - :res[content-length]'));

// Body parsing middleware
const bodyLimit = env.BODY_LIMIT || "8mb";
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// Cookie parsing middleware
app.use(cookieParser());

// API routes
app.use("/api/v1", routes);

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Node.js Prisma Auth API",
    version: "1.0.0",
    endpoints: {
      health: "/api/v1/health",
      auth: "/api/v1/auth",
      users: "/api/v1/users",
    },
  });
});

// 404 handler
app.use("*", (req, res) => {
  createResponse(res, HTTP_STATUS.NOT_FOUND, `Route ${req.originalUrl} not found`);
});

// Global error handler
app.use(errorMiddleware);

export default app;
