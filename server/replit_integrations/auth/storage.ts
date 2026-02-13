import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = await this.getUser(userData.id!);

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

export const authStorage = new AuthStorage();
