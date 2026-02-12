import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import { Filters, type FilterState } from "@/components/filters";
import { LessonDetailDialog } from "@/components/lesson-detail-dialog";
import type { Lesson, Project, LessonCategory, LessonSubcategory, ReferenceValue } from "@shared/schema";

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

interface ReferenceData {
  projectTypes: ReferenceValue[];
  projectPhases: ReferenceValue[];
  categories: LessonCategory[];
  subcategories: LessonSubcategory[];
}

function getScoreColor(score: number) {
  if (score >= 750) return "text-destructive";
  if (score >= 500) return "text-chart-4";
  if (score >= 250) return "text-chart-3";
  return "text-chart-2";
}

function getScoreBarWidth(score: number) {
  return Math.min(100, Math.max(3, (score / 1000) * 100));
}

function getScoreBarColor(score: number) {
  if (score >= 750) return "bg-destructive/70";
  if (score >= 500) return "bg-chart-4/70";
  if (score >= 250) return "bg-chart-3/70";
  return "bg-chart-2/70";
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"could-be-better" | "went-well">("could-be-better");
  const [filters, setFilters] = useState<FilterState>({
    projectType: null,
    phase: null,
    categoryId: null,
    subcategoryId: null,
    search: "",
  });
  const [selectedLesson, setSelectedLesson] = useState<LessonWithRelations | null>(null);
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

  const { data: refData } = useQuery<ReferenceData>({
    queryKey: ["/api/reference-data"],
  });

  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      if (filters.projectType) {
        const project = lesson.project || projects.find((p) => p.id === lesson.projectId);
        if (!project || project.projectType !== filters.projectType) return false;
      }
      if (filters.phase && lesson.phase !== filters.phase) return false;
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

  const buildGroups = useMemo(() => {
    const buildForType = (type: "CouldHaveGoneBetter" | "WentWell"): SubcategoryGroup[] => {
      const typedLessons = filteredLessons.filter((l) => l.type === type);
      const groups: Map<number, SubcategoryGroup> = new Map();

      typedLessons.forEach((lesson) => {
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

      return Array.from(groups.values()).sort((a, b) => b.effectiveScore - a.effectiveScore);
    };

    return {
      couldBeBetter: buildForType("CouldHaveGoneBetter"),
      wentWell: buildForType("WentWell"),
    };
  }, [filteredLessons, subcategories, categories, projects]);

  const toggleSubcategory = (subId: number) => {
    setExpandedSubcategories((prev) => {
      const next = new Set(prev);
      next.has(subId) ? next.delete(subId) : next.add(subId);
      return next;
    });
  };

  const couldBeBetterCount = lessons.filter((l) => l.type === "CouldHaveGoneBetter").length;
  const wentWellCount = lessons.filter((l) => l.type === "WentWell").length;

  if (lessonsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  const isCBB = activeTab === "could-be-better";
  const activeGroups = isCBB ? buildGroups.couldBeBetter : buildGroups.wentWell;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-tight" data-testid="text-dashboard-title">Lessons Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Browse, filter, and explore lessons learned across all projects.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isCBB ? "default" : "outline"}
            className={isCBB ? "bg-destructive text-destructive-foreground border-destructive" : ""}
            onClick={() => setActiveTab("could-be-better")}
            data-testid="tab-could-be-better"
          >
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            Could Be Better
            <Badge variant="secondary" className="ml-2 text-xs no-default-active-elevate no-default-hover-elevate">{couldBeBetterCount}</Badge>
          </Button>
          <Button
            variant={!isCBB ? "default" : "outline"}
            className={!isCBB ? "bg-chart-2 text-white border-chart-2" : ""}
            onClick={() => setActiveTab("went-well")}
            data-testid="tab-went-well"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Went Well
            <Badge variant="secondary" className="ml-2 text-xs no-default-active-elevate no-default-hover-elevate">{wentWellCount}</Badge>
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <Filters
          filters={filters}
          onFiltersChange={setFilters}
          categories={categories}
          subcategories={subcategories}
          referenceProjectTypes={refData?.projectTypes || []}
          referencePhases={refData?.projectPhases || []}
        />
      </Card>

      <div className="space-y-2">
        {activeGroups.length === 0 ? (
          <Card className="p-8 text-center">
            {isCBB ? (
              <AlertTriangle className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            ) : (
              <CheckCircle2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            )}
            <p className="text-sm text-muted-foreground">
              No "{isCBB ? "could be better" : "went well"}" lessons found matching your filters.
            </p>
          </Card>
        ) : (
          activeGroups.map((group) => {
            const isExpanded = expandedSubcategories.has(group.subcategory.id);
            return (
              <Card key={group.subcategory.id} className="overflow-visible" data-testid={`card-subcategory-${group.subcategory.id}`}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleSubcategory(group.subcategory.id)}>
                  <CollapsibleTrigger className="flex items-center gap-3 w-full text-left p-4" data-testid={`button-expand-subcategory-${group.subcategory.id}`}>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm" data-testid={`text-subcategory-name-${group.subcategory.id}`}>
                            {group.subcategory.name}
                          </span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">({group.category.name})</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">{group.lessons.length} lesson{group.lessons.length !== 1 ? "s" : ""}</span>
                          {isCBB && (
                            <div className="flex items-center gap-1.5">
                              <TrendingDown className={`w-3.5 h-3.5 ${getScoreColor(group.effectiveScore)}`} />
                              <span className={`text-sm font-mono font-semibold ${getScoreColor(group.effectiveScore)}`} data-testid={`text-score-${group.subcategory.id}`}>
                                {group.effectiveScore.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {isCBB && (
                        <div className="h-1.5 rounded-sm bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-sm transition-all ${getScoreBarColor(group.effectiveScore)}`}
                            style={{ width: `${getScoreBarWidth(group.effectiveScore)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4">
                    <div className="space-y-1.5 mt-1">
                      {group.lessons
                        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
                        .map((lesson) => (
                          <button
                            key={lesson.id}
                            onClick={() => setSelectedLesson(lesson)}
                            className="w-full text-left p-2.5 rounded-md hover-elevate flex items-center justify-between gap-3"
                            data-testid={`button-lesson-${lesson.id}`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate"><span className="text-muted-foreground font-mono mr-1.5">#{lesson.id}</span>{lesson.name}</p>
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
          })
        )}
      </div>

      <LessonDetailDialog
        lesson={selectedLesson}
        open={!!selectedLesson}
        onOpenChange={(open) => !open && setSelectedLesson(null)}
      />
    </div>
  );
}
