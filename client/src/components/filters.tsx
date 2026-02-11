import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LessonCategory, LessonSubcategory } from "@shared/schema";

export interface FilterState {
  projectTypes: string[];
  phases: string[];
  categoryId: string | null;
  subcategoryId: string | null;
  search: string;
}

interface FiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  categories: LessonCategory[];
  subcategories: LessonSubcategory[];
  availableProjectTypes: string[];
  availablePhases: string[];
}

export function Filters({
  filters,
  onFiltersChange,
  categories,
  subcategories,
  availableProjectTypes,
  availablePhases,
}: FiltersProps) {
  const filteredSubcategories = filters.categoryId
    ? subcategories.filter((s) => s.categoryId === parseInt(filters.categoryId!))
    : subcategories;

  const hasActiveFilters =
    filters.projectTypes.length > 0 ||
    filters.phases.length > 0 ||
    filters.categoryId !== null ||
    filters.subcategoryId !== null ||
    filters.search !== "";

  const clearAll = () => {
    onFiltersChange({
      projectTypes: [],
      phases: [],
      categoryId: null,
      subcategoryId: null,
      search: "",
    });
  };

  const toggleProjectType = (pt: string) => {
    const newTypes = filters.projectTypes.includes(pt)
      ? filters.projectTypes.filter((t) => t !== pt)
      : [...filters.projectTypes, pt];
    onFiltersChange({ ...filters, projectTypes: newTypes });
  };

  const togglePhase = (phase: string) => {
    const newPhases = filters.phases.includes(phase)
      ? filters.phases.filter((p) => p !== phase)
      : [...filters.phases, phase];
    onFiltersChange({ ...filters, phases: newPhases });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium">Filters</span>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="ml-auto text-xs"
            data-testid="button-clear-filters"
          >
            <X className="w-3 h-3 mr-1" />
            Clear all
          </Button>
        )}
      </div>

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

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Project Type</label>
        <div className="flex flex-wrap gap-1.5">
          {availableProjectTypes.map((pt) => (
            <Badge
              key={pt}
              variant={filters.projectTypes.includes(pt) ? "default" : "outline"}
              className="cursor-pointer toggle-elevate"
              onClick={() => toggleProjectType(pt)}
              data-testid={`badge-filter-type-${pt}`}
            >
              {pt}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phase</label>
        <div className="flex flex-wrap gap-1.5">
          {availablePhases.map((phase) => (
            <Badge
              key={phase}
              variant={filters.phases.includes(phase) ? "default" : "outline"}
              className="cursor-pointer toggle-elevate"
              onClick={() => togglePhase(phase)}
              data-testid={`badge-filter-phase-${phase}`}
            >
              {phase}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</label>
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

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subcategory</label>
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
    </div>
  );
}
