"use client"

import { UserX, Eye, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatPrice, formatDateTime } from "@/lib/localization"
import type { CrmAnalyticsCustomer } from "@/types/crm-analytics"

type ReEngagementCustomersProps = {
  reEngagement: {
    thresholdDays: number
    dormantThresholdDays: number
    customerCount: number
    dormantCustomerCount: number
    customers: CrmAnalyticsCustomer[]
  }
  currency: string
  timezone?: string
  onSelectCustomer: (guestId: string) => void
}

export function ReEngagementCustomers({
  reEngagement,
  currency,
  timezone,
  onSelectCustomer,
}: ReEngagementCustomersProps) {
  const formatCents = (cents: number) => {
    return formatPrice((cents || 0) / 100, currency)
  }

  const {
    thresholdDays = 30,
    customerCount = 0,
    dormantCustomerCount = 0,
    customers = [],
  } = reEngagement || {}

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-2 text-base">
              <UserX className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Customers To Re-Engage
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inactive for {thresholdDays}+ days ({customerCount} total, including {dormantCustomerCount} dormant 90d+)
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
            {customerCount} At Risk
          </span>
        </div>

        {customers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
            <p className="text-sm font-medium">No inactive customers requiring re-engagement.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-center">Visits</th>
                  <th className="px-4 py-3 text-right">Lifetime Spend</th>
                  <th className="px-4 py-3">Last Visit</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {customers.map((customer) => (
                  <tr
                    key={customer.guestId}
                    className="hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <p className="font-bold text-foreground text-sm flex items-center gap-2">
                          {customer.name || customer.email}
                          {customer.marketingConsent && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                              Opt-In
                            </span>
                          )}
                        </p>
                        {customer.name && (
                          <p className="text-xs text-muted-foreground">
                            {customer.email}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="font-bold text-foreground bg-secondary px-2 py-0.5 rounded text-xs">
                        {customer.visitCount}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right font-black text-foreground whitespace-nowrap">
                      {formatCents(customer.totalSpendCents)}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground text-xs font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        <span>
                          {customer.lastVisitAt
                            ? formatDateTime(customer.lastVisitAt, timezone)
                            : "-"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button
                        onClick={() => onSelectCustomer(customer.guestId)}
                        variant="ghost"
                        size="sm"
                        className="font-bold hover:bg-primary/10 hover:text-primary transition-colors gap-1.5 h-8 px-2.5"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
