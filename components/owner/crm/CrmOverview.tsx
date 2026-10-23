"use client"

import { useState } from "react"
import { AnalyticsRangeSelector } from "@/components/analytics/shared/AnalyticsRangeSelector"
import { AnalyticsRefreshControl } from "@/components/analytics/shared/AnalyticsRefreshControl"
import { AnalyticsSkeleton } from "@/components/analytics/shared/AnalyticsSkeleton"
import { AnalyticsErrorState } from "@/components/analytics/shared/AnalyticsErrorState"
import { useBusinessSettings } from "@/contexts/BusinessContext"
import { useCrmAnalytics } from "@/hooks/use-crm-analytics"
import type {
    CrmAnalyticsCustomRange,
    CrmAnalyticsRange,
} from "@/types/crm-analytics"
import { CrmMetricGrid } from "./CrmMetricGrid"
import { CustomerActivityChart } from "./CustomerActivityChart"
import { CustomerVisitsChart } from "./CustomerVisitsChart"
import { CustomerSegments } from "./CustomerSegments"
import { TopCustomers } from "./TopCustomers"
import { ReEngagementCustomers } from "./ReEngagementCustomers"
import { GuestDetailModal } from "./GuestDetailModal"
import { CustomerFunnel } from "./CustomerFunnel"
import { CustomerJourneyTrendChart } from "./CustomerJourneyTrendChart"

type CrmOverviewProps = {
    active?: boolean
    businessId?: string
    requestedGuestId?: string | null
    onRequestedGuestHandled?: () => void
}

export function CrmOverview({
    active = true,
    businessId,
    requestedGuestId,
    onRequestedGuestHandled,
}: CrmOverviewProps) {
    const [range, setRange] = useState<CrmAnalyticsRange>("30days")
    const [customRange, setCustomRange] = useState<CrmAnalyticsCustomRange>({
        from: "",
        to: "",
    })
    const [selectedGuestId, setSelectedGuestId] = useState<string | null>(
        requestedGuestId || null,
    )

    const { currency, timezone } = useBusinessSettings()

    const {
        data,
        loading,
        refreshing,
        error,
        lastUpdated,
        refresh,
    } = useCrmAnalytics({
        businessId,
        range,
        customRange,
        active,
    })
    const analyticsCurrency = data?.currency || currency

    const handleCloseModal = () => {
        setSelectedGuestId(null)
        if (requestedGuestId && onRequestedGuestHandled) {
            onRequestedGuestHandled()
        }
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Overview Top Header Bar (Date Range Selector & Refresh) */}
            <div className="bg-background/95 border-b border-border px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-foreground">
                        Customer Intelligence Overview
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Key customer metrics, visit volume, trends & value
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <AnalyticsRangeSelector
                        range={range}
                        customRange={customRange}
                        onRangeChange={setRange}
                        onCustomRangeChange={setCustomRange}
                    />

                    <AnalyticsRefreshControl
                        lastUpdated={lastUpdated}
                        onRefresh={() => void refresh()}
                        refreshing={refreshing || loading}
                        timezone={timezone}
                        label="customer analytics"
                    />
                </div>
            </div>

            <div className="px-6 space-y-6">
                {loading && !data ? (
                    <AnalyticsSkeleton showHeader={false} />
                ) : null}
                {error ? (
                    <AnalyticsErrorState
                        message={error}
                        onRetry={() => void refresh()}
                        compact={Boolean(data)}
                    />
                ) : null}
                {data ? (
                    <>
                        {/* Acquisition Funnel & Journey Intelligence */}
                        {data.customerJourney && (
                            <div className="space-y-6">
                                {data.customerJourney.totalOrderingVisitors > 0 && data.overview.totalVisits === 0 ? (
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200" role="status">
                                        Ordering journeys are grouped by the business day when the menu visit began. Confirmed visits and customer revenue are grouped by the paid order&apos;s business day after processing, so activity near closing time can appear in adjacent periods.
                                    </div>
                                ) : null}
                                <CustomerFunnel
                                    journeyData={data.customerJourney}
                                    currency={analyticsCurrency}
                                    timezone={timezone}
                                />
                                <CustomerJourneyTrendChart
                                    points={data.customerJourney.trend || []}
                                    bucket={data.customerActivity?.bucket || "day"}
                                />
                            </div>
                        )}

                        {/* KPI Metric Cards */}
                        <CrmMetricGrid overview={data.overview} currency={analyticsCurrency} />

                        {/* Trends Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <CustomerActivityChart
                                points={data.customerActivity?.points || []}
                                bucket={data.customerActivity?.bucket || "day"}
                            />
                            <CustomerVisitsChart
                                points={data.visits?.points || []}
                                bucket={data.visits?.bucket || "day"}
                            />
                        </div>

                        {/* Segments Breakdown */}
                        <CustomerSegments
                            segments={data.segments || []}
                            totalCustomers={data.overview?.totalCustomers || 0}
                        />

                        {/* Top Customers & At-Risk Customers */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <TopCustomers
                                customers={data.topCustomers || []}
                                currency={analyticsCurrency}
                                timezone={timezone}
                                onSelectCustomer={setSelectedGuestId}
                            />
                            <ReEngagementCustomers
                                reEngagement={data.reEngagement}
                                currency={analyticsCurrency}
                                timezone={timezone}
                                onSelectCustomer={setSelectedGuestId}
                            />
                        </div>
                    </>
                ) : null}
            </div>

            {/* Guest Detail Modal */}
            {selectedGuestId && (
                <GuestDetailModal
                    guestId={selectedGuestId}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    )
}
