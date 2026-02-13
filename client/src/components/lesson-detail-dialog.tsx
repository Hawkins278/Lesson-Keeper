import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, FolderOpen, Layers, Tag, User, FileText, Gauge } from "lucide-react";
import type { Lesson, Project, LessonCategory, LessonSubcategory, ImpactLevel } from "@shared/schema";

interface LessonDetailDialogProps {
  lesson: (Lesson & { project?: Project; category?: LessonCategory; subcategory?: LessonSubcategory; impact?: ImpactLevel }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LessonDetailDialog({ lesson, open, onOpenChange }: LessonDetailDialogProps) {
  if (!lesson) return null;

  const isWentWell = lesson.type === "WentWell";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg leading-snug" data-testid="text-lesson-detail-title">
                <span className="text-muted-foreground font-mono mr-1.5">#{lesson.id}</span>{lesson.name}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge
                  className={`text-xs ${isWentWell ? "bg-ww text-ww-foreground" : "bg-cbb text-cbb-foreground"}`}
                  data-testid="badge-lesson-type"
                >
                  {isWentWell ? "Went Well" : "Could Be Better"}
                </Badge>
                <Badge variant="outline" className="text-xs" data-testid="badge-lesson-phase">
                  {lesson.phase}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        <div className="space-y-4">
          {lesson.project && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                Project
              </div>
              <div className="ml-6 space-y-1 text-sm">
                <p data-testid="text-project-name">{lesson.project.name}</p>
                <p className="text-muted-foreground">{lesson.project.projectType}</p>
                {lesson.project.projectManager && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    {lesson.project.projectManager}
                  </div>
                )}
                {lesson.project.closeDate && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {lesson.project.closeDate}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Layers className="w-4 h-4 text-muted-foreground" />
              Category
            </div>
            <div className="ml-6 text-sm">
              <p data-testid="text-lesson-category">{lesson.category?.name || "—"}</p>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Tag className="w-3.5 h-3.5" />
                <span data-testid="text-lesson-subcategory">{lesson.subcategory?.name || "—"}</span>
              </div>
            </div>
          </div>

          {!isWentWell && lesson.impact && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Gauge className="w-4 h-4 text-muted-foreground" />
                Impact
              </div>
              <div className="ml-6 text-sm">
                <p data-testid="text-lesson-impact">{lesson.impact.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-lesson-impact-weighting">
                  Weighting: {lesson.impact.weightingPercent}%
                </p>
              </div>
            </div>
          )}

          {lesson.eventDescription && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="w-4 h-4 text-muted-foreground" />
                What Happened
              </div>
              <p className="ml-6 text-sm text-muted-foreground leading-relaxed" data-testid="text-event-description">
                {lesson.eventDescription}
              </p>
            </div>
          )}

          {lesson.keyLearningOrAction && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Tag className="w-4 h-4 text-muted-foreground" />
                Key Learning / Action
              </div>
              <div className="ml-6 rounded-md bg-muted/50 p-3">
                <p className="text-sm leading-relaxed" data-testid="text-key-learning">
                  {lesson.keyLearningOrAction}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
