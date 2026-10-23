"use client"

import { PieChart, Sparkles, Clock, AlertTriangle, Mail } from "lucide-react"
import type { CrmSegment } from "@/types/crm-analytics"

type CustomerSegmentsProps = {
  segments: CrmSegment[]
  totalCustomers: number
}

const segmentIcons: Record<string, React.ReactNode> = {
  new: <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
  returning: <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
  recent: <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
  inactive: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
  marketing_opt_in: <Mail className="w-4 h-4 text-green-600 dark:text-green-400" />,
}

const segmentBgColors: Record<string, string> = {
  new: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50",
  returning: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/50",
  recent: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/50",
  inactive: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50",
  marketing_opt_in: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50",
}

export function CustomerSegments({
  segments,
  totalCustomers,
}: CustomerSegmentsProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2 text-base">
            <PieChart className="w-4 h-4 text-primary" />
            Customer Segments Overview
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Key operational customer cohorts (segments may contain overlapping profiles)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {segments.map((segment) => {
          const icon = segmentIcons[segment.id] || <Sparkles className="w-4 h-4 text-primary" />
          const colorClass = segmentBgColors[segment.id] || "bg-secondary/30 border-border"
          const pct = totalCustomers > 0 ? Math.round((segment.count / totalCustomers) * 100) : 0

          return (
            <div
              key={segment.id}
              className={`p-4 rounded-xl border ${colorClass} flex flex-col justify-between shadow-xs`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-background/80 shadow-2xs">
                  {icon}
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-background/80 text-muted-foreground uppercase">
                  {segment.scope === "selectedPeriod" ? "Period" : "Lifetime"}
                </span>
              </div>

              <div>
                <p className="text-2xl font-black text-foreground">
                  {segment.count.toLocaleString()}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs font-bold text-foreground">
                    {segment.label}
                  </p>
                  {segment.scope === "lifetimeCurrentState" && totalCustomers > 0 && (
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {pct}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
