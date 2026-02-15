/**
 * @file use-mobile.tsx — Responsive mobile detection hook.
 *
 * Provides `useIsMobile()` which returns a boolean indicating whether the viewport
 * is below the mobile breakpoint (768px, matching Tailwind's `md` breakpoint).
 *
 * Implementation details:
 * - Uses `window.matchMedia` for efficient, event-driven viewport monitoring
 *   (no polling or resize event listeners needed).
 * - Initial state is `undefined` (SSR-safe) until the first client-side check runs.
 * - The double-bang (`!!`) coerces the initial `undefined` to `false`, so the hook
 *   always returns a stable boolean. On the very first render before useEffect fires,
 *   this means the component assumes "not mobile" — which avoids layout flicker
 *   on desktop (the more common case).
 * - The MediaQueryList "change" event fires only when the viewport crosses the
 *   breakpoint boundary, not on every pixel of resize.
 */
import * as React from "react"

// Matches Tailwind's `md` breakpoint — below this width is considered "mobile"
const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Starts as undefined (no assumption about viewport size until client-side check)
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Create a MediaQueryList that tracks whether the viewport is below the breakpoint
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    // Listen for viewport changes that cross the breakpoint boundary
    mql.addEventListener("change", onChange)
    // Set the initial value immediately on mount
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    // Cleanup: remove the listener when the component unmounts
    return () => mql.removeEventListener("change", onChange)
  }, [])

  // Coerce undefined to false so the return type is always boolean
  return !!isMobile
}
