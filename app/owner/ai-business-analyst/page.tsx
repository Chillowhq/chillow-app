"use client"

import { useState } from "react"
import { ChevronDown, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useAiBusinessAnalyst } from "@/hooks/use-ai-business-analyst"
import { LockedFeatureState } from "@/components/owner/LockedFeatureState"
import type { PeriodSelectorItem } from "@/types/ai-business-analyst"

import { MayorHeader } from "@/components/owner/ai-analyst/MayorHeader"
import { AnalystSkeleton } from "@/components/owner/ai-analyst/AnalystSkeleton"
import { CurrentWeekView } from "@/components/owner/ai-analyst/CurrentWeekView"

import { BusinessHealthV5 } from "@/components/owner/ai-analyst/v5/BusinessHealthV5"
import { PrioritiesV5 } from "@/components/owner/ai-analyst/v5/PrioritiesV5"
import { WorkingWellV5 } from "@/components/owner/ai-analyst/v5/WorkingWellV5"
import { OpportunitiesV5 } from "@/components/owner/ai-analyst/v5/OpportunitiesV5"
import { WatchNextWeekV5 } from "@/components/owner/ai-analyst/v5/WatchNextWeekV5"
import {
  NotGeneratedState,
  GeneratingState,
  FailedState,
  ErrorState,
  InsufficientDataState,
  StableWeekState,
} from "@/components/owner/ai-analyst/EmptyStates"

