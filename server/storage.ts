import {
  type Project, type InsertProject,
  type LessonCategory, type InsertLessonCategory,
  type LessonSubcategory, type InsertLessonSubcategory,
  type Lesson, type InsertLesson,
  projects, lessonCategories, lessonSubcategories, lessons,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  findProjectByNameAndType(name: string, projectType: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;

  getCategories(): Promise<LessonCategory[]>;
  findCategoryByName(name: string): Promise<LessonCategory | undefined>;
  createCategory(category: InsertLessonCategory): Promise<LessonCategory>;

  getSubcategories(): Promise<LessonSubcategory[]>;
  findSubcategoryByNameAndCategory(name: string, categoryId: number): Promise<LessonSubcategory | undefined>;
  createSubcategory(subcategory: InsertLessonSubcategory): Promise<LessonSubcategory>;
  updateSubcategoryScore(id: number, score: number, lastUpdated: Date): Promise<void>;
  createSubcategoryFirstRecorded(id: number, date: Date): Promise<void>;

  getLessons(): Promise<(Lesson & { project?: Project; category?: LessonCategory; subcategory?: LessonSubcategory })[]>;
  getLesson(id: number): Promise<Lesson | undefined>;
  createLesson(lesson: InsertLesson): Promise<Lesson>;
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

  async getLessons(): Promise<(Lesson & { project?: Project; category?: LessonCategory; subcategory?: LessonSubcategory })[]> {
    const allLessons = await db.select().from(lessons).orderBy(desc(lessons.createdAt));
    const allProjects = await this.getProjects();
    const allCategories = await this.getCategories();
    const allSubcategories = await this.getSubcategories();

    const projectMap = new Map(allProjects.map((p) => [p.id, p]));
    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
    const subcategoryMap = new Map(allSubcategories.map((s) => [s.id, s]));

    return allLessons.map((lesson) => {
      const subcategory = subcategoryMap.get(lesson.subcategoryId);
      const category = subcategory ? categoryMap.get(subcategory.categoryId) : undefined;
      return {
        ...lesson,
        project: projectMap.get(lesson.projectId),
        category,
        subcategory,
      };
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
}

export const storage = new DatabaseStorage();
