import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import multer from "multer";
import * as XLSX from "xlsx";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

  app.get("/api/projects", isAuthenticated, async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
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

  app.get("/api/subcategories", isAuthenticated, async (_req, res) => {
    try {
      const subcategories = await storage.getSubcategories();
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      res.status(500).json({ message: "Failed to fetch subcategories" });
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

  app.get("/api/template", isAuthenticated, async (_req, res) => {
    try {
      const headers = [
        "ProjectType", "ProjectName", "ProjectCloseDate", "ProjectManager",
        "ProjectDescription", "LessonType", "LessonName", "LessonEventDescription",
        "KeyLearningOrAction", "ProjectPhase", "LessonCategory", "LessonSubcategory",
      ];

      const exampleRow = [
        "IT Change", "ERP Migration", "2025-06-30", "Jane Smith",
        "Migration of legacy ERP system", "CouldHaveGoneBetter", "Unclear requirements from finance dept",
        "Finance team was not consulted early enough, leading to rework", "Engage all stakeholders in discovery phase",
        "Planning", "Governance", "Requirements Clarity",
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);

      const colWidths = headers.map((h) => ({ wch: Math.max(h.length + 2, 20) }));
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Lessons Template");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="lessons-template.xlsx"');
      res.send(buf);
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
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      const errors: ValidationError[] = [];
      const requiredFields = ["ProjectType", "ProjectName", "LessonType", "LessonName", "ProjectPhase", "LessonCategory", "LessonSubcategory"];

      rows.forEach((row, idx) => {
        const rowNum = idx + 2;
        requiredFields.forEach((field) => {
          if (!row[field] || String(row[field]).trim() === "") {
            errors.push({ row: rowNum, column: field, message: `${field} is required` });
          }
        });

        if (row["LessonType"] && !["WentWell", "CouldHaveGoneBetter"].includes(String(row["LessonType"]).trim())) {
          errors.push({ row: rowNum, column: "LessonType", message: 'Must be "WentWell" or "CouldHaveGoneBetter"' });
        }
      });

      if (errors.length > 0) {
        return res.json({ success: false, lessonsCreated: 0, projectsCreated: 0, errors });
      }

      let lessonsCreated = 0;
      let projectsCreated = 0;
      const userId = req.user?.claims?.sub;

      for (const row of rows) {
        const projectType = String(row["ProjectType"]).trim();
        const projectName = String(row["ProjectName"]).trim();
        const categoryName = String(row["LessonCategory"]).trim();
        const subcategoryName = String(row["LessonSubcategory"]).trim();
        const lessonType = String(row["LessonType"]).trim() as "WentWell" | "CouldHaveGoneBetter";

        let project = await storage.findProjectByNameAndType(projectName, projectType);
        if (!project) {
          project = await storage.createProject({
            projectType,
            name: projectName,
            closeDate: row["ProjectCloseDate"] ? String(row["ProjectCloseDate"]).trim() : null,
            projectManager: row["ProjectManager"] ? String(row["ProjectManager"]).trim() : null,
            description: row["ProjectDescription"] ? String(row["ProjectDescription"]).trim() : null,
          });
          projectsCreated++;
        }

        let category = await storage.findCategoryByName(categoryName);
        if (!category) {
          category = await storage.createCategory({ name: categoryName, description: null });
        }

        let subcategory = await storage.findSubcategoryByNameAndCategory(subcategoryName, category.id);
        if (!subcategory) {
          subcategory = await storage.createSubcategory({
            categoryId: category.id,
            name: subcategoryName,
            description: null,
          });
        }

        if (lessonType === "CouldHaveGoneBetter") {
          const now = new Date();
          if (!subcategory.firstRecordedDate) {
            await storage.createSubcategoryFirstRecorded(subcategory.id, now);
            await storage.updateSubcategoryScore(subcategory.id, 1000, now);
          } else {
            const lastUpdate = subcategory.lastScoreUpdatedAt ? new Date(subcategory.lastScoreUpdatedAt) : now;
            const daysSince = Math.max(0, Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)));
            const decayed = Math.max(0, (subcategory.currentScore || 0) - daysSince);
            const newScore = decayed + 200;
            await storage.updateSubcategoryScore(subcategory.id, newScore, now);
          }
          subcategory = (await storage.findSubcategoryByNameAndCategory(subcategoryName, category.id))!;
        }

        await storage.createLesson({
          projectId: project.id,
          subcategoryId: subcategory.id,
          phase: String(row["ProjectPhase"]).trim(),
          type: lessonType,
          name: String(row["LessonName"]).trim(),
          eventDescription: row["LessonEventDescription"] ? String(row["LessonEventDescription"]).trim() : null,
          keyLearningOrAction: row["KeyLearningOrAction"] ? String(row["KeyLearningOrAction"]).trim() : null,
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

  return httpServer;
}
