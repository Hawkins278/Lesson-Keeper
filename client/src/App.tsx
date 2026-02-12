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
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import hawkinsLogo from "@assets/Hawkins-Digital_1770883345237.jpg";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadministrator",
  admin: "Administrator",
  user: "User",
};

function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated } = useAuth();

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

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const roleLabel = ROLE_LABELS[user!.role || "user"] || "User";
  const initials = `${(user!.firstName || "")[0] || ""}${(user!.lastName || "")[0] || ""}`.toUpperCase() || "U";

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar user={user!} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-50 flex items-center justify-between gap-4 p-3 border-b bg-background/80 backdrop-blur-md">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/upload" component={UploadPage} />
              <Route path="/projects" component={ProjectsPage} />
              <Route path="/admin" component={AdminPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <footer className="border-t bg-background">
            <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <img src={hawkinsLogo} alt="Hawkins-Digital" className="h-8 w-8 rounded-md object-cover" data-testid="img-footer-logo" />
                <div>
                  <span className="block text-xs font-medium">LessonKeeper</span>
                  <span className="block text-xs">a Hawkins-Digital product</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="block text-xs" data-testid="text-footer-logged-in">Logged in as {user!.email || `${user!.firstName} ${user!.lastName}`}</span>
                  <Badge variant="secondary" className="text-xs mt-0.5 no-default-active-elevate" data-testid="badge-footer-role">{roleLabel}</Badge>
                </div>
                <Avatar className="h-8 w-8" data-testid="avatar-footer-user">
                  <AvatarImage src={user!.profileImageUrl || undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}

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
