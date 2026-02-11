import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Plus, X, Settings2 } from "lucide-react";

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

interface RefEntry {
  id: number;
  value: string;
  categoryId?: number;
}

interface ReferenceData {
  projectTypes: RefEntry[];
  projectPhases: RefEntry[];
  categories: RefEntry[];
  subcategories: (RefEntry & { categoryId: number })[];
}

const FIELD_LABELS: Record<string, string> = {
  ProjectType: "Project Types",
  ProjectPhase: "Project Phases",
  LessonCategory: "Lesson Categories",
  LessonSubcategory: "Lesson Subcategories",
};

function ReferenceFieldSection({
  type,
  entries,
  categories,
  onAdd,
  onRemove,
  isAdding,
}: {
  type: string;
  entries: RefEntry[];
  categories?: RefEntry[];
  onAdd: (value: string, categoryId?: number) => void;
  onRemove: (id: number) => void;
  isAdding: boolean;
}) {
  const [newValue, setNewValue] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const handleAdd = () => {
    if (!newValue.trim()) return;
    if (type === "LessonSubcategory" && !selectedCategoryId) return;
    onAdd(newValue.trim(), type === "LessonSubcategory" ? Number(selectedCategoryId) : undefined);
    setNewValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold" data-testid={`text-ref-section-${type}`}>{FIELD_LABELS[type]}</h3>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((entry) => (
          <Badge
            key={entry.id}
            variant="secondary"
            className="gap-1 pr-1 no-default-active-elevate"
            data-testid={`badge-ref-${type}-${entry.id}`}
          >
            <span className="text-xs">{entry.value}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onRemove(entry.id); }}
              className="ml-0.5 rounded-full p-0.5 cursor-pointer opacity-60 hover-elevate"
              data-testid={`button-remove-ref-${type}-${entry.id}`}
              aria-label={`Remove ${entry.value}`}
            >
              <X className="w-3 h-3" />
            </span>
          </Badge>
        ))}
        {entries.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No entries yet</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {type === "LessonSubcategory" && categories && (
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger className="w-40 flex-shrink-0" data-testid={`select-subcategory-category-${type}`}>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input
          placeholder={`Add new ${FIELD_LABELS[type].toLowerCase().replace(/s$/, "")}...`}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
          data-testid={`input-add-ref-${type}`}
        />
        <Button
          size="icon"
          variant="outline"
          onClick={handleAdd}
          disabled={isAdding || !newValue.trim() || (type === "LessonSubcategory" && !selectedCategoryId)}
          data-testid={`button-add-ref-${type}`}
        >
          {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: refData, isLoading: refLoading } = useQuery<ReferenceData>({
    queryKey: ["/api/reference-data"],
  });

  const addMutation = useMutation({
    mutationFn: async ({ type, value, categoryId }: { type: string; value: string; categoryId?: number }) => {
      const res = await apiRequest("POST", `/api/reference-data/${type}`, { value, categoryId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      await apiRequest("DELETE", `/api/reference-data/${type}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reference-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

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
        queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
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

  const handleAddRef = (type: string) => (value: string, categoryId?: number) => {
    addMutation.mutate({ type, value, categoryId });
  };

  const handleRemoveRef = (type: string) => (id: number) => {
    removeMutation.mutate({ type, id });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold tracking-tight" data-testid="text-upload-title">Upload Lessons</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your reference data, download the template, and import lessons from Excel.
        </p>
      </div>

      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm" data-testid="text-ref-data-title">Reference Data</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          These values populate the dropdown lists in the Excel template. Add or remove entries, then download the template.
        </p>

        {refLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : refData ? (
          <div className="space-y-5">
            <ReferenceFieldSection
              type="ProjectType"
              entries={refData.projectTypes}
              onAdd={handleAddRef("ProjectType")}
              onRemove={handleRemoveRef("ProjectType")}
              isAdding={addMutation.isPending}
            />
            <Separator />
            <ReferenceFieldSection
              type="ProjectPhase"
              entries={refData.projectPhases}
              onAdd={handleAddRef("ProjectPhase")}
              onRemove={handleRemoveRef("ProjectPhase")}
              isAdding={addMutation.isPending}
            />
            <Separator />
            <ReferenceFieldSection
              type="LessonCategory"
              entries={refData.categories}
              onAdd={handleAddRef("LessonCategory")}
              onRemove={handleRemoveRef("LessonCategory")}
              isAdding={addMutation.isPending}
            />
            <Separator />
            <ReferenceFieldSection
              type="LessonSubcategory"
              entries={refData.subcategories}
              categories={refData.categories}
              onAdd={handleAddRef("LessonSubcategory")}
              onRemove={handleRemoveRef("LessonSubcategory")}
              isAdding={addMutation.isPending}
            />
          </div>
        ) : null}

        <Separator />

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium">Download Template</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The template will include the reference data above as dropdown lists.
            </p>
          </div>
          <Button onClick={downloadTemplate} data-testid="button-download-template">
            <Download className="w-4 h-4 mr-2" />
            Confirm &amp; Download
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
