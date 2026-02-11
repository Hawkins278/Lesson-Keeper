import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import { Filters, type FilterState } from "@/components/filters";
import { LessonDetailDialog } from "@/components/lesson-detail-dialog";
import type { Lesson, Project, LessonCategory, LessonSubcategory } from "@shared/schema";

interface LessonWithRelations extends Lesson {
  project?: Project;
  category?: LessonCategory;
  subcategory?: LessonSubcategory;
}

interface SubcategoryGroup {
  subcategory: LessonSubcategory;
  category: LessonCategory;
  lessons: LessonWithRelations[];
  effectiveScore: number;
}

function getScoreColor(score: number) {
  if (score >= 1000) return "text-destructive";
  if (score >= 600) return "text-chart-4";
  if (score >= 300) return "text-chart-3";
  return "text-chart-2";
}

function getScoreBarWidth(score: number) {
  return Math.min(100, Math.max(3, (score / 1500) * 100));
}

function getScoreBarColor(score: number) {
  if (score >= 1000) return "bg-destructive/70";
  if (score >= 600) return "bg-chart-4/70";
  if (score >= 300) return "bg-chart-3/70";
  return "bg-chart-2/70";
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("could-be-better");
  const [filters, setFilters] = useState<FilterState>({
    projectTypes: [],
    phases: [],
    categoryId: null,
    subcategoryId: null,
    search: "",
  });
  const [selectedLesson, setSelectedLesson] = useState<LessonWithRelations | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<number>>(new Set());

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

  const availableProjectTypes = useMemo(() => {
    return [...new Set(projects.map((p) => p.projectType))];
  }, [projects]);

  const availablePhases = useMemo(() => {
    return [...new Set(lessons.map((l) => l.phase))];
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      if (filters.projectTypes.length > 0) {
        const project = lesson.project || projects.find((p) => p.id === lesson.projectId);
        if (!project || !filters.projectTypes.includes(project.projectType)) return false;
      }
      if (filters.phases.length > 0 && !filters.phases.includes(lesson.phase)) return false;
      if (filters.categoryId) {
        const sub = lesson.subcategory || subcategories.find((s) => s.id === lesson.subcategoryId);
        if (!sub || sub.categoryId !== parseInt(filters.categoryId)) return false;
      }
      if (filters.subcategoryId && lesson.subcategoryId !== parseInt(filters.subcategoryId)) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (
          !lesson.name.toLowerCase().includes(search) &&
          !(lesson.eventDescription || "").toLowerCase().includes(search) &&
          !(lesson.keyLearningOrAction || "").toLowerCase().includes(search)
        )
          return false;
      }
      return true;
    });
  }, [lessons, filters, projects, subcategories]);

  const couldBeBetterGroups = useMemo(() => {
    const cbbLessons = filteredLessons.filter((l) => l.type === "CouldHaveGoneBetter");
    const groups: Map<number, SubcategoryGroup> = new Map();

    cbbLessons.forEach((lesson) => {
      const sub = lesson.subcategory || subcategories.find((s) => s.id === lesson.subcategoryId);
      const cat = sub ? (lesson.category || categories.find((c) => c.id === sub.categoryId)) : undefined;
      if (!sub || !cat) return;

      if (!groups.has(sub.id)) {
        const now = new Date();
        const lastUpdate = sub.lastScoreUpdatedAt ? new Date(sub.lastScoreUpdatedAt) : now;
        const daysSince = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
        const effectiveScore = Math.max(0, (sub.currentScore || 0) - daysSince);

        groups.set(sub.id, {
          subcategory: sub,
          category: cat,
          lessons: [],
          effectiveScore,
        });
      }
      const enriched = { ...lesson, project: projects.find((p) => p.id === lesson.projectId), category: cat, subcategory: sub };
      groups.get(sub.id)!.lessons.push(enriched);
    });

    return [...groups.values()].sort((a, b) => b.effectiveScore - a.effectiveScore);
  }, [filteredLessons, subcategories, categories, projects]);

  const wentWellGroups = useMemo(() => {
    const wwLessons = filteredLessons.filter((l) => l.type === "WentWell");
    const groups: Map<number, { subcategory: LessonSubcategory; category: LessonCategory; lessons: LessonWithRelations[] }> = new Map();

    wwLessons.forEach((lesson) => {
      const sub = lesson.subcategory || subcategories.find((s) => s.id === lesson.subcategoryId);
      const cat = sub ? (lesson.category || categories.find((c) => c.id === sub.categoryId)) : undefined;
      if (!sub || !cat) return;

      if (!groups.has(sub.id)) {
        groups.set(sub.id, { subcategory: sub, category: cat, lessons: [] });
      }
      const enriched = { ...lesson, project: projects.find((p) => p.id === lesson.projectId), category: cat, subcategory: sub };
      groups.get(sub.id)!.lessons.push(enriched);
    });

    return [...groups.values()].sort((a, b) => a.category.name.localeCompare(b.category.name));
  }, [filteredLessons, subcategories, categories, projects]);

  const toggleCategory = (catId: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  };

  const toggleSubcategory = (subId: number) => {
    setExpandedSubcategories((prev) => {
      const next = new Set(prev);
      next.has(subId) ? next.delete(subId) : next.add(subId);
      return next;
    });
  };

  const couldBeBetterCount = lessons.filter((l) => l.type === "CouldHaveGoneBetter").length;
  const wentWellCount = lessons.filter((l) => l.type === "WentWell").length;

  const groupsByCategory = (groups: SubcategoryGroup[] | { subcategory: LessonSubcategory; category: LessonCategory; lessons: LessonWithRelations[] }[]) => {
    const catMap: Map<number, typeof groups> = new Map();
    groups.forEach((g) => {
      const catId = g.category.id;
      if (!catMap.has(catId)) catMap.set(catId, []);
      catMap.get(catId)!.push(g as any);
    });
    return catMap;
  };

  if (lessonsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight" data-testid="text-dashboard-title">Lessons Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Browse, filter, and explore lessons learned across all projects.</p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <aside className="space-y-4">
          <Filters
            filters={filters}
            onFiltersChange={setFilters}
            categories={categories}
            subcategories={subcategories}
            availableProjectTypes={availableProjectTypes}
            availablePhases={availablePhases}
          />
        </aside>

        <main>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="could-be-better" data-testid="tab-could-be-better">
                <AlertTriangle className="w-4 h-4 mr-1.5" />
                Could Be Better
                <Badge variant="secondary" className="ml-2 text-xs no-default-active-elevate">{couldBeBetterCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="went-well" data-testid="tab-went-well">
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Went Well
                <Badge variant="secondary" className="ml-2 text-xs no-default-active-elevate">{wentWellCount}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="could-be-better" className="space-y-4">
              {couldBeBetterGroups.length === 0 ? (
                <Card className="p-8 text-center">
                  <AlertTriangle className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No "could be better" lessons found matching your filters.</p>
                </Card>
              ) : (
                (() => {
                  const catGroups = groupsByCategory(couldBeBetterGroups);
                  return [...catGroups.entries()].map(([catId, groups]) => {
                    const cat = (groups as SubcategoryGroup[])[0].category;
                    const isExpanded = expandedCategories.has(catId) || expandedCategories.size === 0;
                    return (
                      <Collapsible key={catId} open={isExpanded} onOpenChange={() => toggleCategory(catId)}>
                        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 group" data-testid={`button-expand-category-${catId}`}>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          <span className="font-semibold text-sm">{cat.name}</span>
                          <span className="text-xs text-muted-foreground">({(groups as SubcategoryGroup[]).reduce((a, g) => a + g.lessons.length, 0)} lessons)</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-6 space-y-3 mt-1">
                          {(groups as SubcategoryGroup[]).map((group) => {
                            const isSubExpanded = expandedSubcategories.has(group.subcategory.id) || expandedSubcategories.size === 0;
                            return (
                              <Card key={group.subcategory.id} className="overflow-visible">
                                <Collapsible open={isSubExpanded} onOpenChange={() => toggleSubcategory(group.subcategory.id)}>
                                  <CollapsibleTrigger className="flex items-center gap-3 w-full text-left p-4" data-testid={`button-expand-subcategory-${group.subcategory.id}`}>
                                    {isSubExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                      <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <span className="font-medium text-sm" data-testid={`text-subcategory-name-${group.subcategory.id}`}>{group.subcategory.name}</span>
                                        <div className="flex items-center gap-2">
                                          <TrendingDown className={`w-3.5 h-3.5 ${getScoreColor(group.effectiveScore)}`} />
                                          <span className={`text-xs font-mono font-semibold ${getScoreColor(group.effectiveScore)}`} data-testid={`text-score-${group.subcategory.id}`}>
                                            {group.effectiveScore.toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="h-1.5 rounded-sm bg-muted overflow-hidden">
                                        <div
                                          className={`h-full rounded-sm transition-all ${getScoreBarColor(group.effectiveScore)}`}
                                          style={{ width: `${getScoreBarWidth(group.effectiveScore)}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-muted-foreground">{group.lessons.length} lesson{group.lessons.length !== 1 ? "s" : ""}</span>
                                    </div>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="px-4 pb-4">
                                    <div className="space-y-1.5 mt-1">
                                      {group.lessons.map((lesson) => (
                                        <button
                                          key={lesson.id}
                                          onClick={() => setSelectedLesson(lesson)}
                                          className="w-full text-left p-2.5 rounded-md hover-elevate flex items-center justify-between gap-3"
                                          data-testid={`button-lesson-${lesson.id}`}
                                        >
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{lesson.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{lesson.project?.name || "—"} · {lesson.phase}</p>
                                          </div>
                                          <Badge variant="outline" className="text-xs flex-shrink-0 no-default-active-elevate">{lesson.phase}</Badge>
                                        </button>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              </Card>
                            );
                          })}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  });
                })()
              )}
            </TabsContent>

            <TabsContent value="went-well" className="space-y-4">
              {wentWellGroups.length === 0 ? (
                <Card className="p-8 text-center">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No "went well" lessons found matching your filters.</p>
                </Card>
              ) : (
                (() => {
                  const catGroups = groupsByCategory(wentWellGroups as any);
                  return [...catGroups.entries()].map(([catId, groups]) => {
                    const cat = (groups as any[])[0].category;
                    const isExpanded = expandedCategories.has(catId) || expandedCategories.size === 0;
                    return (
                      <Collapsible key={catId} open={isExpanded} onOpenChange={() => toggleCategory(catId)}>
                        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 group" data-testid={`button-expand-ww-category-${catId}`}>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          <span className="font-semibold text-sm">{cat.name}</span>
                          <span className="text-xs text-muted-foreground">({(groups as any[]).reduce((a: number, g: any) => a + g.lessons.length, 0)} lessons)</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-6 space-y-3 mt-1">
                          {(groups as any[]).map((group: any) => {
                            const isSubExpanded = expandedSubcategories.has(group.subcategory.id) || expandedSubcategories.size === 0;
                            return (
                              <Card key={group.subcategory.id} className="overflow-visible">
                                <Collapsible open={isSubExpanded} onOpenChange={() => toggleSubcategory(group.subcategory.id)}>
                                  <CollapsibleTrigger className="flex items-center gap-3 w-full text-left p-4" data-testid={`button-expand-ww-subcategory-${group.subcategory.id}`}>
                                    {isSubExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium text-sm">{group.subcategory.name}</span>
                                      <span className="text-xs text-muted-foreground ml-2">{group.lessons.length} lesson{group.lessons.length !== 1 ? "s" : ""}</span>
                                    </div>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="px-4 pb-4">
                                    <div className="space-y-1.5 mt-1">
                                      {group.lessons
                                        .sort((a: LessonWithRelations, b: LessonWithRelations) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
                                        .map((lesson: LessonWithRelations) => (
                                          <button
                                            key={lesson.id}
                                            onClick={() => setSelectedLesson(lesson)}
                                            className="w-full text-left p-2.5 rounded-md hover-elevate flex items-center justify-between gap-3"
                                            data-testid={`button-lesson-ww-${lesson.id}`}
                                          >
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium truncate">{lesson.name}</p>
                                              <p className="text-xs text-muted-foreground truncate">{lesson.project?.name || "—"} · {lesson.phase}</p>
                                            </div>
                                            <Badge variant="outline" className="text-xs flex-shrink-0 no-default-active-elevate">{lesson.phase}</Badge>
                                          </button>
                                        ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              </Card>
                            );
                          })}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  });
                })()
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <LessonDetailDialog
        lesson={selectedLesson}
        open={!!selectedLesson}
        onOpenChange={(open) => !open && setSelectedLesson(null)}
      />
    </div>
  );
}
