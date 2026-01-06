"use client"


import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Filter, LayoutGrid, AlertCircle } from "lucide-react"

export type FilterType = "all" | "labeled" | "unlabeled" | "needs-review"

interface ImageGalleryFilterProps {
  onFilterChange: (filter: FilterType) => void
  onSearchChange: (search: string) => void
  onSortChange: (sort: "asc" | "desc") => void
  currentFilter: FilterType
  currentSearch: string
  currentSort: "asc" | "desc"
  totalCount: number
  labeledCount: number
  unlabeledCount: number
  needsReviewCount: number
}

export default function ImageGalleryFilter({
  onFilterChange,
  onSearchChange,
  onSortChange,
  currentFilter,
  currentSearch,
  currentSort,
  totalCount,
  labeledCount,
  unlabeledCount,
  needsReviewCount,
}: ImageGalleryFilterProps) {
  const getCount = (id: FilterType) => {
    switch (id) {
      case "all": return totalCount
      case "labeled": return labeledCount
      case "unlabeled": return unlabeledCount
      case "needs-review": return needsReviewCount
      default: return 0
    }
  }
  const filterOptions: { id: FilterType; label: string; icon: any }[] = [
    { id: "all", label: "All Images", icon: LayoutGrid },
    { id: "labeled", label: "Labeled", icon: LayoutGrid },
    { id: "unlabeled", label: "Unlabeled", icon: LayoutGrid },
    { id: "needs-review", label: "Needs Review", icon: AlertCircle },
  ]

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search images..."
            value={currentSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={currentSort}
          onChange={(e) => onSortChange(e.target.value as "asc" | "desc")}
          className="h-9 px-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="asc">Name A-Z</option>
          <option value="desc">Name Z-A</option>
        </select>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => {
          const count = getCount(option.id)
          return (
            <Button
              key={option.id}
              variant={currentFilter === option.id ? "secondary" : "outline"}
              size="sm"
              onClick={() => onFilterChange(option.id)}
              className="gap-2"
            >
              <option.icon className="h-3.5 w-3.5" />
              {option.label}
              <Badge 
                variant={option.id === "needs-review" && count > 0 ? "destructive" : "secondary"} 
                className="ml-1"
              >
                {count}
              </Badge>
            </Button>
          )
        })}
      </div>

      {/* Filter Legend */}
      {currentFilter === "needs-review" && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md">
          <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-100">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block mb-1">Needs Review (Iterative Refinement)</strong>
              <p className="opacity-90">
                Confidence score가 임계값(0.8) 미만인 객체가 포함된 이미지입니다.
                <br />
                Paper: "임계값 미만인 객체는 사용자 검토 대상으로 분류"
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
