import { UsersRound } from "lucide-react"
import { AnalyticsSection } from "@/components/analytics/shared/AnalyticsSection"
import type {
  LodgingCheckInStaffPerformance,
  LodgingCheckOutStaffPerformance,
  LodgingStaffAttribution,
} from "@/types/owner-analytics"

type HotelStaffPerformanceProps = {
  checkIns: LodgingCheckInStaffPerformance[]
  checkOuts: LodgingCheckOutStaffPerformance[]
  attribution: LodgingStaffAttribution
}

function delayLabel(value: number | null) {
  if (value === null) return "Unavailable"
  if (value === 0) return "On schedule"
  return value < 0
    ? `${Math.abs(value).toFixed(1)} min early`
    : `${value.toFixed(1)} min late`
}

export function HotelStaffPerformance({
  checkIns,
  checkOuts,
  attribution,
}: HotelStaffPerformanceProps) {
  return (
    <AnalyticsSection
      icon={<UsersRound className="h-5 w-5 text-white" />}
      iconClassName="bg-gradient-to-br from-emerald-500 to-teal-600"
      title="Hotel Staff Activity"
      subtitle="Counts and timing use the staff snapshots persisted on check-in and checkout events."
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StaffTable
          title="Check-in Activity"
          rows={checkIns.map((item) => ({
            staffId: item.staffId,
            name: item.name,
            count: item.checkInsCompleted,
            percentagePercent: item.percentagePercent,
            delay: delayLabel(item.averageCheckInDelayMinutes),
          }))}
          countLabel="Check-ins"
          unattributed={attribution.unattributedCheckIns}
        />
        <StaffTable
          title="Checkout Activity"
          rows={checkOuts.map((item) => ({
            staffId: item.staffId,
            name: item.name,
            count: item.checkOutsCompleted,
            percentagePercent: item.percentagePercent,
            delay: delayLabel(item.averageCheckoutDelayMinutes),
          }))}
          countLabel="Checkouts"
          unattributed={attribution.unattributedCheckOuts}
        />
      </div>
    </AnalyticsSection>
  )
}

function StaffTable({
  title,
  rows,
  countLabel,
  unattributed,
}: {
  title: string
  rows: Array<{
    staffId: string
    name: string
    count: number
    percentagePercent: number
    delay: string
  }>
  countLabel: string
  unattributed: number
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h3 className="font-bold text-foreground">{title}</h3>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Staff</th>
                <th className="px-5 py-3 text-right">{countLabel}</th>
                <th className="px-5 py-3 text-right">Share</th>
                <th className="px-5 py-3 text-right">Average Timing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((item) => (
                <tr key={item.staffId}>
                  <td className="px-5 py-4 font-bold text-foreground">
                    {item.name}
                  </td>
                  <td className="px-5 py-4 text-right text-foreground">
                    {item.count}
                  </td>
                  <td className="px-5 py-4 text-right text-foreground">
                    {item.percentagePercent.toFixed(1)}%
                  </td>
                  <td className="px-5 py-4 text-right text-foreground">
                    {item.delay}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          No attributed staff events occurred in this period.
        </p>
      )}
      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Unattributed events: {unattributed}
      </p>
    </div>
  )
}
