# LessonKeeper - Lessons Learned Knowledge Base

## Overview
A full-stack web application for capturing, organizing, and learning from project experiences. Features Excel import, risk scoring for problem areas, and rich filtering/drill-down views. Branded as "LessonKeeper — a Hawkins-Digital product".

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, Shadcn UI components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect)

## Key Features
- Two-tab dashboard: "Could Be Better" (with risk scoring) and "Went Well" views
- Excel template download and bulk lesson upload with validation
- Filtering by project type, phase, category, subcategory, and text search
- Collapsible category/subcategory groupings
- Lesson detail drill-down dialog
- Scoring system: subcategories start at 500 when first "Could Be Better" lesson is recorded, decay by 1 point per day, boost by 250 for each new issue
- Role-based access control: User and Admin
- Admin page for managing reference data and admin accounts

## Role System
- **User**: Default role. Can only view Dashboard and Projects pages.
- **Admin**: Full access. Can view all pages, upload lessons, manage reference data, and manage admin accounts. Minimum 2 admins required at all times. Each must have email + ID.

## Project Structure
```
shared/schema.ts          - Drizzle schema for all entities
shared/models/auth.ts     - Auth-related schema (users with role, sessions)
server/db.ts              - Database connection
server/storage.ts         - Data access layer (IStorage interface)
server/routes.ts          - Express API routes (includes admin middleware)
server/seed.ts            - Seed data for demo
client/src/App.tsx         - Main app with auth routing and footer
client/src/pages/          - Landing, Dashboard, Upload, Projects, Admin pages
client/src/components/     - Sidebar, Filters, LessonDetailDialog, ThemeToggle
```

## Data Model
- **Users**: id, email, firstName, lastName, profileImageUrl, role (user|admin)
- **Projects**: projectType, name, closeDate, projectManager, description
- **LessonCategories**: name, description
- **LessonSubcategories**: name, categoryId, currentScore, lastScoreUpdatedAt, firstRecordedDate
- **Lessons**: projectId, subcategoryId, phase, type (WentWell/CouldHaveGoneBetter), name, eventDescription, keyLearningOrAction
- **ReferenceValues**: type (ProjectType|ProjectPhase), value — stores configurable dropdown values for template generation

## Admin API Endpoints
- GET /api/admin/users — list admins (requires admin)
- POST /api/admin/add — add admin by email (requires admin)
- DELETE /api/admin/remove/:userId — remove admin (requires admin, min 2 enforced)
- POST/DELETE /api/reference-data/:type — manage reference data (requires admin)

## Excel Template Format
- **Sheet 1 "Lessons Template"**: Structured layout with styled section headers (dark blue) and column headers (light blue)
  - PROJECT DETAILS section: single row for ProjectType, ProjectName, ProjectCloseDate, ProjectManager, ProjectDescription
  - COULD HAVE GONE BETTER section: multiple lesson rows
  - WENT WELL section: same lesson columns, multiple rows
  - Dropdown validation on ProjectType, ProjectPhase, LessonCategory, LessonSubcategory cells linked to Reference Data sheet
- **Sheet 2 "Reference Data"**: Valid values for ProjectType, ProjectPhase, LessonCategory, LessonSubcategory
- Template generation uses `exceljs` library for styling; upload parsing uses `xlsx` (SheetJS)

## Recent Changes
- 2026-02-13: Renamed Superadministrator role to Admin; users can only see Dashboard and Projects
- 2026-02-12: Added role-based access control (user/admin) with admin page
- 2026-02-12: Moved reference data management from Upload page to Admin page
- 2026-02-12: Added admin user management with authorization middleware
- 2026-02-12: Updated branding to LessonKeeper with Hawkins-Digital logo
- 2026-02-11: Added reference data management form with add/remove for all four field types
- 2026-02-11: Added ReferenceValues table for ProjectType and ProjectPhase with seeded defaults
- 2026-02-13: Fixed role checking to accept legacy "superadmin"/"superadministrator" values alongside "admin"; normalizes to "admin" on next login; case-insensitive email lookups throughout
- 2026-02-11: Initial MVP implementation with all core features
