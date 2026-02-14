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
import { Skeleton } from "@/components/ui/skeleton";
import hawkinsLogo from "@assets/Hawkins-Digital_1770883345237.jpg";
import citbLogo from "@assets/citb_logo_1770915007635.png";
import hermitIcon from "@assets/Zeppelin_hermit_1_1770990450114.png";

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

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar user={user!} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-3 py-1.5 border-b bg-background/80 backdrop-blur-md">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-3">
              <span className="text-5xl tracking-tight" style={{ fontFamily: '"Boucherie Block W05 Bold", serif' }} data-testid="text-header-logo">LessonKeeper</span>
              <img src={hermitIcon} alt="LessonKeeper" className="h-[72px] w-[72px] rounded-md object-cover" data-testid="img-hermit-icon" />
            </div>
            <div className="flex items-center gap-2">
              <a href="https://www.citb.co.uk" target="_blank" rel="noopener noreferrer"><img src={citbLogo} alt="CITB" className="h-[108px] w-[108px] rounded-md object-contain" data-testid="img-citb-logo" /></a>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/upload" component={UploadPage} />
              <Route path="/projects" component={ProjectsPage} />
              <Route path="/admin" component={AdminPage} />
              <Route path="/user-admin" component={UserAdminPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
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
