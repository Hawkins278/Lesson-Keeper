/**
 * @file use-auth.ts — User authentication hook for the LessonKeeper application.
 *
 * Provides the `useAuth` hook which manages the current user's authentication state
 * using TanStack Query. The hook exposes:
 * - `user`: The authenticated User object, or null/undefined if not logged in
 * - `isLoading`: Whether the initial auth check is still in progress
 * - `isAuthenticated`: Boolean derived from `!!user` — true only when a valid user exists
 * - `logout`: Triggers a full-page redirect to the server logout endpoint
 * - `isLoggingOut`: Whether the logout mutation is currently pending
 *
 * Authentication flow:
 * 1. On mount, `fetchUser` calls GET /api/auth/user with credentials (session cookie).
 * 2. A 401 response means "not logged in" and returns null (no error thrown).
 * 3. The query result is cached for 5 minutes (staleTime) to avoid redundant auth checks.
 * 4. Logout performs a full navigation to /api/logout (server-side session destruction),
 *    and optimistically clears the cached user data on success.
 *
 * Note: This hook does NOT check user roles. Role-based access (admin vs. regular user)
 * is handled by consuming components that inspect user.role from the returned user object.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

/**
 * fetchUser — Fetches the currently authenticated user from the server.
 * Returns null on 401 (not authenticated) instead of throwing, so the app
 * can gracefully handle the "logged out" state without triggering error boundaries.
 */
async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  // 401 means no active session — return null rather than treating it as an error
  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * logout — Performs logout by redirecting to the server-side logout endpoint.
 * Uses window.location.href (full page navigation) because the server needs to
 * clear the session cookie and may redirect to an external auth provider's logout page.
 */
async function logout(): Promise<void> {
  window.location.href = "/api/logout";
}

export function useAuth() {
  const queryClient = useQueryClient();

  // Query the current user's auth state; cached for 5 minutes to reduce API calls
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Logout mutation: on success, immediately clear the cached user data so the
  // UI reflects the logged-out state without waiting for a refetch
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user, // Coerce to boolean — null/undefined becomes false
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
