/**
 * @file App.tsx — Main application component for LessonKeeper.
 *
 * This file defines the top-level React component tree including:
 * - Global providers: ThemeProvider (dark/light mode), QueryClientProvider (TanStack Query),
 *   TooltipProvider (shadcn tooltips), and SidebarProvider (collapsible sidebar layout).
 * - Authentication guard: The AuthenticatedApp component checks auth state via `useAuth()`.
 *   Unauthenticated users see the LandingPage; authenticated users get the full sidebar layout.
 * - Routing: Uses `wouter`'s Switch/Route for client-side navigation. Routes include both
 *   general user pages (Dashboard, Upload, Projects, Settings) and admin-only pages
 *   (Admin, User Admin, Scoring Rates). Note: route-level access control is handled
 *   within individual page components or the sidebar — all routes are rendered here.
 * - Header: Contains the sidebar toggle, LessonKeeper branding with the Hermit icon,
 *   a link to the CITB website, and the dark/light theme toggle.
 * - Footer: Displays Hawkins-Digital branding (product creator) and copyright info.
 *
 * The AppSidebar component (defined separately in app-sidebar.tsx) receives the current
 * `user` object and renders role-based navigation items (admin users see additional
 * menu items like User Admin and Scoring Rates).
 */
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import UploadPage from "@/pages/upload";
import ProjectsPage from "@/pages/projects";
import AdminPage from "@/pages/admin";
import UserAdminPage from "@/pages/user-admin";
import SettingsPage from "@/pages/settings";
import ScoringRatesPage from "@/pages/scoring-rates";
import LearningAppliedPage from "@/pages/learning-applied";
import { Skeleton } from "@/components/ui/skeleton";
import hawkinsLogo from "@assets/Hawkins-Digital_1770883345237.jpg";
import citbLogo from "@assets/citb_logo_1770915007635.png";
import hermitIcon from "@assets/Zeppelin_hermit_1_1770990450114.png";

/**
 * AuthenticatedApp — Inner layout component that acts as an authentication guard.
 * Shows a skeleton loader while auth state is being determined, redirects to
 * LandingPage if the user is not authenticated, and renders the full app shell
 * (sidebar + header + routes + footer) for authenticated users.
 */
function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated } = useAuth();

  // While the auth query is in flight, show a centered skeleton placeholder
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-3 text-center">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  // Auth guard: unauthenticated users are shown the public landing page instead
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // Sidebar width configuration passed as CSS custom properties to SidebarProvider
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        {/* AppSidebar receives the authenticated user to render role-based nav items.
            Admin users see extra items (User Admin, Scoring Rates) in the sidebar. */}
        <AppSidebar user={user!} />
        <div className="flex flex-col flex-1 min-w-0">
          {/* Sticky header with backdrop blur — contains sidebar toggle, branding, and theme toggle */}
          <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-3 py-1.5 border-b bg-background/80 backdrop-blur-md">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-3">
              <span className="text-5xl tracking-tight" style={{ fontFamily: '"Boucherie Block W05 Bold", serif' }} data-testid="text-header-logo">LessonKeeper</span>
              <img src={hermitIcon} alt="LessonKeeper" className="h-[72px] w-[72px] rounded-md object-cover" data-testid="img-hermit-icon" />
            </div>
            <div className="flex items-center gap-2">
              {/* External link to the CITB website with their logo */}
              <a href="https://www.citb.co.uk" target="_blank" rel="noopener noreferrer"><img src={citbLogo} alt="CITB" className="h-[108px] w-[108px] rounded-md object-contain" data-testid="img-citb-logo" /></a>
              <ThemeToggle />
            </div>
          </header>
          {/* Main content area — scrollable, renders the matched route's page component */}
          <main className="flex-1 overflow-y-auto">
            <Switch>
              {/* Default route: Dashboard (home page for authenticated users) */}
              <Route path="/" component={Dashboard} />
              <Route path="/upload" component={UploadPage} />
              <Route path="/projects" component={ProjectsPage} />
              <Route path="/learning-applied" component={LearningAppliedPage} />
              {/* Admin-only routes — access control is enforced within these page components */}
              <Route path="/admin" component={AdminPage} />
              <Route path="/user-admin" component={UserAdminPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/scoring-rates" component={ScoringRatesPage} />
              {/* Catch-all 404 route for unmatched paths */}
              <Route component={NotFound} />
            </Switch>
          </main>
          {/* Footer branding: Hawkins-Digital product attribution and LessonKeeper copyright */}
          <footer className="border-t bg-background">
            <div className="px-4 py-1.5 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <a href="https://www.hawkins-digital.com" target="_blank" rel="noopener noreferrer"><img src={hawkinsLogo} alt="Hawkins-Digital" className="h-[52px] w-[52px] rounded-md object-cover" data-testid="img-footer-logo" /></a>
                <span className="align-super text-[0.45rem]">TM</span>
                <span className="text-[0.9rem] text-muted-foreground">A Hawkins-Digital<span className="align-super text-[0.5rem]">TM</span> product</span>
              </div>
              <div className="text-[0.9rem]">
                <span style={{ fontFamily: '"Boucherie Block W05 Bold", serif' }}>LessonKeeper</span>
                <span className="align-super text-[0.5rem]">TM</span>
                <span className="mx-1.5">·</span>
                <span>Copyright &copy; 2026</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}

/**
 * App — Root component that wraps the entire application in global providers.
 * Provider nesting order (outermost to innermost):
 *  1. ThemeProvider — manages dark/light mode via CSS class on <html>
 *  2. QueryClientProvider — provides TanStack Query client for data fetching/caching
 *  3. TooltipProvider — enables shadcn tooltip components app-wide
 *  4. AuthenticatedApp — the auth-guarded layout
 *  5. Toaster — renders toast notifications (placed outside AuthenticatedApp so
 *     toasts are visible even on the landing page)
 */
function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthenticatedApp />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
