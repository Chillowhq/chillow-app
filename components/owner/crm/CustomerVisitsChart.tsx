"use client"

import { CalendarCheck } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { CrmVisitPoint } from "@/types/crm-analytics"

type CustomerVisitsChartProps = {
  points: CrmVisitPoint[]
  bucket: "day" | "week" | "month"
}

export function CustomerVisitsChart({
  points,
  bucket,
}: CustomerVisitsChartProps) {
  const hasData = points && points.length > 0 && points.some((p) => p.visits > 0)

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2 text-base">
            <CalendarCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Visits Over Time
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Confirmed customer visits by business day ({bucket === "day" ? "daily" : `${bucket}ly`} view)
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="h-[240px] flex items-center justify-center text-center p-6 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted-foreground">
            No CRM visits recorded during this period.
          </p>
        </div>
      ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="crmVisitsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
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
              <Area
                type="monotone"
                dataKey="visits"
                name="Visits"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                fill="url(#crmVisitsGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
