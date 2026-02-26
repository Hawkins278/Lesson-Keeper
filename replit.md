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
- Configurable scoring system with admin-managed parameters (initial score, increment, daily decrement) and impact-weighted multipliers
- Role-based access control: User and Admin
- Reference Data page for managing reference data
- Scoring Rates page for configuring scoring parameters and impact level weightings
- User Administration page for managing admin accounts and user access

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
client/src/pages/          - Landing, Dashboard, Upload, Projects, Reference Data (admin.tsx), Scoring Rates, User Admin, Settings pages
client/src/components/     - Sidebar, Filters, LessonDetailDialog, ThemeToggle
```

## Data Model
- **Users**: id, email, firstName, lastName, profileImageUrl, role (user|admin)
- **Projects**: projectCode (auto-assigned PRJ-XXX), projectType, name, closeDate, projectManager, description, status (New|Live|Closed)
- **LessonCategories**: name, description
- **LessonSubcategories**: name, categoryId, currentScore, lastScoreUpdatedAt, firstRecordedDate
- **Lessons**: projectId, subcategoryId, phase, type (WentWell/CouldHaveGoneBetter), name, eventDescription, keyLearningOrAction
- **ReferenceValues**: type (ProjectType|ProjectPhase), value — stores configurable dropdown values for template generation
- **ScoringConfig**: initialScore, incrementScore, dailyDecrement — configurable scoring parameters

## Admin API Endpoints
- GET /api/admin/users — list admins (requires admin)
- POST /api/admin/add — add admin by email (requires admin)
- DELETE /api/admin/remove/:userId — remove admin (requires admin, min 2 enforced)
- POST/DELETE /api/reference-data/:type — manage reference data (requires admin)
- GET /api/scoring-config — get scoring parameters (authenticated)
- PATCH /api/scoring-config — update scoring parameters and recalculate all scores (admin)
- POST /api/scoring-config/reset — reset to defaults and recalculate (admin)

## Excel Template Format
- **Sheet 1 "Lessons Template"**: Structured layout with styled section headers (dark blue) and column headers (light blue)
  - PROJECT DETAILS section: single row for ProjectType, ProjectName, ProjectCloseDate, ProjectManager, ProjectDescription
  - COULD HAVE GONE BETTER section: multiple lesson rows
  - WENT WELL section: same lesson columns, multiple rows
  - Dropdown validation on ProjectType, ProjectPhase, LessonCategory, LessonSubcategory cells linked to Reference Data sheet
- **Sheet 2 "Reference Data"**: Valid values for ProjectType, ProjectPhase, LessonCategory, LessonSubcategory
- Template generation uses `exceljs` library for styling; upload parsing uses `xlsx` (SheetJS)

## API Endpoints
- POST /api/projects — create a new project with auto-assigned projectCode (admin)
- PATCH /api/projects/:id — update project fields including status (admin)

## Recent Changes
- 2026-02-26: Added project creation form on Projects page with name (required), type (required), PM, close date, status, description
- 2026-02-26: Added projectCode (auto-assigned PRJ-XXX) and status (New/Live/Closed) fields to projects
- 2026-02-26: Added graceful shutdown handler (SIGTERM/SIGINT) to server/index.ts for clean process termination
- 2026-02-15: Added Full Lesson List dialog on Dashboard with filter summary, lesson details, and Excel download
- 2026-02-15: Added GET /api/lessons/export endpoint with filter query params for dashboard Excel export
- 2026-02-15: Added Scoring Rates page (/scoring-rates) with configurable scoring parameters and impact level management
- 2026-02-15: Created scoring_config table with initialScore (500), incrementScore (250), dailyDecrement (1) defaults
- 2026-02-15: Moved Impact Levels from Reference Data page to Scoring Rates page
- 2026-02-15: Dashboard and upload use dynamic scoring config from database instead of hardcoded values
- 2026-02-15: Added recalculateAllScores functionality for retroactive score recalculation with zero-floor rule
- 2026-02-14: Added User Settings page (/settings) with avatar upload via object storage and profile editing (first/last name)
- 2026-02-14: Integrated object storage for user avatar file uploads with presigned URL flow
- 2026-02-14: Added GET/PATCH /api/user/profile endpoints for user profile management
- 2026-02-13: Split Administration page into two: Reference Data page (/admin) and User Administration page (/user-admin)
- 2026-02-13: Added User Management section to Admin page: add/remove user IDs, download all users as CSV (with admin flag)
- 2026-02-13: Renamed Superadministrator role to Admin; users can only see Dashboard and Projects
- 2026-02-12: Added role-based access control (user/admin) with admin page
- 2026-02-12: Moved reference data management from Upload page to Admin page
- 2026-02-12: Added admin user management with authorization middleware
- 2026-02-12: Updated branding to LessonKeeper with Hawkins-Digital logo
- 2026-02-11: Added reference data management form with add/remove for all four field types
- 2026-02-11: Added ReferenceValues table for ProjectType and ProjectPhase with seeded defaults
- 2026-02-13: Fixed role checking to accept legacy "superadmin"/"superadministrator" values alongside "admin"; normalizes to "admin" on next login; case-insensitive email lookups throughout
- 2026-02-11: Initial MVP implementation with all core features