export default function AiBusinessAnalystPage() {
  const { user } = useAuthGuard()
  const isLocked = user && !user.entitlements?.aiBusinessAnalyst
  const businessId = isLocked ? undefined : user?.businessId
  const businessName = user?.displayName || user?.name || "Business"

  const {
    report,
    status,
    historyLoading,
    selectedView,
    currentWeekSnapshot,
    currentWeekLoading,
    
    thisWeek,
    lastWeek,
    twoWeeksAgo,
    threeWeeksAgo,
    fourWeeksAgo,
    customHistory,

    fetchLatest,
    selectCurrentWeek,
    selectFinalReport,
  } = useAiBusinessAnalyst(businessId)

  const [historyOpen, setHistoryOpen] = useState(false)

  if (isLocked) {
    return (
      <div className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center px-6 py-12 lg:min-h-svh">
        <LockedFeatureState feature="aiBusinessAnalyst" />
      </div>
    )
  }

  const isSelected = (item: PeriodSelectorItem | null) => {
    if (!item) return false
    if (selectedView.type === "current-week") return item.isCurrentWeek
    return selectedView.periodKey === item.periodKey
  }

  const selectItem = (item: PeriodSelectorItem) => {
    if (item.isCurrentWeek) {
      selectCurrentWeek()
    } else {
      selectFinalReport(item.periodKey)
    }
  }

  const renderNavButton = (label: string, item: PeriodSelectorItem | null) => {
    if (!item) return null
    const selected = isSelected(item)
    return (
      <Button
        key={item.periodKey}
        variant={selected ? "default" : "ghost"}
        size="sm"
        disabled={!item.isSelectable}
        onClick={() => selectItem(item)}
        className={`h-8 px-4 text-sm font-semibold rounded-full transition-colors ${
          selected 
            ? "bg-foreground text-background hover:bg-foreground/90 shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        {label}
      </Button>
    )
  }

  const flatCustomHistory = customHistory.flatMap((g) => g.items)
  const isCustomSelected = flatCustomHistory.some(isSelected)

  const customSelector = customHistory.length > 0 ? (
    <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isCustomSelected ? "default" : "ghost"}
          size="sm"
          className={`gap-2 h-8 px-4 text-sm font-semibold rounded-full transition-colors ${
            isCustomSelected
              ? "bg-foreground text-background hover:bg-foreground/90 shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Custom
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 shadow-xl border-muted rounded-xl overflow-hidden" align="end">
        {historyLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto p-2">
            {customHistory.map((group) => (
              <div key={group.monthLabel} className="mb-4 last:mb-0">
                <p className="px-2 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur z-10">
                  {group.monthLabel}
                </p>
                <div className="space-y-0.5 mt-1">
                  {group.items.map((h) => {
                    const selected = isSelected(h)
                    const badgeLabel = 
                      h.badge === "generating" ? "Generating" :
                      h.badge === "unavailable" ? "Unavailable" : null

                    return (
                      <button
                        key={h.periodKey}
                        disabled={!h.isSelectable}
                        onClick={() => {
                          selectItem(h)
                          setHistoryOpen(false)
                        }}
                        className={`w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                          selected
                            ? "bg-[#EA601A]/10 font-semibold text-[#EA601A]"
                            : !h.isSelectable
                              ? "cursor-not-allowed text-muted-foreground/50"
                              : "hover:bg-muted font-medium"
                        }`}
                      >
                        <span className="flex items-center justify-between w-full">
                          <span>{h.label}</span>
                          {badgeLabel && (
                            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                              {badgeLabel}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  ) : null

  // Find the currently active item to show the date range context
  const activeItem = [thisWeek, lastWeek, twoWeeksAgo, threeWeeksAgo, fourWeeksAgo, ...flatCustomHistory].find(isSelected)
  const headerBadge = activeItem?.badge === "live" ? "live" : activeItem?.badge === "generating" ? "generating" : activeItem?.badge === "unavailable" ? "unavailable" : "final"

  const LayoutWrapper = ({ children, hideHeader = false }: { children: React.ReactNode, hideHeader?: boolean }) => (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {!hideHeader && (
          <div className="mb-8 border-b border-border/50 pb-6">
            <MayorHeader businessName={businessName} badge={headerBadge as any} />
            
            <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-1.5 rounded-full border border-border/50 w-fit">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {renderNavButton("This Week", thisWeek)}
                {renderNavButton("Last Week", lastWeek)}
                {renderNavButton("2 Weeks Ago", twoWeeksAgo)}
                {renderNavButton("3 Weeks Ago", threeWeeksAgo)}
                {renderNavButton("4 Weeks Ago", fourWeeksAgo)}
                {customSelector}
              </div>
            </div>

            {activeItem && (
              <div className="mt-4 text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span>{activeItem.label}</span>
                <span className="text-border">•</span>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  activeItem.badge === "live" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                }`}>
                  {activeItem.badge === "live" ? "LIVE" : activeItem.badge === "generating" ? "GENERATING" : activeItem.badge === "unavailable" ? "UNAVAILABLE" : "FINAL"}
                </span>
              </div>
            )}
          </div>
        )}
        <div>
          {children}
        </div>
      </div>
    </div>
  )

  if (status === "loading") {
    return <LayoutWrapper hideHeader><MayorHeader businessName={businessName} /><AnalystSkeleton /></LayoutWrapper>
  }

  // Determine what to render based on the selected view
  if (selectedView.type === "current-week") {
    return (
      <LayoutWrapper>
        <CurrentWeekView snapshot={currentWeekSnapshot} loading={currentWeekLoading} />
      </LayoutWrapper>
    )
  }

  // --- Final Report View ---

  if (status === "error") {
    return <LayoutWrapper><ErrorState onRetry={fetchLatest} /></LayoutWrapper>
  }

  if (status === "not_generated") {
    return <LayoutWrapper><NotGeneratedState /></LayoutWrapper>
  }

  if (report?.status === "snapshot_ready" || report?.status === "generating") {
    return <LayoutWrapper><GeneratingState /></LayoutWrapper>
  }

  if (report?.status === "failed") {
    return <LayoutWrapper><FailedState onRetry={fetchLatest} /></LayoutWrapper>
  }

  const gr = report?.generatedReport as any
  const isDeterministic = report?.deterministicInsights?.insufficientData === true
  const isStable = report?.deterministicInsights?.noSignificantInsights === true && !isDeterministic

  return (
    <LayoutWrapper>
      {isDeterministic && <InsufficientDataState />}

      {isStable && !isDeterministic && <StableWeekState businessName={businessName} />}

      {gr && !isDeterministic && !isStable && (
        <div className="pb-16 space-y-2">
          {gr.headline && (
            <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground mb-6 mt-4">
              {gr.headline}
            </h2>
          )}
          {gr.executiveSummary && (
            <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm mb-8">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-4">
                Mayor's Take
              </h3>
              <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
                {gr.executiveSummary}
              </p>
            </div>
          )}
          <BusinessHealthV5 health={gr.businessHealth} />
          <PrioritiesV5 priorities={gr.priorities} />
          <WorkingWellV5 items={gr.workingWell} />
          <OpportunitiesV5 items={gr.opportunities} />
          <WatchNextWeekV5 items={gr.watchNextWeek} />
        </div>
      )}
    </LayoutWrapper>
  )
}
