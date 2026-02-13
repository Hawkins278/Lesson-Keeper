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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Plus, X, Loader2, Shield, ShieldAlert, Download } from "lucide-react";
import type { User } from "@shared/models/auth";

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

const FIELD_LABELS: Record<string, string> = {
  ProjectType: "Project Types",
  ProjectPhase: "Project Phases",
  LessonCategory: "Lesson Categories",
  LessonSubcategory: "Lesson Subcategories",
};

function ReferenceFieldSection({
  type,
  entries,
  categories,
  onAdd,
  onRemove,
  isAdding,
}: {
  type: string;
  entries: RefEntry[];
  categories?: RefEntry[];
  onAdd: (value: string, categoryId?: number) => void;
  onRemove: (id: number) => void;
  isAdding: boolean;
}) {
  const [newValue, setNewValue] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

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

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold" data-testid={`text-ref-section-${type}`}>{FIELD_LABELS[type]}</h3>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((entry) => (
          <Badge
            key={entry.id}
            variant="secondary"
            className="gap-1 pr-1 no-default-active-elevate"
            data-testid={`badge-ref-${type}-${entry.id}`}
          >
            <span className="text-xs">{entry.value}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onRemove(entry.id); }}
              className="ml-0.5 rounded-full p-0.5 cursor-pointer opacity-60 hover-elevate"
              data-testid={`button-remove-ref-${type}-${entry.id}`}
              aria-label={`Remove ${entry.value}`}
            >
              <X className="w-3 h-3" />
            </span>
          </Badge>
        ))}
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

  const currentUserRole = user?.role as string;
  const isCurrentAdmin = currentUserRole === "admin";

  const { data: refData, isLoading: refLoading } = useQuery<ReferenceData>({
    queryKey: ["/api/reference-data"],
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
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add value", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      const res = await apiRequest("DELETE", `/api/reference-data/${type}/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data"] });
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
        <p className="text-sm text-muted-foreground mb-6">
          Manage the predefined values used in lesson templates and dropdown fields.
        </p>

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
              onAdd={(value) => addMutation.mutate({ type: "ProjectType", value })}
              onRemove={(id) => removeMutation.mutate({ type: "ProjectType", id })}
              isAdding={addMutation.isPending}
            />
            <Separator />
            <ReferenceFieldSection
              type="ProjectPhase"
              entries={refData.projectPhases}
              onAdd={(value) => addMutation.mutate({ type: "ProjectPhase", value })}
              onRemove={(id) => removeMutation.mutate({ type: "ProjectPhase", id })}
              isAdding={addMutation.isPending}
            />
            <Separator />
            <ReferenceFieldSection
              type="LessonCategory"
              entries={refData.categories}
              onAdd={(value) => addMutation.mutate({ type: "LessonCategory", value })}
              onRemove={(id) => removeMutation.mutate({ type: "LessonCategory", id })}
              isAdding={addMutation.isPending}
            />
            <Separator />
            <ReferenceFieldSection
              type="LessonSubcategory"
              entries={refData.subcategories}
              categories={refData.categories}
              onAdd={(value, categoryId) => addMutation.mutate({ type: "LessonSubcategory", value, categoryId })}
              onRemove={(id) => removeMutation.mutate({ type: "LessonSubcategory", id })}
              isAdding={addMutation.isPending}
            />
          </div>
        ) : null}
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
                onClick={() => addAdminMutation.mutate(adminEmail.trim())}
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
    </div>
  );
}
