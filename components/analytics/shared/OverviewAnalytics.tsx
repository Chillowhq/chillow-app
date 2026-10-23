import { BarChart3, BedDouble, Building2 } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AnalyticsEmptyState } from "@/components/analytics/shared/AnalyticsEmptyState"
import { SharedAnalyticsSummary } from "@/components/analytics/shared/SharedAnalyticsSummary"
import { formatPrice } from "@/lib/localization"
import type {
  AnalyticsModuleId,
  LodgingAnalyticsModule,
  SharedAnalytics,
} from "@/types/owner-analytics"

type OverviewAnalyticsProps = {
  data?: SharedAnalytics
  lodging?: LodgingAnalyticsModule
  currency: string
}

function formatCents(cents: number, currency: string) {
  return formatPrice(cents / 100, currency)
}

function moduleLabel(moduleId: AnalyticsModuleId) {
  return moduleId === "foodService" ? "Food Service" : "Lodging"
}

export function OverviewAnalytics({
  data,
  lodging,
  currency,
}: OverviewAnalyticsProps) {
  const occupancy = lodging?.occupancy
  const hasRefunds = Boolean(data && data.paidRevenue.refundedCents > 0)
  const revenueDataKey = hasRefunds ? "netRetainedCents" : "grossCents"

  if (!data && !occupancy) {
    return (
      <AnalyticsEmptyState
        icon={<BarChart3 className="h-6 w-6 text-muted-foreground" />}
        title="No overview analytics for this period"
        description="Shared business insights will appear here when activity is recorded."
        className="m-6"
      />
    )
  }

  return (
    <div>
      {data ? (
        <SharedAnalyticsSummary data={data} currency={currency} />
      ) : null}

      <div className="grid grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-2">
        {data ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/50">
                <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">
                  {hasRefunds ? "Net Revenue Trend" : "Revenue Trend"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Paid revenue across all enabled modules
                </p>
              </div>
            </div>

            {data.revenueByDay.length ? (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenueByDay}>
                    <defs>
                      <linearGradient
                        id="overviewRevenueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      strokeOpacity={0.5}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      tickFormatter={(value) => formatCents(value, currency)}
                      width={72}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatCents(Number(value), currency),
                        hasRefunds ? "Net retained" : "Revenue",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey={revenueDataKey}
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#overviewRevenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No paid revenue was recorded in this period.
              </p>
            )}
          </div>
        ) : null}

        {data ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/50">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">
                  Revenue by Module
                </h2>
                <p className="text-xs text-muted-foreground">
                  Contribution from each enabled business module
                </p>
              </div>
            </div>

            {data.revenueByModule.length ? (
              <div className="space-y-3">
                {data.revenueByModule.map((module) => {
                  const moduleHasRefunds = module.refundedCents > 0
                  const displayedCents = moduleHasRefunds
                    ? module.netRetainedCents
                    : module.grossCents

                  return (
                    <div
                      key={module.module}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-secondary/30 p-4"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-foreground">
                          {moduleLabel(module.module)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {module.transactionCount} paid transaction
                          {module.transactionCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-foreground">
                          {formatCents(displayedCents, currency)}
                        </p>
                        {moduleHasRefunds ? (
                          <p className="text-xs text-muted-foreground">
                            Net retained
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No module revenue was recorded in this period.
              </p>
            )}
          </div>
        ) : null}

        {occupancy ? (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-950/50">
                  <BedDouble className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">
                    Occupancy Snapshot
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Current active, reservable room inventory
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 sm:text-right">
                <div>
                  <p className="text-xl font-black text-foreground">
                    {occupancy.occupancyRatePercent === null
                      ? "Unavailable"
                      : `${occupancy.occupancyRatePercent.toFixed(1)}%`}
                  </p>
                  <p className="text-xs text-muted-foreground">Occupancy</p>
                </div>
                <div>
                  <p className="text-xl font-black text-foreground">
                    {occupancy.occupiedRoomsForToday}
                  </p>
                  <p className="text-xs text-muted-foreground">Occupied today</p>
                </div>
                <div>
                  <p className="text-xl font-black text-foreground">
                    {occupancy.availableRoomsForToday}
                  </p>
                  <p className="text-xs text-muted-foreground">Available today</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
