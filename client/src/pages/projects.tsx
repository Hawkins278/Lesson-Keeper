import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { FolderOpen, CalendarDays, User, FileText, ChevronDown, ChevronRight, Loader2, Pencil, X, Save } from "lucide-react";
import { LessonDetailDialog } from "@/components/lesson-detail-dialog";
import { formatUKDate } from "@/lib/format-date";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, Lesson, LessonCategory, LessonSubcategory, ImpactLevel, ReferenceValue } from "@shared/schema";

type EnrichedLesson = Lesson & { category?: LessonCategory; subcategory?: LessonSubcategory; impact?: ImpactLevel };

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

function ProjectLessons({ projectId, isAdmin }: { projectId: number; isAdmin: boolean }) {
  const [selectedLesson, setSelectedLesson] = useState<(EnrichedLesson & { project?: Project }) | null>(null);

  const { data: lessons = [], isLoading } = useQuery<EnrichedLesson[]>({
    queryKey: ["/api/projects", projectId, "lessons"],
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
                      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${isWentWell ? "bg-ww" : "bg-cbb"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" data-testid={`text-lesson-name-${lesson.id}`}><span className="text-muted-foreground font-mono mr-1.5">#{lesson.id}</span>{lesson.name}</p>
                        {lesson.eventDescription && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{lesson.eventDescription}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <Badge
                            className={`text-xs no-default-active-elevate ${isWentWell ? "bg-ww/15 text-ww border-ww/30" : "bg-cbb/15 text-cbb border-cbb/30"}`}
                            variant="outline"
                          >
                            {isWentWell ? "WW" : "CBB"}
                          </Badge>
                          <Badge variant="outline" className="text-xs no-default-active-elevate">{lesson.phase}</Badge>
                          {!isWentWell && lesson.impact && (
                            <Badge variant="outline" className="text-xs no-default-active-elevate" data-testid={`badge-impact-${lesson.id}`}>
                              {lesson.impact.weightingPercent}%
                            </Badge>
                          )}
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
        isAdmin={isAdmin}
      />
    </div>
  );
}

function ProjectEditForm({ project, onCancel, onSaved }: { project: Project; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(project.name);
  const [projectType, setProjectType] = useState(project.projectType);
  const [closeDate, setCloseDate] = useState(project.closeDate || "");
  const [projectManager, setProjectManager] = useState(project.projectManager || "");
  const [description, setDescription] = useState(project.description || "");
  const { toast } = useToast();

  const { data: projectTypes = [] } = useQuery<ReferenceValue[]>({
    queryKey: ["/api/reference-data", "ProjectType"],
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/projects/${project.id}`, {
        name, projectType, closeDate, projectManager, description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project updated" });
      onSaved();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update project", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Project Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-edit-project-name" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Project Type</label>
          <Select value={projectType} onValueChange={setProjectType}>
            <SelectTrigger data-testid="select-edit-project-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projectTypes.map((pt) => (
                <SelectItem key={pt.id} value={pt.value}>{pt.value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Project Manager</label>
          <Input value={projectManager} onChange={(e) => setProjectManager(e.target.value)} data-testid="input-edit-project-manager" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Close Date</label>
          <Input value={closeDate} onChange={(e) => setCloseDate(e.target.value)} placeholder="DD-Mon-YYYY" data-testid="input-edit-project-close-date" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="input-edit-project-description" />
      </div>
      <div className="flex items-center gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} data-testid="button-cancel-edit-project">
          <X className="w-3.5 h-3.5 mr-1" /> Cancel
        </Button>
        <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-project">
          <Save className="w-3.5 h-3.5 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const userRole = (user?.role as string || "").toLowerCase().trim();
  const isAdminUser = userRole === "admin" || userRole === "superadmin" || userRole === "superadministrator";
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);

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
            const isEditing = editingProjectId === project.id;
            return (
              <Card key={project.id} className="overflow-visible" data-testid={`card-project-${project.id}`}>
                {isEditing ? (
                  <ProjectEditForm
                    key={project.id}
                    project={project}
                    onCancel={() => setEditingProjectId(null)}
                    onSaved={() => setEditingProjectId(null)}
                  />
                ) : (
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
                            {formatUKDate(project.closeDate)}
                          </span>
                        )}
                        {isAdminUser && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setEditingProjectId(project.id); }}
                            data-testid={`button-edit-project-${project.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {isExpanded && !isEditing && (
                  <div className="px-4 pb-4">
                    <Separator />
                    <ProjectLessons projectId={project.id} isAdmin={isAdminUser} />
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
