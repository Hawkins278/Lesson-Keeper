/**
 * @file settings.tsx — User Settings Page
 *
 * @description
 * Available to all authenticated users. Allows viewing and editing of
 * personal profile information.
 *
 * Key features:
 * - **Avatar upload via object storage**: uses a two-step presigned-URL flow:
 *   1. POST /api/uploads/request-url with file metadata → receives an
 *      `uploadURL` (presigned PUT URL) and `objectPath`.
 *   2. PUT the raw file bytes to `uploadURL` (direct-to-storage upload).
 *   3. PATCH /api/user/profile with the `uploadURL` as the new
 *      `profileImageUrl` so the server records the avatar location.
 *   File validation: max 5 MB, must be an image/* MIME type.
 * - **Profile editing**: first name and last name can be changed and saved.
 *   Email is read-only (managed by the login provider). Role is displayed
 *   as a badge but cannot be changed by the user.
 * - **One-time initialization**: local form state is populated from the
 *   server profile query on first load to avoid overwriting user edits
 *   on re-renders.
 *
 * Access: any authenticated user.
 *
 * Data flow:
 * - GET   /api/user/profile         → User object
 * - PATCH /api/user/profile         → update firstName / lastName / profileImageUrl
 * - POST  /api/uploads/request-url  → presigned upload URL for object storage
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/models/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Save, Loader2 } from "lucide-react";

/**
 * SettingsPage — profile editing page with avatar upload and name fields.
 */
export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Ref to the hidden file input so avatar click/button can trigger it
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Local form state for editable profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Tracks the presigned-URL upload lifecycle
  const [isUploading, setIsUploading] = useState(false);
  // Guards against re-initializing form fields on subsequent renders
  const [initialized, setInitialized] = useState(false);

  // Fetch the authenticated user's profile
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user/profile"],
  });

  // One-time initialization: copy server values into local state
  if (user && !initialized) {
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setInitialized(true);
  }

  // Mutation: update profile fields (name and/or avatar URL)
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; profileImageUrl?: string }) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({ firstName, lastName });
  };

  /**
   * Avatar upload handler — presigned URL flow:
   * 1. Validate file (size ≤ 5MB, image/* type)
   * 2. Request a presigned PUT URL from the server
   * 3. Upload the file directly to object storage via the presigned URL
   * 4. Save the URL as the user's profileImageUrl
   */
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 5 MB limit enforced client-side
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "File too large", description: "Please choose an image under 5MB.", variant: "destructive" });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      // Step 1: request a presigned upload URL from the server
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });

      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      // Destructure the presigned URL and the canonical object path
      const { uploadURL, objectPath } = await urlRes.json();

      // Step 2: PUT the raw file bytes directly to object storage
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) throw new Error("Failed to upload file");

      // Step 3: persist the presigned URL as the user's avatar
      updateProfileMutation.mutate({ profileImageUrl: uploadURL });
    } catch (error) {
      toast({ title: "Upload failed", description: "Could not upload avatar. Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Build avatar fallback initials from first+last name, defaulting to "U"
  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  // Derive a display-friendly role label for the badge
  const roleLabel = user?.role === "admin" || user?.role === "superadmin" || user?.role === "superadministrator" ? "Admin" : "User";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold" data-testid="text-settings-title">User Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative group">
            <Avatar className="w-20 h-20">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              data-testid="button-change-avatar"
            >
              {isUploading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
              data-testid="input-avatar-file"
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Upload a new profile picture</p>
            <p className="text-xs text-muted-foreground">Max file size: 5MB. Supported formats: JPG, PNG, GIF, WebP.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              data-testid="button-upload-avatar"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Choose Image
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user?.email || ""}
              disabled
              className="bg-muted"
              data-testid="input-email"
            />
            <p className="text-xs text-muted-foreground">Email is managed through your login provider and cannot be changed here.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                data-testid="input-last-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <div>
              <Badge variant="secondary" className="no-default-active-elevate" data-testid="badge-user-role">{roleLabel}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Your role is managed by administrators.</p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-profile"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
