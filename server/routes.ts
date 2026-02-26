/**
 * @file server/routes.ts
 * @description Express API route registration for LessonKeeper.
 *
 * This module registers all REST API endpoints on the Express application.
 * Routes are organized into the following groups:
 *
 *  - **Public endpoints** – Unauthenticated routes (e.g. top subcategories widget)
 *  - **Project CRUD** – List and update projects (admin-only updates)
 *  - **Lesson queries / exports** – List lessons, per-project lessons, and Excel exports
 *  - **Reference data management** – CRUD for ProjectType, ProjectPhase, LessonCategory, LessonSubcategory
 *  - **Impact level management** – CRUD for impact-level definitions and weighting
 *  - **Excel template generation** – Dynamic .xlsx template with dropdown validations
 *  - **Excel upload / parsing** – Parse uploaded .xlsx, validate, create projects & lessons
 *  - **Scoring configuration** – View / update / reset the subcategory scoring formula
 *  - **User profile management** – View and update the authenticated user's profile
 *  - **Admin user management** – List, add, remove admins; manage all users; CSV download
 */

// ── Imports ────────────────────────────────────────────────────────────
import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import multer from "multer";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import type { UserRole } from "@shared/models/auth";

// Configure multer for in-memory file uploads (max 10 MB)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Admin helpers ──────────────────────────────────────────────────────

/**
 * Checks whether a role string represents an admin-level role.
 * Recognized values (case-insensitive): "admin", "superadmin", "superadministrator".
 */
function hasAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === "admin" || normalized === "superadmin" || normalized === "superadministrator";
}

/**
 * Express middleware that enforces admin access.
 * Requires `isAuthenticated` to run first so that `req.user` is populated.
 * Looks up the database user record and verifies they hold an admin role.
 * On success, attaches the DB user object as `req.dbUser` for downstream handlers.
 */
const isAdmin: RequestHandler = async (req: any, res, next) => {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const user = await storage.getUserById(userId);
  if (!user || !hasAdminRole(user.role)) {
    return res.status(403).json({ message: "Forbidden: admin access required" });
  }
  (req as any).dbUser = user;
  next();
};

/** Shape of a single validation error returned from the upload parser. */
interface ValidationError {
  row: number;
  column: string;
  message: string;
}

