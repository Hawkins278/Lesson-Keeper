import { storage } from "./storage";
import { db } from "./db";
import { lessons, referenceValues } from "@shared/schema";
import { sql } from "drizzle-orm";

async function seedReferenceValues() {
  const existing = await db.select({ count: sql<number>`count(*)` }).from(referenceValues);
  if (Number(existing[0].count) > 0) return;

  const projectTypes = ["IT Change", "Construction", "Business Change", "Infrastructure", "Software Development", "Organizational"];
  const phases = ["Initiation", "Planning", "Delivery", "Close-out"];

  for (const v of projectTypes) {
    await storage.createReferenceValue({ type: "ProjectType", value: v });
  }
  for (const v of phases) {
    await storage.createReferenceValue({ type: "ProjectPhase", value: v });
  }
  console.log("Seeded reference values: project types and phases");
}

export async function seedDatabase() {
  await seedReferenceValues();

  const existingLessons = await db.select({ count: sql<number>`count(*)` }).from(lessons);
  if (Number(existingLessons[0].count) > 0) {
    return;
  }

  console.log("Seeding database with example data...");

  const cat1 = await storage.createCategory({ name: "Governance", description: "Project governance and oversight" });
  const cat2 = await storage.createCategory({ name: "Planning", description: "Project planning and scheduling" });
  const cat3 = await storage.createCategory({ name: "Execution", description: "Project delivery and execution" });
  const cat4 = await storage.createCategory({ name: "Communication", description: "Stakeholder and team communication" });

  const sub1 = await storage.createSubcategory({ categoryId: cat1.id, name: "Requirements Clarity", description: "Clarity and completeness of requirements" });
  const sub2 = await storage.createSubcategory({ categoryId: cat1.id, name: "Decision Making", description: "Timeliness and quality of decisions" });
  const sub3 = await storage.createSubcategory({ categoryId: cat2.id, name: "Resource Planning", description: "Adequacy of resource allocation" });
  const sub4 = await storage.createSubcategory({ categoryId: cat2.id, name: "Timeline Estimation", description: "Accuracy of project timelines" });
  const sub5 = await storage.createSubcategory({ categoryId: cat3.id, name: "Testing & QA", description: "Quality assurance processes" });
  const sub6 = await storage.createSubcategory({ categoryId: cat3.id, name: "Change Management", description: "Managing scope and process changes" });
  const sub7 = await storage.createSubcategory({ categoryId: cat4.id, name: "Stakeholder Engagement", description: "Engaging project stakeholders" });
  const sub8 = await storage.createSubcategory({ categoryId: cat4.id, name: "Team Collaboration", description: "Internal team working practices" });

  const now = new Date();

  await storage.updateSubcategoryScore(sub1.id, 1200, now);
  await storage.createSubcategoryFirstRecorded(sub1.id, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  await storage.updateSubcategoryScore(sub7.id, 1000, now);
  await storage.createSubcategoryFirstRecorded(sub7.id, new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000));
  await storage.updateSubcategoryScore(sub4.id, 800, now);
  await storage.createSubcategoryFirstRecorded(sub4.id, new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000));
  await storage.updateSubcategoryScore(sub6.id, 400, now);
  await storage.createSubcategoryFirstRecorded(sub6.id, new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000));

  const proj1 = await storage.createProject({
    projectType: "IT Change",
    name: "ERP Migration Phase 2",
    closeDate: "2025-09-30",
    projectManager: "Sarah Chen",
    description: "Migration of legacy ERP modules to cloud-based SAP S/4HANA platform",
  });

  const proj2 = await storage.createProject({
    projectType: "Construction",
    name: "HQ Building Renovation",
    closeDate: "2025-12-15",
    projectManager: "Michael Torres",
    description: "Complete renovation of floors 3-5 including open plan workspace conversion",
  });

  const proj3 = await storage.createProject({
    projectType: "Software Development",
    name: "Customer Portal v3",
    closeDate: "2025-07-01",
    projectManager: "Priya Sharma",
    description: "Redesign and rebuild of customer-facing portal with self-service capabilities",
  });

  const proj4 = await storage.createProject({
    projectType: "Business Change",
    name: "APAC Market Expansion",
    closeDate: "2026-03-31",
    projectManager: "David Kim",
    description: "Strategic expansion into three new APAC markets with local partnerships",
  });

  const proj5 = await storage.createProject({
    projectType: "IT Change",
    name: "Cloud Security Audit",
    closeDate: "2025-04-15",
    projectManager: "Lisa Rodriguez",
    description: "Comprehensive security audit and remediation of cloud infrastructure",
  });

  const seedLessons = [
    { projectId: proj1.id, subcategoryId: sub1.id, phase: "Planning", type: "CouldHaveGoneBetter" as const, name: "Finance team requirements missed", eventDescription: "The finance department was not engaged during initial requirements gathering, leading to significant rework when their data migration needs were identified late.", keyLearningOrAction: "Create a comprehensive stakeholder map at project initiation and ensure all departments with data dependencies are consulted." },
    { projectId: proj1.id, subcategoryId: sub1.id, phase: "Delivery", type: "CouldHaveGoneBetter" as const, name: "Unclear integration specifications", eventDescription: "Third-party API integration requirements were vaguely documented, causing two sprints of rework when actual API limitations were discovered.", keyLearningOrAction: "Conduct technical spike sessions for all integrations before committing to delivery timelines." },
    { projectId: proj3.id, subcategoryId: sub1.id, phase: "Initiation", type: "CouldHaveGoneBetter" as const, name: "Accessibility requirements added late", eventDescription: "WCAG 2.1 AA compliance was not included in original requirements and was only identified during UAT.", keyLearningOrAction: "Include accessibility requirements as a standard item in all project charters for customer-facing systems." },
    { projectId: proj2.id, subcategoryId: sub7.id, phase: "Planning", type: "CouldHaveGoneBetter" as const, name: "Tenant communication plan delayed", eventDescription: "Building tenants on affected floors were not informed of renovation schedule until two weeks before work began, causing complaints.", keyLearningOrAction: "Develop communication plan as part of project initiation, not as a follow-up activity." },
    { projectId: proj4.id, subcategoryId: sub7.id, phase: "Delivery", type: "CouldHaveGoneBetter" as const, name: "Local partner expectations misaligned", eventDescription: "Distribution partners in two markets had different expectations about exclusivity terms than what was discussed.", keyLearningOrAction: "Document all verbal agreements in writing immediately and share meeting minutes within 24 hours." },
    { projectId: proj1.id, subcategoryId: sub4.id, phase: "Planning", type: "CouldHaveGoneBetter" as const, name: "Data migration timeline underestimated", eventDescription: "Legacy data cleansing took 3x longer than estimated due to undocumented data quality issues.", keyLearningOrAction: "Run data profiling and quality assessment before estimating migration timelines." },
    { projectId: proj3.id, subcategoryId: sub4.id, phase: "Planning", type: "CouldHaveGoneBetter" as const, name: "Sprint velocity overestimated", eventDescription: "Team velocity was projected based on experienced developers, but two junior members joined mid-project.", keyLearningOrAction: "Factor in team composition changes when forecasting velocity for future sprints." },
    { projectId: proj2.id, subcategoryId: sub6.id, phase: "Delivery", type: "CouldHaveGoneBetter" as const, name: "Scope creep on electrical work", eventDescription: "Additional electrical work was requested by facilities team without going through formal change control.", keyLearningOrAction: "Enforce change control process for all scope additions regardless of perceived size." },
    { projectId: proj3.id, subcategoryId: sub5.id, phase: "Delivery", type: "WentWell" as const, name: "Automated regression testing suite", eventDescription: "Team invested in building comprehensive automated tests early, which caught 40+ issues before UAT.", keyLearningOrAction: "Allocate 20% of development effort to test automation from sprint 1." },
    { projectId: proj5.id, subcategoryId: sub5.id, phase: "Delivery", type: "WentWell" as const, name: "Penetration testing early engagement", eventDescription: "Security team was engaged for penetration testing from the second sprint, not just at the end.", keyLearningOrAction: "Embed security testing throughout the delivery lifecycle, not just at the end." },
    { projectId: proj1.id, subcategoryId: sub8.id, phase: "Delivery", type: "WentWell" as const, name: "Cross-functional war room effective", eventDescription: "Daily 30-minute cross-functional standups during critical migration weekends prevented blockers.", keyLearningOrAction: "Establish war room protocols for critical project phases with representation from all teams." },
    { projectId: proj4.id, subcategoryId: sub8.id, phase: "Planning", type: "WentWell" as const, name: "Virtual collaboration tools adopted", eventDescription: "Using Miro and shared workspaces allowed APAC and HQ teams to collaborate effectively across time zones.", keyLearningOrAction: "Invest in async-friendly collaboration tools for geographically distributed projects." },
    { projectId: proj2.id, subcategoryId: sub2.id, phase: "Initiation", type: "WentWell" as const, name: "Rapid decision framework implemented", eventDescription: "RACI matrix and decision escalation paths were established in week 1, preventing decision bottlenecks.", keyLearningOrAction: "Define decision-making authority and escalation paths in the project charter." },
    { projectId: proj5.id, subcategoryId: sub3.id, phase: "Planning", type: "WentWell" as const, name: "Security specialist secondment", eventDescription: "Securing a dedicated security specialist for the audit duration ensured consistent expertise.", keyLearningOrAction: "For specialized projects, secure dedicated expertise rather than shared resources." },
    { projectId: proj3.id, subcategoryId: sub7.id, phase: "Close-out", type: "WentWell" as const, name: "Customer feedback sessions", eventDescription: "Post-launch feedback sessions with key customers provided valuable input for the next iteration.", keyLearningOrAction: "Schedule structured feedback sessions within 2 weeks of go-live for customer-facing deliverables." },
  ];

  for (const lesson of seedLessons) {
    await storage.createLesson({
      ...lesson,
      createdByUserId: null,
    });
  }

  console.log("Seed data created: 5 projects, 4 categories, 8 subcategories, 15 lessons");
}
