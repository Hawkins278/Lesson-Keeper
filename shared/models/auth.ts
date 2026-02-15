/**
 * shared/models/auth.ts — Authentication data model
 * 
 * Defines the users and sessions tables required by Replit Auth (OIDC).
 * Both tables are mandatory for the authentication system to function.
 * 
 * The users table supports two roles:
 *   - "user": Default role with read-only access (Dashboard + Projects)
 *   - "admin": Full access including uploads, reference data, user management
 * 
 * Pre-registration flow: Admins can create user records with just an email.
 * When that person logs in via Replit Auth, the pre-registered record is
 * linked to their actual account (see server/replit_integrations/auth/storage.ts).
 */

import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Role type constraint — only "user" or "admin" are valid
// Legacy values "superadmin"/"superadministrator" are normalized to "admin" on login
export type UserRole = "user" | "admin";

// Session storage table — stores server-side session data in PostgreSQL
// Used by connect-pg-simple to persist Express sessions
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),         // session ID (from cookie)
    sess: jsonb("sess").notNull(),           // serialized session data (user claims, tokens)
    expire: timestamp("expire").notNull(),   // session expiry timestamp
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table — stores user profiles and role assignments
// Populated automatically on first login via OIDC, or pre-registered by admins
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), // OIDC subject ID or auto-generated UUID for pre-registered users
  email: varchar("email").unique(),                               // user's email (used for pre-registration matching)
  firstName: varchar("first_name"),                               // from OIDC claims
  lastName: varchar("last_name"),                                 // from OIDC claims
  profileImageUrl: varchar("profile_image_url"),                  // avatar URL (OIDC or object storage upload)
  role: varchar("role", { length: 20 }).default("user").notNull(),// "user" or "admin"
  createdAt: timestamp("created_at").defaultNow(),                // record creation timestamp
  updatedAt: timestamp("updated_at").defaultNow(),                // last profile update timestamp
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
