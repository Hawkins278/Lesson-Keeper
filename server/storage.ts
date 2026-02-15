/**
 * server/storage.ts — Data access layer
 * 
 * Implements the IStorage interface which defines all CRUD operations used
 * by the API routes. All database interactions go through this layer,
 * keeping the route handlers thin and testable.
 * 
 * Key design decisions:
 *   - getLessons() and getLessonsByProject() perform in-memory joins to
 *     attach related project, category, subcategory, and impact data
 *   - getUserByEmail() uses case-insensitive matching via SQL lower()
 *   - getUsersByRole("admin") also matches legacy "superadmin"/"superadministrator" values
 *   - renameReferenceValue() cascades renames to all associated records
 *   - recalculateAllScores() replays the entire scoring history for retroactive config changes
 *   - getScoringConfig() auto-creates default config row if none exists (singleton pattern)
 */

import {
  type Project, type InsertProject,
  type LessonCategory, type InsertLessonCategory,
  type LessonSubcategory, type InsertLessonSubcategory,
  type Lesson, type InsertLesson,
  type ReferenceValue, type InsertReferenceValue,
  type ImpactLevel, type InsertImpactLevel,
  type User, type UserRole,
  type ScoringConfig,
  projects, lessonCategories, lessonSubcategories, lessons, referenceValues, impactLevels, users,
  scoringConfig, SCORING_DEFAULTS,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, ne, or, inArray } from "drizzle-orm";

/**
 * IStorage interface — contract for all data access operations.
 * Separated from implementation to allow future storage backend swaps.
 */
export interface IStorage {
  // --- Project operations ---
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  findProjectByNameAndType(name: string, projectType: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined>;

  // --- Category operations ---
  getCategories(): Promise<LessonCategory[]>;
  findCategoryByName(name: string): Promise<LessonCategory | undefined>;
  createCategory(category: InsertLessonCategory): Promise<LessonCategory>;

  // --- Subcategory operations (includes scoring fields) ---
  getSubcategories(): Promise<LessonSubcategory[]>;
  findSubcategoryByNameAndCategory(name: string, categoryId: number): Promise<LessonSubcategory | undefined>;
  createSubcategory(subcategory: InsertLessonSubcategory): Promise<LessonSubcategory>;
  updateSubcategoryScore(id: number, score: number, lastUpdated: Date): Promise<void>;
  createSubcategoryFirstRecorded(id: number, date: Date): Promise<void>;

  // --- Lesson operations (with joined relations) ---
  getLessons(): Promise<(Lesson & { project?: Project; category?: LessonCategory; subcategory?: LessonSubcategory; impact?: ImpactLevel })[]>;
  getLessonsByProject(projectId: number): Promise<(Lesson & { category?: LessonCategory; subcategory?: LessonSubcategory; impact?: ImpactLevel })[]>;
  getLesson(id: number): Promise<Lesson | undefined>;
  createLesson(lesson: InsertLesson): Promise<Lesson>;
  updateLesson(id: number, data: Partial<InsertLesson>): Promise<Lesson | undefined>;

  // --- Reference data operations (ProjectType, ProjectPhase dropdowns) ---
  getReferenceValues(type: string): Promise<ReferenceValue[]>;
  createReferenceValue(value: InsertReferenceValue): Promise<ReferenceValue>;
  deleteReferenceValue(id: number): Promise<void>;
  renameReferenceValue(id: number, newValue: string): Promise<ReferenceValue | undefined>;
  getReferenceValueUsageCount(id: number): Promise<number>;
  hasDependentLessonsForCategory(categoryId: number): Promise<boolean>;
  hasDependentLessonsForSubcategory(subcategoryId: number): Promise<boolean>;
  deleteCategory(id: number): Promise<void>;
  deleteSubcategory(id: number): Promise<void>;
  renameCategory(id: number, newName: string): Promise<LessonCategory | undefined>;
  renameSubcategory(id: number, newName: string): Promise<LessonSubcategory | undefined>;
  getCategoryUsageCount(categoryId: number): Promise<number>;
  getSubcategoryUsageCount(subcategoryId: number): Promise<number>;

  // --- Impact level operations ---
  getImpactLevels(): Promise<ImpactLevel[]>;
  getImpactLevel(id: number): Promise<ImpactLevel | undefined>;
  createImpactLevel(level: InsertImpactLevel): Promise<ImpactLevel>;
  updateImpactLevel(id: number, data: Partial<InsertImpactLevel>): Promise<ImpactLevel | undefined>;
  deleteImpactLevel(id: number): Promise<void>;
  updateLessonImpact(lessonId: number, impactId: number | null): Promise<void>;
  getImpactLevelUsageCount(impactId: number): Promise<number>;

  // --- User management operations ---
  getUsersByRole(role: UserRole): Promise<User[]>;
  getUsersByRoles(roles: UserRole[]): Promise<User[]>;
  setUserRole(userId: string, role: UserRole): Promise<User | undefined>;
  getUserById(userId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  countUsersByRole(role: UserRole): Promise<number>;
  getAllUsers(): Promise<User[]>;
  createUserByEmail(email: string): Promise<User>;
  deleteUserByEmail(email: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; profileImageUrl?: string }): Promise<User | undefined>;

  // --- Scoring configuration operations ---
  getScoringConfig(): Promise<ScoringConfig>;
  updateScoringConfig(data: { initialScore: number; incrementScore: number; dailyDecrement: number }): Promise<ScoringConfig>;
  recalculateAllScores(config: { initialScore: number; incrementScore: number; dailyDecrement: number }): Promise<void>;
}

/**
 * DatabaseStorage — PostgreSQL implementation of IStorage using Drizzle ORM.
 */
export class DatabaseStorage implements IStorage {

