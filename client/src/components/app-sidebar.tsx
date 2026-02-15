import { useLocation, Link } from "wouter";
import { Upload, LayoutDashboard, LogOut, FolderOpen, Settings, Users, UserCog, Gauge } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { User } from "@shared/models/auth";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  superadmin: "Admin",
  superadministrator: "Admin",
  user: "User",
};

function isAdmin(role?: string | null): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return r === "admin" || r === "superadmin" || r === "superadministrator";
}

const userNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "User Settings", url: "/settings", icon: UserCog },
];

const adminOnlyNavItems = [
  { title: "Upload Lessons", url: "/upload", icon: Upload },
  { title: "Reference Data", url: "/admin", icon: Settings },
  { title: "Scoring Rates", url: "/scoring-rates", icon: Gauge },
  { title: "User Administration", url: "/user-admin", icon: Users },
];

interface AppSidebarProps {
  user: User | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const [location] = useLocation();
  const isAdminUser = isAdmin(user?.role);

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  const roleLabel = ROLE_LABELS[user?.role || "user"] || "User";
  const allNavItems = isAdminUser ? [...userNavItems, ...adminOnlyNavItems] : userNavItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {allNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">
              {user?.email}
            </p>
            <Badge variant="secondary" className="text-xs mt-1 no-default-active-elevate" data-testid="badge-sidebar-role">{roleLabel}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start" asChild data-testid="button-logout">
          <a href="/api/logout">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </a>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