// ── Route registration ─────────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize Replit-managed auth, auth routes, and object-storage routes
  await setupAuth(app);
  registerAuthRoutes(app);
  registerObjectStorageRoutes(app);

  // ═══════════════════════════════════════════════════════════════════════
  //  PROJECT CRUD
  // ═══════════════════════════════════════════════════════════════════════

  // GET /api/projects – Return all projects.
  // Auth: isAuthenticated
  app.get("/api/projects", isAuthenticated, async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // POST /api/projects — Create a new project (admin only)
  app.post("/api/projects", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { name, projectType, closeDate, projectManager, description, status } = req.body;
      if (!name || !projectType) {
        return res.status(400).json({ message: "Name and project type are required" });
      }
      const project = await storage.createProject({
        name,
        projectType,
        closeDate: closeDate || null,
        projectManager: projectManager || null,
        description: description || null,
        status: status || "Project to apply learning to",
      });
      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // PATCH /api/projects/:id – Update an existing project's fields.
  // Auth: isAuthenticated + isAdmin
  app.patch("/api/projects/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });
      const { name, projectType, closeDate, projectManager, description, status } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (projectType !== undefined) updateData.projectType = projectType;
      if (closeDate !== undefined) updateData.closeDate = closeDate;
      if (projectManager !== undefined) updateData.projectManager = projectManager;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
      const updated = await storage.updateProject(id, updateData);
      if (!updated) return res.status(404).json({ message: "Project not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  LESSON QUERIES & EXPORTS
  // ═══════════════════════════════════════════════════════════════════════

  // PATCH /api/lessons/:id – Update an existing lesson's fields.
  // Auth: isAuthenticated + isAdmin
  // Accepts optional body fields: name, eventDescription, keyLearningOrAction, phase, impactId.
  app.patch("/api/lessons/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid lesson ID" });
      const { name, eventDescription, keyLearningOrAction, phase, impactId } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (eventDescription !== undefined) updateData.eventDescription = eventDescription;
      if (keyLearningOrAction !== undefined) updateData.keyLearningOrAction = keyLearningOrAction;
      if (phase !== undefined) updateData.phase = phase;
      if (impactId !== undefined) updateData.impactId = impactId;
      const updated = await storage.updateLesson(id, updateData);
      if (!updated) return res.status(404).json({ message: "Lesson not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating lesson:", error);
      res.status(500).json({ message: "Failed to update lesson" });
    }
  });

  // GET /api/categories – Return all lesson categories.
  // Auth: isAuthenticated
  app.get("/api/categories", isAuthenticated, async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC ENDPOINTS (no authentication required)
  // ═══════════════════════════════════════════════════════════════════════

  // GET /api/public/top-subcategories – Return the top 3 trending subcategories.
  // Auth: NONE (public endpoint for the landing page widget)
  // Logic: Computes an "effective score" per subcategory by decaying currentScore
  //        by the number of days since the last score update, then returns the top 3.
  app.get("/api/public/top-subcategories", async (_req, res) => {
    try {
      const subcategories = await storage.getSubcategories();
      const categories = await storage.getCategories();
      const catMap = new Map(categories.map(c => [c.id, c]));
      const now = new Date();
      // Calculate effective score with time-decay and return top 3 by score
      const scored = subcategories
        .map(sub => {
          const lastUpdate = sub.lastScoreUpdatedAt ? new Date(sub.lastScoreUpdatedAt) : now;
          const daysSince = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
          const effectiveScore = Math.round(Math.max(0, (sub.currentScore || 0) - daysSince));
          return { id: sub.id, name: sub.name, categoryName: catMap.get(sub.categoryId)?.name || "", effectiveScore };
        })
        .filter(s => s.effectiveScore > 0)
        .sort((a, b) => b.effectiveScore - a.effectiveScore)
        .slice(0, 3);
      res.json(scored);
    } catch (error) {
      console.error("Error fetching top subcategories:", error);
      res.status(500).json({ message: "Failed to fetch top subcategories" });
    }
  });

  // GET /api/subcategories – Return all lesson subcategories.
  // Auth: isAuthenticated
  app.get("/api/subcategories", isAuthenticated, async (_req, res) => {
    try {
      const subcategories = await storage.getSubcategories();
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      res.status(500).json({ message: "Failed to fetch subcategories" });
    }
  });

  // GET /api/projects/:id/lessons – Return all lessons for a specific project.
  // Auth: isAuthenticated
  app.get("/api/projects/:id/lessons", isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });
      const projectLessons = await storage.getLessonsByProject(projectId);
      res.json(projectLessons);
    } catch (error) {
      console.error("Error fetching project lessons:", error);
      res.status(500).json({ message: "Failed to fetch project lessons" });
    }
  });

  // GET /api/projects/:id/lessons/export – Export a single project's lessons as an Excel file.
  // Auth: isAuthenticated
  // Builds a styled .xlsx workbook with:
  //   1. A "PROJECT DETAILS" header section containing the project metadata
  //   2. A "LESSONS" section listing all lessons sorted by impact weighting (descending)
  app.get("/api/projects/:id/lessons/export", isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const projectLessons = await storage.getLessonsByProject(projectId);

      // Create ExcelJS workbook and worksheet
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Project Lessons");

      // Define reusable cell styles for headers
      const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
      const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      const colHeaderFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4F0" } };
      const colHeaderFont: Partial<ExcelJS.Font> = { bold: true, size: 10 };

      // ── Project details section ──
      ws.addRow(["PROJECT DETAILS"]);
      const projectHeaderRow = ws.getRow(1);
      projectHeaderRow.eachCell((cell) => { cell.fill = headerFill; cell.font = headerFont; });
      ws.mergeCells("A1:F1");

      ws.addRow(["Project Name", "Project Type", "Close Date", "Project Manager", "Description"]);
      const detailHeaderRow = ws.getRow(2);
      detailHeaderRow.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = colHeaderFont; });

      ws.addRow([
        project.name,
        project.projectType,
        project.closeDate || "",
        project.projectManager || "",
        project.description || "",
      ]);

      ws.addRow([]);

      // ── Lessons section ──
      ws.addRow(["LESSONS (Ordered by Impact Score)"]);
      const lessonsHeaderRow = ws.getRow(5);
      lessonsHeaderRow.eachCell((cell) => { cell.fill = headerFill; cell.font = headerFont; });
      ws.mergeCells("A5:J5");

      const colHeaders = ["#", "Type", "Category", "Subcategory", "Phase", "Impact Level", "Weighting %", "Lesson Name", "Event Description", "Key Learning / Action"];
      ws.addRow(colHeaders);
      const colRow = ws.getRow(6);
      colRow.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = colHeaderFont; });

      // Sort lessons by impact weighting percentage descending
      const sorted = [...projectLessons].sort((a, b) => {
        const wA = a.impact?.weightingPercent ?? 0;
        const wB = b.impact?.weightingPercent ?? 0;
        return wB - wA;
      });

      // Add one data row per lesson
      for (const lesson of sorted) {
        ws.addRow([
          lesson.id,
          lesson.type === "WentWell" ? "Went Well" : "Could Have Gone Better",
          lesson.category?.name || "",
          lesson.subcategory?.name || "",
          lesson.phase || "",
          lesson.impact?.description || "",
          lesson.impact?.weightingPercent ?? "",
          lesson.name || "",
          lesson.eventDescription || "",
          lesson.keyLearningOrAction || "",
        ]);
      }

      // Set column widths for readability
      ws.columns = [
        { width: 6 }, { width: 22 }, { width: 18 }, { width: 22 },
        { width: 14 }, { width: 18 }, { width: 12 }, { width: 30 },
        { width: 40 }, { width: 40 },
      ];

      // Write workbook buffer and send as downloadable .xlsx file
      const buf = await wb.xlsx.writeBuffer();
      const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}_lessons.xlsx"`);
      res.send(Buffer.from(buf as ArrayBuffer));
    } catch (error) {
      console.error("Error exporting project lessons:", error);
      res.status(500).json({ message: "Failed to export project lessons" });
    }
  });

  // GET /api/lessons – Return all lessons across all projects.
  // Auth: isAuthenticated
  app.get("/api/lessons", isAuthenticated, async (_req, res) => {
    try {
      const lessons = await storage.getLessons();
      res.json(lessons);
    } catch (error) {
      console.error("Error fetching lessons:", error);
      res.status(500).json({ message: "Failed to fetch lessons" });
    }
  });

  // GET /api/lessons/export – Export dashboard lessons as a filtered Excel file.
  // Auth: isAuthenticated
  // Query params: projectType, phase, categoryId, subcategoryId, search, tab
  // Logic:
  //   1. Fetch all lessons and apply query-string filters
  //   2. Group filtered lessons by subcategory, computing an effective score per group
  //   3. Sort groups by descending effective score
  //   4. Build a styled .xlsx with an "APPLIED FILTERS" summary and grouped lesson rows
  app.get("/api/lessons/export", isAuthenticated, async (req: any, res) => {
    try {
      // ── Extract filter query parameters (support both single values and arrays) ──
      const { search, tab } = req.query as Record<string, string | undefined>;
      const toArray = (v: string | string[] | undefined): string[] => {
        if (!v) return [];
        return Array.isArray(v) ? v : [v];
      };
      const projectTypes = toArray(req.query.projectType);
      const phases = toArray(req.query.phase);
      const categoryIds = toArray(req.query.categoryId);
      const subcategoryIds = toArray(req.query.subcategoryId);

      const allLessons = await storage.getLessons();
      const allSubcategories = await storage.getSubcategories();
      const allCategories = await storage.getCategories();
      const scoringConfigData = await storage.getScoringConfig();
      const dailyDecrement = scoringConfigData?.dailyDecrement ?? 1;

      let filtered = allLessons;
      if (projectTypes.length > 0) filtered = filtered.filter(l => l.project && projectTypes.includes(l.project.projectType));
      if (phases.length > 0) filtered = filtered.filter(l => phases.includes(l.phase));
      if (categoryIds.length > 0) {
        const catIdNums = categoryIds.map(Number);
        filtered = filtered.filter(l => {
          const sub = l.subcategory || allSubcategories.find(s => s.id === l.subcategoryId);
          return sub && catIdNums.includes(sub.categoryId);
        });
      }
      if (subcategoryIds.length > 0) {
        const subIdNums = subcategoryIds.map(Number);
        filtered = filtered.filter(l => subIdNums.includes(l.subcategoryId));
      }
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(l =>
          l.name.toLowerCase().includes(s) ||
          (l.eventDescription || "").toLowerCase().includes(s) ||
          (l.keyLearningOrAction || "").toLowerCase().includes(s)
        );
      }

      // Filter by lesson type tab ("went-well" | "could-be-better" | all)
      if (tab === "could-be-better") filtered = filtered.filter(l => l.type === "CouldHaveGoneBetter");
      else if (tab === "went-well") filtered = filtered.filter(l => l.type === "WentWell");

      // ── Group lessons by subcategory and compute effective scores ──
      const groups = new Map<number, { subcategory: any; category: any; lessons: typeof filtered; effectiveScore: number }>();
      for (const lesson of filtered) {
        const sub = lesson.subcategory || allSubcategories.find(s => s.id === lesson.subcategoryId);
        const cat = sub ? (lesson.category || allCategories.find(c => c.id === sub.categoryId)) : undefined;
        if (!sub || !cat) continue;
        if (!groups.has(sub.id)) {
          const now = new Date();
          const lastUpdate = sub.lastScoreUpdatedAt ? new Date(sub.lastScoreUpdatedAt) : now;
          const daysSince = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
          const effectiveScore = Math.round(Math.max(0, (sub.currentScore || 0) - daysSince * dailyDecrement));
          groups.set(sub.id, { subcategory: sub, category: cat, lessons: [], effectiveScore });
        }
        groups.get(sub.id)!.lessons.push(lesson);
      }
      // Sort groups so highest-scored subcategories appear first
      const sortedGroups = Array.from(groups.values()).sort((a, b) => b.effectiveScore - a.effectiveScore);

      // ── Build the Excel workbook ──
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Dashboard Lessons");

      // Reusable cell styles
      const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
      const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      const colHeaderFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4F0" } };
      const colHeaderFont: Partial<ExcelJS.Font> = { bold: true, size: 10 };
      const groupFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDF2F9" } };
      const groupFont: Partial<ExcelJS.Font> = { bold: true, size: 10 };

      let rowIdx = 1;

      // ── "Applied Filters" summary section ──
      ws.addRow(["APPLIED FILTERS"]);
      const filterHeaderRow = ws.getRow(rowIdx);
      filterHeaderRow.eachCell((cell) => { cell.fill = headerFill; cell.font = headerFont; });
      ws.mergeCells(`A${rowIdx}:J${rowIdx}`);
      rowIdx++;

      const tabLabel = tab === "could-be-better" ? "Could Be Better" : tab === "went-well" ? "Went Well" : "All Lessons";
      const filterParts: string[] = [];
      if (projectTypes.length > 0) filterParts.push(`Project Type: ${projectTypes.join(", ")}`);
      if (phases.length > 0) filterParts.push(`Phase: ${phases.join(", ")}`);
      if (categoryIds.length > 0) {
        const names = categoryIds.map(id => allCategories.find(c => c.id === parseInt(id))?.name || id);
        filterParts.push(`Category: ${names.join(", ")}`);
      }
      if (subcategoryIds.length > 0) {
        const names = subcategoryIds.map(id => allSubcategories.find(s => s.id === parseInt(id))?.name || id);
        filterParts.push(`Subcategory: ${names.join(", ")}`);
      }
      if (search) filterParts.push(`Search: "${search}"`);
      const filterText = filterParts.length > 0
        ? `View: ${tabLabel} | ${filterParts.join(" | ")}`
        : `View: ${tabLabel} | No additional filters applied`;

      ws.addRow([filterText]);
      ws.mergeCells(`A${rowIdx}:J${rowIdx}`);
      rowIdx++;

      ws.addRow([]);
      rowIdx++;

      // ── Lessons data section ──
      ws.addRow(["LESSONS (Ordered by Subcategory Score)"]);
      const lessonsHeaderRow = ws.getRow(rowIdx);
      lessonsHeaderRow.eachCell((cell) => { cell.fill = headerFill; cell.font = headerFont; });
      ws.mergeCells(`A${rowIdx}:J${rowIdx}`);
      rowIdx++;

      const colHeaders = ["#", "Type", "Category", "Subcategory", "Subcategory Score", "Phase", "Impact Level", "Weighting %", "Lesson Name", "Event Description", "Key Learning / Action", "Project"];
      ws.addRow(colHeaders);
      const colRow = ws.getRow(rowIdx);
      colRow.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = colHeaderFont; });
      rowIdx++;

      // Emit one group-header row per subcategory, then its lesson rows
      for (const group of sortedGroups) {
        ws.addRow([`${group.category.name} > ${group.subcategory.name} (Score: ${group.effectiveScore})`]);
        const gRow = ws.getRow(rowIdx);
        gRow.eachCell((cell) => { cell.fill = groupFill; cell.font = groupFont; });
        ws.mergeCells(`A${rowIdx}:L${rowIdx}`);
        rowIdx++;

        for (const lesson of group.lessons) {
          ws.addRow([
            lesson.id,
            lesson.type === "WentWell" ? "Went Well" : "Could Have Gone Better",
            lesson.category?.name || group.category.name,
            lesson.subcategory?.name || group.subcategory.name,
            group.effectiveScore,
            lesson.phase || "",
            lesson.impact?.description || "",
            lesson.impact?.weightingPercent ?? "",
            lesson.name || "",
            lesson.eventDescription || "",
            lesson.keyLearningOrAction || "",
            lesson.project?.name || "",
          ]);
          rowIdx++;
        }
      }

      // Set column widths
      ws.columns = [
        { width: 6 }, { width: 22 }, { width: 18 }, { width: 22 },
        { width: 10 }, { width: 14 }, { width: 18 }, { width: 12 },
        { width: 30 }, { width: 40 }, { width: 40 }, { width: 25 },
      ];

      // Send workbook as downloadable attachment
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="dashboard_lessons_export.xlsx"`);
      res.send(Buffer.from(buf as ArrayBuffer));
    } catch (error) {
      console.error("Error exporting dashboard lessons:", error);
      res.status(500).json({ message: "Failed to export dashboard lessons" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  REFERENCE DATA MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  // GET /api/reference-data – Return all reference data used in dropdown menus.
  // Auth: isAuthenticated
  // Returns: projectTypes, projectPhases, categories, subcategories, impactLevels
  app.get("/api/reference-data", isAuthenticated, async (_req, res) => {
    try {
      const allCategories = await storage.getCategories();
      const allSubcategories = await storage.getSubcategories();
      const projectTypes = await storage.getReferenceValues("ProjectType");
      const projectPhases = await storage.getReferenceValues("ProjectPhase");
      const impacts = await storage.getImpactLevels();
      res.json({
        projectTypes: projectTypes.map((v) => ({ id: v.id, value: v.value })),
        projectPhases: projectPhases.map((v) => ({ id: v.id, value: v.value })),
        categories: allCategories.map((c) => ({ id: c.id, value: c.name })),
        subcategories: allSubcategories.map((s) => ({ id: s.id, value: s.name, categoryId: s.categoryId })),
        impactLevels: impacts,
      });
    } catch (error) {
      console.error("Error fetching reference data:", error);
      res.status(500).json({ message: "Failed to fetch reference data" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  IMPACT LEVEL MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  // GET /api/impact-levels – Return all impact level definitions.
  // Auth: isAuthenticated
  app.get("/api/impact-levels", isAuthenticated, async (_req, res) => {
    try {
      const levels = await storage.getImpactLevels();
      res.json(levels);
    } catch (error) {
      console.error("Error fetching impact levels:", error);
      res.status(500).json({ message: "Failed to fetch impact levels" });
    }
  });

  // POST /api/impact-levels – Create a new impact level.
  // Auth: isAuthenticated + isAdmin
  // Body: { description: string, weightingPercent: number (>= 100), sortOrder?: number }
  app.post("/api/impact-levels", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { description, weightingPercent, sortOrder } = req.body;
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ message: "Description is required" });
      }
      if (weightingPercent == null || typeof weightingPercent !== "number" || weightingPercent < 100) {
        return res.status(400).json({ message: "Weighting percent must be at least 100" });
      }
      const created = await storage.createImpactLevel({
        description: description.trim(),
        weightingPercent,
        sortOrder: sortOrder ?? 0,
      });
      res.json(created);
    } catch (error) {
      console.error("Error creating impact level:", error);
      res.status(500).json({ message: "Failed to create impact level" });
    }
  });

  // PATCH /api/impact-levels/:id – Update an existing impact level.
  // Auth: isAuthenticated + isAdmin
  // Prevents changing weightingPercent if lessons are already assigned to this level (409 Conflict).
  app.patch("/api/impact-levels/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const { description, weightingPercent, sortOrder } = req.body;

      // Guard: prevent weighting changes when lessons reference this impact level
      const usageCount = await storage.getImpactLevelUsageCount(id);
      if (usageCount > 0 && weightingPercent !== undefined) {
        const existing = await storage.getImpactLevel(id);
        if (existing && existing.weightingPercent !== weightingPercent) {
          return res.status(409).json({ message: `Cannot change weighting: this impact level is assigned to ${usageCount} lesson(s). Only the label can be renamed.` });
        }
      }

      const updateData: any = {};
      if (description !== undefined) updateData.description = description.trim();
      if (weightingPercent !== undefined) updateData.weightingPercent = weightingPercent;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      const updated = await storage.updateImpactLevel(id, updateData);
      if (!updated) return res.status(404).json({ message: "Impact level not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating impact level:", error);
      res.status(500).json({ message: "Failed to update impact level" });
    }
  });

  // DELETE /api/impact-levels/:id – Delete an impact level.
  // Auth: isAuthenticated + isAdmin
  // Prevents deletion if lessons are assigned to it (409 Conflict).
  app.delete("/api/impact-levels/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const usageCount = await storage.getImpactLevelUsageCount(id);
      if (usageCount > 0) {
        return res.status(409).json({ message: `Cannot remove: this impact level is assigned to ${usageCount} existing lesson(s).` });
      }
      await storage.deleteImpactLevel(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting impact level:", error);
      res.status(500).json({ message: "Failed to delete impact level" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  REFERENCE DATA CRUD (ProjectType, ProjectPhase, Category, Subcategory)
  // ═══════════════════════════════════════════════════════════════════════

  // POST /api/reference-data/:type – Create a new reference value.
  // Auth: isAuthenticated + isAdmin
  // :type is one of "ProjectType", "ProjectPhase", "LessonCategory", "LessonSubcategory".
  // Routes to the appropriate storage method based on type.
  // Duplicate names within the same type result in 409 Conflict.
  app.post("/api/reference-data/:type", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { type } = req.params;
      const { value } = req.body;
      if (!value || typeof value !== "string" || !value.trim()) {
        return res.status(400).json({ message: "Value is required" });
      }
      const trimmed = value.trim();

      // Route creation by reference-data type
      if (type === "ProjectType" || type === "ProjectPhase") {
        const existing = await storage.getReferenceValues(type);
        if (existing.some((v) => v.value.toLowerCase() === trimmed.toLowerCase())) {
          return res.status(409).json({ message: `"${trimmed}" already exists` });
        }
        const created = await storage.createReferenceValue({ type, value: trimmed });
        return res.json({ id: created.id, value: created.value });
      } else if (type === "LessonCategory") {
        const existing = await storage.findCategoryByName(trimmed);
        if (existing) {
          return res.status(409).json({ message: `"${trimmed}" already exists` });
        }
        const created = await storage.createCategory({ name: trimmed, description: null });
        return res.json({ id: created.id, value: created.name });
      } else if (type === "LessonSubcategory") {
        // Subcategories require a parent categoryId in the request body
        const { categoryId } = req.body;
        if (!categoryId) {
          return res.status(400).json({ message: "Category is required for subcategories" });
        }
        const existing = await storage.findSubcategoryByNameAndCategory(trimmed, Number(categoryId));
        if (existing) {
          return res.status(409).json({ message: `"${trimmed}" already exists in this category` });
        }
        const created = await storage.createSubcategory({ categoryId: Number(categoryId), name: trimmed, description: null });
        return res.json({ id: created.id, value: created.name, categoryId: created.categoryId });
      }
      return res.status(400).json({ message: "Invalid type" });
    } catch (error) {
      console.error("Error creating reference value:", error);
      res.status(500).json({ message: "Failed to create reference value" });
    }
  });

  // PATCH /api/reference-data/:type/:id – Rename an existing reference value.
  // Auth: isAuthenticated + isAdmin
  // Checks for duplicate names before renaming (409 Conflict if duplicate found).
  app.patch("/api/reference-data/:type/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { type, id } = req.params;
      const { value } = req.body;
      const numId = Number(id);
      if (!value || typeof value !== "string" || !value.trim()) {
        return res.status(400).json({ message: "Value is required" });
      }
      const trimmed = value.trim();

      if (type === "ProjectType" || type === "ProjectPhase") {
        // Check for duplicate names among other values of the same type
        const existing = await storage.getReferenceValues(type);
        if (existing.some((v) => v.id !== numId && v.value.toLowerCase() === trimmed.toLowerCase())) {
          return res.status(409).json({ message: `"${trimmed}" already exists` });
        }
        const updated = await storage.renameReferenceValue(numId, trimmed);
        if (!updated) return res.status(404).json({ message: "Not found" });
        return res.json({ id: updated.id, value: updated.value });
      } else if (type === "LessonCategory") {
        const dup = await storage.findCategoryByName(trimmed);
        if (dup && dup.id !== numId) {
          return res.status(409).json({ message: `"${trimmed}" already exists` });
        }
        const updated = await storage.renameCategory(numId, trimmed);
        if (!updated) return res.status(404).json({ message: "Not found" });
        return res.json({ id: updated.id, value: updated.name });
      } else if (type === "LessonSubcategory") {
        const updated = await storage.renameSubcategory(numId, trimmed);
        if (!updated) return res.status(404).json({ message: "Not found" });
        return res.json({ id: updated.id, value: updated.name, categoryId: updated.categoryId });
      }
      return res.status(400).json({ message: "Invalid type" });
    } catch (error) {
      console.error("Error renaming reference value:", error);
      res.status(500).json({ message: "Failed to rename value" });
    }
  });

  // GET /api/reference-data/usage – Return usage counts for all reference data items.
  // Auth: isAuthenticated + isAdmin
  // Used by the admin UI to show how many records reference each value,
  // preventing accidental deletion of values in active use.
  app.get("/api/reference-data/usage", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const ptValues = await storage.getReferenceValues("ProjectType");
      const phValues = await storage.getReferenceValues("ProjectPhase");
      const categories = await storage.getCategories();
      const subcategories = await storage.getSubcategories();
      const impacts = await storage.getImpactLevels();

      // Build a nested map: { typeName: { id: usageCount } }
      const usage: Record<string, Record<number, number>> = {
        ProjectType: {},
        ProjectPhase: {},
        LessonCategory: {},
        LessonSubcategory: {},
        ImpactLevel: {},
      };

      for (const pt of ptValues) {
        usage.ProjectType[pt.id] = await storage.getReferenceValueUsageCount(pt.id);
      }
      for (const ph of phValues) {
        usage.ProjectPhase[ph.id] = await storage.getReferenceValueUsageCount(ph.id);
      }
      for (const cat of categories) {
        usage.LessonCategory[cat.id] = await storage.getCategoryUsageCount(cat.id);
      }
      for (const sub of subcategories) {
        usage.LessonSubcategory[sub.id] = await storage.getSubcategoryUsageCount(sub.id);
      }
      for (const imp of impacts) {
        usage.ImpactLevel[imp.id] = await storage.getImpactLevelUsageCount(imp.id);
      }

      res.json(usage);
    } catch (error) {
      console.error("Error fetching usage counts:", error);
      res.status(500).json({ message: "Failed to fetch usage counts" });
    }
  });

  // DELETE /api/reference-data/:type/:id – Delete a reference value by type.
  // Auth: isAuthenticated + isAdmin
  // Prevents deletion when dependent records exist (409 Conflict).
  app.delete("/api/reference-data/:type/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { type, id } = req.params;
      const numId = Number(id);
      if (type === "ProjectType" || type === "ProjectPhase") {
        const usageCount = await storage.getReferenceValueUsageCount(numId);
        if (usageCount > 0) {
          return res.status(409).json({ message: `Cannot remove: this value is assigned to ${usageCount} existing record(s).` });
        }
        await storage.deleteReferenceValue(numId);
      } else if (type === "LessonCategory") {
        const hasLessons = await storage.hasDependentLessonsForCategory(numId);
        if (hasLessons) {
          return res.status(409).json({ message: "Cannot remove: this category has lessons linked to it." });
        }
        await storage.deleteCategory(numId);
      } else if (type === "LessonSubcategory") {
        const hasLessons = await storage.hasDependentLessonsForSubcategory(numId);
        if (hasLessons) {
          return res.status(409).json({ message: "Cannot remove: this subcategory has lessons linked to it." });
        }
        await storage.deleteSubcategory(numId);
      } else {
        return res.status(400).json({ message: "Invalid type" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting reference value:", error);
      res.status(500).json({ message: "Failed to delete reference value" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  EXCEL TEMPLATE GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  // GET /api/template – Generate and download an Excel upload template.
  // Auth: isAuthenticated
  // Builds a two-sheet workbook:
  //   Sheet 1 ("Lessons Template"): Project details header + two lesson sections
  //     ("COULD HAVE GONE BETTER" and "WENT WELL") with dropdown validations.
  //   Sheet 2 ("Reference Data"): Lists of valid values for dropdowns
  //     (ProjectType, ProjectPhase, LessonCategory, LessonSubcategory, Impact).
  //   Dropdown validations on Sheet 1 reference named ranges on Sheet 2.
  app.get("/api/template", isAuthenticated, async (_req, res) => {
    try {
      const allCategories = await storage.getCategories();
      const allSubcategories = await storage.getSubcategories();
      const allProjects = await storage.getProjects();

      const phValues = await storage.getReferenceValues("ProjectPhase");
      const phases = phValues.length > 0
        ? phValues.map((v) => v.value)
        : ["Initiation", "Planning", "Delivery", "Close-out"];
      const categoryNames = allCategories.length > 0
        ? allCategories.map((c) => c.name)
        : ["Governance", "Planning", "Execution", "Communication"];

      const subcatMap: Record<string, string[]> = {};
      if (allSubcategories.length > 0) {
        for (const sub of allSubcategories) {
          const cat = allCategories.find((c) => c.id === sub.categoryId);
          const catName = cat ? cat.name : "Other";
          if (!subcatMap[catName]) subcatMap[catName] = [];
          subcatMap[catName].push(sub.name);
        }
      } else {
        subcatMap["Governance"] = ["Requirements Clarity", "Decision Making"];
        subcatMap["Planning"] = ["Resource Planning", "Timeline Estimation"];
        subcatMap["Execution"] = ["Testing & QA", "Change Management"];
        subcatMap["Communication"] = ["Stakeholder Engagement", "Team Collaboration"];
      }
      const allSubcatNames = Object.values(subcatMap).flat();

      // Build project ID+Name list for dropdown
      const projectOptions = allProjects.map(p => `${p.projectCode} - ${p.name}`);

      const wb = new ExcelJS.Workbook();

      const sectionHeaderFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B4C7E" } };
      const sectionHeaderFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      const colHeaderFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4F0" } };
      const colHeaderFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF1A1A1A" }, size: 10 };
      const colHeaderBorder: Partial<ExcelJS.Borders> = {
        bottom: { style: "thin", color: { argb: "FF2B4C7E" } },
      };

      const ws = wb.addWorksheet("Lessons Template");

      const impactLevelsList = await storage.getImpactLevels();
      const impactNames = impactLevelsList.map(il => il.description);

      ws.columns = [
        { width: 40 }, { width: 55 }, { width: 48 }, { width: 20 }, { width: 24 }, { width: 24 }, { width: 40 },
      ];

      // Row 1: "PROJECT" section header
      const r1 = ws.addRow(["PROJECT", "", "", "", "", "", ""]);
      ws.mergeCells(r1.number, 1, r1.number, 7);
      r1.getCell(1).fill = sectionHeaderFill;
      r1.getCell(1).font = sectionHeaderFont;
      r1.height = 28;

      // Row 2: Project column header — single dropdown for project selection
      const r2 = ws.addRow(["Project (ID - Name)", "", "", "", "", "", ""]);
      r2.getCell(1).fill = colHeaderFill;
      r2.getCell(1).font = colHeaderFont;
      r2.getCell(1).border = colHeaderBorder;

      // Row 3: Data entry row for project selection
      const dataRow = ws.addRow(["", "", "", "", "", "", ""]);

      ws.addRow([]);

      // Row 5: "COULD HAVE GONE BETTER" section header
      const r5 = ws.addRow(["COULD HAVE GONE BETTER", "", "", "", "", "", ""]);
      ws.mergeCells(r5.number, 1, r5.number, 7);
      r5.getCell(1).fill = sectionHeaderFill;
      r5.getCell(1).font = sectionHeaderFont;
      r5.height = 28;

      // Row 6: Lesson column headers
      const r6 = ws.addRow(["LessonName", "LessonEventDescription", "KeyLearningOrAction", "ProjectPhase", "LessonCategory", "LessonSubcategory", "Impact"]);
      r6.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = colHeaderFont; cell.border = colHeaderBorder; });

      ws.addRow([]);

      // "WENT WELL" section header
      const r10 = ws.addRow(["WENT WELL", "", "", "", "", "", ""]);
      ws.mergeCells(r10.number, 1, r10.number, 7);
      r10.getCell(1).fill = sectionHeaderFill;
      r10.getCell(1).font = sectionHeaderFont;
      r10.height = 28;

      // Lesson column headers for "Went Well"
      const r11 = ws.addRow(["LessonName", "LessonEventDescription", "KeyLearningOrAction", "ProjectPhase", "LessonCategory", "LessonSubcategory", "Impact"]);
      r11.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = colHeaderFont; cell.border = colHeaderBorder; });

      // ── Sheet 2: Reference Data ──
      const refWs = wb.addWorksheet("Reference Data");
      refWs.columns = [{ width: 44 }, { width: 22 }, { width: 28 }, { width: 28 }, { width: 44 }];

      const refHeader = refWs.addRow(["Project (ID - Name)", "ProjectPhase", "LessonCategory", "LessonSubcategory", "Impact"]);
      refHeader.eachCell((cell) => { cell.fill = sectionHeaderFill; cell.font = sectionHeaderFont; });
      refHeader.height = 24;

      const noteRow = refWs.addRow(["Available projects", "Add new values below", "Add new values below", "Add new values below", "Add new values below"]);
      noteRow.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = { italic: true, size: 9, color: { argb: "FF555555" } }; });

      const maxLen = Math.max(projectOptions.length, phases.length, categoryNames.length, allSubcatNames.length, impactNames.length);
      for (let i = 0; i < maxLen; i++) {
        refWs.addRow([
          projectOptions[i] || "",
          phases[i] || "",
          categoryNames[i] || "",
          allSubcatNames[i] || "",
          impactNames[i] || "",
        ]);
      }

      const refDataStart = 3;
      const refDataEnd = refDataStart + maxLen - 1;
      const projRange = `'Reference Data'!$A$${refDataStart}:$A$${refDataEnd}`;
      const phRange = `'Reference Data'!$B$${refDataStart}:$B$${refDataEnd}`;
      const catRange = `'Reference Data'!$C$${refDataStart}:$C$${refDataEnd}`;
      const subRange = `'Reference Data'!$D$${refDataStart}:$D$${refDataEnd}`;
      const impactRange = `'Reference Data'!$E$${refDataStart}:$E$${refDataEnd}`;

      const dropdownValidation = (formula: string): ExcelJS.DataValidation => ({
        type: "list",
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorTitle: "Invalid Value",
        error: "Please select a value from the Reference Data list or add a new one to the Reference Data sheet.",
      });

      // Apply Project dropdown to the project data row
      ws.getCell("A3").dataValidation = dropdownValidation(projRange);

      const lessonDataRows = 50;
      for (let r = r6.number + 1; r <= r6.number + lessonDataRows; r++) {
        ws.getCell(r, 4).dataValidation = dropdownValidation(phRange);
        ws.getCell(r, 5).dataValidation = dropdownValidation(catRange);
        ws.getCell(r, 6).dataValidation = dropdownValidation(subRange);
        ws.getCell(r, 7).dataValidation = dropdownValidation(impactRange);
      }
      for (let r = r11.number + 1; r <= r11.number + lessonDataRows; r++) {
        ws.getCell(r, 4).dataValidation = dropdownValidation(phRange);
        ws.getCell(r, 5).dataValidation = dropdownValidation(catRange);
        ws.getCell(r, 6).dataValidation = dropdownValidation(subRange);
        ws.getCell(r, 7).dataValidation = dropdownValidation(impactRange);
      }

      const buf = await wb.xlsx.writeBuffer();

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="lessons-template.xlsx"');
      res.send(Buffer.from(buf));
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  EXCEL UPLOAD & PARSING
  // ═══════════════════════════════════════════════════════════════════════

  // POST /api/upload – Parse an uploaded Excel file and create project + lessons.
  // Auth: isAuthenticated
  // Middleware: multer single-file upload ("file" field)
  // Processing steps:
  //   1. Read the uploaded .xlsx buffer with the XLSX library
  //   2. Extract valid reference data from the "Reference Data" sheet (if present)
  //   3. Parse project details from the "PROJECT DETAILS" section
  //   4. Parse lessons from "COULD HAVE GONE BETTER" and "WENT WELL" sections
  //   5. Validate all parsed data against reference data and required fields
  //   6. If validation passes, create/find the project and create each lesson
  //   7. Update subcategory scores using the scoring configuration
  //   8. Return { success, lessonsCreated, projectsCreated, errors }
  app.post("/api/upload", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // ── Step 1: Read the Excel workbook ──
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // ── Step 2: Extract reference data from the "Reference Data" sheet ──
      // These sets are used to validate user-entered values in the main sheet
      const validProjectTypes = new Set<string>();
      const validPhases = new Set<string>();
      const validCategories = new Set<string>();
      const validSubcategories = new Set<string>();

      const refSheet = wb.Sheets["Reference Data"];
      if (refSheet) {
        const refRows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(refSheet, { header: 1 });
        // Skip rows 0 (header) and 1 (note row); data starts at row index 2
        for (let i = 2; i < refRows.length; i++) {
          const r = refRows[i];
          if (!r) continue;
          const val0 = r[0] != null ? String(r[0]).trim() : "";
          const val1 = r[1] != null ? String(r[1]).trim() : "";
          const val2 = r[2] != null ? String(r[2]).trim() : "";
          const val3 = r[3] != null ? String(r[3]).trim() : "";
          if (val0) validProjectTypes.add(val0);
          if (val1) validPhases.add(val1);
          if (val2) validCategories.add(val2);
          if (val3) validSubcategories.add(val3);
        }
      }

      const hasRefData = validProjectTypes.size > 0 || validPhases.size > 0 || validCategories.size > 0 || validSubcategories.size > 0;

      const errors: ValidationError[] = [];

      // ── Utility: Convert Excel serial date number to "DD-Mon-YYYY" string ──
      const excelSerialToDate = (serial: number): string => {
        const epoch = new Date(1899, 11, 30);
        const d = new Date(epoch.getTime() + serial * 86400000);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const day = String(d.getDate()).padStart(2, "0");
        return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
      };

      // ── Utility: Safely extract a trimmed string from a cell ──
      const cellStr = (row: (string | number | null | undefined)[], col: number): string => {
        const v = row[col];
        return v != null ? String(v).trim() : "";
      };

      // ── Utility: Extract a date string, handling Excel serial numbers ──
      const cellDateStr = (row: (string | number | null | undefined)[], col: number): string => {
        const v = row[col];
        if (v == null) return "";
        if (typeof v === "number" && v > 30000 && v < 100000) {
          return excelSerialToDate(v);
        }
        return String(v).trim();
      };

      // ── Row-type detection helpers for the state-machine parser ──

      // Detect section headers: "COULD HAVE GONE BETTER" or "WENT WELL"
      const isSectionHeader = (row: (string | number | null | undefined)[]): string | null => {
        const first = cellStr(row, 0).toUpperCase();
        if (first === "COULD HAVE GONE BETTER" || first === "COULD HAVE DONE BETTER") return "CouldHaveGoneBetter";
        if (first === "WENT WELL") return "WentWell";
        return null;
      };

      const isProjectDetailsHeader = (row: (string | number | null | undefined)[]): boolean => {
        const upper = cellStr(row, 0).toUpperCase();
        return upper === "PROJECT DETAILS" || upper === "PROJECT";
      };

      const isLessonHeaderRow = (row: (string | number | null | undefined)[]): boolean => {
        const first = cellStr(row, 0).toLowerCase();
        return first === "lessonname" || first === "lesson name";
      };

      const isProjectHeaderRow = (row: (string | number | null | undefined)[]): boolean => {
        const first = cellStr(row, 0).toLowerCase();
        return first === "projecttype" || first === "project type" || first.startsWith("project (id");
      };

      const isEmpty = (row: (string | number | null | undefined)[]): boolean => {
        return !row || row.every((c) => c == null || String(c).trim() === "");
      };

      // ── State-machine parser state ──
      let projectType = "";
      let projectName = "";
      let projectCloseDate = "";
      let projectManager = "";
      let projectDescription = "";
      let projectCodeFromTemplate = "";
      let currentLessonType: "WentWell" | "CouldHaveGoneBetter" | null = null;
      let expectingLessonHeaders = false;
      let expectingProjectData = false;
      let projectDataFound = false;
      let isNewTemplateFormat = false;

      // Pre-load impact levels for mapping lesson impact strings to DB records
      const allImpactLevels = await storage.getImpactLevels();
      const impactMap = new Map(allImpactLevels.map(il => [il.description.toLowerCase(), il]));

      interface ParsedLesson {
        rowNum: number;
        lessonName: string;
        eventDescription: string;
        keyLearningOrAction: string;
        phase: string;
        category: string;
        subcategory: string;
        impact: string;
        type: "WentWell" | "CouldHaveGoneBetter";
      }

      const parsedLessons: ParsedLesson[] = [];

      // ── Step 3 & 4: Iterate rows using a state machine ──
      // States: looking for PROJECT DETAILS → project header → project data →
      //         section headers (COULD HAVE GONE BETTER / WENT WELL) → lesson rows
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowNum = i + 1;

        if (!row || isEmpty(row)) {
          expectingLessonHeaders = false;
          continue;
        }

        // Detect "PROJECT DETAILS" section header
        if (isProjectDetailsHeader(row)) {
          expectingProjectData = true;
          continue;
        }

        // Skip the project column-header row and detect template format
        if (expectingProjectData && isProjectHeaderRow(row)) {
          const headerText = cellStr(row, 0).toLowerCase();
          if (headerText.startsWith("project (id")) {
            isNewTemplateFormat = true;
          }
          continue;
        }

        // Parse the actual project data row
        if (expectingProjectData && !isProjectHeaderRow(row) && !isProjectDetailsHeader(row)) {
          if (isNewTemplateFormat) {
            // New format: single cell with "PRJ-001 - Project Name"
            const projectSelection = cellStr(row, 0);
            if (!projectSelection) {
              errors.push({ row: rowNum, column: "Project", message: "Project selection is required. Select a project from the dropdown." });
            } else {
              const dashIndex = projectSelection.indexOf(" - ");
              if (dashIndex > 0) {
                projectCodeFromTemplate = projectSelection.substring(0, dashIndex).trim();
                projectName = projectSelection.substring(dashIndex + 3).trim();
              } else {
                projectCodeFromTemplate = projectSelection.trim();
              }
            }
          } else {
            // Legacy format: separate columns for type, name, etc.
            projectType = cellStr(row, 0);
            projectName = cellStr(row, 1);
            projectCloseDate = cellDateStr(row, 2);
            projectManager = cellStr(row, 3);
            projectDescription = cellStr(row, 4);

            if (!projectType) errors.push({ row: rowNum, column: "ProjectType", message: "Project type is required" });
            else if (hasRefData && validProjectTypes.size > 0 && !validProjectTypes.has(projectType)) {
              errors.push({ row: rowNum, column: "ProjectType", message: `"${projectType}" is not in the Reference Data list. Add it to the Reference Data sheet or use an existing value.` });
            }
            if (!projectName) errors.push({ row: rowNum, column: "ProjectName", message: "Project name is required" });
          }
          expectingProjectData = false;
          projectDataFound = true;
          continue;
        }

        // Detect lesson section headers ("COULD HAVE GONE BETTER" / "WENT WELL")
        const sectionType = isSectionHeader(row);
        if (sectionType) {
          currentLessonType = sectionType as "WentWell" | "CouldHaveGoneBetter";
          expectingLessonHeaders = true;
          continue;
        }

        // Skip the lesson column-header row within a section
        if (expectingLessonHeaders && isLessonHeaderRow(row)) {
          expectingLessonHeaders = false;
          continue;
        }

        // ── Step 5: Parse and validate individual lesson rows ──
        if (currentLessonType && !expectingLessonHeaders) {
          const lessonName = cellStr(row, 0);
          const eventDescription = cellStr(row, 1);
          const keyLearningOrAction = cellStr(row, 2);
          const phase = cellStr(row, 3);
          const category = cellStr(row, 4);
          const subcategory = cellStr(row, 5);
          const impact = cellStr(row, 6);

          // Skip fully blank lesson rows
          if (!lessonName && !eventDescription && !phase && !category && !subcategory) continue;

          // Validate required lesson fields
          if (!lessonName) errors.push({ row: rowNum, column: "LessonName", message: "Lesson name is required" });
          if (!phase) errors.push({ row: rowNum, column: "ProjectPhase", message: "Project phase is required" });
          else if (hasRefData && validPhases.size > 0 && !validPhases.has(phase)) {
            errors.push({ row: rowNum, column: "ProjectPhase", message: `"${phase}" is not in the Reference Data list` });
          }
          if (!category) errors.push({ row: rowNum, column: "LessonCategory", message: "Lesson category is required" });
          else if (hasRefData && validCategories.size > 0 && !validCategories.has(category)) {
            errors.push({ row: rowNum, column: "LessonCategory", message: `"${category}" is not in the Reference Data list` });
          }
          if (!subcategory) errors.push({ row: rowNum, column: "LessonSubcategory", message: "Lesson subcategory is required" });
          else if (hasRefData && validSubcategories.size > 0 && !validSubcategories.has(subcategory)) {
            errors.push({ row: rowNum, column: "LessonSubcategory", message: `"${subcategory}" is not in the Reference Data list` });
          }
          if (impact && !impactMap.has(impact.toLowerCase())) {
            errors.push({ row: rowNum, column: "Impact", message: `"${impact}" is not a valid impact level` });
          }

          parsedLessons.push({
            rowNum,
            lessonName,
            eventDescription,
            keyLearningOrAction,
            phase,
            category,
            subcategory,
            impact,
            type: currentLessonType,
          });
        }
      }

      // Ensure project details were found in the spreadsheet
      if (!projectDataFound) {
        errors.push({ row: 1, column: "ProjectDetails", message: "No project details found. Ensure the sheet has a PROJECT DETAILS section." });
      }

      if (parsedLessons.length === 0 && errors.length === 0) {
        errors.push({ row: 1, column: "Lessons", message: "No lessons found. Add lessons under COULD HAVE GONE BETTER and/or WENT WELL sections." });
      }

      // If any validation errors were collected, return them without persisting data
      if (errors.length > 0) {
        return res.json({ success: false, lessonsCreated: 0, projectsCreated: 0, errors });
      }

      // ── Step 6: Persist project and lessons ──
      let lessonsCreated = 0;
      let projectsCreated = 0;
      const userId = req.user?.claims?.sub;
      const scoringCfg = await storage.getScoringConfig();

      // Find existing project (by code for new template, or by name+type for legacy)
      let project;
      if (isNewTemplateFormat && projectCodeFromTemplate) {
        project = await storage.findProjectByCode(projectCodeFromTemplate);
        if (!project) {
          errors.push({ row: 1, column: "Project", message: `Project "${projectCodeFromTemplate}" not found. Create the project first before uploading lessons.` });
          return res.json({ success: false, lessonsCreated: 0, projectsCreated: 0, errors });
        }
      } else {
        project = await storage.findProjectByNameAndType(projectName, projectType);
        if (!project) {
          project = await storage.createProject({
            projectType,
            name: projectName,
            closeDate: projectCloseDate || null,
            projectManager: projectManager || null,
            description: projectDescription || null,
          });
          projectsCreated++;
        }
      }

      // Create each parsed lesson and update subcategory scores
      for (const lesson of parsedLessons) {
        // Find or create the category
        let category = await storage.findCategoryByName(lesson.category);
        if (!category) {
          category = await storage.createCategory({ name: lesson.category, description: null });
        }

        // Find or create the subcategory within that category
        let subcategory = await storage.findSubcategoryByNameAndCategory(lesson.subcategory, category.id);
        if (!subcategory) {
          subcategory = await storage.createSubcategory({
            categoryId: category.id,
            name: lesson.subcategory,
            description: null,
          });
        }

        // Resolve the impact level and compute the weighting multiplier
        const matchedImpact = lesson.impact ? impactMap.get(lesson.impact.toLowerCase()) : undefined;
        const impactId = matchedImpact ? matchedImpact.id : null;
        const weightingMultiplier = matchedImpact ? matchedImpact.weightingPercent / 100 : 1;

        // ── Step 7: Update subcategory score using decay + increment formula ──
        {
          const now = new Date();
          if (!subcategory.firstRecordedDate) {
            // First lesson ever for this subcategory: set initial score
            await storage.createSubcategoryFirstRecorded(subcategory.id, now);
            const initialScore = Math.round(scoringCfg.initialScore * weightingMultiplier);
            await storage.updateSubcategoryScore(subcategory.id, initialScore, now);
          } else {
            // Apply time-decay to existing score, then add the increment
            const lastUpdate = subcategory.lastScoreUpdatedAt ? new Date(subcategory.lastScoreUpdatedAt) : now;
            const daysSince = Math.max(0, Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)));
            const decayed = Math.max(0, (subcategory.currentScore || 0) - daysSince * scoringCfg.dailyDecrement);
            const increment = Math.round(scoringCfg.incrementScore * weightingMultiplier);
            const newScore = decayed + increment;
            await storage.updateSubcategoryScore(subcategory.id, newScore, now);
          }
          // Reload subcategory to get updated score values
          subcategory = (await storage.findSubcategoryByNameAndCategory(lesson.subcategory, category.id))!;
        }

        // Create the lesson record in the database
        await storage.createLesson({
          projectId: project.id,
          subcategoryId: subcategory.id,
          phase: lesson.phase,
          type: lesson.type,
          name: lesson.lessonName,
          eventDescription: lesson.eventDescription || null,
          keyLearningOrAction: lesson.keyLearningOrAction || null,
          impactId,
          createdByUserId: userId || null,
        });
        lessonsCreated++;
      }

      // Auto-update project status when lessons are loaded
      if (lessonsCreated > 0 && project.status === "Project to apply learning to") {
        await storage.updateProjectStatus(project.id, "Live project with learning captured and learning still to be applied");
      }

      res.json({ success: true, lessonsCreated, projectsCreated, errors: [] });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to process upload" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  SCORING CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════

  // GET /api/scoring-config – Return the current scoring formula parameters.
  // Auth: isAuthenticated
  app.get("/api/scoring-config", isAuthenticated, async (_req, res) => {
    try {
      const config = await storage.getScoringConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching scoring config:", error);
      res.status(500).json({ message: "Failed to fetch scoring config" });
    }
  });

  // PATCH /api/scoring-config – Update the scoring formula parameters.
  // Auth: isAuthenticated + isAdmin
  // Body: { initialScore: number, incrementScore: number, dailyDecrement: number }
  // After updating, recalculates all subcategory scores with the new config.
  app.patch("/api/scoring-config", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { initialScore, incrementScore, dailyDecrement } = req.body;
      if (typeof initialScore !== "number" || typeof incrementScore !== "number" || typeof dailyDecrement !== "number") {
        return res.status(400).json({ message: "All scoring values must be numbers" });
      }
      if (initialScore < 0 || incrementScore < 0 || dailyDecrement < 0) {
        return res.status(400).json({ message: "Scoring values must be non-negative" });
      }
      const updated = await storage.updateScoringConfig({ initialScore, incrementScore, dailyDecrement });
      // Recalculate all existing subcategory scores to reflect the new formula
      await storage.recalculateAllScores({ initialScore, incrementScore, dailyDecrement });
      res.json(updated);
    } catch (error) {
      console.error("Error updating scoring config:", error);
      res.status(500).json({ message: "Failed to update scoring config" });
    }
  });

  // POST /api/scoring-config/reset – Reset scoring configuration to application defaults.
  // Auth: isAuthenticated + isAdmin
  // Imports SCORING_DEFAULTS from shared schema and applies them.
  app.post("/api/scoring-config/reset", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const { SCORING_DEFAULTS } = await import("@shared/schema");
      const updated = await storage.updateScoringConfig({
        initialScore: SCORING_DEFAULTS.initialScore,
        incrementScore: SCORING_DEFAULTS.incrementScore,
        dailyDecrement: SCORING_DEFAULTS.dailyDecrement,
      });
      await storage.recalculateAllScores({
        initialScore: SCORING_DEFAULTS.initialScore,
        incrementScore: SCORING_DEFAULTS.incrementScore,
        dailyDecrement: SCORING_DEFAULTS.dailyDecrement,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error resetting scoring config:", error);
      res.status(500).json({ message: "Failed to reset scoring config" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  USER PROFILE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  // Initialize the Object Storage service for profile image ACL management
  const objectStorageService = new ObjectStorageService();

  // GET /api/user/profile – Return the authenticated user's profile.
  // Auth: isAuthenticated
  app.get("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // PATCH /api/user/profile – Update the authenticated user's profile.
  // Auth: isAuthenticated
  // Accepts optional body fields: firstName, lastName, profileImageUrl.
  // When profileImageUrl is provided, normalizes the path and sets a public ACL
  // on the object-storage asset so it can be displayed in the UI.
  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { firstName, lastName, profileImageUrl } = req.body;
      const updateData: { firstName?: string; lastName?: string; profileImageUrl?: string } = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (profileImageUrl !== undefined) {
        if (profileImageUrl) {
          // Normalize the object-storage path and set it as publicly visible
          const normalizedPath = objectStorageService.normalizeObjectEntityPath(profileImageUrl);
          await objectStorageService.trySetObjectEntityAclPolicy(normalizedPath, {
            owner: userId,
            visibility: "public",
          });
          updateData.profileImageUrl = normalizedPath;
        } else {
          updateData.profileImageUrl = profileImageUrl;
        }
      }
      const updated = await storage.updateUserProfile(userId, updateData);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  ADMIN USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  // GET /api/admin/users – Return all users with admin role.
  // Auth: isAuthenticated + isAdmin
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const admins = await storage.getUsersByRole("admin");
      res.json({ admins });
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch admin users" });
    }
  });

  // POST /api/admin/add – Promote an existing user to admin by email.
  // Auth: isAuthenticated + isAdmin
  // The target user must have logged in at least once (must exist in the users table).
  app.post("/api/admin/add", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      const targetUser = await storage.getUserByEmail(email);
      if (!targetUser) return res.status(404).json({ message: "No user found with that email. They must log in at least once first." });

      if (hasAdminRole(targetUser.role)) {
        return res.status(409).json({ message: "User is already an admin" });
      }

      const updated = await storage.setUserRole(targetUser.id, "admin");
      res.json(updated);
    } catch (error) {
      console.error("Error adding admin:", error);
      res.status(500).json({ message: "Failed to add admin" });
    }
  });

  // DELETE /api/admin/remove/:userId – Demote an admin back to regular user.
  // Auth: isAuthenticated + isAdmin
  // Enforces a minimum of 2 admins to prevent accidental lockout.
  app.delete("/api/admin/remove/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const targetUser = await storage.getUserById(userId);
      if (!targetUser || !hasAdminRole(targetUser.role)) {
        return res.status(404).json({ message: "Admin not found" });
      }

      // Safety check: always keep at least 2 admins
      const adminCount = await storage.countUsersByRole("admin");
      if (adminCount <= 2) {
        return res.status(400).json({ message: "Cannot remove admin. There must always be at least 2 admins." });
      }

      const updated = await storage.setUserRole(userId, "user");
      res.json(updated);
    } catch (error) {
      console.error("Error removing admin:", error);
      res.status(500).json({ message: "Failed to remove admin" });
    }
  });

  // GET /api/admin/all-users – Return all users in the system.
  // Auth: isAuthenticated + isAdmin
  app.get("/api/admin/all-users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json({ users: allUsers });
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // POST /api/admin/users – Create a new user by email (admin pre-registration).
  // Auth: isAuthenticated + isAdmin
  // Used to pre-create user accounts before they log in for the first time.
  app.post("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.trim()) {
        return res.status(400).json({ message: "Email is required" });
      }
      const trimmedEmail = email.trim();
      const existing = await storage.getUserByEmail(trimmedEmail);
      if (existing) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }
      const newUser = await storage.createUserByEmail(trimmedEmail);
      res.json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // DELETE /api/admin/users/by-email – Remove a non-admin user by email.
  // Auth: isAuthenticated + isAdmin
  // Guards: Cannot remove admin users (must demote first) or the current user.
  app.delete("/api/admin/users/by-email", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.trim()) {
        return res.status(400).json({ message: "Email is required" });
      }
      const targetUser = await storage.getUserByEmail(email.trim());
      if (!targetUser) {
        return res.status(404).json({ message: "No user found with that email" });
      }
      // Prevent deleting admin accounts (they must be demoted first)
      if (hasAdminRole(targetUser.role)) {
        return res.status(400).json({ message: "Cannot remove an admin user. Demote them first from Admin Accounts." });
      }
      // Prevent self-deletion
      const currentSub = req.user?.claims?.sub;
      if (currentSub && targetUser.id === currentSub) {
        return res.status(400).json({ message: "Cannot remove your own account" });
      }
      await storage.deleteUserByEmail(email.trim());
      res.json({ message: "User removed" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to remove user" });
    }
  });

  // GET /api/admin/users/download – Download all users as a CSV file.
  // Auth: isAuthenticated + isAdmin
  // Generates CSV with columns: UserID, Email, FirstName, LastName, Role, IsAdmin, CreatedAt
  app.get("/api/admin/users/download", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const csvRows = ["UserID,Email,FirstName,LastName,Role,IsAdmin,CreatedAt"];
      for (const u of allUsers) {
        const isAdmin = hasAdminRole(u.role);
        csvRows.push([
          `"${(u.id || "").replace(/"/g, '""')}"`,
          `"${(u.email || "").replace(/"/g, '""')}"`,
          `"${(u.firstName || "").replace(/"/g, '""')}"`,
          `"${(u.lastName || "").replace(/"/g, '""')}"`,
          `"${u.role}"`,
          isAdmin ? "Yes" : "No",
          u.createdAt ? new Date(u.createdAt).toISOString() : "",
        ].join(","));
      }
      const csv = csvRows.join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=users-list.csv");
      res.send(csv);
    } catch (error) {
      console.error("Error downloading users:", error);
      res.status(500).json({ message: "Failed to download users" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  LEARNING APPLICATION ROUTES
  // ═══════════════════════════════════════════════════════════════════════

  // GET /api/learning-applications — Get all learning applications with details
  app.get("/api/learning-applications", isAuthenticated, async (req: any, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId) : undefined;
      const apps = await storage.getLearningApplicationsWithDetails(projectId);
      res.json(apps);
    } catch (error) {
      console.error("Error fetching learning applications:", error);
      res.status(500).json({ message: "Failed to fetch learning applications" });
    }
  });

  // POST /api/learning-applications — Apply lesson subcategories to a project
  app.post("/api/learning-applications", isAuthenticated, async (req: any, res) => {
    try {
      const { projectId, subcategoryIds } = req.body;
      if (!projectId || !subcategoryIds || !Array.isArray(subcategoryIds)) {
        return res.status(400).json({ message: "projectId and subcategoryIds array are required" });
      }
      const userId = req.user?.claims?.sub;
      const existing = await storage.getLearningApplications(projectId);
      const existingSubIds = new Set(existing.map(a => a.subcategoryId));
      const created = [];
      for (const subcategoryId of subcategoryIds) {
        const subId = parseInt(subcategoryId);
        if (isNaN(subId)) continue;
        if (existingSubIds.has(subId)) continue;
        const app = await storage.createLearningApplication({
          projectId: parseInt(projectId),
          subcategoryId: subId,
          appliedByUserId: userId || null,
        });
        created.push(app);
        existingSubIds.add(subId);
      }
      res.json({ created: created.length, applications: created });
    } catch (error) {
      console.error("Error creating learning applications:", error);
      res.status(500).json({ message: "Failed to create learning applications" });
    }
  });

  // DELETE /api/learning-applications/:id — Remove a learning application
  app.delete("/api/learning-applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteLearningApplication(id);
      res.json({ message: "Learning application removed" });
    } catch (error) {
      console.error("Error deleting learning application:", error);
      res.status(500).json({ message: "Failed to delete learning application" });
    }
  });

  return httpServer;
}
