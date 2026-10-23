import React from "react"
import { Activity, TrendingUp, TrendingDown, Minus, Users, ShoppingBag, Clock, Sparkles, MessageSquare, Package } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { CurrentWeekSnapshotResponse } from "@/types/ai-business-analyst"

function formatCurrency(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) return null
  const isUp = value > 0
  const isFlat = value === 0
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown
  const color = isFlat
    ? "text-muted-foreground"
    : isUp
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400"
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  change,
  subtext,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  change?: number | null
  subtext?: string
}) {
  return (
    <Card className="shadow-sm border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <span className="text-2xl font-bold text-foreground">{value}</span>
          {change !== undefined && <TrendBadge value={change ?? null} />}
        </div>
        {subtext && (
          <p className="text-[11px] text-muted-foreground mt-1">{subtext}</p>
        )}
      </CardContent>
    </Card>
  )
}

function formatDataThrough(iso: string, timezone?: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone || "UTC",
  }).format(d)
}

export function CurrentWeekView({
  snapshot,
  loading,
}: {
  snapshot: CurrentWeekSnapshotResponse | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="mt-8 space-y-4">
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <Card className="border-dashed border-muted/60 shadow-sm mt-8 max-w-2xl">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-full bg-[#EA601A]/10 p-4 mb-2">
            <Activity className="h-8 w-8 text-[#EA601A]" />
          </div>
          <h3 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Live data is loading
          </h3>
          <p className="max-w-md text-[15px] text-muted-foreground leading-relaxed mx-auto">
            Current-week analytics will appear here shortly.
          </p>
        </CardContent>
      </Card>
    )
  }

  const { sales, operations, customers, feedback, inventory } = snapshot
  const currency = snapshot.business?.currency || "EUR"

  // Derive some basic deterministic observational signals
  const signals = []

  if (sales.revenueChangePercent != null) {
    if (sales.revenueChangePercent > 5) {
      signals.push(`Revenue is ${sales.revenueChangePercent.toFixed(1)}% ahead of the same elapsed period last week.`)
    } else if (sales.revenueChangePercent < -5) {
      signals.push(`Revenue is tracking ${Math.abs(sales.revenueChangePercent).toFixed(1)}% behind the same elapsed period last week.`)
    } else {
      signals.push(`Revenue is tracking closely with the same elapsed period last week.`)
    }
  }

  if (sales.transactionCountChangePercent != null && Math.abs(sales.transactionCountChangePercent) > 5) {
    const isUp = sales.transactionCountChangePercent > 0
    signals.push(`Transaction volume is ${isUp ? "up" : "down"} by ${Math.abs(sales.transactionCountChangePercent).toFixed(1)}%.`)
  }

  if (operations?.prepTimeChangePercent != null && Math.abs(operations.prepTimeChangePercent) > 5) {
    const isWorse = operations.prepTimeChangePercent > 0 // positive change in prep time is worse
    signals.push(`Average preparation time ${isWorse ? "increased" : "improved"} by ${Math.abs(operations.prepTimeChangePercent).toFixed(1)}% compared to last week.`)
  }

  if (customers.returningCustomersChangePercent != null && customers.returningCustomersChangePercent > 5) {
    signals.push(`Returning customer activity is higher than the same point last week.`)
  }

  for (const insight of snapshot.deterministicInsights.insights) {
    const evidence = insight.evidence
    if (insight.category === "feedback") {
      if (insight.id === "feedback_rating_decline" || insight.id === "feedback_rating_improvement") {
        signals.push(
          `Guest rating ${insight.type === "positive" ? "improved" : "declined"} from ${evidence.previousAverageRating} to ${evidence.currentAverageRating} across ${evidence.currentReviews} reviews.`,
        )
      } else if (insight.id.includes("low_rating_share")) {
        signals.push(
          `Low-rating share ${insight.type === "positive" ? "improved" : "increased"} by ${Math.abs(Number(evidence.lowRatingRateDeltaPoints || 0)).toFixed(1)} percentage points.`,
        )
      } else if (insight.id.includes("csat")) {
        signals.push(
          `Guest satisfaction ${insight.type === "positive" ? "improved" : "declined"} by ${Math.abs(Number(evidence.csatDeltaPoints || 0)).toFixed(1)} percentage points.`,
        )
      } else if (insight.id === "feedback_low_rating_level") {
        signals.push(`Guest rating is ${evidence.currentAverageRating} from ${evidence.currentReviews} reviews so far.`)
      }
    }

    if (insight.category === "inventory") {
      if (insight.id === "inventory_shortages_recorded") {
        signals.push(
          `Ingredient shortages were recorded on ${evidence.shortageEvents} fulfilments, affecting ${evidence.affectedItemCount} tracked items.`,
        )
      } else if (insight.id === "inventory_stock_risk") {
        signals.push(
          `${evidence.outOfStockItems} inventory items are out of stock and ${evidence.lowStockItems} are running low.`,
        )
      } else if (insight.id === "inventory_waste_activity") {
        signals.push(`${evidence.wasteEvents} inventory waste movements have been recorded this week.`)
      } else if (insight.id === "inventory_repeated_adjustments") {
        signals.push(`${evidence.adjustmentEvents} inventory adjustments have been recorded this week.`)
      } else if (insight.id === "inventory_shortages_cleared") {
        signals.push(`No ingredient shortages have been recorded after ${evidence.previousShortageEvents} in the comparison period.`)
      }
    }
  }

  return (
    <div className="mt-4 space-y-8 pb-16">
      
      {/* Mayor explanation */}
      <Card className="border-dashed border-[#EA601A]/30 bg-[#EA601A]/5 dark:bg-[#EA601A]/5 shadow-sm">
        <CardContent className="flex items-start gap-4 py-6">
          <div className="rounded-full bg-[#EA601A]/10 p-3 shrink-0">
            <Sparkles className="h-5 w-5 text-[#EA601A]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground mb-1">
              THIS WEEK IS STILL IN PROGRESS
            </h3>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Mayor is monitoring your business as the week develops. 
              Your full weekly analysis, including priorities, opportunities, and recommendations,
              will be generated automatically after the week closes on Sunday.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Week So Far
        </h3>
        
        {/* Data freshness indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Data through {formatDataThrough(snapshot.dataThrough, snapshot.period.timezone)}
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            icon={TrendingUp}
            label="Revenue"
            value={formatCurrency(sales.paidRevenueCents, currency)}
            change={sales.revenueChangePercent}
            subtext="vs same elapsed period last week"
          />
          <MetricCard
            icon={ShoppingBag}
            label="Transactions"
            value={sales.transactionCount}
            change={sales.transactionCountChangePercent}
          />
          {operations && (
            <>
              <MetricCard
                icon={Activity}
                label="Orders Completed"
                value={operations.completedOrders}
                change={operations.completedOrdersChangePercent}
              />
              <MetricCard
                icon={Clock}
                label="Avg Prep Time"
                value={`${operations.averagePrepTimeMinutes}m`}
                change={operations.prepTimeChangePercent}
              />
            </>
          )}
          <MetricCard
            icon={Users}
            label="New Customers"
            value={customers.newCustomers}
            change={customers.newCustomersChangePercent}
          />
          <MetricCard
            icon={Users}
            label="Returning"
            value={customers.returningCustomers}
            change={customers.returningCustomersChangePercent}
          />
          {feedback && feedback.current.reviewCount > 0 && (
            <MetricCard
              icon={MessageSquare}
              label="Guest Rating"
              value={`${feedback.current.averageRating ?? "–"}/5`}
              subtext={`${feedback.current.reviewCount} reviews this week`}
            />
          )}
          {inventory?.stockHealthAsOf.periodAligned === true &&
            Number(inventory.stockHealthAsOf.lowStockItems || 0) +
              Number(inventory.stockHealthAsOf.outOfStockItems || 0) > 0 && (
              <MetricCard
                icon={Package}
                label="Stock Risks"
                value={
                  Number(inventory.stockHealthAsOf.lowStockItems || 0) +
                  Number(inventory.stockHealthAsOf.outOfStockItems || 0)
                }
                subtext={`${inventory.stockHealthAsOf.outOfStockItems || 0} out of stock`}
              />
            )}
        </div>
      </div>

      {signals.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Current Signals
          </h3>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-6">
              <ul className="space-y-3">
                {signals.map((sig, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-[15px] leading-relaxed text-foreground">{sig}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}
