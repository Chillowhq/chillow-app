import {
  CalendarCheck,
  CalendarX,
  ClipboardList,
  DoorClosed,
  Percent,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AnalyticsMetricCard } from "@/components/analytics/shared/AnalyticsMetricCard"
import { AnalyticsSection } from "@/components/analytics/shared/AnalyticsSection"
import type {
  LodgingCancellationReason,
  LodgingEventTrendPoint,
  LodgingLifecycleSummary,
} from "@/types/owner-analytics"

type HotelLifecycleAnalyticsProps = {
  lifecycle: LodgingLifecycleSummary
  confirmationTrend: LodgingEventTrendPoint[]
  cancellationTrend: LodgingEventTrendPoint[]
  checkoutTrend: LodgingEventTrendPoint[]
  cancellationReasons: LodgingCancellationReason[]
}

function comparisonLabel(value: number | null) {
  if (value === null) return "No prior baseline"
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${value.toFixed(1)}% vs prior`
}

export function HotelLifecycleAnalytics({
  lifecycle,
  confirmationTrend,
  cancellationTrend,
  checkoutTrend,
  cancellationReasons,
}: HotelLifecycleAnalyticsProps) {
  const cancellationsByDate = new Map(
    cancellationTrend.map((point) => [point.date, point.count]),
  )
  const checkoutsByDate = new Map(
    checkoutTrend.map((point) => [point.date, point.count]),
  )
  const dates = Array.from(
    new Set([
      ...confirmationTrend.map((point) => point.date),
      ...cancellationTrend.map((point) => point.date),
      ...checkoutTrend.map((point) => point.date),
    ]),
  ).sort()
  const confirmationsByDate = new Map(
    confirmationTrend.map((point) => [point.date, point.count]),
  )
  const trend = dates.map((date) => ({
    date,
    confirmations: confirmationsByDate.get(date) || 0,
    cancellations: cancellationsByDate.get(date) || 0,
    checkouts: checkoutsByDate.get(date) || 0,
  }))

  return (
    <AnalyticsSection
      icon={<ClipboardList className="h-5 w-5 text-white" />}
      iconClassName="bg-gradient-to-br from-sky-500 to-blue-600"
      title="Reservation Lifecycle"
      subtitle="Event counts use persisted confirmation, cancellation, and checkout timestamps."
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <AnalyticsMetricCard
          icon={<CalendarCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconClassName="bg-emerald-100 dark:bg-emerald-950/50"
          value={lifecycle.confirmations.count}
          label="Confirmations"
          meta={
            <span className="text-xs font-semibold text-muted-foreground">
              {comparisonLabel(lifecycle.confirmations.comparisonPercent)}
            </span>
          }
        />
        <AnalyticsMetricCard
          icon={<CalendarX className="h-5 w-5 text-red-600 dark:text-red-400" />}
          iconClassName="bg-red-100 dark:bg-red-950/50"
          value={lifecycle.cancellations.count}
          label="Cancellation Events"
          meta={
            <span className="text-xs font-semibold text-muted-foreground">
              {comparisonLabel(lifecycle.cancellations.comparisonPercent)}
            </span>
          }
        />
        <AnalyticsMetricCard
          icon={<DoorClosed className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          iconClassName="bg-indigo-100 dark:bg-indigo-950/50"
          value={lifecycle.checkouts.actualCount}
          label="Actual Checkouts"
          meta={
            <span className="text-xs font-semibold text-muted-foreground">
              {lifecycle.checkouts.completedScheduledCount} scheduled completed
            </span>
          }
        />
        <AnalyticsMetricCard
          icon={<Percent className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          iconClassName="bg-orange-100 dark:bg-orange-950/50"
          value={
            lifecycle.cancellations.cancelledBookingCohortRatePercent === null
              ? "Unavailable"
              : `${lifecycle.cancellations.cancelledBookingCohortRatePercent.toFixed(1)}%`
          }
          label="Cancelled Booking Cohort"
        />
        <AnalyticsMetricCard
          icon={<Percent className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          iconClassName="bg-cyan-100 dark:bg-cyan-950/50"
          value={
            lifecycle.checkouts.completionRatePercent === null
              ? "Unavailable"
              : `${lifecycle.checkouts.completionRatePercent.toFixed(1)}%`
          }
          label="Scheduled Checkout Completion"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="font-bold text-foreground">Lifecycle Events Over Time</h3>
          {trend.length ? (
            <div className="mt-5 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.35} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="confirmations" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cancellations" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="checkouts" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              No persisted lifecycle events occurred in this period.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-bold text-foreground">Cancellation Reasons</h3>
          {cancellationReasons.length ? (
            <div className="mt-4 space-y-4">
              {cancellationReasons.map((item) => (
                <div key={item.reason}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-foreground">
                      {item.reason}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {item.count} · {item.percentagePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{ width: `${Math.min(100, item.percentagePercent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No cancellation reasons were stored in this period.
            </p>
          )}
        </div>
      </div>
    </AnalyticsSection>
  )
}
