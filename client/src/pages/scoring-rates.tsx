import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Gauge, Plus, X, Loader2, Pencil, Check, Lock, RotateCcw, Save, Info } from "lucide-react";
import type { ImpactLevel, ScoringConfig } from "@shared/schema";

function ImpactLevelsSection({ usage }: { usage: Record<number, number> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newDescription, setNewDescription] = useState("");
  const [newWeighting, setNewWeighting] = useState("100");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editWeight, setEditWeight] = useState("");

  const { data: impacts = [], isLoading } = useQuery<ImpactLevel[]>({
    queryKey: ["/api/impact-levels"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { description: string; weightingPercent: number; sortOrder: number }) => {
      const res = await apiRequest("POST", "/api/impact-levels", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/impact-levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data/usage"] });
      setNewDescription("");
      setNewWeighting("100");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create impact level", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { description?: string; weightingPercent?: number } }) => {
      const res = await apiRequest("PATCH", `/api/impact-levels/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/impact-levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data"] });
      setEditingId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update impact level", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/impact-levels/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/impact-levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data/usage"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete impact level", variant: "destructive" });
    },
  });

  const handleAdd = () => {
    if (!newDescription.trim()) return;
    const w = parseInt(newWeighting);
    if (isNaN(w) || w < 100) return;
    createMutation.mutate({
      description: newDescription.trim(),
      weightingPercent: w,
      sortOrder: impacts.length + 1,
    });
  };

  const startEdit = (impact: ImpactLevel) => {
    setEditingId(impact.id);
    setEditDesc(impact.description);
    setEditWeight(String(impact.weightingPercent));
  };

  const saveEdit = () => {
    if (!editingId) return;
    const w = parseInt(editWeight);
    if (isNaN(w) || w < 100) return;
    updateMutation.mutate({
      id: editingId,
      data: { description: editDesc.trim(), weightingPercent: w },
    });
  };

  if (isLoading) return <Skeleton className="h-20 w-full" />;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {impacts.map((impact) => {
          const usageCount = usage[impact.id] || 0;
          const inUse = usageCount > 0;

          return (
            <div key={impact.id} className="flex items-center gap-2 py-1.5 group" data-testid={`row-impact-${impact.id}`}>
              <Badge variant="outline" className="text-[10px] font-mono flex-shrink-0 no-default-active-elevate" data-testid={`badge-code-impact-${impact.id}`}>
                IMP-{impact.id}
              </Badge>

              {editingId === impact.id ? (
                <>
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <Input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="flex-1 min-w-[200px]"
                      data-testid={`input-edit-impact-desc-${impact.id}`}
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={100}
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        className="w-20"
                        disabled={inUse}
                        data-testid={`input-edit-impact-weight-${impact.id}`}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      {inUse && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Weighting locked: assigned to {usageCount} lesson(s)</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={saveEdit} disabled={updateMutation.isPending} data-testid={`button-save-impact-${impact.id}`}>
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-impact-${impact.id}`}>
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" data-testid={`text-impact-desc-${impact.id}`}>{impact.description}</p>
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0 no-default-active-elevate" data-testid={`badge-impact-weight-${impact.id}`}>
                    {impact.weightingPercent}%
                  </Badge>

                  {inUse && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-[10px] flex-shrink-0 no-default-active-elevate" data-testid={`badge-usage-impact-${impact.id}`}>
                          {usageCount} used
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Assigned to {usageCount} lesson(s). Cannot delete.</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEdit(impact)}
                    className="invisible group-hover:visible"
                    data-testid={`button-edit-impact-${impact.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>

                  {inUse ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="p-1 flex-shrink-0 opacity-30" data-testid={`button-delete-impact-${impact.id}`}>
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cannot delete: assigned to {usageCount} lesson(s)</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => deleteMutation.mutate(impact.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") deleteMutation.mutate(impact.id); }}
                      className="p-1 rounded-full cursor-pointer opacity-60 hover-elevate invisible group-hover:visible"
                      data-testid={`button-delete-impact-${impact.id}`}
                      aria-label={`Delete ${impact.description}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
        {impacts.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No impact levels defined yet.</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Impact description..."
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          className="flex-1 min-w-[200px]"
          data-testid="input-add-impact-desc"
        />
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={100}
            placeholder="100"
            value={newWeighting}
            onChange={(e) => setNewWeighting(e.target.value)}
            className="w-20"
            data-testid="input-add-impact-weight"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
        <Button
          size="icon"
          variant="outline"
          onClick={handleAdd}
          disabled={createMutation.isPending || !newDescription.trim()}
          data-testid="button-add-impact"
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

function ScoringConfigSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery<ScoringConfig>({
    queryKey: ["/api/scoring-config"],
  });

  const [initialScore, setInitialScore] = useState<string>("");
  const [incrementScore, setIncrementScore] = useState<string>("");
  const [dailyDecrement, setDailyDecrement] = useState<string>("");
  const [hasEdited, setHasEdited] = useState(false);

  const populateFields = (cfg: ScoringConfig) => {
    setInitialScore(String(cfg.initialScore));
    setIncrementScore(String(cfg.incrementScore));
    setDailyDecrement(String(cfg.dailyDecrement));
    setHasEdited(false);
  };

  if (config && !hasEdited && initialScore === "") {
    populateFields(config);
  }

  const updateMutation = useMutation({
    mutationFn: async (data: { initialScore: number; incrementScore: number; dailyDecrement: number }) => {
      const res = await apiRequest("PATCH", "/api/scoring-config", data);
      return res.json();
    },
    onSuccess: (data: ScoringConfig) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scoring-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      populateFields(data);
      toast({ title: "Scoring updated", description: "Scoring parameters saved and all scores recalculated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update scoring config", variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/scoring-config/reset");
      return res.json();
    },
    onSuccess: (data: ScoringConfig) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scoring-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      populateFields(data);
      toast({ title: "Scoring reset", description: "Scoring parameters restored to defaults and all scores recalculated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reset scoring config", variant: "destructive" });
    },
  });

  const handleSave = () => {
    const i = parseInt(initialScore);
    const inc = parseInt(incrementScore);
    const d = parseInt(dailyDecrement);
    if (isNaN(i) || isNaN(inc) || isNaN(d)) {
      toast({ title: "Invalid values", description: "All scoring values must be whole numbers.", variant: "destructive" });
      return;
    }
    if (i < 0 || inc < 0 || d < 0) {
      toast({ title: "Invalid values", description: "Scoring values cannot be negative.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ initialScore: i, incrementScore: inc, dailyDecrement: d });
  };

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setHasEdited(true);
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" data-testid="label-initial-score">Initial Score</label>
          <p className="text-xs text-muted-foreground">Points assigned when a subcategory first receives a lesson</p>
          <Input
            type="number"
            min={0}
            value={initialScore}
            onChange={handleChange(setInitialScore)}
            data-testid="input-initial-score"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" data-testid="label-increment-score">Increment Score</label>
          <p className="text-xs text-muted-foreground">Points added each time a new lesson is recorded against a subcategory</p>
          <Input
            type="number"
            min={0}
            value={incrementScore}
            onChange={handleChange(setIncrementScore)}
            data-testid="input-increment-score"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" data-testid="label-daily-decrement">Daily Decrement</label>
          <p className="text-xs text-muted-foreground">Points deducted per day as the issue ages without new occurrences</p>
          <Input
            type="number"
            min={0}
            value={dailyDecrement}
            onChange={handleChange(setDailyDecrement)}
            data-testid="input-daily-decrement"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 flex-wrap">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending || !hasEdited}
          data-testid="button-save-scoring"
        >
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save & Recalculate
        </Button>
        <Button
          variant="outline"
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
          data-testid="button-reset-scoring"
        >
          {resetMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
          Reset to Defaults
        </Button>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
        <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Saving or resetting will recalculate all existing subcategory scores based on the new parameters. Impact level weightings are applied as multipliers (e.g. 150% = 1.5x) to both initial and increment scores.
        </p>
      </div>
    </div>
  );
}

export default function ScoringRatesPage() {
  const { user } = useAuth();

  const currentUserRole = user?.role as string;
  const isCurrentAdmin = currentUserRole === "admin" || currentUserRole === "superadmin" || currentUserRole === "superadministrator";

  const { data: usageData } = useQuery<Record<string, Record<number, number>>>({
    queryKey: ["/api/reference-data/usage"],
  });

  if (!isCurrentAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-bold" data-testid="text-scoring-rates-title">Scoring Rates</h1>
        <p className="text-muted-foreground mt-1">Configure scoring parameters and impact level weightings.</p>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold" data-testid="text-scoring-config-title">Scoring Parameters</h2>
          </div>
        </div>
        <ScoringConfigSection />
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold" data-testid="text-impact-levels-title">Impact Levels</h2>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Impact levels determine score weighting multipliers. A weighting of 100% applies the base score; higher values increase the impact proportionally.
        </p>
        <ImpactLevelsSection usage={usageData?.ImpactLevel || {}} />
      </Card>
    </div>
  );
}
