"use client"

import { Users } from "lucide-react"
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
import type { CrmCustomerActivityPoint } from "@/types/crm-analytics"

type CustomerActivityChartProps = {
  points: CrmCustomerActivityPoint[]
  bucket: "day" | "week" | "month"
}

export function CustomerActivityChart({
  points,
  bucket,
}: CustomerActivityChartProps) {
  const hasData = points && points.length > 0 && points.some((p) => p.newCustomers > 0 || p.returningCustomers > 0)

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-primary" />
            Customer Activity Trend
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            New vs. Returning customers over time ({bucket}ly view)
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="h-[240px] flex items-center justify-center text-center p-6 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted-foreground">
            No customer activity recorded during this period.
          </p>
        </div>
      ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--muted-foreground, #6b7280)" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground, #6b7280)" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--background, #ffffff)",
                  borderColor: "var(--border, #e5e7eb)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              <Bar
                dataKey="newCustomers"
                name="New Customers"
                fill="#10b981"
                stackId="a"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="returningCustomers"
                name="Returning Customers"
                fill="#6366f1"
                stackId="a"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
