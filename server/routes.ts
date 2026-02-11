import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import multer from "multer";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

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
      const allCategories = await storage.getCategories();
      const allSubcategories = await storage.getSubcategories();

      const projectTypes = ["IT Change", "Construction", "Business Change", "Infrastructure", "Software Development", "Organizational"];
      const phases = ["Initiation", "Planning", "Delivery", "Close-out"];
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

      ws.columns = [
        { width: 40 }, { width: 55 }, { width: 48 }, { width: 20 }, { width: 24 }, { width: 24 },
      ];

      const r1 = ws.addRow(["PROJECT DETAILS", "", "", "", "", ""]);
      ws.mergeCells(r1.number, 1, r1.number, 6);
      r1.getCell(1).fill = sectionHeaderFill;
      r1.getCell(1).font = sectionHeaderFont;
      r1.height = 28;

      const r2 = ws.addRow(["ProjectType", "ProjectName", "ProjectCloseDate", "ProjectManager", "ProjectDescription", ""]);
      r2.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = colHeaderFont; cell.border = colHeaderBorder; });

      ws.addRow(["IT Change", "ERP Migration", "2025-06-30", "Jane Smith", "Migration of legacy ERP system", ""]);

      ws.addRow([]);

      const r5 = ws.addRow(["COULD HAVE GONE BETTER", "", "", "", "", ""]);
      ws.mergeCells(r5.number, 1, r5.number, 6);
      r5.getCell(1).fill = sectionHeaderFill;
      r5.getCell(1).font = sectionHeaderFont;
      r5.height = 28;

      const r6 = ws.addRow(["LessonName", "LessonEventDescription", "KeyLearningOrAction", "ProjectPhase", "LessonCategory", "LessonSubcategory"]);
      r6.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = colHeaderFont; cell.border = colHeaderBorder; });

      ws.addRow(["Unclear requirements from finance dept", "Finance team was not consulted early enough, leading to rework", "Engage all stakeholders in discovery phase", "Planning", "Governance", "Requirements Clarity"]);
      ws.addRow(["Data migration timeline underestimated", "Legacy data cleansing took 3x longer than estimated", "Run data profiling before estimating timelines", "Planning", "Planning", "Timeline Estimation"]);

      ws.addRow([]);

      const r10 = ws.addRow(["WENT WELL", "", "", "", "", ""]);
      ws.mergeCells(r10.number, 1, r10.number, 6);
      r10.getCell(1).fill = sectionHeaderFill;
      r10.getCell(1).font = sectionHeaderFont;
      r10.height = 28;

      const r11 = ws.addRow(["LessonName", "LessonEventDescription", "KeyLearningOrAction", "ProjectPhase", "LessonCategory", "LessonSubcategory"]);
      r11.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = colHeaderFont; cell.border = colHeaderBorder; });

      ws.addRow(["Automated regression testing suite", "Team invested in building comprehensive automated tests early", "Allocate 20% of development effort to test automation", "Delivery", "Execution", "Testing & QA"]);

      const refWs = wb.addWorksheet("Reference Data");
      refWs.columns = [{ width: 28 }, { width: 22 }, { width: 28 }, { width: 28 }];

      const refHeader = refWs.addRow(["ProjectType", "ProjectPhase", "LessonCategory", "LessonSubcategory"]);
      refHeader.eachCell((cell) => { cell.fill = sectionHeaderFill; cell.font = sectionHeaderFont; });
      refHeader.height = 24;

      const noteRow = refWs.addRow(["Add new values below", "Add new values below", "Add new values below", "Add new values below"]);
      noteRow.eachCell((cell) => { cell.fill = colHeaderFill; cell.font = { italic: true, size: 9, color: { argb: "FF555555" } }; });

      const maxLen = Math.max(projectTypes.length, phases.length, categoryNames.length, allSubcatNames.length);
      for (let i = 0; i < maxLen; i++) {
        refWs.addRow([
          projectTypes[i] || "",
          phases[i] || "",
          categoryNames[i] || "",
          allSubcatNames[i] || "",
        ]);
      }

      const refDataStart = 3;
      const refDataEnd = refDataStart + maxLen - 1;
      const ptRange = `'Reference Data'!$A$${refDataStart}:$A$${refDataEnd}`;
      const phRange = `'Reference Data'!$B$${refDataStart}:$B$${refDataEnd}`;
      const catRange = `'Reference Data'!$C$${refDataStart}:$C$${refDataEnd}`;
      const subRange = `'Reference Data'!$D$${refDataStart}:$D$${refDataEnd}`;

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
      }
      for (let r = r11.number + 1; r <= r11.number + lessonDataRows; r++) {
        ws.getCell(r, 4).dataValidation = dropdownValidation(phRange);
        ws.getCell(r, 5).dataValidation = dropdownValidation(catRange);
        ws.getCell(r, 6).dataValidation = dropdownValidation(subRange);
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

      const cellStr = (row: (string | number | null | undefined)[], col: number): string => {
        const v = row[col];
        return v != null ? String(v).trim() : "";
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

      interface ParsedLesson {
        rowNum: number;
        lessonName: string;
        eventDescription: string;
        keyLearningOrAction: string;
        phase: string;
        category: string;
        subcategory: string;
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
          projectCloseDate = cellStr(row, 2);
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

          parsedLessons.push({
            rowNum,
            lessonName,
            eventDescription,
            keyLearningOrAction,
            phase,
            category,
            subcategory,
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

        if (lesson.type === "CouldHaveGoneBetter") {
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
