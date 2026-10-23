import {
  Activity,
  DollarSign,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { AnalyticsMetricCard } from "@/components/analytics/shared/AnalyticsMetricCard"
import { formatPrice } from "@/lib/localization"
import type { SharedAnalytics } from "@/types/owner-analytics"

type SharedAnalyticsSummaryProps = {
  data: SharedAnalytics
  currency: string
}

function formatCents(cents: number, currency: string) {
  return formatPrice(cents / 100, currency)
}

export function SharedAnalyticsSummary({
  data,
  currency,
}: SharedAnalyticsSummaryProps) {
  const { paidRevenue } = data
  const comparison = paidRevenue.comparisonPercent
  const hasRefunds = paidRevenue.refundedCents > 0

  return (
    <div className="grid grid-cols-1 gap-4 px-6 pt-6 sm:grid-cols-3">
      <AnalyticsMetricCard
        icon={
          <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        }
        iconClassName="bg-emerald-100 dark:bg-emerald-950/50"
        value={formatCents(
          hasRefunds
            ? paidRevenue.netRetainedCents
            : paidRevenue.grossCents,
          currency,
        )}
        label={hasRefunds ? "Net Retained" : "Paid Revenue"}
        meta={
          hasRefunds ? (
            <div className="text-xs font-semibold text-muted-foreground">
              Gross {formatCents(paidRevenue.grossCents, currency)} · Refunded{" "}
              {formatCents(paidRevenue.refundedCents, currency)}
            </div>
          ) : comparison === null ? undefined : (
            <div
              className={`flex items-center gap-1 text-xs font-bold ${
                comparison >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {comparison >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(comparison).toFixed(1)}%
            </div>
          )
        }
      />

      <AnalyticsMetricCard
        icon={
          <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        }
        iconClassName="bg-blue-100 dark:bg-blue-950/50"
        value={paidRevenue.transactionCount}
        label="Paid Transactions"
      />

      <AnalyticsMetricCard
        icon={
          <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        }
        iconClassName="bg-purple-100 dark:bg-purple-950/50"
        value={formatCents(
          paidRevenue.averageTransactionValueCents,
          currency,
        )}
        label="Average Transaction Value"
      />
    </div>
  )
}
