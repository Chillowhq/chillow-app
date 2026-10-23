"use client"

import { useState } from "react"
import {
  BarChart3,
  BedDouble,
  LayoutDashboard,
  UtensilsCrossed,
} from "lucide-react"
import { AnalyticsEmptyState } from "@/components/analytics/shared/AnalyticsEmptyState"
import { AnalyticsErrorState } from "@/components/analytics/shared/AnalyticsErrorState"
import { AnalyticsHeader } from "@/components/analytics/shared/AnalyticsHeader"
import { AnalyticsShell } from "@/components/analytics/shared/AnalyticsShell"
import { AnalyticsSkeleton } from "@/components/analytics/shared/AnalyticsSkeleton"
import {
  AnalyticsTabs,
  type AnalyticsTabOption,
} from "@/components/analytics/shared/AnalyticsTabs"
import { OverviewAnalytics } from "@/components/analytics/shared/OverviewAnalytics"
import {
  FoodServiceAnalytics,
  isFoodServiceAnalyticsEmpty,
} from "@/components/analytics/food-service/FoodServiceAnalytics"
import {
  HotelAnalytics,
  isLodgingAnalyticsEmpty,
} from "@/components/analytics/hotel/HotelAnalytics"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useOwnerAnalytics } from "@/hooks/use-owner-analytics"
import { LockedFeatureState } from "@/components/owner/LockedFeatureState"
import type {
  AnalyticsModuleId,
  OwnerAnalyticsCustomRange,
  OwnerAnalyticsRange,
} from "@/types/owner-analytics"

type AnalyticsViewId = "overview" | AnalyticsModuleId

export default function OwnerAnalytics() {
  const { user } = useAuthGuard()
  const isLocked = user && !user.entitlements?.advancedAnalytics
  const [range, setRange] = useState<OwnerAnalyticsRange>("today")
  const [customRange, setCustomRange] = useState<OwnerAnalyticsCustomRange>({
    from: "",
    to: "",
  })
  const [activeView, setActiveView] =
    useState<AnalyticsViewId>("overview")

  const {
    data,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
  } = useOwnerAnalytics({
    businessId: isLocked ? undefined : user?.businessId,
    range,
    customRange,
  })


  if (!isLocked && loading && !data) {
    return <AnalyticsSkeleton />
  }

  const foodService = data?.modules.foodService
  const lodging = data?.modules.lodging
  const tabs: AnalyticsTabOption<AnalyticsViewId>[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
  ]

  data?.enabledAnalyticsModules.forEach((moduleId) => {
    if (moduleId === "lodging" && lodging) {
      tabs.push({
        id: moduleId,
        label: "Lodging",
        icon: <BedDouble className="h-4 w-4" />,
      })
    }

    if (moduleId === "foodService" && foodService) {
      tabs.push({
        id: moduleId,
        label: "Food Service",
        icon: <UtensilsCrossed className="h-4 w-4" />,
      })
    }
  })

  const renderedView = tabs.some((tab) => tab.id === activeView)
    ? activeView
    : "overview"

  return (
    <div className={isLocked ? "relative h-[calc(100svh-4rem)] overflow-hidden lg:h-svh" : undefined}>
      {isLocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/60 px-6 py-6 backdrop-blur-[2px]">
          <LockedFeatureState feature="analytics" />
        </div>
      )}
      <div className={isLocked ? "pointer-events-none select-none opacity-40" : undefined}>
        <AnalyticsShell>
      <AnalyticsHeader
        range={range}
        customRange={customRange}
        timezone={data?.range.timezone}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        onRangeChange={setRange}
        onCustomRangeChange={setCustomRange}
        onRefresh={refresh}
      />

      {data ? (
        <AnalyticsTabs
          tabs={tabs}
          value={renderedView}
          onValueChange={setActiveView}
        />
      ) : null}

      {error ? (
        <AnalyticsErrorState
          message={error}
          onRetry={refresh}
          compact={Boolean(data)}
        />
      ) : null}

      {data && renderedView === "overview" ? (
        <div
          id="analytics-panel-overview"
          role="tabpanel"
          aria-labelledby="analytics-tab-overview"
        >
          <OverviewAnalytics
            data={data.shared}
            lodging={lodging}
            currency={data.currency}
          />
        </div>
      ) : null}

      {data && renderedView === "foodService" && foodService ? (
        <div
          id="analytics-panel-foodService"
          role="tabpanel"
          aria-labelledby="analytics-tab-foodService"
        >
          {isFoodServiceAnalyticsEmpty(foodService) ? (
            <AnalyticsEmptyState
              icon={<BarChart3 className="w-6 h-6 text-muted-foreground" />}
              title="No food-service analytics for this period"
              description="Orders and service activity will appear here when they are recorded."
              className="m-6"
            />
          ) : (
            <FoodServiceAnalytics
              data={foodService}
              range={data.range.preset}
              currency={data.currency}
            />
          )}
        </div>
      ) : null}

      {data && renderedView === "lodging" && lodging ? (
        <div
          id="analytics-panel-lodging"
          role="tabpanel"
          aria-labelledby="analytics-tab-lodging"
        >
          {isLodgingAnalyticsEmpty(lodging) ? (
            <AnalyticsEmptyState
              icon={<BarChart3 className="w-6 h-6 text-muted-foreground" />}
              title="No lodging analytics for this period"
              description="Bookings, stays, and room performance will appear here when they are recorded."
              className="m-6"
            />
          ) : (
            <HotelAnalytics
              data={lodging}
              range={data.range.preset}
              currency={data.currency}
              roomTerm="Room"
            />
          )}
        </div>
      ) : null}

    </AnalyticsShell>
      </div>
    </div>
  )
}
