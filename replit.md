# LessonKeeper - Lessons Learned Knowledge Base

## Overview
A full-stack web application for capturing, organizing, and learning from project experiences. Features Excel import, risk scoring for problem areas, multi-select filtering, project management with status tracking, and a Learning Applied page. Branded as "LessonKeeper — a Hawkins-Digital product".

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, Shadcn UI components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect)

## Key Features
- Three-tab dashboard: "Could Be Better" (with risk scoring), "Went Well", and "All Lessons" views
- **Multi-select filters** for Project Type, Phase, Category, and Subcategory with checkbox popover UI
- Excel template download and bulk lesson upload with validation
- **Project management** on Upload page with auto-generated project IDs (PRJ-001 format) and 3-state status system
- **Learning Applied** page for associating lesson subcategories with target projects
- Collapsible category/subcategory groupings with risk scoring
- Lesson detail drill-down dialog
- Configurable scoring system with admin-managed parameters and impact-weighted multipliers
- Role-based access control: User and Admin
- Reference Data, Scoring Rates, and User Administration pages (admin-only)

## Project Status System
Three statuses for projects:
1. **"Project to apply learning to"** — default for new projects; these appear as targets on the Learning Applied page
2. **"Live project with learning captured and learning still to be applied"** — auto-set when lessons are uploaded via Excel
3. **"Closed project with learning captured"** — manually set by admin

## Role System
- **User**: Default role. Can view Dashboard, Projects, Learning Applied, and User Settings pages.
- **Admin**: Full access. Can view all pages, upload lessons, create/manage projects, manage reference data, and manage admin accounts. Minimum 2 admins required at all times.

## Project Structure
```
shared/schema.ts          - Drizzle schema for all entities (projects, lessons, learningApplications, etc.)
shared/models/auth.ts     - Auth-related schema (users with role, sessions)
server/db.ts              - Database connection
server/storage.ts         - Data access layer (IStorage interface)
server/routes.ts          - Express API routes (includes admin middleware)
server/seed.ts            - Seed data for demo
client/src/App.tsx         - Main app with auth routing and footer
client/src/pages/          - Landing, Dashboard, Upload, Projects, Learning Applied, Reference Data, Scoring Rates, User Admin, Settings
client/src/components/     - Sidebar, Filters (multi-select), LessonDetailDialog, ThemeToggle
```

## Data Model
- **Users**: id, email, firstName, lastName, profileImageUrl, role (user|admin)
- **Projects**: id, projectCode (unique, e.g. "PRJ-001"), projectType, name, closeDate, projectManager, description, status, createdAt
- **LessonCategories**: name, description
- **LessonSubcategories**: name, categoryId, currentScore, lastScoreUpdatedAt, firstRecordedDate
- **Lessons**: projectId, subcategoryId, phase, type (WentWell/CouldHaveGoneBetter), name, eventDescription, keyLearningOrAction, impactId
- **LearningApplications**: projectId, subcategoryId, appliedAt, appliedByUserId — tracks which lesson subcategories are associated with projects
- **ReferenceValues**: type (ProjectType|ProjectPhase), value — configurable dropdown values
- **ScoringConfig**: initialScore, incrementScore, dailyDecrement — scoring algorithm parameters

## API Endpoints

### Project Management
- GET /api/projects — list all projects (authenticated)
- POST /api/projects — create project with auto-generated projectCode (admin)
- PATCH /api/projects/:id — update project fields including status (admin)

### Learning Applications
- GET /api/learning-applications — get all with project/subcategory details (authenticated)
- POST /api/learning-applications — apply subcategories to a project (authenticated)
- DELETE /api/learning-applications/:id — remove an application (authenticated)

### Admin
- GET /api/admin/users — list admins (admin)
- POST /api/admin/add — add admin by email (admin)
- DELETE /api/admin/remove/:userId — remove admin (admin, min 2 enforced)
- POST/DELETE /api/reference-data/:type — manage reference data (admin)
- GET /api/scoring-config — get scoring parameters (authenticated)
- PATCH /api/scoring-config — update scoring parameters and recalculate all scores (admin)
- POST /api/scoring-config/reset — reset to defaults and recalculate (admin)

### Excel
- GET /api/template — download Excel template with project dropdown (PRJ-001 - Name format)
- POST /api/upload — upload and parse Excel file (admin)
- GET /api/lessons/export — export filtered lessons as Excel (supports multi-select filter arrays)

## Excel Template Format
- **Sheet 1 "Lessons Template"**: Structured layout with styled section headers
  - PROJECT section: single dropdown for "Project (ID - Name)" selecting from existing projects
  - COULD HAVE GONE BETTER section: lesson rows with Phase, Category, Subcategory, Impact dropdowns
  - WENT WELL section: same lesson columns
- **Sheet 2 "Reference Data"**: Available projects (ID - Name), ProjectPhase, LessonCategory, LessonSubcategory, Impact
- Upload parser supports both new format (project code selection) and legacy format (manual project fields)
- Template generation uses `exceljs`; upload parsing uses `xlsx` (SheetJS)

## Multi-Select Filters
The `FilterState` interface uses arrays instead of single values:
```typescript
interface FilterState {
  projectTypes: string[];
  phases: string[];
  categoryIds: string[];
  subcategoryIds: string[];
  search: string;
}
```
Cascading behavior: selecting categories narrows subcategory options and clears invalid subcategory selections.

## Recent Changes
- 2026-02-26: Converted dashboard filters from single-select to multi-select with checkbox popover UI
- 2026-02-26: Added project management section to Upload page (create projects, manage status)
- 2026-02-26: Added Learning Applied page (/learning-applied) for all users
- 2026-02-26: Added projectCode (PRJ-001 format) and status fields to projects table
- 2026-02-26: Added learningApplications table for tracking lesson-project associations
- 2026-02-26: Updated Excel template to use project ID+Name dropdown instead of manual entry
- 2026-02-26: Updated upload parser to support both new (project code) and legacy (name+type) formats
- 2026-02-26: Updated export endpoint to handle multi-select filter arrays
- 2026-02-26: Added signal handlers (SIGHUP, SIGTERM, SIGINT) for crash prevention
- 2026-02-15: Added Full Lesson List dialog on Dashboard with filter summary and Excel download
- 2026-02-15: Added Scoring Rates page (/scoring-rates) with configurable scoring parameters
- 2026-02-15: Dashboard and upload use dynamic scoring config from database
- 2026-02-14: Added User Settings page (/settings) with avatar upload and profile editing
- 2026-02-13: Split Administration page into Reference Data (/admin) and User Administration (/user-admin)
- 2026-02-12: Added role-based access control (user/admin) with admin management
- 2026-02-11: Initial MVP implementation with all core features
