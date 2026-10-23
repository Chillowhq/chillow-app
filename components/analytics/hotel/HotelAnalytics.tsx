import {
  Activity,
  BarChart3,
  BedDouble,
  CalendarCheck,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  CreditCard,
  DoorOpen,
  Hotel,
  Moon,
  WalletCards,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AnalyticsMetricCard } from "@/components/analytics/shared/AnalyticsMetricCard"
import { AnalyticsSection } from "@/components/analytics/shared/AnalyticsSection"
import { HotelLifecycleAnalytics } from "@/components/analytics/hotel/HotelLifecycleAnalytics"
import { HotelStaffPerformance } from "@/components/analytics/hotel/HotelStaffPerformance"
import { RoomTypePerformance } from "@/components/analytics/hotel/RoomTypePerformance"
import { formatPrice } from "@/lib/localization"
import type {
  LodgingAnalyticsModule,
  OwnerAnalyticsRange,
} from "@/types/owner-analytics"

type HotelAnalyticsProps = {
  data: LodgingAnalyticsModule
  range: OwnerAnalyticsRange
  currency: string
  roomTerm: string
}

type BreakdownItem = {
  key: string
  count: number
  percentagePercent: number
}

function formatCents(cents: number, currency: string) {
  return formatPrice(cents / 100, currency)
}

function friendlyLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function rangeLabel(range: OwnerAnalyticsRange) {
  return range === "7days" ? "Last 7 days" : friendlyLabel(range)
}

