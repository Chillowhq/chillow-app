"use client"

import type { KeyboardEvent, ReactNode } from "react"

export type AnalyticsTabOption<T extends string> = {
  id: T
  label: string
  icon: ReactNode
}

type AnalyticsTabsProps<T extends string> = {
  tabs: AnalyticsTabOption<T>[]
  value: T
  onValueChange: (value: T) => void
  ariaLabel?: string
}

export function AnalyticsTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  ariaLabel = "Analytics modules",
}: AnalyticsTabsProps<T>) {
  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % tabs.length
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabs.length) % tabs.length
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1
    }

    if (nextIndex === null) return

    event.preventDefault()
    const nextTab = tabs[nextIndex]
    onValueChange(nextTab.id)
    document.getElementById(`analytics-tab-${nextTab.id}`)?.focus()
  }

  return (
    <div className="border-b border-border bg-background">
      <div className="overflow-x-auto px-6">
        <div
          className="flex min-w-max gap-1 pt-4"
          role="tablist"
          aria-label={ariaLabel}
        >
          {tabs.map((tab, index) => {
            const isActive = value === tab.id

            return (
              <button
                key={tab.id}
                id={`analytics-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`analytics-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onValueChange(tab.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={`relative flex items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary transition-opacity ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
