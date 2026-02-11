# LessonsDB - Lessons Learned Knowledge Base

## Overview
A full-stack web application for capturing, organizing, and learning from project experiences. Features Excel import, risk scoring for problem areas, and rich filtering/drill-down views.

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
- Scoring system: subcategories start at 1000 when first "Could Be Better" lesson is recorded, decay by 1 point per day, boost by 200 for each new issue

## Project Structure
```
shared/schema.ts          - Drizzle schema for all entities
shared/models/auth.ts     - Auth-related schema (users, sessions)
server/db.ts              - Database connection
server/storage.ts         - Data access layer (IStorage interface)
server/routes.ts          - Express API routes
server/seed.ts            - Seed data for demo
client/src/App.tsx         - Main app with auth routing
client/src/pages/          - Landing, Dashboard, Upload, Projects pages
client/src/components/     - Sidebar, Filters, LessonDetailDialog, ThemeToggle
```

## Data Model
- **Projects**: projectType, name, closeDate, projectManager, description
- **LessonCategories**: name, description
- **LessonSubcategories**: name, categoryId, currentScore, lastScoreUpdatedAt, firstRecordedDate
- **Lessons**: projectId, subcategoryId, phase, type (WentWell/CouldHaveGoneBetter), name, eventDescription, keyLearningOrAction

## Recent Changes
- 2026-02-11: Initial MVP implementation with all core features
