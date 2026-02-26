/**
 * shared/schema.ts — Central data model definitions
 * 
 * Defines all database tables, insert schemas, and TypeScript types shared
 * between the frontend and backend. Uses Drizzle ORM for PostgreSQL schema
 * definition and drizzle-zod for runtime validation schemas.
 * 
 * Tables:
 *   - projects: Stores project metadata (name, type, close date, PM, description)
 *   - lessonCategories: Top-level groupings for lessons (e.g. Governance, Planning)
 *   - lessonSubcategories: Second-level groupings under categories, with risk scoring fields
 *   - lessons: Individual lesson records linked to projects and subcategories
 *   - referenceValues: Configurable dropdown values for ProjectType and ProjectPhase
 *   - impactLevels: Impact severity levels with weighting multipliers (100-175%)
 *   - scoringConfig: Singleton table for risk scoring algorithm parameters
 * 
 * Also re-exports auth models (users, sessions) from shared/models/auth.ts
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export authentication models (users table, sessions table, UserRole type)
export * from "./models/auth";

// Enum for lesson classification: positive outcome or area for improvement
export const lessonTypeEnum = pgEnum("lesson_type", ["WentWell", "CouldHaveGoneBetter"]);

// Project status values
export const PROJECT_STATUSES = [
  "Project to apply learning to",
  "Live project with learning captured and learning still to be applied",
  "Closed project with learning captured",
] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

// Projects table — each uploaded Excel file creates or links to a project
export const projects = pgTable("projects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectCode: text("project_code").unique(),             // human-readable unique ID e.g. "PRJ-001"
  projectType: text("project_type").notNull(),            // e.g. "IT Change", "Construction"
  name: text("name").notNull(),                           // project display name
  closeDate: text("close_date"),                          // stored as DD-Mon-YYYY text string
  projectManager: text("project_manager"),                // PM name from Excel upload
  description: text("description"),                       // free-text project description
  status: text("status").notNull().default("Project to apply learning to"),
  createdAt: timestamp("created_at").defaultNow(),        // record creation timestamp
});

// Lesson categories — top-level groupings (e.g. Governance, Planning, Execution)
export const lessonCategories = pgTable("lesson_categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),                 // unique category name
  description: text("description"),                      // optional description
});

// Lesson subcategories — second-level groupings with risk scoring
// Each subcategory accumulates a score based on how many lessons reference it
export const lessonSubcategories = pgTable("lesson_subcategories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  categoryId: integer("category_id").notNull().references(() => lessonCategories.id),
  name: text("name").notNull(),                          // subcategory display name
  description: text("description"),                      // optional description
  firstRecordedDate: timestamp("first_recorded_date"),   // when first lesson was recorded against this
  currentScore: integer("current_score").default(0),     // current risk score (decays daily)
  lastScoreUpdatedAt: timestamp("last_score_updated_at"),// timestamp of last score update for decay calc
});

// Lessons table — individual lesson records from Excel uploads
export const lessons = pgTable("lessons", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  subcategoryId: integer("subcategory_id").notNull().references(() => lessonSubcategories.id),
  phase: text("phase").notNull(),                        // project phase (e.g. Planning, Delivery)
  type: lessonTypeEnum("type").notNull(),                 // WentWell or CouldHaveGoneBetter
  name: text("name").notNull(),                          // lesson title/summary
  eventDescription: text("event_description"),           // what happened
  keyLearningOrAction: text("key_learning_or_action"),   // what should be done differently
  impactId: integer("impact_id"),                        // FK to impactLevels (nullable)
  createdAt: timestamp("created_at").defaultNow(),       // record creation timestamp
  createdByUserId: varchar("created_by_user_id"),        // user who uploaded this lesson
});

// Learning applications — tracks which lesson subcategories are associated with projects for learning
export const learningApplications = pgTable("learning_applications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  subcategoryId: integer("subcategory_id").notNull().references(() => lessonSubcategories.id),
  appliedAt: timestamp("applied_at").defaultNow(),
  appliedByUserId: varchar("applied_by_user_id"),
});

// Insert schemas — Zod schemas for validating new records, omitting auto-generated fields
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, projectCode: true });
export const insertLessonCategorySchema = createInsertSchema(lessonCategories).omit({ id: true });
export const insertLessonSubcategorySchema = createInsertSchema(lessonSubcategories).omit({ id: true, firstRecordedDate: true, currentScore: true, lastScoreUpdatedAt: true });
export const insertLessonSchema = createInsertSchema(lessons).omit({ id: true, createdAt: true });

// TypeScript types inferred from schemas for use across frontend and backend
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertLessonCategory = z.infer<typeof insertLessonCategorySchema>;
export type LessonCategory = typeof lessonCategories.$inferSelect;
export type InsertLessonSubcategory = z.infer<typeof insertLessonSubcategorySchema>;
export type LessonSubcategory = typeof lessonSubcategories.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessons.$inferSelect;

// Default dropdown values — used as fallbacks when reference data table is empty
export const PHASES = ["Initiation", "Planning", "Delivery", "Close-out"] as const;
export const PROJECT_TYPES = ["IT Change", "Construction", "Business Change", "Infrastructure", "Software Development", "Organizational"] as const;

// Enum for reference value types — only ProjectType and ProjectPhase are stored here
// (Categories and Subcategories are stored in their own dedicated tables)
export const refValueTypeEnum = pgEnum("ref_value_type", ["ProjectType", "ProjectPhase"]);

// Reference values — admin-configurable dropdown options for ProjectType and ProjectPhase
export const referenceValues = pgTable("reference_values", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  type: refValueTypeEnum("type").notNull(),              // ProjectType or ProjectPhase
  value: text("value").notNull(),                        // the dropdown option text
});

// Impact levels — severity classifications with score weighting multipliers
// Weighting percent ranges from 100 (baseline) to 175 (most severe)
// Used to multiply the scoring increment when a lesson is recorded
export const impactLevels = pgTable("impact_levels", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  description: text("description").notNull(),            // human-readable label
  weightingPercent: integer("weighting_percent").notNull().default(100), // multiplier as percentage
  sortOrder: integer("sort_order").notNull().default(0), // display ordering
});

// Scoring config — singleton table holding the three scoring algorithm parameters
// Only one row exists; the scoring algorithm uses these values:
//   - initialScore: points assigned when a subcategory first appears
//   - incrementScore: points added for each subsequent lesson in same subcategory
//   - dailyDecrement: points subtracted per day since last update (score decay)
export const scoringConfig = pgTable("scoring_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  initialScore: integer("initial_score").notNull().default(500),
  incrementScore: integer("increment_score").notNull().default(250),
  dailyDecrement: integer("daily_decrement").notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ScoringConfig = typeof scoringConfig.$inferSelect;

// Default scoring values — used for initial seed and reset-to-defaults functionality
export const SCORING_DEFAULTS = {
  initialScore: 500,
  incrementScore: 250,
  dailyDecrement: 1,
} as const;

// Insert schemas and types for reference values and impact levels
export const insertReferenceValueSchema = createInsertSchema(referenceValues).omit({ id: true });
export type InsertReferenceValue = z.infer<typeof insertReferenceValueSchema>;
export type ReferenceValue = typeof referenceValues.$inferSelect;

export const insertImpactLevelSchema = createInsertSchema(impactLevels).omit({ id: true });
export type InsertImpactLevel = z.infer<typeof insertImpactLevelSchema>;
export type ImpactLevel = typeof impactLevels.$inferSelect;

export const insertLearningApplicationSchema = createInsertSchema(learningApplications).omit({ id: true, appliedAt: true });
export type InsertLearningApplication = z.infer<typeof insertLearningApplicationSchema>;
export type LearningApplication = typeof learningApplications.$inferSelect;
