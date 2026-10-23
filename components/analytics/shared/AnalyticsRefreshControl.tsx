"use client"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatTime } from "@/lib/localization"

type AnalyticsRefreshControlProps = {
  lastUpdated: Date | null
  onRefresh: () => void
  refreshing: boolean
  timezone?: string
  label?: string
}

export function AnalyticsRefreshControl({
  lastUpdated,
  onRefresh,
  refreshing,
  timezone,
  label = "analytics",
}: AnalyticsRefreshControlProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="min-w-14 text-right" aria-live="polite">
        <p className="text-[10px] text-muted-foreground">Updated</p>
        <p className="font-mono text-xs text-foreground">
          {lastUpdated ? formatTime(lastUpdated, timezone) : "—"}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label={`Refresh ${label}`}
      >
        <RefreshCw
          className={refreshing ? "animate-spin" : undefined}
          aria-hidden="true"
        />
        {refreshing ? "Refreshing" : "Refresh"}
      </Button>
    </div>
  )
}
