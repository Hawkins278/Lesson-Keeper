/**
 * server/index.ts — Application entry point
 * 
 * Initializes the Express server with:
 *   1. JSON body parsing (with raw body preservation for webhook compatibility)
 *   2. URL-encoded form parsing
 *   3. API request logging (method, path, status, duration)
 *   4. Route registration (API endpoints + auth + object storage)
 *   5. Database seeding (reference values, impact levels, demo data on first run)
 *   6. Error handling middleware
 *   7. Static file serving (production) or Vite dev server (development)
 * 
 * Binds to port 5000 (or PORT env var) on 0.0.0.0 for external access.
 */

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// Extend IncomingMessage to store raw body buffer (needed for webhook signature verification)
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Parse JSON request bodies, preserving the raw buffer on the request object
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Parse URL-encoded form data (non-extended mode uses querystring library)
app.use(express.urlencoded({ extended: false }));

// Timestamped logging utility for server-side diagnostic messages
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// API request logger — captures response body and logs method, path, status, and duration
// Only logs requests to /api/* paths to avoid noise from static file serving
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Intercept res.json() to capture response body for logging
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Log after response is sent to client
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Main startup sequence (async IIFE)
(async () => {
  // Register all API routes, authentication, and object storage endpoints
  await registerRoutes(httpServer, app);

  // Seed database with default reference values, impact levels, and demo data (if empty)
  const { seedDatabase } = await import("./seed");
  await seedDatabase().catch((err) => console.error("Seed error:", err));

  // Global error handler — catches unhandled errors from route handlers
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // Setup frontend serving — Vite dev server in development, static files in production
  // Must be registered after API routes to prevent the catch-all from intercepting API requests
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Start HTTP server — port 5000 is the only non-firewalled port on Replit
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
