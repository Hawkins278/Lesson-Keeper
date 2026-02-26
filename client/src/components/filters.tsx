import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Search } from "lucide-react";
import type { LessonCategory, LessonSubcategory, ReferenceValue } from "@shared/schema";

export interface FilterState {
  projectType: string | null;
  phase: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  search: string;
}

interface FiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  categories: LessonCategory[];
  subcategories: LessonSubcategory[];
  referenceProjectTypes: ReferenceValue[];
  referencePhases: ReferenceValue[];
}

export function Filters({
  filters,
  onFiltersChange,
  categories,
  subcategories,
  referenceProjectTypes,
  referencePhases,
}: FiltersProps) {
  const filteredSubcategories = filters.categoryId
    ? subcategories.filter((s) => s.categoryId === parseInt(filters.categoryId!))
    : subcategories;

  const hasActiveFilters =
    filters.projectType !== null ||
    filters.phase !== null ||
    filters.categoryId !== null ||
    filters.subcategoryId !== null ||
    filters.search !== "";

  const clearAll = () => {
    onFiltersChange({
      projectType: null,
      phase: null,
      categoryId: null,
      subcategoryId: null,
      search: "",
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1 min-w-[160px] flex-1">
        <label className="text-xs font-medium text-muted-foreground">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search lessons..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      <div className="space-y-1 min-w-[150px]">
        <label className="text-xs font-medium text-muted-foreground">Project Type</label>
        <Select
          value={filters.projectType || "all"}
          onValueChange={(v) => onFiltersChange({ ...filters, projectType: v === "all" ? null : v })}
        >
          <SelectTrigger data-testid="select-project-type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {referenceProjectTypes.map((pt) => (
              <SelectItem key={pt.id} value={pt.value}>
                {pt.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 min-w-[140px]">
        <label className="text-xs font-medium text-muted-foreground">Phase</label>
        <Select
          value={filters.phase || "all"}
          onValueChange={(v) => onFiltersChange({ ...filters, phase: v === "all" ? null : v })}
        >
          <SelectTrigger data-testid="select-phase">
            <SelectValue placeholder="All phases" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All phases</SelectItem>
            {referencePhases.map((p) => (
              <SelectItem key={p.id} value={p.value}>
                {p.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 min-w-[150px]">
        <label className="text-xs font-medium text-muted-foreground">Category</label>
        <Select
          value={filters.categoryId || "all"}
          onValueChange={(v) =>
            onFiltersChange({
              ...filters,
              categoryId: v === "all" ? null : v,
              subcategoryId: null,
            })
          }
        >
          <SelectTrigger data-testid="select-category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1 min-w-[150px]">
        <label className="text-xs font-medium text-muted-foreground">Subcategory</label>
        <Select
          value={filters.subcategoryId || "all"}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, subcategoryId: v === "all" ? null : v })
          }
        >
          <SelectTrigger data-testid="select-subcategory">
            <SelectValue placeholder="All subcategories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subcategories</SelectItem>
            {filteredSubcategories.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="text-xs flex-shrink-0"
          data-testid="button-clear-filters"
        >
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