function BreakdownCard({
  title,
  items,
}: {
  title: string
  items: BreakdownItem[]
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-bold text-foreground">{title}</h3>
      {items.length ? (
        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <div key={item.key}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-foreground">
                  {friendlyLabel(item.key)}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {item.count} · {item.percentagePercent.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{
                    width: `${Math.min(100, item.percentagePercent)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          No bookings were created in this period.
        </p>
      )}
    </div>
  )
}

export function isLodgingAnalyticsEmpty(data: LodgingAnalyticsModule) {
  return (
    data.overview.paidBookingCount === 0 &&
    data.overview.scheduledArrivals === 0 &&
    data.overview.scheduledDepartures === 0 &&
    data.overview.actualCheckIns === 0 &&
    data.bookingTrend.length === 0 &&
    data.reservationStatusBreakdown.length === 0 &&
    data.pendingPayments.activeCount === 0 &&
    data.pendingPayments.expiredCount === 0 &&
    data.roomRevenuePerformance.length === 0 &&
    data.occupancy.availableRoomNights === 0 &&
    data.lifecycle.confirmations.count === 0 &&
    data.lifecycle.cancellations.count === 0 &&
    data.lifecycle.checkouts.actualCount === 0 &&
    data.roomTypePerformance.length === 0 &&
    data.checkInStaffPerformance.length === 0 &&
    data.checkOutStaffPerformance.length === 0
  )
}

export function HotelAnalytics({
  data,
  range,
  currency,
  roomTerm,
}: HotelAnalyticsProps) {
  const normalizedRoomTerm = roomTerm || "Room"
  const occupancy = data.occupancy
  const hasBookingRefunds =
    data.overview.refundedBookingRevenueCents > 0
  const statusBreakdown = data.reservationStatusBreakdown.map((item) => ({
    key: item.status,
    count: item.count,
    percentagePercent: item.percentagePercent,
  }))
  const paymentBreakdown = data.paymentStatusBreakdown.map((item) => ({
    key: item.status,
    count: item.count,
    percentagePercent: item.percentagePercent,
  }))
  const sourceBreakdown = data.bookingSourceBreakdown.map((item) => ({
    key: item.source,
    count: item.count,
    percentagePercent: item.percentagePercent,
  }))

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AnalyticsMetricCard
          icon={<CalendarCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconClassName="bg-blue-100 dark:bg-blue-950/50"
          value={data.overview.paidBookingCount}
          label="Paid Bookings"
        />
        <AnalyticsMetricCard
          icon={<CircleDollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconClassName="bg-emerald-100 dark:bg-emerald-950/50"
          value={formatCents(data.overview.averageBookingValueCents, currency)}
          label="Average Booking Value"
        />
        <AnalyticsMetricCard
          icon={<Moon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          iconClassName="bg-indigo-100 dark:bg-indigo-950/50"
          value={`${data.overview.averageLengthOfStayNights.toFixed(1)} nights`}
          label="Average Length of Stay"
        />
        <AnalyticsMetricCard
          icon={<DoorOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
          iconClassName="bg-purple-100 dark:bg-purple-950/50"
          value={data.overview.actualCheckIns}
          label="Actual Check-ins"
        />
        <AnalyticsMetricCard
          icon={<CalendarClock className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          iconClassName="bg-cyan-100 dark:bg-cyan-950/50"
          value={data.overview.scheduledArrivals}
          label="Scheduled Arrivals"
        />
        <AnalyticsMetricCard
          icon={<Clock3 className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          iconClassName="bg-orange-100 dark:bg-orange-950/50"
          value={data.overview.scheduledDepartures}
          label="Scheduled Departures"
        />
        <AnalyticsMetricCard
          icon={<CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconClassName="bg-amber-100 dark:bg-amber-950/50"
          value={data.overview.pendingPaymentCount}
          label="Active Pending Payments"
          meta={
            <span className="text-xs font-bold text-amber-600">
              {formatCents(data.overview.pendingPaymentValueCents, currency)}
            </span>
          }
        />
        <AnalyticsMetricCard
          icon={<Hotel className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
          iconClassName="bg-teal-100 dark:bg-teal-950/50"
          value={
            occupancy.occupancyRatePercent === null
              ? "Unavailable"
              : `${occupancy.occupancyRatePercent.toFixed(1)}%`
          }
          label="Current-inventory Occupancy"
        />
      </div>

      <HotelLifecycleAnalytics
        lifecycle={data.lifecycle}
        confirmationTrend={data.confirmationTrend}
        cancellationTrend={data.cancellationTrend}
        checkoutTrend={data.checkoutTrend}
        cancellationReasons={data.cancellationReasonBreakdown}
      />

      <AnalyticsSection
        icon={<BarChart3 className="h-5 w-5 text-white" />}
        iconClassName="bg-gradient-to-br from-blue-500 to-indigo-600"
        title="Booking Activity"
        subtitle="Revenue is recognized by payment time; booking volume uses creation time."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-foreground">
                  {hasBookingRefunds
                    ? "Net Booking Revenue"
                    : "Booking Revenue"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {rangeLabel(range)}
                  {hasBookingRefunds &&
                    ` · Gross ${formatCents(
                      data.overview.paidBookingRevenueCents,
                      currency,
                    )} · Refunded ${formatCents(
                      data.overview.refundedBookingRevenueCents,
                      currency,
                    )}`}
                </p>
              </div>
              <p className="text-lg font-black text-foreground">
                {formatCents(
                  hasBookingRefunds
                    ? data.overview.netRetainedBookingRevenueCents
                    : data.overview.paidBookingRevenueCents,
                  currency,
                )}
              </p>
            </div>
            {data.bookingRevenueByDay.length ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.bookingRevenueByDay}>
                    <defs>
                      <linearGradient id="hotelRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      tickFormatter={(value) => formatCents(value, currency)}
                      width={72}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-lg">
                            <p className="font-medium text-foreground">{label}</p>
                            <p className="text-sm text-muted-foreground">
                               {hasBookingRefunds ? "Net retained" : "Revenue"}:{" "}
                              <span className="font-semibold text-indigo-600">
                                {formatCents(payload[0]?.value as number, currency)}
                              </span>
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={
                        hasBookingRefunds
                          ? "netRetainedCents"
                          : "grossCents"
                      }
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#hotelRevenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                No paid bookings in this period.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="font-bold text-foreground">Bookings Created</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {rangeLabel(range)}
              </p>
            </div>
            {data.bookingTrend.length ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.bookingTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-lg">
                            <p className="font-medium text-foreground">{label}</p>
                            <p className="text-sm text-muted-foreground">
                              Bookings:{" "}
                              <span className="font-semibold text-blue-600">
                                {payload[0]?.value}
                              </span>
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="bookingCount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                No bookings were created in this period.
              </div>
            )}
          </div>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        icon={<Activity className="h-5 w-5 text-white" />}
        iconClassName="bg-gradient-to-br from-violet-500 to-purple-600"
        title="Booking Mix"
        subtitle="Current stored status, payment state, and source for bookings created in the selected period."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <BreakdownCard title="Reservation Status" items={statusBreakdown} />
          <BreakdownCard title="Payment Status" items={paymentBreakdown} />
          <BreakdownCard title="Booking Source" items={sourceBreakdown} />
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        icon={<WalletCards className="h-5 w-5 text-white" />}
        iconClassName="bg-gradient-to-br from-amber-500 to-orange-600"
        title="Pending Payments"
        subtitle={`Current snapshot generated ${new Date(data.pendingPayments.snapshotAt).toLocaleString()}.`}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              Active payment links
            </p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="text-2xl font-black text-foreground">
                {data.pendingPayments.activeCount}
              </p>
              <p className="font-bold text-foreground">
                {formatCents(data.pendingPayments.activeValueCents, currency)}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/60 dark:bg-red-950/30">
            <p className="text-sm font-bold text-red-800 dark:text-red-300">
              Expired payment links
            </p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="text-2xl font-black text-foreground">
                {data.pendingPayments.expiredCount}
              </p>
              <p className="font-bold text-foreground">
                {formatCents(data.pendingPayments.expiredValueCents, currency)}
              </p>
            </div>
          </div>
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        icon={<BedDouble className="h-5 w-5 text-white" />}
        iconClassName="bg-gradient-to-br from-teal-500 to-cyan-600"
        title={`${friendlyLabel(normalizedRoomTerm)} Performance`}
        subtitle="Paid lodging bookings grouped by the persisted service point."
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {data.roomRevenuePerformance.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-border bg-muted/50">
                  <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-4">{friendlyLabel(normalizedRoomTerm)}</th>
                    <th className="px-5 py-4 text-right">Paid Bookings</th>
                    <th className="px-5 py-4 text-right">Nights</th>
                    <th className="px-5 py-4 text-right">Paid Revenue</th>
                    <th className="px-5 py-4 text-right">Average Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.roomRevenuePerformance.map((item) => (
                    <tr key={item.servicePointId}>
                      <td className="px-5 py-4">
                        <p className="font-bold text-foreground">{item.label}</p>
                        {item.code ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.code}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-foreground">
                        {item.paidBookingCount}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-foreground">
                        {item.totalNights}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-foreground">
                        {formatCents(item.paidRevenueCents, currency)}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-foreground">
                        {formatCents(item.averageBookingValueCents, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              No paid {normalizedRoomTerm.toLowerCase()} bookings in this period.
            </p>
          )}
        </div>
      </AnalyticsSection>

      <RoomTypePerformance
        data={data.roomTypePerformance}
        currency={currency}
      />

      <HotelStaffPerformance
        checkIns={data.checkInStaffPerformance}
        checkOuts={data.checkOutStaffPerformance}
        attribution={data.staffAttribution}
      />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-950/50">
            <Hotel className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Occupancy Snapshot</h3>
            <p className="text-xs text-muted-foreground">
              Based on current active, reservable room inventory.
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div>
            <p className="text-xl font-black text-foreground">{occupancy.occupiedRoomNights}</p>
            <p className="text-xs text-muted-foreground">Occupied room-nights</p>
          </div>
          <div>
            <p className="text-xl font-black text-foreground">{occupancy.availableRoomNights}</p>
            <p className="text-xs text-muted-foreground">Available room-nights</p>
          </div>
          <div>
            <p className="text-xl font-black text-foreground">{occupancy.occupiedRoomsForToday}</p>
            <p className="text-xs text-muted-foreground">Occupied today</p>
          </div>
          <div>
            <p className="text-xl font-black text-foreground">{occupancy.availableRoomsForToday}</p>
            <p className="text-xs text-muted-foreground">Available today</p>
          </div>
        </div>
        {occupancy.occupancyRatePercent === null ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No active, reservable room inventory is available for this calculation.
          </p>
        ) : null}
      </div>
    </div>
  )
}
