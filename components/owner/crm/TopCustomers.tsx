"use client"

import { Trophy, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatPrice, formatDateTime } from "@/lib/localization"
import type { CrmAnalyticsCustomer } from "@/types/crm-analytics"

type TopCustomersProps = {
  customers: CrmAnalyticsCustomer[]
  currency: string
  timezone?: string
  onSelectCustomer: (guestId: string) => void
}

export function TopCustomers({
  customers,
  currency,
  timezone,
  onSelectCustomer,
}: TopCustomersProps) {
  const formatCents = (cents: number) => {
    return formatPrice((cents || 0) / 100, currency)
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-2 text-base">
              <Trophy className="w-4 h-4 text-amber-500" />
              Top Customers by Spend
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ranked by CRM-attributed order spend
            </p>
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
            <p className="text-sm font-medium">No customer spend recorded in this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-center">Visits</th>
                  <th className="px-4 py-3 text-center">Orders</th>
                  <th className="px-4 py-3 text-right">Spend</th>
                  <th className="px-4 py-3">Last Visit</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {customers.map((customer, index) => (
                  <tr
                    key={customer.guestId}
                    className="hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold text-xs flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-bold text-foreground text-sm">
                            {customer.name || customer.email}
                          </p>
                          {customer.name && (
                            <p className="text-xs text-muted-foreground">
                              {customer.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="font-bold text-foreground bg-secondary px-2 py-0.5 rounded text-xs">
                        {customer.visitCount}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="font-bold text-foreground bg-secondary px-2 py-0.5 rounded text-xs">
                        {customer.orderCount}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right font-black text-foreground whitespace-nowrap">
                      {formatCents(customer.totalSpendCents)}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground text-xs font-medium whitespace-nowrap">
                      {customer.lastVisitAt
                        ? formatDateTime(customer.lastVisitAt, timezone)
                        : "-"}
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
