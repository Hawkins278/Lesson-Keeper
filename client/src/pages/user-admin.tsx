/**
 * @file user-admin.tsx — User Administration Page
 *
 * @description
 * Admin-only page for managing user accounts and admin privileges.
 *
 * Key features:
 * - **Admin Accounts section**: lists all current admins with avatar, name,
 *   and email. Admins can be demoted to regular users via a two-click
 *   confirm flow, but only when there are more than 2 admins (minimum of 2
 *   admins is enforced to prevent lockout).
 * - **Promote to admin**: enter an email address to grant admin privileges
 *   to an existing user. If the user hasn't logged in yet, the server
 *   creates a pre-registered record that will be linked on first login.
 * - **User Management section**:
 *   - **Pre-registration**: add a user by email before they log in; the
 *     account is created in a pending state and linked automatically when
 *     the user authenticates for the first time.
 *   - **Remove user**: remove a user by email address.
 * - **CSV download**: exports the full user list (including admin status)
 *   as a CSV file via GET /api/admin/users/download.
 *
 * Access: restricted to "admin", "superadmin", or "superadministrator" roles.
 *
 * Data flow:
 * - GET    /api/admin/users           → { admins: User[] }
 * - POST   /api/admin/add             → promote user to admin by email
 * - DELETE /api/admin/remove/:userId  → demote admin to regular user
 * - POST   /api/admin/users           → pre-register a user by email
 * - DELETE /api/admin/users/by-email  → remove a user by email
 * - GET    /api/admin/users/download  → CSV blob of all users
 */
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

/**
 * UserCard — displays a single admin user row with an optional demote button.
 * Uses a two-step confirmation pattern: first click shows "Confirm Demote",
 * second click executes the demotion. A "Cancel" button resets the state.
 */
function UserCard({ user, onRemove, canRemove }: { user: User; onRemove?: () => void; canRemove: boolean }) {
  // Two-phase confirmation state for the demote action
  const [confirming, setConfirming] = useState(false);
  // Build initials from first/last name; fall back to "U" if both are empty
  const initials = `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U";

  /** Toggle between "request confirmation" and "execute demotion" states */
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

/**
 * UserAdminPage — top-level page component for user & admin management.
 * Two Card sections: Admin Accounts (promote/demote) and User Management
 * (pre-register/remove users + CSV export).
 */
export default function UserAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Input state for the three email fields
  const [adminEmail, setAdminEmail] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [removeUserEmail, setRemoveUserEmail] = useState("");

  // Role-based access gate
  const currentUserRole = user?.role as string;
  const isCurrentAdmin = currentUserRole === "admin" || currentUserRole === "superadmin" || currentUserRole === "superadministrator";

  // Fetch the list of current admin users
  const { data: adminData, isLoading: adminLoading } = useQuery<{ admins: User[] }>({
    queryKey: ["/api/admin/users"],
  });

  // Mutation: promote a user to admin by email
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

  // Mutation: demote an admin back to regular user by userId
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

  // Mutation: pre-register a user by email (account linked on first login)
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

  // Mutation: remove a user by email address
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

  /**
   * Download a CSV of all users. Uses raw fetch (not apiRequest) because
   * the response is a binary blob, not JSON.
   */
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
                    /* Enforce minimum 2 admins: demote button only enabled when >2 exist */
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
