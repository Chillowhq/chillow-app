"use client"

import {
  Users,
  UserPlus,
  UserCheck,
  RotateCcw,
  CalendarCheck,
  Activity,
  DollarSign,
  CreditCard,
  Receipt,
  MailCheck,
} from "lucide-react"
import { AnalyticsMetricCard } from "@/components/analytics/shared/AnalyticsMetricCard"
import { formatPrice } from "@/lib/localization"
import type { CrmAnalyticsOverview } from "@/types/crm-analytics"

type CrmMetricGridProps = {
  overview: CrmAnalyticsOverview
  currency: string
}

export function CrmMetricGrid({ overview, currency }: CrmMetricGridProps) {
  const formatCents = (cents: number) => {
    return formatPrice((cents || 0) / 100, currency)
  }

  return (
    <div className="space-y-6">
      {/* Primary Customer Activity & Volume KPIs */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Customer & Visit Volume
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <AnalyticsMetricCard
            icon={<Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            iconClassName="bg-blue-100 dark:bg-blue-950/50"
            value={overview.totalCustomers.toLocaleString()}
            label="Total Customers"
            meta={
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-secondary text-muted-foreground uppercase">
                Lifetime
              </span>
            }
          />

          <AnalyticsMetricCard
            icon={<UserPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            iconClassName="bg-emerald-100 dark:bg-emerald-950/50"
            value={overview.newCustomers.toLocaleString()}
            label="New Customers"
            meta={
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                Selected Period
              </span>
            }
          />

          <AnalyticsMetricCard
            icon={<UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            iconClassName="bg-indigo-100 dark:bg-indigo-950/50"
            value={overview.returningCustomers.toLocaleString()}
            label="Returning Customers"
            meta={
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 uppercase">
                Selected Period
              </span>
            }
          />

          <AnalyticsMetricCard
            icon={<RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            iconClassName="bg-amber-100 dark:bg-amber-950/50"
            value={`${overview.repeatCustomerRatePercent}%`}
            label="Repeat Customer Rate"
            meta={
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 uppercase">
                Selected Period
              </span>
            }
          />

          <AnalyticsMetricCard
            icon={<CalendarCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
            iconClassName="bg-purple-100 dark:bg-purple-950/50"
            value={overview.totalVisits.toLocaleString()}
            label="Total Visits"
            meta={
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 uppercase">
                Selected Period
              </span>
            }
          />

          <AnalyticsMetricCard
            icon={<Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
            iconClassName="bg-teal-100 dark:bg-teal-950/50"
            value={overview.averageVisitsPerCustomer}
            label="Avg Visits / Customer"
            meta={
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 uppercase">
                Selected Period
              </span>
            }
          />
        </div>
      </div>

      {/* Financial & Customer Value KPIs */}
      <div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Customer Revenue & Marketing
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnalyticsMetricCard
            icon={<DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            iconClassName="bg-emerald-100 dark:bg-emerald-950/50"
            value={formatCents(overview.customerRevenueCents)}
            label="Customer Revenue"
            meta={
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                Selected Period
              </span>
            }
          />

          <AnalyticsMetricCard
            icon={<CreditCard className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />}
            iconClassName="bg-cyan-100 dark:bg-cyan-950/50"
            value={formatCents(overview.averageSpendPerCustomerCents)}
            label="Avg Spend / Customer"
            meta={
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 uppercase">
                Selected Period
              </span>
            }
          />

          <AnalyticsMetricCard
            icon={<Receipt className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
            iconClassName="bg-orange-100 dark:bg-orange-950/50"
            value={formatCents(overview.averageSpendPerVisitCents)}
            label="Avg Spend / Visit"
            meta={
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 uppercase">
                Selected Period
              </span>
            }
          />

          <AnalyticsMetricCard
            icon={<MailCheck className="w-5 h-5 text-green-600 dark:text-green-400" />}
            iconClassName="bg-green-100 dark:bg-green-950/50"
            value={`${overview.marketingConsentPercent}% (${overview.marketingConsentCount.toLocaleString()})`}
            label="Marketing Opt-In Rate"
            meta={
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-secondary text-muted-foreground uppercase">
                Lifetime
              </span>
            }
          />
        </div>
      </div>
    </div>
  )
}
