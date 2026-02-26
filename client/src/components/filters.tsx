import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Search, ChevronDown } from "lucide-react";
import type { LessonCategory, LessonSubcategory, ReferenceValue } from "@shared/schema";

export interface FilterState {
  projectTypes: string[];
  phases: string[];
  categoryIds: string[];
  subcategoryIds: string[];
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

function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
  testId,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  testId: string;
}) {
  return (
    <div className="space-y-1 min-w-[150px]">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between font-normal h-9 px-3"
            data-testid={testId}
          >
            <span className="truncate text-sm">
              {selected.length === 0
                ? `All ${label.toLowerCase()}`
                : selected.length === 1
                  ? options.find((o) => o.value === selected[0])?.label || selected[0]
                  : `${selected.length} selected`}
            </span>
            <div className="flex items-center gap-1 ml-1 flex-shrink-0">
              {selected.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 no-default-active-elevate no-default-hover-elevate">
                  {selected.length}
                </Badge>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-2 max-h-[280px] overflow-y-auto" align="start">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm"
              data-testid={`${testId}-option-${option.value}`}
            >
              <Checkbox
                checked={selected.includes(option.value)}
                onCheckedChange={() => onToggle(option.value)}
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))}
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No options available</p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function Filters({
  filters,
  onFiltersChange,
  categories,
  subcategories,
  referenceProjectTypes,
  referencePhases,
}: FiltersProps) {
  const filteredSubcategories =
    filters.categoryIds.length > 0
      ? subcategories.filter((s) => filters.categoryIds.includes(String(s.categoryId)))
      : subcategories;

  const hasActiveFilters =
    filters.projectTypes.length > 0 ||
    filters.phases.length > 0 ||
    filters.categoryIds.length > 0 ||
    filters.subcategoryIds.length > 0 ||
    filters.search !== "";

  const clearAll = () => {
    onFiltersChange({
      projectTypes: [],
      phases: [],
      categoryIds: [],
      subcategoryIds: [],
      search: "",
    });
  };

  const toggleValue = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

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

      <MultiSelectFilter
        label="Project Type"
        options={referenceProjectTypes.map((pt) => ({ value: pt.value, label: pt.value }))}
        selected={filters.projectTypes}
        onToggle={(v) => onFiltersChange({ ...filters, projectTypes: toggleValue(filters.projectTypes, v) })}
        testId="select-project-type"
      />

      <MultiSelectFilter
        label="Phase"
        options={referencePhases.map((p) => ({ value: p.value, label: p.value }))}
        selected={filters.phases}
        onToggle={(v) => onFiltersChange({ ...filters, phases: toggleValue(filters.phases, v) })}
        testId="select-phase"
      />

      <MultiSelectFilter
        label="Category"
        options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
        selected={filters.categoryIds}
        onToggle={(v) => {
          const newCats = toggleValue(filters.categoryIds, v);
          const validSubIds = newCats.length > 0
            ? filters.subcategoryIds.filter((sid) => {
                const sub = subcategories.find((s) => String(s.id) === sid);
                return sub && newCats.includes(String(sub.categoryId));
              })
            : filters.subcategoryIds;
          onFiltersChange({ ...filters, categoryIds: newCats, subcategoryIds: validSubIds });
        }}
        testId="select-category"
      />

      <MultiSelectFilter
        label="Subcategory"
        options={filteredSubcategories.map((s) => ({ value: String(s.id), label: s.name }))}
        selected={filters.subcategoryIds}
        onToggle={(v) => onFiltersChange({ ...filters, subcategoryIds: toggleValue(filters.subcategoryIds, v) })}
        testId="select-subcategory"
      />

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
