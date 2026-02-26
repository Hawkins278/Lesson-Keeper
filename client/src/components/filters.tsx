import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Search, ChevronDown, Check } from "lucide-react";
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

interface MultiSelectProps {
  label: string;
  placeholder: string;
  selected: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
  testId: string;
}

function MultiSelect({ label, placeholder, selected, options, onChange, testId }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  const filteredOptions = searchText
    ? options.filter(o => o.label.toLowerCase().includes(searchText.toLowerCase()))
    : options;

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const displayText = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label || selected[0]
      : `${selected.length} selected`;

  return (
    <div className="space-y-1 min-w-[150px]">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal h-9 px-3 text-sm"
            data-testid={testId}
          >
            <span className={`truncate ${selected.length === 0 ? "text-muted-foreground" : ""}`}>
              {displayText}
            </span>
            <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          {options.length > 5 && (
            <div className="p-2 border-b">
              <Input
                placeholder="Search..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="h-8 text-sm"
                data-testid={`${testId}-search`}
              />
            </div>
          )}
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2 text-center">No options</p>
            ) : (
              filteredOptions.map(option => (
                <button
                  key={option.value}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer text-left"
                  onClick={() => toggleValue(option.value)}
                  data-testid={`${testId}-option-${option.value}`}
                >
                  <Checkbox
                    checked={selected.includes(option.value)}
                    className="pointer-events-none"
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="p-1 border-t">
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground rounded-sm hover:bg-accent cursor-pointer"
                onClick={() => { onChange([]); }}
                data-testid={`${testId}-clear`}
              >
                <X className="h-3 w-3" />
                Clear selection
              </button>
            </div>
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
  const filteredSubcategories = filters.categoryIds.length > 0
    ? subcategories.filter(s => filters.categoryIds.includes(String(s.categoryId)))
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

      <MultiSelect
        label="Project Type"
        placeholder="All types"
        selected={filters.projectTypes}
        options={referenceProjectTypes.map(pt => ({ value: pt.value, label: pt.value }))}
        onChange={(values) => onFiltersChange({ ...filters, projectTypes: values })}
        testId="select-project-type"
      />

      <MultiSelect
        label="Phase"
        placeholder="All phases"
        selected={filters.phases}
        options={referencePhases.map(p => ({ value: p.value, label: p.value }))}
        onChange={(values) => onFiltersChange({ ...filters, phases: values })}
        testId="select-phase"
      />

      <MultiSelect
        label="Category"
        placeholder="All categories"
        selected={filters.categoryIds}
        options={categories.map(c => ({ value: String(c.id), label: c.name }))}
        onChange={(values) => onFiltersChange({
          ...filters,
          categoryIds: values,
          subcategoryIds: filters.subcategoryIds.filter(sid => {
            const sub = subcategories.find(s => String(s.id) === sid);
            return sub && (values.length === 0 || values.includes(String(sub.categoryId)));
          }),
        })}
        testId="select-category"
      />

      <MultiSelect
        label="Subcategory"
        placeholder="All subcategories"
        selected={filters.subcategoryIds}
        options={filteredSubcategories.map(s => ({ value: String(s.id), label: s.name }))}
        onChange={(values) => onFiltersChange({ ...filters, subcategoryIds: values })}
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
