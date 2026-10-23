import type { ReactNode } from "react"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  CheckCheck,
  Clock3,
  HandCoins,
  Receipt,
  ShoppingBag,
  Timer,
  TrendingUp,
  Truck,
  Users,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatPrice, pluralize } from "@/lib/localization"
import type {
  FoodServiceAnalyticsModule,
  OwnerAnalyticsRange,
  ServiceRequestsByReason,
} from "@/types/owner-analytics"

interface FoodServiceAnalyticsProps {
  data: FoodServiceAnalyticsModule
  range: OwnerAnalyticsRange
  currency: string
}

type Accent = "orange" | "blue" | "violet" | "emerald" | "rose"

type BreakdownRow = {
  id: string
  label: string
  count: number
  percentage: number
  revenueCents: number
  color: string
  icon: ReactNode
}

const CATEGORY_COLORS = [
  "#0f3d78",
  "#fe6006",
  "#3b82f6",
  "#7c3aed",
  "#10b981",
  "#94a3b8",
]

const ACCENT_CLASSES: Record<
  Accent,
  { icon: string; line: string }
> = {
  orange: {
    icon: "bg-orange-50 text-[#fe6006] dark:bg-orange-950/40 dark:text-orange-400",
    line: "bg-[#fe6006]",
  },
  blue: {
    icon: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    line: "bg-blue-500",
  },
  violet: {
    icon: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
    line: "bg-violet-500",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
    line: "bg-emerald-500",
  },
  rose: {
    icon: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
    line: "bg-rose-500",
  },
}

const RANGE_LABELS: Record<OwnerAnalyticsRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7days": "Last 7 days",
  "30days": "Last 30 days",
  thisMonth: "This month",
  custom: "Custom range",
}

const SERVICE_REASON_PRESENTATION: Array<{
  key: keyof ServiceRequestsByReason
  label: string
  color: string
  icon: ReactNode
}> = [
  {
    key: "request_bill",
    label: "Bill request",
    color: "bg-blue-500",
    icon: <Receipt className="h-4 w-4 text-blue-500" />,
  },
  {
    key: "assistance",
    label: "Assistance",
    color: "bg-violet-500",
    icon: <BellRing className="h-4 w-4 text-violet-500" />,
  },
  {
    key: "emergency",
    label: "Emergency",
    color: "bg-rose-500",
    icon: <AlertTriangle className="h-4 w-4 text-rose-500" />,
  },
  {
    key: "other",
    label: "Other / no reason",
    color: "bg-slate-400",
    icon: <Activity className="h-4 w-4 text-slate-500" />,
  },
]

function formatCents(cents: number, currency: string) {
  return formatPrice(cents / 100, currency)
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return "—"
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0
    ? `${minutes}m ${remainingSeconds}s`
    : `${minutes}m`
}

function formatChartDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed)
}

function percentage(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
  className = "",
}: {
  title: string
  subtitle: string
  icon: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-border bg-card shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3 border-b border-border/70 px-4 py-3.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#fe6006] dark:bg-orange-950/40 dark:text-orange-400">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-foreground">{title}</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </section>
  )
}

