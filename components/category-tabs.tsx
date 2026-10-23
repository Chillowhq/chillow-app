"use client"

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Cake, Coffee, LayoutGrid, Soup, Utensils } from "lucide-react"

interface CategoryTabsProps {
  categories: string[]
  activeCategory: string
  onCategoryChange: (category: string) => void
}

const categoryIcons: Record<string, React.ReactNode> = {
  all: <LayoutGrid className="h-5 w-5" />,
  appetizers: <Soup className="h-5 w-5" />,
  mains: <Utensils className="h-5 w-5" />,
  desserts: <Cake className="h-5 w-5" />,
  beverages: <Coffee className="h-5 w-5" />,
}

export default function CategoryTabs({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) {
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2.5 py-3">
        {categories.map((category) => {
          const isActive = activeCategory === category
          const normalizedCategory = category.toLowerCase()
          return (
            <button
              type="button"
              key={category}
              onClick={() => onCategoryChange(category)}
              aria-pressed={isActive}
              className={`group relative flex min-h-13 items-center gap-2.5 whitespace-nowrap rounded-full px-5 text-[15px] font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#EA601A)] focus-visible:ring-offset-2 motion-reduce:transition-none ${
                isActive
                  ? "text-[var(--brand-text-on-brand,white)] shadow-[0_10px_24px_-14px_var(--brand-primary,#EA601A)]"
                  : "border border-border/70 bg-card text-foreground shadow-sm hover:bg-secondary active:scale-95"
              }`}
              style={isActive ? {
                background: "linear-gradient(to right, var(--brand-gradient-from, #EA601A), var(--brand-gradient-to, #ff8c42))",
              } : {}}
            >
              <span className="relative z-10 flex items-center gap-2">
                {categoryIcons[normalizedCategory]}
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </span>
            </button>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
