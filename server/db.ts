/**
 * server/db.ts — Database connection setup
 * 
 * Creates a PostgreSQL connection pool and initializes the Drizzle ORM instance.
 * The DATABASE_URL environment variable is provided by Replit's built-in PostgreSQL.
 * The pool is shared across all server modules for connection reuse.
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

// Fail fast if database is not provisioned
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Connection pool — manages multiple concurrent database connections
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Drizzle ORM instance — provides type-safe query building with schema awareness
export const db = drizzle(pool, { schema });
