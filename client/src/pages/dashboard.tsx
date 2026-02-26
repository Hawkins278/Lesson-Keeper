import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, TrendingDown, List, FileSpreadsheet, Eye, Download, Loader2 } from "lucide-react";
import { Filters, type FilterState } from "@/components/filters";
import { LessonDetailDialog } from "@/components/lesson-detail-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { Lesson, Project, LessonCategory, LessonSubcategory, ReferenceValue, ImpactLevel, ScoringConfig } from "@shared/schema";

interface LessonWithRelations extends Lesson {
  project?: Project;
  category?: LessonCategory;
  subcategory?: LessonSubcategory;
  impact?: ImpactLevel;
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

type TabType = "could-be-better" | "went-well" | "all";

function getScoreColor(score: number) {
  if (score >= 750) return "text-cbb";
  if (score >= 500) return "text-cbb/80";
  if (score >= 250) return "text-cbb/60";
  return "text-muted-foreground";
}

function getScoreBarWidth(score: number) {
  return Math.min(100, Math.max(3, (score / 1500) * 100));
}

function getScoreBarColor(score: number) {
  if (score >= 750) return "bg-cbb";
  if (score >= 500) return "bg-cbb/70";
  if (score >= 250) return "bg-cbb/50";
  return "bg-cbb/30";
}

function buildFilterSummary(filters: FilterState, activeTab: TabType, categories: LessonCategory[], subcategories: LessonSubcategory[]) {
  const parts: { label: string; value: string }[] = [];
  const tabLabel = activeTab === "could-be-better" ? "Could Be Better" : activeTab === "went-well" ? "Went Well" : "All Lessons";
  parts.push({ label: "View", value: tabLabel });
  if (filters.projectTypes.length > 0) parts.push({ label: "Project Type", value: filters.projectTypes.join(", ") });
  if (filters.phases.length > 0) parts.push({ label: "Phase", value: filters.phases.join(", ") });
  if (filters.categoryIds.length > 0) {
    const names = filters.categoryIds.map(id => categories.find(c => c.id === parseInt(id))?.name || id);
    parts.push({ label: "Category", value: names.join(", ") });
  }
  if (filters.subcategoryIds.length > 0) {
    const names = filters.subcategoryIds.map(id => subcategories.find(s => s.id === parseInt(id))?.name || id);
    parts.push({ label: "Subcategory", value: names.join(", ") });
  }
  if (filters.search) parts.push({ label: "Search", value: `"${filters.search}"` });
  return parts;
}

function hasActiveFilters(filters: FilterState) {
  return filters.projectTypes.length > 0 || filters.phases.length > 0 || filters.categoryIds.length > 0 || filters.subcategoryIds.length > 0 || filters.search !== "";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRole = (user?.role as string || "").toLowerCase().trim();
  const isAdminUser = userRole === "admin" || userRole === "superadmin" || userRole === "superadministrator";
  const [activeTab, setActiveTab] = useState<TabType>("could-be-better");
  const [filters, setFilters] = useState<FilterState>({
    projectTypes: [],
    phases: [],
    categoryIds: [],
    subcategoryIds: [],
    search: "",
  });
  const [selectedLesson, setSelectedLesson] = useState<LessonWithRelations | null>(null);
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<number>>(new Set());
  const [showFullList, setShowFullList] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  const { data: scoringConfigData } = useQuery<ScoringConfig>({
    queryKey: ["/api/scoring-config"],
  });
  const dailyDecrement = scoringConfigData?.dailyDecrement ?? 1;

  const { data: refData } = useQuery<ReferenceData>({
    queryKey: ["/api/reference-data"],
  });

  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      if (filters.projectTypes.length > 0) {
        const project = lesson.project || projects.find((p) => p.id === lesson.projectId);
        if (!project || !filters.projectTypes.includes(project.projectType)) return false;
      }
      if (filters.phases.length > 0 && !filters.phases.includes(lesson.phase)) return false;
      if (filters.categoryIds.length > 0) {
        const sub = lesson.subcategory || subcategories.find((s) => s.id === lesson.subcategoryId);
        if (!sub || !filters.categoryIds.includes(String(sub.categoryId))) return false;
      }
      if (filters.subcategoryIds.length > 0 && !filters.subcategoryIds.includes(String(lesson.subcategoryId))) return false;
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
    const buildForType = (type: "CouldHaveGoneBetter" | "WentWell" | "All"): SubcategoryGroup[] => {
      const typedLessons = type === "All"
        ? filteredLessons
        : filteredLessons.filter((l) => l.type === type);
      const groups: Map<number, SubcategoryGroup> = new Map();

      typedLessons.forEach((lesson) => {
        const sub = lesson.subcategory || subcategories.find((s) => s.id === lesson.subcategoryId);
        const cat = sub ? (lesson.category || categories.find((c) => c.id === sub.categoryId)) : undefined;
        if (!sub || !cat) return;

        if (!groups.has(sub.id)) {
          const now = new Date();
          const lastUpdate = sub.lastScoreUpdatedAt ? new Date(sub.lastScoreUpdatedAt) : now;
          const daysSince = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
          const effectiveScore = Math.round(Math.max(0, (sub.currentScore || 0) - daysSince * dailyDecrement));

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
      all: buildForType("All"),
    };
  }, [filteredLessons, subcategories, categories, projects, dailyDecrement]);

  const toggleSubcategory = (subId: number) => {
    setExpandedSubcategories((prev) => {
      const next = new Set(prev);
      next.has(subId) ? next.delete(subId) : next.add(subId);
      return next;
    });
  };

  const buildExportParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    filters.projectTypes.forEach((v) => params.append("projectType", v));
    filters.phases.forEach((v) => params.append("phase", v));
    filters.categoryIds.forEach((v) => params.append("categoryId", v));
    filters.subcategoryIds.forEach((v) => params.append("subcategoryId", v));
    if (filters.search) params.set("search", filters.search);
    return params.toString();
  }, [activeTab, filters]);