function MetricCard({
  label,
  value,
  description,
  icon,
  accent,
}: {
  label: string
  value: ReactNode
  description?: string
  icon: ReactNode
  accent: Accent
}) {
  const accentClasses = ACCENT_CLASSES[accent]

  return (
    <article className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-0.5 ${accentClasses.line}`}
      />
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentClasses.icon}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold leading-3 text-muted-foreground sm:text-[11px]">
            {label}
          </p>
          <p className="mt-0.5 truncate text-xl font-black tracking-tight text-foreground sm:text-2xl">
            {value}
          </p>
        </div>
      </div>
      {description ? (
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </article>
  )
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-40 items-center justify-center px-5 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export function isFoodServiceAnalyticsEmpty(
  data: FoodServiceAnalyticsModule,
) {
  return (
    data.overview.activeOrders === 0 &&
    data.overview.completedOrders === 0 &&
    data.overview.paidRevenueCents === 0 &&
    data.serviceRequests.total === 0 &&
    data.topItems.length === 0 &&
    data.servicePointPerformance.length === 0 &&
    data.staffPerformance.length === 0
  )
}

export function FoodServiceAnalytics({
  data,
  range,
  currency,
}: FoodServiceAnalyticsProps) {
  const totalPaidOrders = data.revenueByDay.reduce(
    (sum, day) => sum + day.orderCount,
    0,
  )
  const categoryBreakdown = data.categoryPerformance.filter(
    (category) =>
      category.percentageOfItemRevenue > 0 ||
      category.quantity > 0 ||
      category.paidItemRevenueCents > 0,
  )
  const categoryTotalCents = categoryBreakdown.reduce(
    (sum, category) => sum + category.paidItemRevenueCents,
    0,
  )
  const hasRevenueTrend = data.revenueByDay.some(
    (day) => day.grossCents > 0 || day.orderCount > 0,
  )
  const hasHourlyOrders = data.hourlyOrders.some(
    (hour) => hour.orderCount > 0,
  )
  const resolutionRate = percentage(
    data.serviceRequests.resolved,
    data.serviceRequests.total,
  )
  const missRate = percentage(
    data.serviceRequests.missed,
    data.serviceRequests.total,
  )

  const orderTypeRows = data.orderTypeBreakdown.map((row) => ({
    id: row.type,
    label: row.type === "dine-in" ? "Dine-in" : "Takeout",
    count: row.orderCount,
    percentage: row.orderPercentage,
    revenueCents: row.paidRevenueCents,
    color: row.type === "dine-in" ? "bg-blue-500" : "bg-[#fe6006]",
    icon:
      row.type === "dine-in" ? (
        <UtensilsCrossed className="h-4 w-4 text-blue-500" />
      ) : (
        <Truck className="h-4 w-4 text-[#fe6006]" />
      ),
  }))

  const channelRows = data.channelBreakdown.map((row) => ({
    id: row.channel,
    label: row.label,
    count: row.orderCount,
    percentage: row.orderPercentage,
    revenueCents: row.paidRevenueCents,
    color: row.channel === "self" ? "bg-emerald-500" : "bg-violet-500",
    icon:
      row.channel === "self" ? (
        <ShoppingBag className="h-4 w-4 text-emerald-500" />
      ) : (
        <Users className="h-4 w-4 text-violet-500" />
      ),
  }))

  function renderBreakdownRows(
    rows: BreakdownRow[],
    emptyMessage: string,
  ) {
    if (!rows.some((row) => row.count > 0)) {
      return <EmptyPanel>{emptyMessage}</EmptyPanel>
    }

    return (
      <div className="space-y-4 p-4">
        {rows.map((row) => (
          <div key={row.id} className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span aria-hidden="true">{row.icon}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-foreground">
                {row.label}
              </span>
              <span className="font-black text-foreground">
                {row.count}
              </span>
              <span className="text-muted-foreground">
                ({row.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${row.color}`}
                style={{
                  width: `${Math.min(100, Math.max(0, row.percentage))}%`,
                }}
              />
            </div>
            <p className="text-right text-[10px] font-semibold text-muted-foreground">
              {formatCents(row.revenueCents, currency)} paid revenue
            </p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
      <section aria-labelledby="operational-kpis-title">
        <h2 id="operational-kpis-title" className="sr-only">
          Operational key metrics
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Active Orders"
            value={data.overview.activeOrders}
            description="Placed in the period and still active"
            icon={<Activity className="h-5 w-5" />}
            accent="orange"
          />
          <MetricCard
            label="Orders Completed"
            value={data.overview.completedOrders}
            description="Placed in the period and now completed"
            icon={<CheckCheck className="h-5 w-5" />}
            accent="blue"
          />
          <MetricCard
            label="Avg Prep Time"
            value={
              data.overview.averagePrepTimeMinutes > 0
                ? `${data.overview.averagePrepTimeMinutes} min`
                : "—"
            }
            description="From order creation to ready or completed"
            icon={<Clock3 className="h-5 w-5" />}
            accent="violet"
          />
          <MetricCard
            label="Items Sold"
            value={data.overview.totalItemsSold}
            description={
              data.overview.peakOrderHour
                ? `Peak order hour: ${data.overview.peakOrderHour}`
                : "From paid orders"
            }
            icon={<UtensilsCrossed className="h-5 w-5" />}
            accent="emerald"
          />
        </div>
      </section>

      <section aria-labelledby="tipping-kpis-title">
        <h2 id="tipping-kpis-title" className="sr-only">
          Tipping key metrics
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            label="Total Tips Collected"
            value={formatCents(data.tips.totalTipsCents, currency)}
            icon={<HandCoins className="h-5 w-5" />}
            accent="blue"
          />
          <MetricCard
            label="Average Tip"
            value={
              data.tips.ordersWithTips > 0
                ? formatCents(data.tips.averageTipCents, currency)
                : "—"
            }
            description="Across tipped paid orders"
            icon={<WalletCards className="h-5 w-5" />}
            accent="emerald"
          />
          <MetricCard
            label="Highest Tip"
            value={
              data.tips.ordersWithTips > 0
                ? formatCents(data.tips.highestTipCents, currency)
                : "—"
            }
            icon={<TrendingUp className="h-5 w-5" />}
            accent="orange"
          />
          <MetricCard
            label="Orders With Tips"
            value={data.tips.ordersWithTips}
            icon={<ShoppingBag className="h-5 w-5" />}
            accent="violet"
          />
          <div className="col-span-2 md:col-span-1">
            <MetricCard
              label="Tip Rate"
              value={
                totalPaidOrders > 0
                  ? `${data.tips.tipRatePercent.toFixed(1)}%`
                  : "—"
              }
              description="Tipped paid orders / all paid orders"
              icon={<BarChart3 className="h-5 w-5" />}
              accent="rose"
            />
          </div>
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-5">
        <SectionCard
          title="Revenue Trend"
          subtitle="Paid revenue and paid transactions across the selected period"
          icon={<BarChart3 className="h-4 w-4" />}
          className="xl:col-span-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 text-[10px] font-semibold text-muted-foreground">
            <span>{RANGE_LABELS[range]}</span>
            <span className="text-sm font-black text-foreground">
              {formatCents(data.overview.paidRevenueCents, currency)}
            </span>
          </div>
          {hasRevenueTrend ? (
            <div
              role="img"
              aria-label="Daily paid revenue shown as orange bars and paid transaction count shown as a blue line"
              className="h-64 min-w-0 px-1 pb-3 pt-2 sm:px-3"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={data.revenueByDay}
                  margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-border"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatChartDate}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={22}
                  />
                  <YAxis
                    yAxisId="revenue"
                    tickFormatter={(value) => formatCents(Number(value), currency)}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    width={74}
                  />
                  <YAxis
                    yAxisId="orders"
                    orientation="right"
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const day = payload[0]?.payload as
                        | { grossCents: number; orderCount: number }
                        | undefined
                      if (!day) return null

                      return (
                        <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs shadow-xl">
                          <p className="font-black text-foreground">
                            {formatChartDate(String(label))}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            Paid revenue: {formatCents(day.grossCents, currency)}
                          </p>
                          <p className="text-muted-foreground">
                            Paid transactions: {day.orderCount}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    yAxisId="revenue"
                    dataKey="grossCents"
                    fill="#fe6006"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={44}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="orders"
                    type="monotone"
                    dataKey="orderCount"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 2, fill: "#ffffff", strokeWidth: 2 }}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyPanel>No paid revenue in this period.</EmptyPanel>
          )}
          <div className="flex items-center justify-center gap-5 border-t border-border/60 px-4 py-2 text-[10px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#fe6006]" />
              Paid revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-blue-600" />
              Paid transactions
            </span>
          </div>
        </SectionCard>

        <SectionCard
          title="Hourly Orders"
          subtitle="Orders placed by local business hour"
          icon={<Clock3 className="h-4 w-4" />}
          className="xl:col-span-2"
        >
          {hasHourlyOrders ? (
            <div
              role="img"
              aria-label="Order counts grouped by local business hour"
              className="h-[306px] min-w-0 px-1 py-3 sm:px-3"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.hourlyOrders}
                  margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-border"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    interval={2}
                    tick={{ fontSize: 9, fill: "currentColor" }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="text-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const count = Number(payload[0]?.value || 0)
                      return (
                        <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs shadow-xl">
                          <p className="font-black text-foreground">{label}</p>
                          <p className="mt-1 text-muted-foreground">
                            {count} {pluralize(count, "order")}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey="orderCount"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyPanel>No order activity in this period.</EmptyPanel>
          )}
        </SectionCard>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard
          title="Top Selling Items"
          subtitle="Ranked by quantity sold from paid orders"
          icon={<TrendingUp className="h-4 w-4" />}
        >
          {data.topItems.length > 0 ? (
            <div className="divide-y divide-border/60 px-4">
              {data.topItems.map((item, index) => (
                <div
                  key={`${item.itemName}-${item.category}`}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 py-3"
                >
                  <span className="text-center text-xs font-black text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">
                      {item.itemName}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {item.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-foreground">
                      {item.quantity}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatCents(item.paidItemRevenueCents, currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel>No paid item sales in this period.</EmptyPanel>
          )}
        </SectionCard>

        <SectionCard
          title="Category Breakdown"
          subtitle="Share of paid item revenue"
          icon={<BarChart3 className="h-4 w-4" />}
        >
          {categoryBreakdown.length > 0 ? (
            <div className="p-4">
              <div
                role="img"
                aria-label="Menu category shares of paid item revenue"
                className="relative mx-auto h-32 w-32"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="paidItemRevenueCents"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={39}
                      outerRadius={58}
                      paddingAngle={categoryBreakdown.length > 1 ? 2 : 0}
                      stroke="var(--color-card)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {categoryBreakdown.map((category, index) => (
                        <Cell
                          key={category.category}
                          fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="max-w-24 truncate text-sm font-black text-foreground">
                    {formatCents(categoryTotalCents, currency)}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                    Total
                  </span>
                </div>
              </div>
              <ul className="mt-3 space-y-2" aria-label="Category revenue legend">
                {categoryBreakdown.slice(0, 6).map((category, index) => (
                  <li
                    key={category.category}
                    className="grid grid-cols-[0.6rem_minmax(0,1fr)_auto] items-center gap-2 text-[10px]"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                      }}
                    />
                    <span className="truncate font-semibold text-foreground">
                      {category.category}
                    </span>
                    <span className="text-muted-foreground">
                      {category.percentageOfItemRevenue.toFixed(1)}% · {formatCents(category.paidItemRevenueCents, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyPanel>No category revenue in this period.</EmptyPanel>
          )}
        </SectionCard>

        <SectionCard
          title="Order Type Split"
          subtitle="Orders by fulfilment type"
          icon={<UtensilsCrossed className="h-4 w-4" />}
        >
          {renderBreakdownRows(orderTypeRows, "No order type data for this period.")}
        </SectionCard>

        <SectionCard
          title="Channel Breakdown"
          subtitle="Orders by creation source"
          icon={<ShoppingBag className="h-4 w-4" />}
        >
          {renderBreakdownRows(channelRows, "No ordering channel data for this period.")}
        </SectionCard>
      </div>

      <section aria-labelledby="service-call-title" className="space-y-3">
        <div>
          <h2 id="service-call-title" className="text-sm font-black text-foreground">
            Service Call Analytics
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Waitstaff request activity for the selected period
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[
            {
              label: "Total Calls",
              value: data.serviceRequests.total,
              icon: <BellRing className="h-4 w-4" />,
              accent: "violet" as const,
            },
            {
              label: "Pending",
              value: data.serviceRequests.pending,
              icon: <Clock3 className="h-4 w-4" />,
              accent: "orange" as const,
            },
            {
              label: "Acknowledged",
              value: data.serviceRequests.acknowledged,
              icon: <Activity className="h-4 w-4" />,
              accent: "blue" as const,
            },
            {
              label: "Resolved",
              value: data.serviceRequests.resolved,
              icon: <CheckCheck className="h-4 w-4" />,
              accent: "emerald" as const,
            },
            {
              label: "Missed",
              value: data.serviceRequests.missed,
              icon: <AlertTriangle className="h-4 w-4" />,
              accent: "rose" as const,
            },
          ].map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-5">
          <SectionCard
            title="Calls by Reason"
            subtitle="Current request categories"
            icon={<Receipt className="h-4 w-4" />}
            className="lg:col-span-3"
          >
            {data.serviceRequests.total > 0 ? (
              <div className="space-y-4 p-4">
                {SERVICE_REASON_PRESENTATION.map((reason) => {
                  const count = data.serviceRequests.byReason[reason.key]
                  const share = percentage(count, data.serviceRequests.total) ?? 0

                  return (
                    <div
                      key={reason.key}
                      className="grid grid-cols-[1rem_minmax(5.5rem,auto)_minmax(4rem,1fr)_3.25rem] items-center gap-2"
                    >
                      <span aria-hidden="true">{reason.icon}</span>
                      <span className="truncate text-xs font-semibold text-foreground">
                        {reason.label}
                      </span>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${reason.color}`}
                          style={{ width: `${share}%` }}
                        />
                      </div>
                      <span className="text-right text-[10px] font-semibold text-muted-foreground">
                        {count} ({share}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyPanel>No service calls in this period.</EmptyPanel>
            )}
          </SectionCard>

          <SectionCard
            title="Response Times"
            subtitle="From request creation to staff action"
            icon={<Timer className="h-4 w-4" />}
            className="lg:col-span-2"
          >
            <dl className="grid grid-cols-2 gap-3 p-4">
              <div className="rounded-xl bg-blue-50/70 p-3 dark:bg-blue-950/20">
                <dt className="text-[10px] font-semibold text-muted-foreground">
                  Avg First Response
                </dt>
                <dd className="mt-1 text-lg font-black text-foreground">
                  {formatDuration(data.serviceRequests.averageResponseTimeSeconds)}
                </dd>
              </div>
              <div className="rounded-xl bg-emerald-50/70 p-3 dark:bg-emerald-950/20">
                <dt className="text-[10px] font-semibold text-muted-foreground">
                  Avg Resolution
                </dt>
                <dd className="mt-1 text-lg font-black text-foreground">
                  {formatDuration(data.serviceRequests.averageResolutionTimeSeconds)}
                </dd>
              </div>
              <div className="rounded-xl border border-border p-3">
                <dt className="text-[10px] font-semibold text-muted-foreground">
                  Resolution Rate
                </dt>
                <dd className="mt-1 text-base font-black text-foreground">
                  {resolutionRate === null ? "—" : `${resolutionRate}%`}
                </dd>
              </div>
              <div className="rounded-xl border border-border p-3">
                <dt className="text-[10px] font-semibold text-muted-foreground">
                  Miss Rate
                </dt>
                <dd className="mt-1 text-base font-black text-foreground">
                  {missRate === null ? "—" : `${missRate}%`}
                </dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-2">
        <SectionCard
          title="Service Point Performance"
          subtitle="Ranked by number of orders placed"
          icon={<BarChart3 className="h-4 w-4" />}
        >
          {data.servicePointPerformance.length > 0 ? (
            <>
              <div className="hidden max-h-[28rem] overflow-auto md:block">
                <table className="w-full border-collapse text-xs">
                  <caption className="sr-only">
                    Service Points ranked by order count
                  </caption>
                  <thead className="sticky top-0 z-10 bg-secondary/95">
                    <tr className="text-[9px] font-black uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-3 py-2.5 text-left">#</th>
                      <th scope="col" className="px-3 py-2.5 text-left">Service Point</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Orders</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Paid Revenue</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Avg Paid Order</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Paid / Unpaid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data.servicePointPerformance.map((row, index) => (
                      <tr key={row.servicePointId || `${row.label}-${index}`}>
                        <td className="px-3 py-3 font-black text-muted-foreground">
                          {index + 1}
                        </td>
                        <th scope="row" className="px-3 py-3 text-left">
                          <span className="font-bold text-foreground">{row.label}</span>
                          {row.code ? (
                            <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                              {row.code}
                            </span>
                          ) : null}
                        </th>
                        <td className="px-3 py-3 text-right font-black text-foreground">{row.orderCount}</td>
                        <td className="px-3 py-3 text-right font-bold text-foreground">{formatCents(row.paidRevenueCents, currency)}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">
                          {row.paidOrders > 0 ? formatCents(row.averagePaidOrderValueCents, currency) : "—"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="font-bold text-emerald-600">{row.paidOrders}</span>
                          <span className="px-1 text-muted-foreground">/</span>
                          <span className="font-bold text-muted-foreground">{row.unpaidOrders}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-border md:hidden">
                {data.servicePointPerformance.map((row, index) => (
                  <article key={row.servicePointId || `${row.label}-${index}`} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">
                          {index + 1}. {row.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{row.code || "No code"}</p>
                      </div>
                      <p className="text-sm font-black text-foreground">{row.orderCount} orders</p>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                      <div><dt className="text-muted-foreground">Paid revenue</dt><dd className="mt-1 font-bold text-foreground">{formatCents(row.paidRevenueCents, currency)}</dd></div>
                      <div><dt className="text-muted-foreground">Avg paid</dt><dd className="mt-1 font-bold text-foreground">{row.paidOrders > 0 ? formatCents(row.averagePaidOrderValueCents, currency) : "—"}</dd></div>
                      <div><dt className="text-muted-foreground">Paid / unpaid</dt><dd className="mt-1 font-bold text-foreground">{row.paidOrders} / {row.unpaidOrders}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyPanel>No Service Point activity in this period.</EmptyPanel>
          )}
        </SectionCard>

        <SectionCard
          title="Waitstaff Activity"
          subtitle="Operational service activity for the selected period"
          icon={<Users className="h-4 w-4" />}
        >
          {data.staffPerformance.length > 0 ? (
            <>
              <div className="hidden max-h-[28rem] overflow-auto lg:block">
                <table className="w-full border-collapse text-xs">
                  <caption className="sr-only">
                    Waitstaff service activity
                  </caption>
                  <thead className="sticky top-0 z-10 bg-secondary/95">
                    <tr className="text-[9px] font-black uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-3 py-2.5 text-left">Staff member</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Acknowledged</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Resolved</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Avg Response</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Avg Resolution</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Orders Served</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Offline Payments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data.staffPerformance.map((staff) => (
                      <tr key={staff.staffId}>
                        <th scope="row" className="px-3 py-3 text-left font-bold text-foreground">{staff.name}</th>
                        <td className="px-3 py-3 text-right font-bold text-foreground">{staff.callsAcknowledged}</td>
                        <td className="px-3 py-3 text-right font-bold text-foreground">{staff.callsResolved}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">{formatDuration(staff.averageResponseTimeSeconds)}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">{formatDuration(staff.averageResolutionTimeSeconds)}</td>
                        <td className="px-3 py-3 text-right font-bold text-foreground">{staff.ordersServed}</td>
                        <td className="px-3 py-3 text-right">
                          {staff.paymentsConfirmed > 0 ? (
                            <><span className="font-bold text-foreground">{formatCents(staff.totalOfflinePaymentsConfirmedCents, currency)}</span><span className="ml-1 text-[9px] text-muted-foreground">({staff.paymentsConfirmed})</span></>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-border lg:hidden">
                {data.staffPerformance.map((staff) => (
                  <article key={staff.staffId} className="p-4">
                    <p className="text-sm font-black text-foreground">{staff.name}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] sm:grid-cols-3">
                      <div><dt className="text-muted-foreground">Acknowledged</dt><dd className="mt-1 font-bold text-foreground">{staff.callsAcknowledged}</dd></div>
                      <div><dt className="text-muted-foreground">Resolved</dt><dd className="mt-1 font-bold text-foreground">{staff.callsResolved}</dd></div>
                      <div><dt className="text-muted-foreground">Avg response</dt><dd className="mt-1 font-bold text-foreground">{formatDuration(staff.averageResponseTimeSeconds)}</dd></div>
                      <div><dt className="text-muted-foreground">Avg resolution</dt><dd className="mt-1 font-bold text-foreground">{formatDuration(staff.averageResolutionTimeSeconds)}</dd></div>
                      <div><dt className="text-muted-foreground">Orders served</dt><dd className="mt-1 font-bold text-foreground">{staff.ordersServed}</dd></div>
                      <div><dt className="text-muted-foreground">Offline payments</dt><dd className="mt-1 font-bold text-foreground">{staff.paymentsConfirmed > 0 ? `${formatCents(staff.totalOfflinePaymentsConfirmedCents, currency)} (${staff.paymentsConfirmed})` : "—"}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyPanel>No waitstaff activity in this period.</EmptyPanel>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