  // ==================== PROJECT OPERATIONS ====================

  // Returns all projects ordered by creation date (newest first)
  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  // Finds a single project by its numeric ID
  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  // Finds a project by exact name + type match — used during upload to avoid duplicates
  async findProjectByNameAndType(name: string, projectType: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.name, name), eq(projects.projectType, projectType)));
    return project;
  }

  // Creates a new project record from Excel upload data
  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  // Partially updates a project's fields (admin only)
  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return updated;
  }

  // ==================== CATEGORY OPERATIONS ====================

  // Returns all lesson categories sorted alphabetically
  async getCategories(): Promise<LessonCategory[]> {
    return db.select().from(lessonCategories).orderBy(lessonCategories.name);
  }

  // Finds a category by exact name — used during upload to link or create categories
  async findCategoryByName(name: string): Promise<LessonCategory | undefined> {
    const [cat] = await db.select().from(lessonCategories).where(eq(lessonCategories.name, name));
    return cat;
  }

  // Creates a new lesson category
  async createCategory(category: InsertLessonCategory): Promise<LessonCategory> {
    const [created] = await db.insert(lessonCategories).values(category).returning();
    return created;
  }

  // ==================== SUBCATEGORY OPERATIONS ====================

  // Returns all subcategories sorted alphabetically
  async getSubcategories(): Promise<LessonSubcategory[]> {
    return db.select().from(lessonSubcategories).orderBy(lessonSubcategories.name);
  }

  // Finds a subcategory by name within a specific category — prevents duplicates per category
  async findSubcategoryByNameAndCategory(name: string, categoryId: number): Promise<LessonSubcategory | undefined> {
    const [sub] = await db.select().from(lessonSubcategories)
      .where(and(eq(lessonSubcategories.name, name), eq(lessonSubcategories.categoryId, categoryId)));
    return sub;
  }

  // Creates a new subcategory (score fields default to 0/null)
  async createSubcategory(subcategory: InsertLessonSubcategory): Promise<LessonSubcategory> {
    const [created] = await db.insert(lessonSubcategories).values(subcategory).returning();
    return created;
  }

  // Updates a subcategory's risk score and records the update timestamp
  // Called during lesson upload to increment scores
  async updateSubcategoryScore(id: number, score: number, lastUpdated: Date): Promise<void> {
    await db.update(lessonSubcategories)
      .set({ currentScore: score, lastScoreUpdatedAt: lastUpdated })
      .where(eq(lessonSubcategories.id, id));
  }

  // Sets the first-recorded date for a subcategory (only called once per subcategory)
  async createSubcategoryFirstRecorded(id: number, date: Date): Promise<void> {
    await db.update(lessonSubcategories)
      .set({ firstRecordedDate: date })
      .where(eq(lessonSubcategories.id, id));
  }

  // ==================== LESSON OPERATIONS ====================

  // Returns all lessons with joined project, category, subcategory, and impact data
  // Performs in-memory joins using lookup maps for efficiency
  async getLessons(): Promise<(Lesson & { project?: Project; category?: LessonCategory; subcategory?: LessonSubcategory; impact?: ImpactLevel })[]> {
    const allLessons = await db.select().from(lessons).orderBy(desc(lessons.createdAt));
    const allProjects = await this.getProjects();
    const allCategories = await this.getCategories();
    const allSubcategories = await this.getSubcategories();
    const allImpacts = await this.getImpactLevels();

    // Build lookup maps for O(1) access during join
    const projectMap = new Map(allProjects.map((p) => [p.id, p]));
    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
    const subcategoryMap = new Map(allSubcategories.map((s) => [s.id, s]));
    const impactMap = new Map(allImpacts.map((il) => [il.id, il]));

    return allLessons.map((lesson) => {
      const subcategory = subcategoryMap.get(lesson.subcategoryId);
      const category = subcategory ? categoryMap.get(subcategory.categoryId) : undefined;
      const impact = lesson.impactId ? impactMap.get(lesson.impactId) : undefined;
      return {
        ...lesson,
        project: projectMap.get(lesson.projectId),
        category,
        subcategory,
        impact,
      };
    });
  }

  // Returns lessons for a specific project with joined category, subcategory, and impact data
  async getLessonsByProject(projectId: number): Promise<(Lesson & { category?: LessonCategory; subcategory?: LessonSubcategory; impact?: ImpactLevel })[]> {
    const projectLessons = await db.select().from(lessons).where(eq(lessons.projectId, projectId)).orderBy(desc(lessons.createdAt));
    const allCategories = await this.getCategories();
    const allSubcategories = await this.getSubcategories();
    const allImpacts = await this.getImpactLevels();

    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
    const subcategoryMap = new Map(allSubcategories.map((s) => [s.id, s]));
    const impactMap = new Map(allImpacts.map((il) => [il.id, il]));

    return projectLessons.map((lesson) => {
      const subcategory = subcategoryMap.get(lesson.subcategoryId);
      const category = subcategory ? categoryMap.get(subcategory.categoryId) : undefined;
      const impact = lesson.impactId ? impactMap.get(lesson.impactId) : undefined;
      return { ...lesson, category, subcategory, impact };
    });
  }

  // Finds a single lesson by ID (without joins)
  async getLesson(id: number): Promise<Lesson | undefined> {
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id));
    return lesson;
  }

  // Creates a new lesson record from Excel upload or manual entry
  async createLesson(lesson: InsertLesson): Promise<Lesson> {
    const [created] = await db.insert(lessons).values(lesson).returning();
    return created;
  }

  // Partially updates a lesson's fields (admin only)
  async updateLesson(id: number, data: Partial<InsertLesson>): Promise<Lesson | undefined> {
    const [updated] = await db.update(lessons).set(data).where(eq(lessons.id, id)).returning();
    return updated;
  }

  // ==================== REFERENCE DATA OPERATIONS ====================

  // Returns reference values filtered by type (ProjectType or ProjectPhase)
  async getReferenceValues(type: string): Promise<ReferenceValue[]> {
    return db.select().from(referenceValues).where(eq(referenceValues.type, type as any));
  }

  // Creates a new reference value (admin only)
  async createReferenceValue(value: InsertReferenceValue): Promise<ReferenceValue> {
    const [created] = await db.insert(referenceValues).values(value).returning();
    return created;
  }

  // Deletes a reference value by ID (only if not in use)
  async deleteReferenceValue(id: number): Promise<void> {
    await db.delete(referenceValues).where(eq(referenceValues.id, id));
  }

  // Checks if any lessons exist under any subcategory of the given category
  // Used to prevent deletion of categories that have associated lesson data
  async hasDependentLessonsForCategory(categoryId: number): Promise<boolean> {
    const subs = await db.select().from(lessonSubcategories).where(eq(lessonSubcategories.categoryId, categoryId));
    if (subs.length === 0) return false;
    for (const sub of subs) {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(lessons).where(eq(lessons.subcategoryId, sub.id));
      if (Number(result.count) > 0) return true;
    }
    return false;
  }

  // Checks if any lessons reference the given subcategory
  // Used to prevent deletion of subcategories with associated lesson data
  async hasDependentLessonsForSubcategory(subcategoryId: number): Promise<boolean> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(lessons).where(eq(lessons.subcategoryId, subcategoryId));
    return Number(result.count) > 0;
  }

  // Deletes a category and all its subcategories (only if no dependent lessons exist)
  async deleteCategory(id: number): Promise<void> {
    await db.delete(lessonSubcategories).where(eq(lessonSubcategories.categoryId, id));
    await db.delete(lessonCategories).where(eq(lessonCategories.id, id));
  }

  // Deletes a subcategory (only if no dependent lessons exist)
  async deleteSubcategory(id: number): Promise<void> {
    await db.delete(lessonSubcategories).where(eq(lessonSubcategories.id, id));
  }

  // Renames a reference value and cascades the change to all associated records
  // For ProjectType: updates all projects using the old value
  // For ProjectPhase: updates all lessons using the old phase name
  async renameReferenceValue(id: number, newValue: string): Promise<ReferenceValue | undefined> {
    const [existing] = await db.select().from(referenceValues).where(eq(referenceValues.id, id));
    if (!existing) return undefined;
    const oldValue = existing.value;
    const [updated] = await db.update(referenceValues).set({ value: newValue }).where(eq(referenceValues.id, id)).returning();
    if (existing.type === "ProjectType") {
      await db.update(projects).set({ projectType: newValue }).where(eq(projects.projectType, oldValue));
    } else if (existing.type === "ProjectPhase") {
      await db.update(lessons).set({ phase: newValue }).where(eq(lessons.phase, oldValue));
    }
    return updated;
  }

  // Counts how many records use a specific reference value
  // For ProjectType: counts projects with that type
  // For ProjectPhase: counts lessons with that phase
  async getReferenceValueUsageCount(id: number): Promise<number> {
    const [ref] = await db.select().from(referenceValues).where(eq(referenceValues.id, id));
    if (!ref) return 0;
    if (ref.type === "ProjectType") {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.projectType, ref.value));
      return Number(result.count);
    } else if (ref.type === "ProjectPhase") {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(lessons).where(eq(lessons.phase, ref.value));
      return Number(result.count);
    }
    return 0;
  }

  // Renames a lesson category
  async renameCategory(id: number, newName: string): Promise<LessonCategory | undefined> {
    const [updated] = await db.update(lessonCategories).set({ name: newName }).where(eq(lessonCategories.id, id)).returning();
    return updated;
  }

  // Renames a lesson subcategory
  async renameSubcategory(id: number, newName: string): Promise<LessonSubcategory | undefined> {
    const [updated] = await db.update(lessonSubcategories).set({ name: newName }).where(eq(lessonSubcategories.id, id)).returning();
    return updated;
  }

  // Counts total lessons across all subcategories of the given category
  async getCategoryUsageCount(categoryId: number): Promise<number> {
    const subs = await db.select({ id: lessonSubcategories.id }).from(lessonSubcategories).where(eq(lessonSubcategories.categoryId, categoryId));
    if (subs.length === 0) return 0;
    let total = 0;
    for (const sub of subs) {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(lessons).where(eq(lessons.subcategoryId, sub.id));
      total += Number(result.count);
    }
    return total;
  }

  // Counts lessons that reference a specific subcategory
  async getSubcategoryUsageCount(subcategoryId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(lessons).where(eq(lessons.subcategoryId, subcategoryId));
    return Number(result.count);
  }

  // ==================== IMPACT LEVEL OPERATIONS ====================

  // Counts lessons that have a specific impact level assigned
  async getImpactLevelUsageCount(impactId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(lessons).where(eq(lessons.impactId, impactId));
    return Number(result.count);
  }

  // Returns all impact levels ordered by sortOrder (most severe first)
  async getImpactLevels(): Promise<ImpactLevel[]> {
    return db.select().from(impactLevels).orderBy(impactLevels.sortOrder);
  }

  // Finds a single impact level by ID
  async getImpactLevel(id: number): Promise<ImpactLevel | undefined> {
    const [level] = await db.select().from(impactLevels).where(eq(impactLevels.id, id));
    return level;
  }

  // Creates a new impact level with description, weighting, and sort order
  async createImpactLevel(level: InsertImpactLevel): Promise<ImpactLevel> {
    const [created] = await db.insert(impactLevels).values(level).returning();
    return created;
  }

  // Updates an impact level's fields (weighting changes blocked if level is in use)
  async updateImpactLevel(id: number, data: Partial<InsertImpactLevel>): Promise<ImpactLevel | undefined> {
    const [updated] = await db.update(impactLevels).set(data).where(eq(impactLevels.id, id)).returning();
    return updated;
  }

  // Deletes an impact level — first nullifies all lesson references to it
  async deleteImpactLevel(id: number): Promise<void> {
    await db.update(lessons).set({ impactId: null }).where(eq(lessons.impactId, id));
    await db.delete(impactLevels).where(eq(impactLevels.id, id));
  }

  // Updates a specific lesson's impact level assignment
  async updateLessonImpact(lessonId: number, impactId: number | null): Promise<void> {
    await db.update(lessons).set({ impactId }).where(eq(lessons.id, lessonId));
  }

  // ==================== USER MANAGEMENT OPERATIONS ====================

  // Returns users filtered by role — for "admin" also matches legacy role names
  async getUsersByRole(role: UserRole): Promise<User[]> {
    if (role === "admin") {
      return db.select().from(users)
        .where(sql`lower(${users.role}) in ('admin', 'superadmin', 'superadministrator')`)
        .orderBy(users.email);
    }
    return db.select().from(users).where(eq(users.role, role)).orderBy(users.email);
  }

  // Returns users matching any of the provided roles (with legacy role expansion)
  async getUsersByRoles(roles: UserRole[]): Promise<User[]> {
    const expandedRoles: string[] = [];
    for (const r of roles) {
      if (r === "admin") {
        expandedRoles.push("admin", "superadmin", "superadministrator");
      } else {
        expandedRoles.push(r);
      }
    }
    return db.select().from(users)
      .where(sql`lower(${users.role}) in (${sql.join(expandedRoles.map(r => sql`${r}`), sql`, `)})`)
      .orderBy(users.email);
  }

  // Updates a user's role (used for admin promotion/demotion)
  async setUserRole(userId: string, role: UserRole): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return updated;
  }

  // Finds a user by their OIDC subject ID
  async getUserById(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user;
  }

  // Finds a user by email (case-insensitive) — used for pre-registration matching
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`);
    return user;
  }

  // Counts admin users (includes legacy role names) — used to enforce minimum 2 admins
  async countUsersByRole(role: UserRole): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`lower(${users.role}) in ('admin', 'superadmin', 'superadministrator')`);
    return Number(result.count);
  }

  // Returns all users ordered by email — used for admin user list and CSV export
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.email);
  }

  // Pre-registers a user by email only (UUID auto-generated) — admin feature
  // The pre-registered record will be linked to the actual OIDC account on first login
  async createUserByEmail(email: string): Promise<User> {
    const [user] = await db.insert(users).values({
      email,
      role: "user",
    }).returning();
    return user;
  }

  // Deletes a user by email (case-insensitive match)
  async deleteUserByEmail(email: string): Promise<void> {
    await db.delete(users).where(sql`lower(${users.email}) = lower(${email})`);
  }

  // Deletes a user by their ID
  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  // Updates user profile fields (name, avatar URL) — available to all authenticated users
  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; profileImageUrl?: string }): Promise<User | undefined> {
    const updateData: any = { updatedAt: new Date() };
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;
    const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
    return updated;
  }

  // ==================== SCORING CONFIGURATION OPERATIONS ====================

  // Returns the scoring config (singleton) — auto-creates with defaults if no row exists
  async getScoringConfig(): Promise<ScoringConfig> {
    const rows = await db.select().from(scoringConfig);
    if (rows.length > 0) return rows[0];
    // Auto-create default config on first access
    const [created] = await db.insert(scoringConfig).values({
      initialScore: SCORING_DEFAULTS.initialScore,
      incrementScore: SCORING_DEFAULTS.incrementScore,
      dailyDecrement: SCORING_DEFAULTS.dailyDecrement,
    }).returning();
    return created;
  }

  // Updates all three scoring parameters — called alongside recalculateAllScores
  async updateScoringConfig(data: { initialScore: number; incrementScore: number; dailyDecrement: number }): Promise<ScoringConfig> {
    const existing = await this.getScoringConfig();
    const [updated] = await db.update(scoringConfig).set({
      initialScore: data.initialScore,
      incrementScore: data.incrementScore,
      dailyDecrement: data.dailyDecrement,
      updatedAt: new Date(),
    }).where(eq(scoringConfig.id, existing.id)).returning();
    return updated;
  }

  /**
   * Recalculates all subcategory scores from scratch using the provided config.
   * Called when scoring parameters change to retroactively apply new values.
   * 
   * Algorithm per subcategory:
   *   1. Sort all lessons by creation date (oldest first)
   *   2. First lesson: score = initialScore * impact weighting multiplier
   *   3. Subsequent lessons: apply daily decay since last lesson, then add increment * multiplier
   *   4. After all lessons: apply decay from last lesson to current date
   *   5. Zero-floor rule: score never goes below 0 (Math.max(0, ...))
   *   6. Subcategories with no lessons are reset to score 0
   */
  async recalculateAllScores(config: { initialScore: number; incrementScore: number; dailyDecrement: number }): Promise<void> {
    const allSubcategories = await db.select().from(lessonSubcategories);
    const allLessons = await db.select().from(lessons);
    const allImpacts = await db.select().from(impactLevels);
    const impactMap = new Map(allImpacts.map(i => [i.id, i.weightingPercent]));

    for (const sub of allSubcategories) {
      // Get lessons for this subcategory, sorted by creation date (oldest first)
      const subLessons = allLessons
        .filter(l => l.subcategoryId === sub.id)
        .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());

      // Reset subcategories with no lessons
      if (subLessons.length === 0) {
        await db.update(lessonSubcategories).set({
          currentScore: 0,
          lastScoreUpdatedAt: null,
          firstRecordedDate: null,
        }).where(eq(lessonSubcategories.id, sub.id));
        continue;
      }

      // Replay scoring history lesson by lesson
      const firstDate = new Date(subLessons[0].createdAt!);
      let score = 0;
      let lastUpdate = firstDate;

      for (let i = 0; i < subLessons.length; i++) {
        const lesson = subLessons[i];
        const lessonDate = new Date(lesson.createdAt!);
        const weightingPercent = lesson.impactId ? (impactMap.get(lesson.impactId) || 100) : 100;
        const weightingMultiplier = weightingPercent / 100;

        if (i === 0) {
          // First lesson: apply initial score with weighting
          score = Math.round(config.initialScore * weightingMultiplier);
        } else {
          // Subsequent lessons: decay from last update, then increment
          const daysSince = Math.max(0, Math.floor((lessonDate.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)));
          score = Math.max(0, score - daysSince * config.dailyDecrement);
          score += Math.round(config.incrementScore * weightingMultiplier);
        }
        lastUpdate = lessonDate;
      }

      // Apply final decay from last lesson to current time
      const now = new Date();
      const daysSinceLastLesson = Math.max(0, Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)));
      score = Math.max(0, score - daysSinceLastLesson * config.dailyDecrement);

      // Persist recalculated score
      await db.update(lessonSubcategories).set({
        currentScore: score,
        lastScoreUpdatedAt: now,
        firstRecordedDate: firstDate,
      }).where(eq(lessonSubcategories.id, sub.id));
    }
  }
}

// Singleton storage instance used across all route handlers
export const storage = new DatabaseStorage();
