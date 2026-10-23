"use client"

import type {
  OwnerAnalyticsCustomRange,
  OwnerAnalyticsRange,
} from "@/types/owner-analytics"
import { AnalyticsRefreshControl } from "./AnalyticsRefreshControl"
import { AnalyticsRangeSelector } from "./AnalyticsRangeSelector"

type AnalyticsHeaderProps = {
  range: OwnerAnalyticsRange
  customRange: OwnerAnalyticsCustomRange
  onRangeChange: (range: OwnerAnalyticsRange) => void
  onCustomRangeChange: (range: OwnerAnalyticsCustomRange) => void
  onRefresh: () => void
  refreshing: boolean
  lastUpdated: Date | null
  timezone?: string
}

export function AnalyticsHeader({
  range,
  customRange,
  onRangeChange,
  onCustomRangeChange,
  onRefresh,
  refreshing,
  lastUpdated,
  timezone,
}: AnalyticsHeaderProps) {
  return (
    <header className="sticky top-0 lg:top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="px-4 py-4 sm:px-6">
        <div className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Historical reporting &amp; business insights
            </p>
          </div>

          <div className="flex w-full min-w-0 items-center gap-3 lg:w-auto">
            <AnalyticsRangeSelector
              range={range}
              customRange={customRange}
              onRangeChange={onRangeChange}
              onCustomRangeChange={onCustomRangeChange}
            />

            <AnalyticsRefreshControl
              lastUpdated={lastUpdated}
              onRefresh={onRefresh}
              refreshing={refreshing}
              timezone={timezone}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
