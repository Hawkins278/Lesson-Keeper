import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { FolderOpen, CalendarDays, User, FileText, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { LessonDetailDialog } from "@/components/lesson-detail-dialog";
import type { Project, Lesson, LessonCategory, LessonSubcategory } from "@shared/schema";

type EnrichedLesson = Lesson & { category?: LessonCategory; subcategory?: LessonSubcategory };

interface CategoryGroup {
  category: LessonCategory;
  subcategoryGroups: {
    subcategory: LessonSubcategory;
    lessons: EnrichedLesson[];
  }[];
}

function groupLessonsByCategoryAndSubcategory(lessons: EnrichedLesson[]): CategoryGroup[] {
  const categoryMap = new Map<number, { category: LessonCategory; subcatMap: Map<number, { subcategory: LessonSubcategory; lessons: EnrichedLesson[] }> }>();

  for (const lesson of lessons) {
    if (!lesson.category || !lesson.subcategory) continue;
    const catId = lesson.category.id;
    const subId = lesson.subcategory.id;

    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, { category: lesson.category, subcatMap: new Map() });
    }
    const catEntry = categoryMap.get(catId)!;

    if (!catEntry.subcatMap.has(subId)) {
      catEntry.subcatMap.set(subId, { subcategory: lesson.subcategory, lessons: [] });
    }
    catEntry.subcatMap.get(subId)!.lessons.push(lesson);
  }

  return Array.from(categoryMap.values())
    .map((entry) => ({
      category: entry.category,
      subcategoryGroups: Array.from(entry.subcatMap.values()),
    }))
    .sort((a, b) => a.category.name.localeCompare(b.category.name));
}

function ProjectLessons({ projectId }: { projectId: number }) {
  const [selectedLesson, setSelectedLesson] = useState<(EnrichedLesson & { project?: Project }) | null>(null);

  const { data: lessons = [], isLoading } = useQuery<EnrichedLesson[]>({
    queryKey: ["/api/projects", projectId, "lessons"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/lessons`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lessons");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 px-4 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading lessons...
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="py-4 px-4 text-sm text-muted-foreground">
        No lessons recorded for this project.
      </div>
    );
  }

  const groups = groupLessonsByCategoryAndSubcategory(lessons);

  return (
    <div className="space-y-4 pt-2">
      {groups.map((group) => (
        <div key={group.category.id} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1" data-testid={`text-category-heading-${group.category.id}`}>
            {group.category.name}
          </h4>
          {group.subcategoryGroups.map((subGroup) => (
            <div key={subGroup.subcategory.id} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground/80 pl-3" data-testid={`text-subcategory-heading-${subGroup.subcategory.id}`}>
                {subGroup.subcategory.name}
              </p>
              <div className="space-y-1.5 pl-3">
                {subGroup.lessons.map((lesson) => {
                  const isWentWell = lesson.type === "WentWell";
                  return (
                    <div
                      key={lesson.id}
                      className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover-elevate"
                      onClick={() => setSelectedLesson(lesson)}
                      data-testid={`card-lesson-${lesson.id}`}
                    >
                      <Badge
                        variant={isWentWell ? "default" : "destructive"}
                        className="text-xs flex-shrink-0 mt-0.5 no-default-active-elevate"
                      >
                        {isWentWell ? "Went Well" : "Could Be Better"}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" data-testid={`text-lesson-name-${lesson.id}`}><span className="text-muted-foreground font-mono mr-1.5">#{lesson.id}</span>{lesson.name}</p>
                        {lesson.eventDescription && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{lesson.eventDescription}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-xs no-default-active-elevate">{lesson.phase}</Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
      <LessonDetailDialog
        lesson={selectedLesson}
        open={!!selectedLesson}
        onOpenChange={(open) => { if (!open) setSelectedLesson(null); }}
      />
    </div>
  );
}

export default function ProjectsPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const toggleProject = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight" data-testid="text-projects-title">Projects</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {projects.length} project{projects.length !== 1 ? "s" : ""} with recorded lessons. Click a project to view its lessons.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card className="p-8 text-center">
          <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No projects yet. Upload lessons from Excel to get started.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const isExpanded = expandedId === project.id;
            return (
              <Card key={project.id} className="overflow-visible" data-testid={`card-project-${project.id}`}>
                <div
                  className="p-4 cursor-pointer hover-elevate rounded-md"
                  onClick={() => toggleProject(project.id)}
                  data-testid={`button-expand-project-${project.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-muted-foreground">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-sm" data-testid={`text-project-name-${project.id}`}>{project.name}</h3>
                        <Badge variant="outline" className="text-xs no-default-active-elevate">{project.projectType}</Badge>
                      </div>
                      {project.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1 leading-relaxed">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                      {project.projectManager && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {project.projectManager}
                        </span>
                      )}
                      {project.closeDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {project.closeDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4">
                    <Separator />
                    <ProjectLessons projectId={project.id} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
