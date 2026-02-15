/**
 * server/replit_integrations/auth/storage.ts — Authentication user storage
 * 
 * Manages user record creation and updates during the OIDC login flow.
 * The upsertUser() method handles three scenarios:
 *   1. Returning user: Updates profile data, normalizes legacy role names
 *   2. Pre-registered user: Links email-only record to OIDC account (replaces UUID with OIDC sub)
 *   3. New user: Creates record; first user gets "admin" role, subsequent users get "user"
 * 
 * Legacy role normalization: "superadmin" and "superadministrator" are converted to "admin"
 * on each login to support migration from the old role naming convention.
 */

import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  // Fetches a user by their OIDC subject ID
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  /**
   * Creates or updates a user record on login. Three paths:
   * 
   * Path 1 — Returning user (ID match):
   *   Updates profile fields from OIDC claims. Normalizes legacy roles to "admin".
   * 
   * Path 2 — Pre-registered user (email match, no ID match):
   *   Admin pre-created a record with email only (auto-generated UUID as ID).
   *   On first OIDC login, replaces the UUID with the real OIDC subject ID,
   *   preserving the existing role assignment. This links the pre-registration
   *   to the actual user account.
   * 
   * Path 3 — Brand new user (no ID or email match):
   *   Creates a new record. If no admins exist yet, assigns "admin" role
   *   (bootstraps the first admin). Otherwise assigns "user" role.
   */
  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = await this.getUser(userData.id!);

    // Path 1: Returning user — update profile, normalize legacy roles
    if (existingUser) {
      const existingRole = (existingUser.role || "").toLowerCase().trim();
      const normalizedRole = (existingRole === "superadmin" || existingRole === "superadministrator")
        ? "admin"
        : existingUser.role;

      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          role: normalizedRole,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id!))
        .returning();
      return user;
    }

    // Path 2: Pre-registered user — match by email (case-insensitive), link OIDC ID
    if (userData.email) {
      const [preRegistered] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = lower(${userData.email})`);

      if (preRegistered) {
        const existingRole = (preRegistered.role || "").toLowerCase().trim();
        const normalizedRole = (existingRole === "superadmin" || existingRole === "superadministrator")
          ? "admin"
          : preRegistered.role;

        // Raw SQL update needed to replace the primary key (ID) — Drizzle ORM
        // doesn't support updating primary keys via the .set() method
        const result = await db.execute(sql`
          UPDATE users SET
            id = ${userData.id!},
            email = ${userData.email},
            first_name = ${userData.firstName || null},
            last_name = ${userData.lastName || null},
            profile_image_url = ${userData.profileImageUrl || null},
            role = ${normalizedRole},
            updated_at = NOW()
          WHERE id = ${preRegistered.id}
          RETURNING *
        `);
        return result.rows[0] as unknown as User;
      }
    }

    // Path 3: Brand new user — auto-assign admin if no admins exist yet
    const [adminCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`lower(${users.role}) in ('admin', 'superadmin', 'superadministrator')`);
    const hasAdmins = Number(adminCount.count) > 0;

    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        role: hasAdmins ? "user" : "admin",
      })
      .returning();
    return user;
  }
}

// Singleton auth storage instance
export const authStorage = new AuthStorage();
