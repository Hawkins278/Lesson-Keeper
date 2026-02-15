/**
 * @file LessonDetailDialog — Modal dialog for viewing (and optionally editing)
 * a single lesson's full details.
 *
 * Displays the lesson's:
 *   - Name (with numeric ID prefix)
 *   - Type badge ("Went Well" or "Could Be Better")
 *   - Phase badge
 *   - Associated project info (name, type, manager, close date)
 *   - Category / subcategory
 *   - Impact level (only shown for "Could Be Better" lessons)
 *   - Event description ("What Happened")
 *   - Key learning / action
 *
 * When `isAdmin` is true, an edit button appears in the header. Clicking it
 * switches editable fields (name, event description, key learning, phase,
 * impact level) into inline form controls. Reference data for phases and
 * impact levels is lazily fetched only when editing mode is activated
 * (`enabled: editing`).
 *
 * After a successful save the component invalidates both the global lessons
 * cache and the project-specific lessons cache so that the dashboard and
 * project detail pages reflect the update immediately.
 *
 * @prop {Lesson & { project?, category?, subcategory?, impact? } | null} lesson
 *   The lesson to display. When `null` the component renders nothing.
 * @prop {boolean}  open          — Controls dialog visibility.
 * @prop {(open: boolean) => void} onOpenChange — Callback when visibility changes.
 * @prop {boolean}  isAdmin       — If true, shows the edit/save controls.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, FolderOpen, Layers, Tag, User, FileText, Gauge, Pencil, X, Save } from "lucide-react";
import { formatUKDate } from "@/lib/format-date";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lesson, Project, LessonCategory, LessonSubcategory, ImpactLevel, ReferenceValue } from "@shared/schema";

interface LessonDetailDialogProps {
  lesson: (Lesson & { project?: Project; category?: LessonCategory; subcategory?: LessonSubcategory; impact?: ImpactLevel }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}

export function LessonDetailDialog({ lesson, open, onOpenChange, isAdmin }: LessonDetailDialogProps) {
  // Local editing state — each editable field gets its own state variable
  // so the user can modify them independently and cancel without affecting
  // the original lesson data.
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEvent, setEditEvent] = useState("");
  const [editLearning, setEditLearning] = useState("");
  const [editPhase, setEditPhase] = useState("");
  const [editImpactId, setEditImpactId] = useState<string>("");
  const { toast } = useToast();

  // Lazily fetch phase reference data only when editing mode is active.
  const { data: phases = [] } = useQuery<ReferenceValue[]>({
    queryKey: ["/api/reference-data", "ProjectPhase"],
    enabled: editing,
  });

  // Lazily fetch impact levels only when editing mode is active.
  const { data: impactLevels = [] } = useQuery<ImpactLevel[]>({
    queryKey: ["/api/impact-levels"],
    enabled: editing,
  });

  // Mutation to PATCH the lesson. On success, invalidate both the global
  // lessons list and the project-specific lessons list so the UI stays in
  // sync across pages.
  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; eventDescription: string; keyLearningOrAction: string; phase: string; impactId: number | null }) => {
      await apiRequest("PATCH", `/api/lessons/${lesson?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      if (lesson?.projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", lesson.projectId, "lessons"] });
      }
      toast({ title: "Lesson updated" });
      setEditing(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update lesson", description: error.message, variant: "destructive" });
    },
  });

  // Render nothing when no lesson is selected.
  if (!lesson) return null;

  // Determine the lesson type to conditionally style the badge and
  // decide whether to show the impact section.
  const isWentWell = lesson.type === "WentWell";

  // Populate edit fields from the current lesson data before entering
  // editing mode. This ensures the form starts with the existing values.
  const startEdit = () => {
    setEditName(lesson.name);
    setEditEvent(lesson.eventDescription || "");
    setEditLearning(lesson.keyLearningOrAction || "");
    setEditPhase(lesson.phase);
    setEditImpactId(lesson.impactId ? String(lesson.impactId) : "");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  // Fire the PATCH mutation with the current edit-field values.
  const saveEdit = () => {
    updateMutation.mutate({
      name: editName,
      eventDescription: editEvent,
      keyLearningOrAction: editLearning,
      phase: editPhase,
      impactId: editImpactId ? parseInt(editImpactId) : null,
    });
  };

  // When the dialog closes (o === false), reset editing mode so the
  // next open starts in read-only view.
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg leading-snug" data-testid="text-lesson-detail-title">
                <span className="text-muted-foreground font-mono mr-1.5">#{lesson.id}</span>
                {editing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1"
                    data-testid="input-edit-lesson-name"
                  />
                ) : (
                  lesson.name
                )}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge
                  className={`text-xs ${isWentWell ? "bg-ww text-ww-foreground" : "bg-cbb text-cbb-foreground"}`}
                  data-testid="badge-lesson-type"
                >
                  {isWentWell ? "Went Well" : "Could Be Better"}
                </Badge>
                {editing ? (
                  <Select value={editPhase} onValueChange={setEditPhase}>
                    <SelectTrigger className="w-[160px] h-7 text-xs" data-testid="select-edit-phase">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {phases.map((p) => (
                        <SelectItem key={p.id} value={p.value}>{p.value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className="text-xs" data-testid="badge-lesson-phase">
                    {lesson.phase}
                  </Badge>
                )}
              </div>
            </div>
            {isAdmin && !editing && (
              <Button size="icon" variant="ghost" onClick={startEdit} data-testid="button-edit-lesson">
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            {editing && (
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={cancelEdit} data-testid="button-cancel-edit">
                  <X className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="default" onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-lesson">
                  <Save className="w-4 h-4" />
                </Button>
              </div>
            )}
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
                    {formatUKDate(lesson.project.closeDate)}
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

          {!isWentWell && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Gauge className="w-4 h-4 text-muted-foreground" />
                Impact
              </div>
              <div className="ml-6 text-sm">
                {editing ? (
                  <Select value={editImpactId} onValueChange={setEditImpactId}>
                    <SelectTrigger className="w-full" data-testid="select-edit-impact">
                      <SelectValue placeholder="Select impact level" />
                    </SelectTrigger>
                    <SelectContent>
                      {impactLevels.map((il) => (
                        <SelectItem key={il.id} value={String(il.id)}>
                          {il.description} ({il.weightingPercent}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : lesson.impact ? (
                  <>
                    <p data-testid="text-lesson-impact">{lesson.impact.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-lesson-impact-weighting">
                      Weighting: {lesson.impact.weightingPercent}%
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No impact level set</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4 text-muted-foreground" />
              What Happened
            </div>
            {editing ? (
              <Textarea
                value={editEvent}
                onChange={(e) => setEditEvent(e.target.value)}
                className="ml-6 text-sm"
                rows={3}
                data-testid="input-edit-event-description"
              />
            ) : (
              <p className="ml-6 text-sm text-muted-foreground leading-relaxed" data-testid="text-event-description">
                {lesson.eventDescription || "—"}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Tag className="w-4 h-4 text-muted-foreground" />
              Key Learning / Action
            </div>
            {editing ? (
              <Textarea
                value={editLearning}
                onChange={(e) => setEditLearning(e.target.value)}
                className="ml-6 text-sm"
                rows={3}
                data-testid="input-edit-key-learning"
              />
            ) : (
              <div className="ml-6 rounded-md bg-muted/50 p-3">
                <p className="text-sm leading-relaxed" data-testid="text-key-learning">
                  {lesson.keyLearningOrAction || "—"}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
