import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const lessonTypeEnum = pgEnum("lesson_type", ["WentWell", "CouldHaveGoneBetter"]);

export const projects = pgTable("projects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectType: text("project_type").notNull(),
  name: text("name").notNull(),
  closeDate: text("close_date"),
  projectManager: text("project_manager"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lessonCategories = pgTable("lesson_categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const lessonSubcategories = pgTable("lesson_subcategories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  categoryId: integer("category_id").notNull().references(() => lessonCategories.id),
  name: text("name").notNull(),
  description: text("description"),
  firstRecordedDate: timestamp("first_recorded_date"),
  currentScore: integer("current_score").default(0),
  lastScoreUpdatedAt: timestamp("last_score_updated_at"),
});

export const lessons = pgTable("lessons", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  subcategoryId: integer("subcategory_id").notNull().references(() => lessonSubcategories.id),
  phase: text("phase").notNull(),
  type: lessonTypeEnum("type").notNull(),
  name: text("name").notNull(),
  eventDescription: text("event_description"),
  keyLearningOrAction: text("key_learning_or_action"),
  createdAt: timestamp("created_at").defaultNow(),
  createdByUserId: varchar("created_by_user_id"),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertLessonCategorySchema = createInsertSchema(lessonCategories).omit({ id: true });
export const insertLessonSubcategorySchema = createInsertSchema(lessonSubcategories).omit({ id: true, firstRecordedDate: true, currentScore: true, lastScoreUpdatedAt: true });
export const insertLessonSchema = createInsertSchema(lessons).omit({ id: true, createdAt: true });

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertLessonCategory = z.infer<typeof insertLessonCategorySchema>;
export type LessonCategory = typeof lessonCategories.$inferSelect;
export type InsertLessonSubcategory = z.infer<typeof insertLessonSubcategorySchema>;
export type LessonSubcategory = typeof lessonSubcategories.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessons.$inferSelect;

export const PHASES = ["Initiation", "Planning", "Delivery", "Close-out"] as const;
export const PROJECT_TYPES = ["IT Change", "Construction", "Business Change", "Infrastructure", "Software Development", "Organizational"] as const;