  const handleDownloadExcel = useCallback(async () => {
    setDownloading(true);
    try {
      const resp = await fetch(`/api/lessons/export?${buildExportParams()}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dashboard_lessons_export.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: "Your lessons export is downloading." });
    } catch {
      toast({ title: "Export failed", description: "Could not download the lessons export.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }, [buildExportParams, toast]);

  const couldBeBetterCount = lessons.filter((l) => l.type === "CouldHaveGoneBetter").length;
  const wentWellCount = lessons.filter((l) => l.type === "WentWell").length;
  const allCount = lessons.length;

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
  const isWW = activeTab === "went-well";
  const isAll = activeTab === "all";
  const activeGroups = isCBB
    ? buildGroups.couldBeBetter
    : isWW
      ? buildGroups.wentWell
      : buildGroups.all;

  const showScores = true;
  const totalFilteredLessons = activeGroups.reduce((sum, g) => sum + g.lessons.length, 0);
  const filterSummary = buildFilterSummary(filters, activeTab, categories, subcategories);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-tight" data-testid="text-dashboard-title">Lessons Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Browse, filter, and explore lessons learned across all projects.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={isCBB ? "default" : "outline"}
            className={isCBB ? "bg-cbb text-cbb-foreground border-cbb" : ""}
            onClick={() => setActiveTab("could-be-better")}
            data-testid="tab-could-be-better"
          >
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            Could Be Better
            <Badge variant="secondary" className="ml-2 text-xs no-default-active-elevate no-default-hover-elevate">{couldBeBetterCount}</Badge>
          </Button>
          <Button
            variant={isWW ? "default" : "outline"}
            className={isWW ? "bg-ww text-ww-foreground border-ww" : ""}
            onClick={() => setActiveTab("went-well")}
            data-testid="tab-went-well"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Went Well
            <Badge variant="secondary" className="ml-2 text-xs no-default-active-elevate no-default-hover-elevate">{wentWellCount}</Badge>
          </Button>
          <Button
            variant={isAll ? "default" : "outline"}
            onClick={() => setActiveTab("all")}
            data-testid="tab-all-lessons"
          >
            <List className="w-4 h-4 mr-1.5" />
            All Lessons
            <Badge variant="secondary" className="ml-2 text-xs no-default-active-elevate no-default-hover-elevate">{allCount}</Badge>
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

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground" data-testid="text-lesson-count">
          {totalFilteredLessons} lesson{totalFilteredLessons !== 1 ? "s" : ""} across {activeGroups.length} subcategor{activeGroups.length !== 1 ? "ies" : "y"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFullList(true)}
            data-testid="button-view-full-list"
          >
            <Eye className="w-4 h-4 mr-1.5" />
            View Full List
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadExcel}
            disabled={downloading}
            data-testid="button-download-lessons"
          >
            {downloading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            Download Excel
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {activeGroups.length === 0 ? (
          <Card className="p-8 text-center">
            <List className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No lessons found matching your filters.
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
                          {isAll && (
                            <div className="flex items-center gap-1.5">
                              <Badge className="text-xs bg-cbb text-cbb-foreground no-default-active-elevate no-default-hover-elevate">
                                {group.lessons.filter(l => l.type === "CouldHaveGoneBetter").length}
                              </Badge>
                              <Badge className="text-xs bg-ww text-ww-foreground no-default-active-elevate no-default-hover-elevate">
                                {group.lessons.filter(l => l.type === "WentWell").length}
                              </Badge>
                            </div>
                          )}
                          {!isAll && (
                            <span className="text-xs text-muted-foreground">{group.lessons.length} lesson{group.lessons.length !== 1 ? "s" : ""}</span>
                          )}
                          {showScores && group.effectiveScore > 0 && (
                            <div className="flex items-center gap-1.5">
                              <TrendingDown className={`w-3.5 h-3.5 ${getScoreColor(group.effectiveScore)}`} />
                              <span className={`text-sm font-mono font-semibold ${getScoreColor(group.effectiveScore)}`} data-testid={`text-score-${group.subcategory.id}`}>
                                {group.effectiveScore.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {showScores && group.effectiveScore > 0 && (
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
                        .map((lesson) => {
                          const lessonIsCBB = lesson.type === "CouldHaveGoneBetter";
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => setSelectedLesson(lesson)}
                              className="w-full text-left p-2.5 rounded-md hover-elevate flex items-center justify-between gap-3"
                              data-testid={`button-lesson-${lesson.id}`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-1 h-8 rounded-full flex-shrink-0 ${lessonIsCBB ? "bg-cbb" : "bg-ww"}`} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate"><span className="text-muted-foreground font-mono mr-1.5">#{lesson.id}</span>{lesson.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{lesson.project?.name || "—"} · {lesson.phase}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {lessonIsCBB && lesson.impact && (
                                  <Badge variant="outline" className="text-xs flex-shrink-0 no-default-active-elevate" data-testid={`badge-impact-${lesson.id}`}>
                                    {lesson.impact.weightingPercent}%
                                  </Badge>
                                )}
                                <Badge
                                  className={`text-xs no-default-active-elevate ${lessonIsCBB ? "bg-cbb/15 text-cbb border-cbb/30" : "bg-ww/15 text-ww border-ww/30"}`}
                                  variant="outline"
                                >
                                  {lessonIsCBB ? "CBB" : "WW"}
                                </Badge>
                                <Badge variant="outline" className="text-xs flex-shrink-0 no-default-active-elevate">{lesson.phase}</Badge>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={showFullList} onOpenChange={setShowFullList}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col" data-testid="dialog-full-lesson-list">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Full Lesson List
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap" data-testid="text-filter-summary">
              {!hasActiveFilters(filters) ? (
                <span className="text-sm text-muted-foreground">No filters applied</span>
              ) : (
                filterSummary.filter(f => f.label !== "View").map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-xs no-default-active-elevate no-default-hover-elevate">
                    {f.label}: {f.value}
                  </Badge>
                ))
              )}
              <Badge variant="outline" className="text-xs no-default-active-elevate no-default-hover-elevate" data-testid="badge-view-type">
                {filterSummary.find(f => f.label === "View")?.value}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs no-default-active-elevate no-default-hover-elevate" data-testid="badge-total-count">
                {totalFilteredLessons} lesson{totalFilteredLessons !== 1 ? "s" : ""}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadExcel}
                disabled={downloading}
                data-testid="button-dialog-download"
              >
                {downloading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                Download Excel
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {activeGroups.length === 0 ? (
              <div className="p-8 text-center">
                <List className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No lessons found matching your filters.</p>
              </div>
            ) : (
              activeGroups.map((group) => (
                <div key={group.subcategory.id} data-testid={`fulllist-group-${group.subcategory.id}`}>
                  <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm">{group.subcategory.name}</span>
                      <span className="text-xs text-muted-foreground">({group.category.name})</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="secondary" className="text-xs no-default-active-elevate no-default-hover-elevate">
                        {group.lessons.length} lesson{group.lessons.length !== 1 ? "s" : ""}
                      </Badge>
                      {group.effectiveScore > 0 && (
                        <div className="flex items-center gap-1">
                          <TrendingDown className={`w-3 h-3 ${getScoreColor(group.effectiveScore)}`} />
                          <span className={`text-xs font-mono font-semibold ${getScoreColor(group.effectiveScore)}`}>
                            {group.effectiveScore.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {group.lessons.map((lesson) => {
                      const lessonIsCBB = lesson.type === "CouldHaveGoneBetter";
                      return (
                        <Card
                          key={lesson.id}
                          className="p-3 overflow-visible hover-elevate cursor-pointer"
                          onClick={() => setSelectedLesson(lesson)}
                          data-testid={`fulllist-lesson-${lesson.id}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`w-1 min-h-[3rem] rounded-full flex-shrink-0 mt-0.5 ${lessonIsCBB ? "bg-cbb" : "bg-ww"}`} />
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <p className="text-sm font-medium">
                                  <span className="text-muted-foreground font-mono mr-1.5">#{lesson.id}</span>
                                  {lesson.name}
                                </p>
                                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                                  {lessonIsCBB && lesson.impact && (
                                    <Badge variant="outline" className="text-xs no-default-active-elevate">
                                      {lesson.impact.description} ({lesson.impact.weightingPercent}%)
                                    </Badge>
                                  )}
                                  <Badge
                                    className={`text-xs no-default-active-elevate ${lessonIsCBB ? "bg-cbb/15 text-cbb border-cbb/30" : "bg-ww/15 text-ww border-ww/30"}`}
                                    variant="outline"
                                  >
                                    {lessonIsCBB ? "CBB" : "WW"}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs no-default-active-elevate">{lesson.phase}</Badge>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {lesson.project?.name || "—"} · {lesson.category?.name} · {lesson.subcategory?.name}
                              </p>
                              <p className="text-xs text-muted-foreground/80 line-clamp-2">
                                {lesson.eventDescription || "No event description provided"}
                              </p>
                              <p className="text-xs">
                                <span className="font-medium">Key Learning:</span>{" "}
                                <span className="text-muted-foreground">{lesson.keyLearningOrAction || "Not provided"}</span>
                              </p>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                  <Separator className="mt-4" />
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <LessonDetailDialog
        lesson={selectedLesson}
        open={!!selectedLesson}
        onOpenChange={(open) => !open && setSelectedLesson(null)}
        isAdmin={isAdminUser}
      />
    </div>
  );
}
