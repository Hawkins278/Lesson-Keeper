// server/replit_integrations/auth/index.ts — Auth module barrel export
// Re-exports all authentication components for clean imports from "server/replit_integrations/auth"
export { setupAuth, isAuthenticated, getSession } from "./replitAuth";
export { authStorage, type IAuthStorage } from "./storage";
export { registerAuthRoutes } from "./routes";
