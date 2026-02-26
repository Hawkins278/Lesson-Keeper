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

export interface IStorage {
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  findProjectByNameAndType(name: string, projectType: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined>;

  getCategories(): Promise<LessonCategory[]>;
  findCategoryByName(name: string): Promise<LessonCategory | undefined>;
  createCategory(category: InsertLessonCategory): Promise<LessonCategory>;

  getSubcategories(): Promise<LessonSubcategory[]>;
  findSubcategoryByNameAndCategory(name: string, categoryId: number): Promise<LessonSubcategory | undefined>;
  createSubcategory(subcategory: InsertLessonSubcategory): Promise<LessonSubcategory>;
  updateSubcategoryScore(id: number, score: number, lastUpdated: Date): Promise<void>;
  createSubcategoryFirstRecorded(id: number, date: Date): Promise<void>;

  getLessons(): Promise<(Lesson & { project?: Project; category?: LessonCategory; subcategory?: LessonSubcategory; impact?: ImpactLevel })[]>;
  getLessonsByProject(projectId: number): Promise<(Lesson & { category?: LessonCategory; subcategory?: LessonSubcategory; impact?: ImpactLevel })[]>;
  getLesson(id: number): Promise<Lesson | undefined>;
  createLesson(lesson: InsertLesson): Promise<Lesson>;
  updateLesson(id: number, data: Partial<InsertLesson>): Promise<Lesson | undefined>;

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

  getImpactLevels(): Promise<ImpactLevel[]>;
  getImpactLevel(id: number): Promise<ImpactLevel | undefined>;
  createImpactLevel(level: InsertImpactLevel): Promise<ImpactLevel>;
  updateImpactLevel(id: number, data: Partial<InsertImpactLevel>): Promise<ImpactLevel | undefined>;
  deleteImpactLevel(id: number): Promise<void>;
  updateLessonImpact(lessonId: number, impactId: number | null): Promise<void>;
  getImpactLevelUsageCount(impactId: number): Promise<number>;

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

  getScoringConfig(): Promise<ScoringConfig>;
  updateScoringConfig(data: { initialScore: number; incrementScore: number; dailyDecrement: number }): Promise<ScoringConfig>;
  recalculateAllScores(config: { initialScore: number; incrementScore: number; dailyDecrement: number }): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async findProjectByNameAndType(name: string, projectType: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.name, name), eq(projects.projectType, projectType)));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return updated;
  }

  async getCategories(): Promise<LessonCategory[]> {
    return db.select().from(lessonCategories).orderBy(lessonCategories.name);
  }

  async findCategoryByName(name: string): Promise<LessonCategory | undefined> {
    const [cat] = await db.select().from(lessonCategories).where(eq(lessonCategories.name, name));
    return cat;
  }

  async createCategory(category: InsertLessonCategory): Promise<LessonCategory> {
    const [created] = await db.insert(lessonCategories).values(category).returning();
    return created;
  }

  async getSubcategories(): Promise<LessonSubcategory[]> {
    return db.select().from(lessonSubcategories).orderBy(lessonSubcategories.name);
  }

  async findSubcategoryByNameAndCategory(name: string, categoryId: number): Promise<LessonSubcategory | undefined> {
    const [sub] = await db.select().from(lessonSubcategories)
      .where(and(eq(lessonSubcategories.name, name), eq(lessonSubcategories.categoryId, categoryId)));
    return sub;
  }

  async createSubcategory(subcategory: InsertLessonSubcategory): Promise<LessonSubcategory> {
    const [created] = await db.insert(lessonSubcategories).values(subcategory).returning();
    return created;
  }

  async updateSubcategoryScore(id: number, score: number, lastUpdated: Date): Promise<void> {
    await db.update(lessonSubcategories)
      .set({ currentScore: score, lastScoreUpdatedAt: lastUpdated })
      .where(eq(lessonSubcategories.id, id));
  }

  async createSubcategoryFirstRecorded(id: number, date: Date): Promise<void> {
    await db.update(lessonSubcategories)
      .set({ firstRecordedDate: date })
      .where(eq(lessonSubcategories.id, id));
  }

  async getLessons(): Promise<(Lesson & { project?: Project; category?: LessonCategory; subcategory?: LessonSubcategory; impact?: ImpactLevel })[]> {
    const allLessons = await db.select().from(lessons).orderBy(desc(lessons.createdAt));
    const allProjects = await this.getProjects();
    const allCategories = await this.getCategories();
    const allSubcategories = await this.getSubcategories();
    const allImpacts = await this.getImpactLevels();

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

  async getLesson(id: number): Promise<Lesson | undefined> {
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id));
    return lesson;
  }

  async createLesson(lesson: InsertLesson): Promise<Lesson> {
    const [created] = await db.insert(lessons).values(lesson).returning();
    return created;
  }

  async updateLesson(id: number, data: Partial<InsertLesson>): Promise<Lesson | undefined> {
    const [updated] = await db.update(lessons).set(data).where(eq(lessons.id, id)).returning();
    return updated;
  }

  async getReferenceValues(type: string): Promise<ReferenceValue[]> {
    return db.select().from(referenceValues).where(eq(referenceValues.type, type as any));
  }

  async createReferenceValue(value: InsertReferenceValue): Promise<ReferenceValue> {
    const [created] = await db.insert(referenceValues).values(value).returning();
    return created;
  }

  async deleteReferenceValue(id: number): Promise<void> {
    await db.delete(referenceValues).where(eq(referenceValues.id, id));
  }

  async hasDependentLessonsForCategory(categoryId: number): Promise<boolean> {
    const subs = await db.select().from(lessonSubcategories).where(eq(lessonSubcategories.categoryId, categoryId));
    if (subs.length === 0) return false;
    for (const sub of subs) {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(lessons).where(eq(lessons.subcategoryId, sub.id));
      if (Number(result.count) > 0) return true;
    }
    return false;
  }

  async hasDependentLessonsForSubcategory(subcategoryId: number): Promise<boolean> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(lessons).where(eq(lessons.subcategoryId, subcategoryId));
    return Number(result.count) > 0;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(lessonSubcategories).where(eq(lessonSubcategories.categoryId, id));
    await db.delete(lessonCategories).where(eq(lessonCategories.id, id));
  }

  async deleteSubcategory(id: number): Promise<void> {
    await db.delete(lessonSubcategories).where(eq(lessonSubcategories.id, id));
  }

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

  async renameCategory(id: number, newName: string): Promise<LessonCategory | undefined> {
    const [updated] = await db.update(lessonCategories).set({ name: newName }).where(eq(lessonCategories.id, id)).returning();
    return updated;
  }

  async renameSubcategory(id: number, newName: string): Promise<LessonSubcategory | undefined> {
    const [updated] = await db.update(lessonSubcategories).set({ name: newName }).where(eq(lessonSubcategories.id, id)).returning();
    return updated;
  }

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

  async getSubcategoryUsageCount(subcategoryId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(lessons).where(eq(lessons.subcategoryId, subcategoryId));
    return Number(result.count);
  }

  async getImpactLevelUsageCount(impactId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(lessons).where(eq(lessons.impactId, impactId));
    return Number(result.count);
  }

  async getImpactLevels(): Promise<ImpactLevel[]> {
    return db.select().from(impactLevels).orderBy(impactLevels.sortOrder);
  }

  async getImpactLevel(id: number): Promise<ImpactLevel | undefined> {
    const [level] = await db.select().from(impactLevels).where(eq(impactLevels.id, id));
    return level;
  }

  async createImpactLevel(level: InsertImpactLevel): Promise<ImpactLevel> {
    const [created] = await db.insert(impactLevels).values(level).returning();
    return created;
  }

  async updateImpactLevel(id: number, data: Partial<InsertImpactLevel>): Promise<ImpactLevel | undefined> {
    const [updated] = await db.update(impactLevels).set(data).where(eq(impactLevels.id, id)).returning();
    return updated;
  }

  async deleteImpactLevel(id: number): Promise<void> {
    await db.update(lessons).set({ impactId: null }).where(eq(lessons.impactId, id));
    await db.delete(impactLevels).where(eq(impactLevels.id, id));
  }

  async updateLessonImpact(lessonId: number, impactId: number | null): Promise<void> {
    await db.update(lessons).set({ impactId }).where(eq(lessons.id, lessonId));
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    if (role === "admin") {
      return db.select().from(users)
        .where(sql`lower(${users.role}) in ('admin', 'superadmin', 'superadministrator')`)
        .orderBy(users.email);
    }
    return db.select().from(users).where(eq(users.role, role)).orderBy(users.email);
  }

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

  async setUserRole(userId: string, role: UserRole): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async getUserById(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`);
    return user;
  }

  async countUsersByRole(role: UserRole): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`lower(${users.role}) in ('admin', 'superadmin', 'superadministrator')`);
    return Number(result.count);
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.email);
  }

  async createUserByEmail(email: string): Promise<User> {
    const [user] = await db.insert(users).values({
      email,
      role: "user",
    }).returning();
    return user;
  }

  async deleteUserByEmail(email: string): Promise<void> {
    await db.delete(users).where(sql`lower(${users.email}) = lower(${email})`);
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; profileImageUrl?: string }): Promise<User | undefined> {
    const updateData: any = { updatedAt: new Date() };
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;
    const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
    return updated;
  }

  async getScoringConfig(): Promise<ScoringConfig> {
    const rows = await db.select().from(scoringConfig);
    if (rows.length > 0) return rows[0];
    const [created] = await db.insert(scoringConfig).values({
      initialScore: SCORING_DEFAULTS.initialScore,
      incrementScore: SCORING_DEFAULTS.incrementScore,
      dailyDecrement: SCORING_DEFAULTS.dailyDecrement,
    }).returning();
    return created;
  }

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

  async recalculateAllScores(config: { initialScore: number; incrementScore: number; dailyDecrement: number }): Promise<void> {
    const allSubcategories = await db.select().from(lessonSubcategories);
    const allLessons = await db.select().from(lessons);
    const allImpacts = await db.select().from(impactLevels);
    const impactMap = new Map(allImpacts.map(i => [i.id, i.weightingPercent]));

    for (const sub of allSubcategories) {
      const subLessons = allLessons
        .filter(l => l.subcategoryId === sub.id)
        .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());

      if (subLessons.length === 0) {
        await db.update(lessonSubcategories).set({
          currentScore: 0,
          lastScoreUpdatedAt: null,
          firstRecordedDate: null,
        }).where(eq(lessonSubcategories.id, sub.id));
        continue;
      }

      const firstDate = new Date(subLessons[0].createdAt!);
      let score = 0;
      let lastUpdate = firstDate;

      for (let i = 0; i < subLessons.length; i++) {
        const lesson = subLessons[i];
        const lessonDate = new Date(lesson.createdAt!);
        const weightingPercent = lesson.impactId ? (impactMap.get(lesson.impactId) || 100) : 100;
        const weightingMultiplier = weightingPercent / 100;

        if (i === 0) {
          score = Math.round(config.initialScore * weightingMultiplier);
        } else {
          const daysSince = Math.max(0, Math.floor((lessonDate.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)));
          score = Math.max(0, score - daysSince * config.dailyDecrement);
          score += Math.round(config.incrementScore * weightingMultiplier);
        }
        lastUpdate = lessonDate;
      }

      const now = new Date();
      const daysSinceLastLesson = Math.max(0, Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)));
      score = Math.max(0, score - daysSinceLastLesson * config.dailyDecrement);

      await db.update(lessonSubcategories).set({
        currentScore: score,
        lastScoreUpdatedAt: now,
        firstRecordedDate: firstDate,
      }).where(eq(lessonSubcategories.id, sub.id));
    }
  }
}

export const storage = new DatabaseStorage();
