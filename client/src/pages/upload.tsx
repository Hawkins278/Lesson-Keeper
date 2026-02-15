/**
 * @file Upload Page — Excel file upload for bulk lesson import.
 *
 * @description
 * Admin-only page that provides two key workflows:
 *
 * 1. **Template download** — Opens `/api/template` in a new tab to download a
 *    pre-configured Excel template. The template contains dropdown-validated
 *    columns for project types, phases, categories, and subcategories so that
 *    users can fill in lessons offline with valid values.
 *
 * 2. **File upload & import** — Users drag-and-drop or browse for an .xlsx/.xls
 *    file. The file is POSTed as multipart/form-data to `/api/upload` (handled
 *    server-side by multer). On success, the response includes:
 *    - `lessonsCreated` / `projectsCreated` counts
 *    - A `success` boolean
 *    - An `errors` array of per-row validation issues (row number, column, message)
 *
 *    After a successful import the component invalidates all relevant query
 *    caches (lessons, projects, categories, subcategories) so the rest of the
 *    app reflects the new data immediately.
 *
 * 3. **Results display** — Shows a summary card with import counts and, when
 *    validation errors exist, a scrollable list of row-level issues so the user
 *    can correct and re-upload.
 *
 * Access: Restricted to admin / superadmin / superadministrator roles.
 * Non-admin users see an "access denied" message.
 */
import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

/** A single row-level validation error returned by the server after processing the uploaded file. */
interface ValidationError {
  row: number;
  column: string;
  message: string;
}

/** Server response shape from POST /api/upload after processing an Excel file. */
interface UploadResult {
  success: boolean;
  lessonsCreated: number;
  projectsCreated: number;
  errors: ValidationError[];
}

export default function UploadPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  /** Controls the visual highlight of the drop zone when a file is dragged over it. */
  const [dragActive, setDragActive] = useState(false);
  /** Stores the server response after a successful or partially-successful upload. */
  const [result, setResult] = useState<UploadResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- Access gate: only admin-level roles can see this page ---
  const userRole = user?.role?.toLowerCase().trim();
  if (userRole !== "admin" && userRole !== "superadmin" && userRole !== "superadministrator") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  /**
   * Upload mutation: wraps the file in FormData and POSTs to /api/upload.
   * The server (multer middleware) parses the multipart body, validates each
   * row, and returns an UploadResult with counts and any validation errors.
   *
   * On success, all related query caches are invalidated so the dashboard,
   * projects page, and filter dropdowns reflect the newly imported data.
   *
   * On 401 errors, the user is redirected to the login flow after a short delay.
   */
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
        // Invalidate all data caches so the app reflects the newly imported lessons
        queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
        toast({ title: "Upload successful", description: `${data.lessonsCreated} lessons imported from ${data.projectsCreated} projects.` });
      }
    },
    onError: (error: Error) => {
      // Handle expired session by redirecting to the login endpoint
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  /**
   * Drag-and-drop handler: validates that the dropped file has an Excel extension
   * before accepting it. Clears any previous upload result when a new file is selected.
   */
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

  /** File browser handler: accepts the first file from the native file picker dialog. */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  }, []);

  /** Triggers the upload mutation with the currently selected file. */
  const handleUpload = () => {
    if (file) uploadMutation.mutate(file);
  };

  /** Opens the server-generated Excel template in a new tab for download. */
  const downloadTemplate = () => {
    window.open("/api/template", "_blank");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight" data-testid="text-upload-title">Upload Lessons</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Download the template, fill it in, and import lessons from Excel.
        </p>
      </div>

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
