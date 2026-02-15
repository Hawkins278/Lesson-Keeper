/**
 * @file queryClient.ts — TanStack Query configuration and API request utilities.
 *
 * This module provides:
 * - `apiRequest`: A generic helper for making authenticated JSON API calls (POST, PATCH, DELETE, etc.).
 *   It automatically sets Content-Type headers when a body is present and includes cookies
 *   for session-based authentication. Throws on non-2xx responses.
 * - `getQueryFn`: A factory that creates TanStack Query `queryFn` functions with configurable
 *   401 (Unauthorized) handling. The query key segments are joined to form the URL
 *   (e.g., queryKey ['/api/recipes', '5'] becomes '/api/recipes/5').
 * - `queryClient`: The singleton QueryClient instance with conservative defaults —
 *   no automatic refetching, infinite stale time (data is considered fresh until manually
 *   invalidated), and no retries. This gives the app full control over when data refreshes.
 */
import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Inspects a fetch Response and throws an Error if the status is not 2xx.
 * Attempts to read the response body as text for a descriptive error message;
 * falls back to the HTTP status text if the body is empty.
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * apiRequest — A convenience wrapper around fetch for mutating API calls.
 *
 * @param method - HTTP method (e.g., "POST", "PATCH", "DELETE")
 * @param url    - The API endpoint path (e.g., "/api/lessons")
 * @param data   - Optional request body; automatically JSON-serialized when present
 * @returns The raw Response object (callers can call .json() if needed)
 *
 * Key behaviors:
 * - Sets Content-Type to application/json only when `data` is provided
 * - Always sends credentials (cookies) for session-based auth
 * - Throws on any non-2xx response via throwIfResNotOk
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * UnauthorizedBehavior controls how 401 responses are handled in queries:
 * - "returnNull": Silently returns null (used by auth-checking queries like useAuth
 *   where a 401 simply means "not logged in")
 * - "throw": Throws an error (used by the default queryFn so data-fetching queries
 *   surface auth failures to error boundaries or query error states)
 */
type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * getQueryFn — Factory that produces a TanStack Query `queryFn` with configurable 401 handling.
 *
 * The returned function uses the queryKey array segments joined together as the fetch URL.
 * This means queryKey: ['/api/lessons'] fetches '/api/lessons', and
 * queryKey: ['/api/lessons', id] fetches '/api/lessons/<id>'.
 * Credentials are always included for session-based authentication.
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Join queryKey segments to build the URL (supports hierarchical keys like ['/api/items', id])
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    // When configured to "returnNull", a 401 is treated as a valid "no user" response
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * queryClient — The singleton TanStack QueryClient instance used throughout the app.
 *
 * Default query options:
 * - queryFn: Uses getQueryFn with on401="throw" so unauthenticated data requests
 *   propagate errors (individual queries like useAuth override this with "returnNull")
 * - refetchInterval: false — no automatic polling
 * - refetchOnWindowFocus: false — no refetch when the browser tab regains focus
 * - staleTime: Infinity — cached data is never considered stale; components must
 *   manually invalidate queries (via queryClient.invalidateQueries) to trigger refetches
 * - retry: false — failed queries/mutations are not retried automatically
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
