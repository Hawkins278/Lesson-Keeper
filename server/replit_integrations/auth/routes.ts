/**
 * server/replit_integrations/auth/routes.ts — Auth-specific API routes
 * 
 * Registers the GET /api/auth/user endpoint which returns the currently
 * authenticated user's profile data. Used by the frontend to determine
 * the logged-in user's identity, role, and profile information.
 */

import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";

// Registers authentication-related API routes
export function registerAuthRoutes(app: Express): void {
  // GET /api/auth/user — Returns the current user's profile from the database
  // Requires: isAuthenticated (valid session with unexpired token)
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
