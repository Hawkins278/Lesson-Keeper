import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PROJECT_STATUSES, type Project } from "@shared/schema";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
  FolderOpen,
} from "lucide-react";

interface ValidationError {
  row: number;
  column: string;
  message: string;
}

interface UploadResult {
  success: boolean;
  lessonsCreated: number;
  projectsCreated: number;
  errors: ValidationError[];
}

interface ReferenceData {
  projectTypes: { id: number; value: string }[];
  projectPhases: { id: number; value: string }[];
}

export default function UploadPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [createdProjectCode, setCreatedProjectCode] = useState<string | null>(null);

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectType, setNewProjectType] = useState("");
  const [newCloseDate, setNewCloseDate] = useState("");
  const [newProjectManager, setNewProjectManager] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const { toast } = useToast();
  const qc = useQueryClient();

  const userRole = user?.role?.toLowerCase().trim();
  if (userRole !== "admin" && userRole !== "superadmin" && userRole !== "superadministrator") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  const { data: referenceData } = useQuery<ReferenceData>({
    queryKey: ["/api/reference-data"],
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createProjectMutation = useMutation({
    mutationFn: async (body: {
      name: string;
      projectType: string;
      closeDate?: string;
      projectManager?: string;
      description?: string;
      status?: string;
    }) => {
      const res = await apiRequest("POST", "/api/projects", body);
      return res.json() as Promise<Project>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
      setCreatedProjectCode(data.projectCode ?? null);
      setNewProjectName("");
      setNewProjectType("");
      setNewCloseDate("");
      setNewProjectManager("");
      setNewDescription("");
      toast({ title: "Project created", description: `Project ${data.projectCode} created successfully.` });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Failed to create project", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/projects/${id}`, { status });
      return res.json() as Promise<Project>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Status updated" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateProject = () => {
    if (!newProjectName.trim() || !newProjectType) return;
    const body: Record<string, string> = {
      name: newProjectName.trim(),
      projectType: newProjectType,
      status: PROJECT_STATUSES[0],
    };
    if (newCloseDate) body.closeDate = newCloseDate;
    if (newProjectManager.trim()) body.projectManager = newProjectManager.trim();
    if (newDescription.trim()) body.description = newDescription.trim();
    createProjectMutation.mutate(body as any);
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json() as Promise<UploadResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        qc.invalidateQueries({ queryKey: ["/api/lessons"] });
        qc.invalidateQueries({ queryKey: ["/api/projects"] });
        qc.invalidateQueries({ queryKey: ["/api/categories"] });
        qc.invalidateQueries({ queryKey: ["/api/subcategories"] });
        toast({ title: "Upload successful", description: `${data.lessonsCreated} lessons imported from ${data.projectsCreated} projects.` });
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) {
      setFile(f);
      setResult(null);
    } else {
      toast({ title: "Invalid file", description: "Please upload an Excel file (.xlsx)", variant: "destructive" });
    }
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  }, []);

  const handleUpload = () => {
    if (file) uploadMutation.mutate(file);
  };

  const downloadTemplate = () => {
    window.open("/api/template", "_blank");
  };

  const projectTypes = referenceData?.projectTypes?.map((pt) => pt.value) ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight" data-testid="text-upload-title">Upload Lessons</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Download the template, fill it in, and import lessons from Excel.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-sm" data-testid="text-manage-projects-title">Manage Projects</h2>
        </div>
        <Separator />

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Create New Project</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              placeholder="Project Name *"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              data-testid="input-project-name"
            />
            <Select value={newProjectType} onValueChange={setNewProjectType}>
              <SelectTrigger data-testid="select-project-type">
                <SelectValue placeholder="Project Type *" />
              </SelectTrigger>
              <SelectContent>
                {projectTypes.map((pt) => (
                  <SelectItem key={pt} value={pt} data-testid={`option-project-type-${pt}`}>
                    {pt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Close Date (DD-Mon-YYYY)"
              value={newCloseDate}
              onChange={(e) => setNewCloseDate(e.target.value)}
              data-testid="input-close-date"
            />
            <Input
              placeholder="Project Manager"
              value={newProjectManager}
              onChange={(e) => setNewProjectManager(e.target.value)}
              data-testid="input-project-manager"
            />
          </div>
          <Input
            placeholder="Description"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            data-testid="input-project-description"
          />
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Status defaults to "{PROJECT_STATUSES[0]}"
            </p>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || !newProjectType || createProjectMutation.isPending}
              data-testid="button-create-project"
            >
              {createProjectMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </div>

          {createdProjectCode && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-chart-2/10" data-testid="text-created-project-code">
              <CheckCircle2 className="w-4 h-4 text-chart-2" />
              <span className="text-sm">Project created: <strong>{createdProjectCode}</strong></span>
            </div>
          )}
        </div>

        <Separator />

        <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2" data-testid="button-toggle-projects">
              {projectsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Existing Projects ({projects?.length ?? 0})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {projectsLoading ? (
              <div className="flex items-center gap-2 p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading projects...</span>
              </div>
            ) : projects && projects.length > 0 ? (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border flex-wrap"
                  data-testid={`card-project-${project.id}`}
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Badge variant="secondary" className="no-default-active-elevate" data-testid={`text-project-code-${project.id}`}>
                      {project.projectCode}
                    </Badge>
                    <span className="text-sm font-medium truncate" data-testid={`text-project-name-${project.id}`}>{project.name}</span>
                    <span className="text-xs text-muted-foreground" data-testid={`text-project-type-${project.id}`}>{project.projectType}</span>
                  </div>
                  <Select
                    value={project.status}
                    onValueChange={(val) => updateStatusMutation.mutate({ id: project.id, status: val })}
                  >
                    <SelectTrigger className="w-auto max-w-[280px]" data-testid={`select-project-status-${project.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} data-testid={`option-status-${s}`}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground p-3" data-testid="text-no-projects">No projects found.</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium">Download Template</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get the Excel template with pre-filled dropdown values for project types, phases, categories and subcategories.
            </p>
          </div>
          <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-sm">Upload Your File</h2>
        <div
          className={`border-2 border-dashed rounded-md p-8 text-center transition-colors cursor-pointer ${
            dragActive ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
          data-testid="dropzone-upload"
        >
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-file"
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-chart-2" />
              <div className="text-left">
                <p className="text-sm font-medium" data-testid="text-file-name">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Drag and drop your Excel file here, or click to browse</p>
              <p className="text-xs text-muted-foreground/60">Supports .xlsx and .xls files</p>
            </div>
          )}
        </div>

        {file && (
          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
              data-testid="button-upload"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload &amp; Import
                </>
              )}
            </Button>
          </div>
        )}
      </Card>

      {result && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            {result.success && result.errors.length === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-chart-2 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            )}
            <div>
              <h3 className="font-semibold text-sm" data-testid="text-upload-result-title">
                {result.success ? "Import Complete" : "Import Issues"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {result.lessonsCreated} lessons imported, {result.projectsCreated} projects created
              </p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Validation Issues ({result.errors.length})
                </p>
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {result.errors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-sm p-2 rounded-md bg-destructive/5"
                      data-testid={`text-error-${i}`}
                    >
                      <Badge variant="destructive" className="text-xs flex-shrink-0 no-default-active-elevate">
                        Row {err.row}
                      </Badge>
                      <span className="text-xs">
                        <strong>{err.column}:</strong> {err.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
