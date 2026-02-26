import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, BookOpen, Plus, X, Check, AlertTriangle } from "lucide-react";
import { Filters, type FilterState } from "@/components/filters";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Project, LessonCategory, LessonSubcategory, ReferenceValue, Lesson, LearningApplication } from "@shared/schema";
import { PROJECT_STATUSES } from "@shared/schema";

interface LessonWithRelations extends Lesson {
  project?: Project;
  category?: LessonCategory;
  subcategory?: LessonSubcategory;
}

interface ReferenceData {
  projectTypes: ReferenceValue[];
  projectPhases: ReferenceValue[];
  categories: LessonCategory[];
  subcategories: LessonSubcategory[];
}

interface LearningAppWithDetails {
  id: number;
  projectId: number;
  subcategoryId: number;
  appliedAt: string;
  appliedByUserId: string | null;
  project: Project;
  subcategory: LessonSubcategory;
  category: LessonCategory;
}

export default function LearningAppliedPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<FilterState>({
    projectTypes: [],
    phases: [],
    categoryIds: [],
    subcategoryIds: [],
    search: "",
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<Set<number>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery<LessonWithRelations[]>({
    queryKey: ["/api/lessons"],
  });
  const { data: categories = [] } = useQuery<LessonCategory[]>({
    queryKey: ["/api/categories"],
  });
  const { data: subcategories = [] } = useQuery<LessonSubcategory[]>({
    queryKey: ["/api/subcategories"],
  });
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  const { data: refData } = useQuery<ReferenceData>({
    queryKey: ["/api/reference-data"],
  });
  const { data: learningApps = [] } = useQuery<LearningAppWithDetails[]>({
    queryKey: ["/api/learning-applications"],
  });

  const targetProjects = projects.filter(p => p.status === "Project to apply learning to");

  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      if (filters.projectTypes.length > 0) {
        const project = lesson.project || projects.find(p => p.id === lesson.projectId);
        if (!project || !filters.projectTypes.includes(project.projectType)) return false;
      }
      if (filters.phases.length > 0 && !filters.phases.includes(lesson.phase)) return false;
      if (filters.categoryIds.length > 0) {
        const sub = lesson.subcategory || subcategories.find(s => s.id === lesson.subcategoryId);
        if (!sub || !filters.categoryIds.includes(String(sub.categoryId))) return false;
      }
      if (filters.subcategoryIds.length > 0 && !filters.subcategoryIds.includes(String(lesson.subcategoryId))) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (
          !lesson.name.toLowerCase().includes(search) &&
          !(lesson.eventDescription || "").toLowerCase().includes(search) &&
          !(lesson.keyLearningOrAction || "").toLowerCase().includes(search)
        ) return false;
      }
      return true;
    });
  }, [lessons, filters, projects, subcategories]);

  const filteredSubcategoryIds = useMemo(() => {
    const ids = new Set<number>();
    filteredLessons.forEach(l => ids.add(l.subcategoryId));
    return ids;
  }, [filteredLessons]);

  const filteredSubcategoriesGrouped = useMemo(() => {
    const groups: Map<number, { category: LessonCategory; subcategories: { sub: LessonSubcategory; lessonCount: number }[] }> = new Map();
    filteredSubcategoryIds.forEach(subId => {
      const sub = subcategories.find(s => s.id === subId);
      if (!sub) return;
      const cat = categories.find(c => c.id === sub.categoryId);
      if (!cat) return;
      if (!groups.has(cat.id)) {
        groups.set(cat.id, { category: cat, subcategories: [] });
      }
      const count = filteredLessons.filter(l => l.subcategoryId === subId).length;
      groups.get(cat.id)!.subcategories.push({ sub, lessonCount: count });
    });
    return Array.from(groups.values()).sort((a, b) => a.category.name.localeCompare(b.category.name));
  }, [filteredSubcategoryIds, subcategories, categories, filteredLessons]);

  const applyMutation = useMutation({
    mutationFn: async ({ projectId, subcategoryIds }: { projectId: number; subcategoryIds: number[] }) => {
      const res = await apiRequest("POST", "/api/learning-applications", { projectId, subcategoryIds });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-applications"] });
      toast({ title: "Learning applied", description: `${data.created} subcategories associated with the project.` });
      setSelectedSubcategoryIds(new Set());
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not apply learning to the project.", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/learning-applications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning-applications"] });
      toast({ title: "Removed", description: "Learning application removed." });
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not remove the learning application.", variant: "destructive" });
    },
  });

  const toggleSubcategory = (subId: number) => {
    setSelectedSubcategoryIds(prev => {
      const next = new Set(prev);
      next.has(subId) ? next.delete(subId) : next.add(subId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedSubcategoryIds(new Set(filteredSubcategoryIds));
  };

  const clearSelection = () => {
    setSelectedSubcategoryIds(new Set());
  };

  const handleApply = () => {
    if (!selectedProjectId || selectedSubcategoryIds.size === 0) return;
    applyMutation.mutate({
      projectId: parseInt(selectedProjectId),
      subcategoryIds: Array.from(selectedSubcategoryIds),
    });
  };

  const toggleProject = (projectId: number) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  };

  const projectApps = useMemo(() => {
    const grouped: Map<number, { project: Project; apps: LearningAppWithDetails[] }> = new Map();
    learningApps.forEach(app => {
      if (!grouped.has(app.projectId)) {
        grouped.set(app.projectId, { project: app.project, apps: [] });
      }
      grouped.get(app.projectId)!.apps.push(app);
    });
    return Array.from(grouped.values()).sort((a, b) => a.project.name.localeCompare(b.project.name));
  }, [learningApps]);

  const hasActiveFilters = filters.projectTypes.length > 0 || filters.phases.length > 0 || filters.categoryIds.length > 0 || filters.subcategoryIds.length > 0 || filters.search !== "";

  if (lessonsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight" data-testid="text-learning-applied-title">Learning Applied</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Associate lesson categories with projects to track where learning has been applied.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Apply Learning to a Project
        </h2>
        <p className="text-xs text-muted-foreground">
          Use the filters below to find relevant lesson subcategories, then select which ones to associate with a target project.
        </p>

        <Filters
          filters={filters}
          onFiltersChange={setFilters}
          categories={categories}
          subcategories={subcategories}
          referenceProjectTypes={refData?.projectTypes || []}
          referencePhases={refData?.projectPhases || []}
        />

        <Separator />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground" data-testid="text-filtered-subcategories-count">
            {filteredSubcategoryIds.size} subcategor{filteredSubcategoryIds.size !== 1 ? "ies" : "y"} from {filteredLessons.length} filtered lesson{filteredLessons.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={selectAllFiltered} disabled={filteredSubcategoryIds.size === 0} data-testid="button-select-all">
              <Check className="w-3 h-3 mr-1" />
              Select All
            </Button>
            {selectedSubcategoryIds.size > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection} data-testid="button-clear-selection">
                <X className="w-3 h-3 mr-1" />
                Clear ({selectedSubcategoryIds.size})
              </Button>
            )}
          </div>
        </div>

        {filteredSubcategoriesGrouped.length === 0 ? (
          <div className="text-center py-6">
            <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? "No subcategories match your filters." : "No lesson subcategories available."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSubcategoriesGrouped.map(group => (
              <div key={group.category.id}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{group.category.name}</p>
                <div className="grid gap-1.5">
                  {group.subcategories.map(({ sub, lessonCount }) => {
                    const isSelected = selectedSubcategoryIds.has(sub.id);
                    return (
                      <button
                        key={sub.id}
                        className={`flex items-center justify-between gap-3 p-2.5 rounded-md text-left text-sm border transition-colors ${
                          isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                        }`}
                        onClick={() => toggleSubcategory(sub.id)}
                        data-testid={`button-subcategory-${sub.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                            {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <span className="truncate">{sub.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs flex-shrink-0 no-default-active-elevate">{lessonCount} lesson{lessonCount !== 1 ? "s" : ""}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedSubcategoryIds.size > 0 && (
          <>
            <Separator />
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground">Target Project</label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger data-testid="select-target-project">
                    <SelectValue placeholder="Select a project to apply learning to..." />
                  </SelectTrigger>
                  <SelectContent>
                    {targetProjects.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No projects with status "Project to apply learning to"
                      </div>
                    ) : (
                      targetProjects.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.projectCode} - {p.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleApply}
                disabled={!selectedProjectId || applyMutation.isPending}
                data-testid="button-apply-learning"
              >
                <BookOpen className="w-4 h-4 mr-1.5" />
                Apply {selectedSubcategoryIds.size} Subcategor{selectedSubcategoryIds.size !== 1 ? "ies" : "y"}
              </Button>
            </div>
          </>
        )}
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3" data-testid="text-applied-learning-heading">Applied Learning by Project</h2>
        {projectApps.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No learning has been applied to any projects yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {projectApps.map(({ project, apps }) => {
              const isExpanded = expandedProjects.has(project.id);
              return (
                <Card key={project.id} data-testid={`card-project-${project.id}`}>
                  <Collapsible open={isExpanded} onOpenChange={() => toggleProject(project.id)}>
                    <CollapsibleTrigger className="flex items-center gap-3 w-full text-left p-4" data-testid={`button-expand-project-${project.id}`}>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">{project.projectCode}</span>
                          <span className="font-medium text-sm">{project.name}</span>
                          <Badge variant="outline" className="text-xs no-default-active-elevate">{project.projectType}</Badge>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs flex-shrink-0 no-default-active-elevate">
                        {apps.length} subcategor{apps.length !== 1 ? "ies" : "y"}
                      </Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 pb-4">
                      <div className="space-y-1.5 mt-1">
                        {apps.map(app => (
                          <div
                            key={app.id}
                            className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/50"
                            data-testid={`row-learning-app-${app.id}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm">{app.subcategory?.name || "Unknown"}</span>
                              <span className="text-xs text-muted-foreground">({app.category?.name || "Unknown"})</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => removeMutation.mutate(app.id)}
                              data-testid={`button-remove-app-${app.id}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
