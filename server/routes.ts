import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import multer from "multer";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import type { UserRole } from "@shared/models/auth";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function hasAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === "admin" || normalized === "superadmin" || normalized === "superadministrator";
}

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

interface ValidationError {
  row: number;
  column: string;
  message: string;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  registerObjectStorageRoutes(app);

  app.get("/api/projects", isAuthenticated, async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });
      const { name, projectType, closeDate, projectManager, description } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (projectType !== undefined) updateData.projectType = projectType;
      if (closeDate !== undefined) updateData.closeDate = closeDate;
      if (projectManager !== undefined) updateData.projectManager = projectManager;
      if (description !== undefined) updateData.description = description;
      const updated = await storage.updateProject(id, updateData);
      if (!updated) return res.status(404).json({ message: "Project not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

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

  app.get("/api/categories", isAuthenticated, async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/public/top-subcategories", async (_req, res) => {
    try {
      const subcategories = await storage.getSubcategories();
      const categories = await storage.getCategories();
      const catMap = new Map(categories.map(c => [c.id, c]));
      const now = new Date();
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

  app.get("/api/subcategories", isAuthenticated, async (_req, res) => {
    try {
      const subcategories = await storage.getSubcategories();
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      res.status(500).json({ message: "Failed to fetch subcategories" });
    }
  });

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

  app.get("/api/lessons", isAuthenticated, async (_req, res) => {
    try {
      const lessons = await storage.getLessons();
      res.json(lessons);
    } catch (error) {
      console.error("Error fetching lessons:", error);
      res.status(500).json({ message: "Failed to fetch lessons" });
    }
  });

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

  app.get("/api/impact-levels", isAuthenticated, async (_req, res) => {
    try {
      const levels = await storage.getImpactLevels();
      res.json(levels);
    } catch (error) {
      console.error("Error fetching impact levels:", error);
      res.status(500).json({ message: "Failed to fetch impact levels" });
    }
  });

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

  app.patch("/api/impact-levels/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const { description, weightingPercent, sortOrder } = req.body;

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

  app.post("/api/reference-data/:type", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { type } = req.params;
      const { value } = req.body;
      if (!value || typeof value !== "string" || !value.trim()) {
        return res.status(400).json({ message: "Value is required" });
      }
      const trimmed = value.trim();

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

  app.get("/api/reference-data/usage", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const ptValues = await storage.getReferenceValues("ProjectType");
      const phValues = await storage.getReferenceValues("ProjectPhase");
      const categories = await storage.getCategories();
      const subcategories = await storage.getSubcategories();
      const impacts = await storage.getImpactLevels();

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

  app.get("/api/template", isAuthenticated, async (_req, res) => {
    try {
      const allCategories = await storage.getCategories();
      const allSubcategories = await storage.getSubcategories();

      const ptValues = await storage.getReferenceValues("ProjectType");
      const phValues = await storage.getReferenceValues("ProjectPhase");
      const projectTypes = ptValues.length > 0
        ? ptValues.map((v) => v.value)
        : ["IT Change", "Construction", "Business Change", "Infrastructure", "Software Development", "Organizational"];
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

      const r1 = ws.addRow(["PROJECT DETAILS", "", "", "", "", "", ""]);
      ws.mergeCells(r1.number, 1, r1.number, 7);
      r1.getCell(1).fill = sectionHeaderFill;
      r1.getCell(1).font = sectionHeaderFont;
      r1.height = 28;

      const r2 = ws.addRow(["ProjectType", "ProjectName", "ProjectCloseDate", "ProjectManager", "ProjectDescription", "", ""]);
      r2.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = colHeaderFont; cell.border = colHeaderBorder; });

      const dataRow = ws.addRow(["", "", "", "", "", "", ""]);
      dataRow.getCell(3).numFmt = "@";

      ws.addRow([]);

      const r5 = ws.addRow(["COULD HAVE GONE BETTER", "", "", "", "", "", ""]);
      ws.mergeCells(r5.number, 1, r5.number, 7);
      r5.getCell(1).fill = sectionHeaderFill;
      r5.getCell(1).font = sectionHeaderFont;
      r5.height = 28;

      const r6 = ws.addRow(["LessonName", "LessonEventDescription", "KeyLearningOrAction", "ProjectPhase", "LessonCategory", "LessonSubcategory", "Impact"]);
      r6.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = colHeaderFont; cell.border = colHeaderBorder; });

      ws.addRow([]);

      const r10 = ws.addRow(["WENT WELL", "", "", "", "", "", ""]);
      ws.mergeCells(r10.number, 1, r10.number, 7);
      r10.getCell(1).fill = sectionHeaderFill;
      r10.getCell(1).font = sectionHeaderFont;
      r10.height = 28;

      const r11 = ws.addRow(["LessonName", "LessonEventDescription", "KeyLearningOrAction", "ProjectPhase", "LessonCategory", "LessonSubcategory", "Impact"]);
      r11.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = colHeaderFont; cell.border = colHeaderBorder; });

      const refWs = wb.addWorksheet("Reference Data");
      refWs.columns = [{ width: 28 }, { width: 22 }, { width: 28 }, { width: 28 }, { width: 44 }];

      const refHeader = refWs.addRow(["ProjectType", "ProjectPhase", "LessonCategory", "LessonSubcategory", "Impact"]);
      refHeader.eachCell((cell) => { cell.fill = sectionHeaderFill; cell.font = sectionHeaderFont; });
      refHeader.height = 24;

      const noteRow = refWs.addRow(["Add new values below", "Add new values below", "Add new values below", "Add new values below", "Add new values below"]);
      noteRow.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = { italic: true, size: 9, color: { argb: "FF555555" } }; });

      const maxLen = Math.max(projectTypes.length, phases.length, categoryNames.length, allSubcatNames.length, impactNames.length);
      for (let i = 0; i < maxLen; i++) {
        refWs.addRow([
          projectTypes[i] || "",
          phases[i] || "",
          categoryNames[i] || "",
          allSubcatNames[i] || "",
          impactNames[i] || "",
        ]);
      }

      const refDataStart = 3;
      const refDataEnd = refDataStart + maxLen - 1;
      const ptRange = `'Reference Data'!$A$${refDataStart}:$A$${refDataEnd}`;
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

      ws.getCell("A3").dataValidation = dropdownValidation(ptRange);

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

  app.post("/api/upload", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const validProjectTypes = new Set<string>();
      const validPhases = new Set<string>();
      const validCategories = new Set<string>();
      const validSubcategories = new Set<string>();

      const refSheet = wb.Sheets["Reference Data"];
      if (refSheet) {
        const refRows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(refSheet, { header: 1 });
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

      const excelSerialToDate = (serial: number): string => {
        const epoch = new Date(1899, 11, 30);
        const d = new Date(epoch.getTime() + serial * 86400000);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const day = String(d.getDate()).padStart(2, "0");
        return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
      };

      const cellStr = (row: (string | number | null | undefined)[], col: number): string => {
        const v = row[col];
        return v != null ? String(v).trim() : "";
      };

      const cellDateStr = (row: (string | number | null | undefined)[], col: number): string => {
        const v = row[col];
        if (v == null) return "";
        if (typeof v === "number" && v > 30000 && v < 100000) {
          return excelSerialToDate(v);
        }
        return String(v).trim();
      };

      const isSectionHeader = (row: (string | number | null | undefined)[]): string | null => {
        const first = cellStr(row, 0).toUpperCase();
        if (first === "COULD HAVE GONE BETTER" || first === "COULD HAVE DONE BETTER") return "CouldHaveGoneBetter";
        if (first === "WENT WELL") return "WentWell";
        return null;
      };

      const isProjectDetailsHeader = (row: (string | number | null | undefined)[]): boolean => {
        return cellStr(row, 0).toUpperCase() === "PROJECT DETAILS";
      };

      const isLessonHeaderRow = (row: (string | number | null | undefined)[]): boolean => {
        const first = cellStr(row, 0).toLowerCase();
        return first === "lessonname" || first === "lesson name";
      };

      const isProjectHeaderRow = (row: (string | number | null | undefined)[]): boolean => {
        const first = cellStr(row, 0).toLowerCase();
        return first === "projecttype" || first === "project type";
      };

      const isEmpty = (row: (string | number | null | undefined)[]): boolean => {
        return !row || row.every((c) => c == null || String(c).trim() === "");
      };

      let projectType = "";
      let projectName = "";
      let projectCloseDate = "";
      let projectManager = "";
      let projectDescription = "";
      let currentLessonType: "WentWell" | "CouldHaveGoneBetter" | null = null;
      let expectingLessonHeaders = false;
      let expectingProjectData = false;
      let projectDataFound = false;

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

      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowNum = i + 1;

        if (!row || isEmpty(row)) {
          expectingLessonHeaders = false;
          continue;
        }

        if (isProjectDetailsHeader(row)) {
          expectingProjectData = true;
          continue;
        }

        if (expectingProjectData && isProjectHeaderRow(row)) {
          continue;
        }

        if (expectingProjectData && !isProjectHeaderRow(row) && !isProjectDetailsHeader(row)) {
          projectType = cellStr(row, 0);
          projectName = cellStr(row, 1);
          projectCloseDate = cellDateStr(row, 2);
          projectManager = cellStr(row, 3);
          projectDescription = cellStr(row, 4);
          expectingProjectData = false;
          projectDataFound = true;

          if (!projectType) errors.push({ row: rowNum, column: "ProjectType", message: "Project type is required" });
          else if (hasRefData && validProjectTypes.size > 0 && !validProjectTypes.has(projectType)) {
            errors.push({ row: rowNum, column: "ProjectType", message: `"${projectType}" is not in the Reference Data list. Add it to the Reference Data sheet or use an existing value.` });
          }
          if (!projectName) errors.push({ row: rowNum, column: "ProjectName", message: "Project name is required" });
          continue;
        }

        const sectionType = isSectionHeader(row);
        if (sectionType) {
          currentLessonType = sectionType as "WentWell" | "CouldHaveGoneBetter";
          expectingLessonHeaders = true;
          continue;
        }

        if (expectingLessonHeaders && isLessonHeaderRow(row)) {
          expectingLessonHeaders = false;
          continue;
        }

        if (currentLessonType && !expectingLessonHeaders) {
          const lessonName = cellStr(row, 0);
          const eventDescription = cellStr(row, 1);
          const keyLearningOrAction = cellStr(row, 2);
          const phase = cellStr(row, 3);
          const category = cellStr(row, 4);
          const subcategory = cellStr(row, 5);
          const impact = cellStr(row, 6);

          if (!lessonName && !eventDescription && !phase && !category && !subcategory) continue;

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

      if (!projectDataFound) {
        errors.push({ row: 1, column: "ProjectDetails", message: "No project details found. Ensure the sheet has a PROJECT DETAILS section." });
      }

      if (parsedLessons.length === 0 && errors.length === 0) {
        errors.push({ row: 1, column: "Lessons", message: "No lessons found. Add lessons under COULD HAVE GONE BETTER and/or WENT WELL sections." });
      }

      if (errors.length > 0) {
        return res.json({ success: false, lessonsCreated: 0, projectsCreated: 0, errors });
      }

      let lessonsCreated = 0;
      let projectsCreated = 0;
      const userId = req.user?.claims?.sub;

      let project = await storage.findProjectByNameAndType(projectName, projectType);
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

      for (const lesson of parsedLessons) {
        let category = await storage.findCategoryByName(lesson.category);
        if (!category) {
          category = await storage.createCategory({ name: lesson.category, description: null });
        }

        let subcategory = await storage.findSubcategoryByNameAndCategory(lesson.subcategory, category.id);
        if (!subcategory) {
          subcategory = await storage.createSubcategory({
            categoryId: category.id,
            name: lesson.subcategory,
            description: null,
          });
        }

        const matchedImpact = lesson.impact ? impactMap.get(lesson.impact.toLowerCase()) : undefined;
        const impactId = matchedImpact ? matchedImpact.id : null;
        const weightingMultiplier = matchedImpact ? matchedImpact.weightingPercent / 100 : 1;

        {
          const now = new Date();
          if (!subcategory.firstRecordedDate) {
            await storage.createSubcategoryFirstRecorded(subcategory.id, now);
            const initialScore = Math.round(500 * weightingMultiplier);
            await storage.updateSubcategoryScore(subcategory.id, initialScore, now);
          } else {
            const lastUpdate = subcategory.lastScoreUpdatedAt ? new Date(subcategory.lastScoreUpdatedAt) : now;
            const daysSince = Math.max(0, Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)));
            const decayed = Math.max(0, (subcategory.currentScore || 0) - daysSince);
            const increment = Math.round(250 * weightingMultiplier);
            const newScore = decayed + increment;
            await storage.updateSubcategoryScore(subcategory.id, newScore, now);
          }
          subcategory = (await storage.findSubcategoryByNameAndCategory(lesson.subcategory, category.id))!;
        }

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

      res.json({ success: true, lessonsCreated, projectsCreated, errors: [] });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to process upload" });
    }
  });

  const objectStorageService = new ObjectStorageService();

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

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const admins = await storage.getUsersByRole("admin");
      res.json({ admins });
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch admin users" });
    }
  });

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

  app.delete("/api/admin/remove/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const targetUser = await storage.getUserById(userId);
      if (!targetUser || !hasAdminRole(targetUser.role)) {
        return res.status(404).json({ message: "Admin not found" });
      }

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

  app.get("/api/admin/all-users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json({ users: allUsers });
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

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
      if (hasAdminRole(targetUser.role)) {
        return res.status(400).json({ message: "Cannot remove an admin user. Demote them first from Admin Accounts." });
      }
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

  return httpServer;
}
