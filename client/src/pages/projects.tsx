import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, CalendarDays, User, FileText } from "lucide-react";
import type { Project } from "@shared/schema";

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight" data-testid="text-projects-title">Projects</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {projects.length} project{projects.length !== 1 ? "s" : ""} with recorded lessons.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card className="p-8 text-center">
          <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No projects yet. Upload lessons from Excel to get started.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="p-4 space-y-3" data-testid={`card-project-${project.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm truncate" data-testid={`text-project-name-${project.id}`}>{project.name}</h3>
                  <Badge variant="outline" className="mt-1 text-xs no-default-active-elevate">{project.projectType}</Badge>
                </div>
              </div>
              {project.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  <FileText className="w-3.5 h-3.5 inline mr-1" />
                  {project.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {project.projectManager && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {project.projectManager}
                  </span>
                )}
                {project.closeDate && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {project.closeDate}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
