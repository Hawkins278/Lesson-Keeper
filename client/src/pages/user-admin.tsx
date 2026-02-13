import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Loader2, ShieldAlert, Download, Users, Trash2 } from "lucide-react";
import type { User } from "@shared/models/auth";

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

export default function UserAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminEmail, setAdminEmail] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [removeUserEmail, setRemoveUserEmail] = useState("");

  const currentUserRole = user?.role as string;
  const isCurrentAdmin = currentUserRole === "admin" || currentUserRole === "superadmin" || currentUserRole === "superadministrator";

  const { data: adminData, isLoading: adminLoading } = useQuery<{ admins: User[] }>({
    queryKey: ["/api/admin/users"],
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
        <h1 className="text-2xl font-serif font-bold" data-testid="text-user-admin-title">User Administration</h1>
        <p className="text-muted-foreground mt-1">Manage admin accounts and user access.</p>
      </div>

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
