import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Plus, X, Loader2, Shield, ShieldAlert, Download, Gauge, Pencil, Check, Lock, Info, Users, Trash2 } from "lucide-react";
import type { User } from "@shared/models/auth";
import type { ImpactLevel } from "@shared/schema";

interface RefEntry {
  id: number;
  value: string;
  categoryId?: number;
}

interface ReferenceData {
  projectTypes: RefEntry[];
  projectPhases: RefEntry[];
  categories: RefEntry[];
  subcategories: (RefEntry & { categoryId: number })[];
}

type UsageCounts = Record<string, Record<number, number>>;

const FIELD_LABELS: Record<string, string> = {
  ProjectType: "Project Types",
  ProjectPhase: "Project Phases",
  LessonCategory: "Lesson Categories",
  LessonSubcategory: "Lesson Subcategories",
};

const SYSTEM_CODE_PREFIX: Record<string, string> = {
  ProjectType: "PT",
  ProjectPhase: "PH",
  LessonCategory: "CAT",
  LessonSubcategory: "SUB",
};

function ReferenceFieldSection({
  type,
  entries,
  categories,
  usage,
  onAdd,
  onRemove,
  onRename,
  isAdding,
}: {
  type: string;
  entries: RefEntry[];
  categories?: RefEntry[];
  usage: Record<number, number>;
  onAdd: (value: string, categoryId?: number) => void;
  onRemove: (id: number) => void;
  onRename: (id: number, newValue: string) => void;
  isAdding: boolean;
}) {
  const [newValue, setNewValue] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const prefix = SYSTEM_CODE_PREFIX[type] || "REF";

  const handleAdd = () => {
    if (!newValue.trim()) return;
    if (type === "LessonSubcategory" && !selectedCategoryId) return;
    onAdd(newValue.trim(), type === "LessonSubcategory" ? Number(selectedCategoryId) : undefined);
    setNewValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const startEdit = (entry: RefEntry) => {
    setEditingId(entry.id);
    setEditValue(entry.value);
  };

  const saveEdit = () => {
    if (!editingId || !editValue.trim()) return;
    onRename(editingId, editValue.trim());
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const getCategoryName = (catId?: number) => {
    if (!catId || !categories) return "";
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.value : "";
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold" data-testid={`text-ref-section-${type}`}>{FIELD_LABELS[type]}</h3>
      <div className="space-y-1">
        {entries.map((entry) => {
          const usageCount = usage[entry.id] || 0;
          const inUse = usageCount > 0;
          const isEditing = editingId === entry.id;
          const systemCode = `${prefix}-${entry.id}`;

          return (
            <div key={entry.id} className="flex items-center gap-2 py-1.5 group" data-testid={`row-ref-${type}-${entry.id}`}>
              <Badge variant="outline" className="text-[10px] font-mono flex-shrink-0 no-default-active-elevate" data-testid={`badge-code-${type}-${entry.id}`}>
                {systemCode}
              </Badge>

              {isEditing ? (
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                    className="flex-1 min-w-[150px]"
                    autoFocus
                    data-testid={`input-edit-ref-${type}-${entry.id}`}
                  />
                  <Button size="icon" variant="ghost" onClick={saveEdit} data-testid={`button-save-ref-${type}-${entry.id}`}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={cancelEdit} data-testid={`button-cancel-ref-${type}-${entry.id}`}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm truncate" data-testid={`text-ref-label-${type}-${entry.id}`}>
                    {entry.value}
                    {type === "LessonSubcategory" && entry.categoryId && (
                      <span className="text-xs text-muted-foreground ml-2">({getCategoryName(entry.categoryId)})</span>
                    )}
                  </span>

                  {inUse && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-[10px] flex-shrink-0 no-default-active-elevate" data-testid={`badge-usage-${type}-${entry.id}`}>
                          {usageCount} used
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Assigned to {usageCount} record(s). Cannot delete.</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEdit(entry)}
                    className="invisible group-hover:visible flex-shrink-0"
                    data-testid={`button-edit-ref-${type}-${entry.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>

                  {inUse ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="p-1 flex-shrink-0 opacity-30" data-testid={`button-remove-ref-${type}-${entry.id}`}>
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cannot delete: assigned to {usageCount} record(s)</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onRemove(entry.id); }}
                      className="p-1 rounded-full cursor-pointer opacity-60 hover-elevate invisible group-hover:visible flex-shrink-0"
                      data-testid={`button-remove-ref-${type}-${entry.id}`}
                      aria-label={`Remove ${entry.value}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
        {entries.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No entries yet</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {type === "LessonSubcategory" && categories && (
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger className="w-40 flex-shrink-0" data-testid={`select-subcategory-category-${type}`}>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input
          placeholder={`Add new ${FIELD_LABELS[type].toLowerCase().replace(/s$/, "")}...`}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
          data-testid={`input-add-ref-${type}`}
        />
        <Button
          size="icon"
          variant="outline"
          onClick={handleAdd}
          disabled={isAdding || !newValue.trim() || (type === "LessonSubcategory" && !selectedCategoryId)}
          data-testid={`button-add-ref-${type}`}
        >
          {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

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

function UserCard({ user, onRemove, canRemove }: { user: User; onRemove?: () => void; canRemove: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const initials = `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U";

  const handleRemoveClick = () => {
    if (confirming) {
      onRemove?.();
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={user.profileImageUrl || undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" data-testid={`text-admin-name-${user.id}`}>
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-muted-foreground truncate" data-testid={`text-admin-email-${user.id}`}>
            {user.email || user.id}
          </p>
        </div>
      </div>
      {canRemove && onRemove && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {confirming && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              data-testid={`button-cancel-remove-${user.id}`}
            >
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            variant={confirming ? "destructive" : "outline"}
            onClick={handleRemoveClick}
            data-testid={`button-remove-admin-${user.id}`}
          >
            {confirming ? "Confirm Demote" : "Demote to User"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminEmail, setAdminEmail] = useState("");

  const [newUserEmail, setNewUserEmail] = useState("");
  const [removeUserEmail, setRemoveUserEmail] = useState("");

  const currentUserRole = user?.role as string;
  const isCurrentAdmin = currentUserRole === "admin" || currentUserRole === "superadmin" || currentUserRole === "superadministrator";

  const { data: refData, isLoading: refLoading } = useQuery<ReferenceData>({
    queryKey: ["/api/reference-data"],
  });

  const { data: usageData } = useQuery<UsageCounts>({
    queryKey: ["/api/reference-data/usage"],
  });

  const { data: adminData, isLoading: adminLoading } = useQuery<{ admins: User[] }>({
    queryKey: ["/api/admin/users"],
  });


  const addMutation = useMutation({
    mutationFn: async ({ type, value, categoryId }: { type: string; value: string; categoryId?: number }) => {
      const res = await apiRequest("POST", `/api/reference-data/${type}`, { value, categoryId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data/usage"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add value", variant: "destructive" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ type, id, value }: { type: string; id: number; value: string }) => {
      const res = await apiRequest("PATCH", `/api/reference-data/${type}/${id}`, { value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data/usage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to rename value", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      const res = await apiRequest("DELETE", `/api/reference-data/${type}/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data/usage"] });
    },
    onError: (error: any) => {
      toast({ title: "Cannot remove", description: error.message || "Failed to remove value", variant: "destructive" });
    },
  });

  const addAdminMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/admin/add", { email });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setAdminEmail("");
      toast({ title: "Success", description: "Admin added" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add admin", variant: "destructive" });
    },
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/remove/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "Admin removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove admin", variant: "destructive" });
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/admin/users", { email });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
      setNewUserEmail("");
      toast({ title: "Success", description: "User added. They will be linked to this account when they first log in." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add user", variant: "destructive" });
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("DELETE", "/api/admin/users/by-email", { email });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
      setRemoveUserEmail("");
      toast({ title: "Success", description: "User removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove user", variant: "destructive" });
    },
  });

  const handleDownloadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users/download", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "users-list.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: "User list has been saved as CSV." });
    } catch {
      toast({ title: "Error", description: "Failed to download user list", variant: "destructive" });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch("/api/template", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lessons-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Template downloaded", description: "The template has been saved with the current reference data." });
    } catch {
      toast({ title: "Error", description: "Failed to download template", variant: "destructive" });
    }
  };

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
        <h1 className="text-2xl font-serif font-bold" data-testid="text-admin-title">Administration</h1>
        <p className="text-muted-foreground mt-1">Manage reference data and admin accounts.</p>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold" data-testid="text-ref-data-title">Reference Data</h2>
          </div>
          <Button variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </Button>
        </div>
        <div className="flex items-center gap-2 mb-6">
          <Info className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Each value has a system code (read-only). Labels can be renamed and changes apply to all linked records. Values assigned to existing data cannot be deleted.
          </p>
        </div>

        {refLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : refData ? (
          <div className="space-y-6">
            <ReferenceFieldSection
              type="ProjectType"
              entries={refData.projectTypes}
              usage={usageData?.ProjectType || {}}
              onAdd={(value) => addMutation.mutate({ type: "ProjectType", value })}
              onRemove={(id) => removeMutation.mutate({ type: "ProjectType", id })}
              onRename={(id, value) => renameMutation.mutate({ type: "ProjectType", id, value })}
              isAdding={addMutation.isPending}
            />
            <Separator />
            <ReferenceFieldSection
              type="ProjectPhase"
              entries={refData.projectPhases}
              usage={usageData?.ProjectPhase || {}}
              onAdd={(value) => addMutation.mutate({ type: "ProjectPhase", value })}
              onRemove={(id) => removeMutation.mutate({ type: "ProjectPhase", id })}
              onRename={(id, value) => renameMutation.mutate({ type: "ProjectPhase", id, value })}
              isAdding={addMutation.isPending}
            />
            <Separator />
            <ReferenceFieldSection
              type="LessonCategory"
              entries={refData.categories}
              usage={usageData?.LessonCategory || {}}
              onAdd={(value) => addMutation.mutate({ type: "LessonCategory", value })}
              onRemove={(id) => removeMutation.mutate({ type: "LessonCategory", id })}
              onRename={(id, value) => renameMutation.mutate({ type: "LessonCategory", id, value })}
              isAdding={addMutation.isPending}
            />
            <Separator />
            <ReferenceFieldSection
              type="LessonSubcategory"
              entries={refData.subcategories}
              categories={refData.categories}
              usage={usageData?.LessonSubcategory || {}}
              onAdd={(value, categoryId) => addMutation.mutate({ type: "LessonSubcategory", value, categoryId })}
              onRemove={(id) => removeMutation.mutate({ type: "LessonSubcategory", id })}
              onRename={(id, value) => renameMutation.mutate({ type: "LessonSubcategory", id, value })}
              isAdding={addMutation.isPending}
            />
          </div>
        ) : null}
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold" data-testid="text-impact-levels-title">Impact Levels</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Define impact levels for "Could Be Better" lessons. Higher weighting percentages increase the risk score contribution.
        </p>
        <ImpactLevelsSection usage={usageData?.ImpactLevel || {}} />
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold" data-testid="text-admin-accounts-title">Admin Accounts</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          Admins have full access including reference data management, lesson uploads, and user administration.
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          There must always be at least 2 admins. Each must have an email and ID.
        </p>

        {adminLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div>
            {adminData?.admins && adminData.admins.length > 0 ? (
              <div className="divide-y">
                {adminData.admins.map((admin) => (
                  <UserCard
                    key={admin.id}
                    user={admin}
                    canRemove={adminData.admins.length > 2}
                    onRemove={() => removeAdminMutation.mutate(admin.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic py-2">No admin accounts.</p>
            )}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Input
                placeholder="Enter user email to add as admin..."
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && adminEmail.trim()) {
                    addAdminMutation.mutate(adminEmail.trim());
                  }
                }}
                className="flex-1"
                data-testid="input-add-admin-email"
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (adminEmail.trim()) addAdminMutation.mutate(adminEmail.trim());
                }}
                disabled={addAdminMutation.isPending || !adminEmail.trim()}
                data-testid="button-add-admin"
              >
                {addAdminMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Add Admin
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold" data-testid="text-user-management-title">User Management</h2>
          </div>
          <Button variant="outline" onClick={handleDownloadUsers} data-testid="button-download-users">
            <Download className="w-4 h-4 mr-2" />
            Download User List
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Add or remove users by email address. When a new user logs in, their account will be linked automatically by their email. Download the full list to see all users with admin status.
        </p>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Add User</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="email"
                placeholder="Enter user email address..."
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newUserEmail.trim()) {
                    addUserMutation.mutate(newUserEmail.trim());
                  }
                }}
                className="flex-1 min-w-[250px]"
                data-testid="input-add-user-email"
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (newUserEmail.trim()) addUserMutation.mutate(newUserEmail.trim());
                }}
                disabled={addUserMutation.isPending || !newUserEmail.trim()}
                data-testid="button-add-user"
              >
                {addUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Add User
              </Button>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-2">Remove User</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="email"
                placeholder="Enter user email to remove..."
                value={removeUserEmail}
                onChange={(e) => setRemoveUserEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && removeUserEmail.trim()) {
                    removeUserMutation.mutate(removeUserEmail.trim());
                  }
                }}
                className="flex-1 min-w-[250px]"
                data-testid="input-remove-user-email"
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (removeUserEmail.trim()) removeUserMutation.mutate(removeUserEmail.trim());
                }}
                disabled={removeUserMutation.isPending || !removeUserEmail.trim()}
                data-testid="button-remove-user"
              >
                {removeUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Remove User
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
