import React from "react"
import { Sparkles } from "lucide-react"

interface MayorHeaderProps {
  businessName: string
  subtitle?: string
  badge?: "live" | "final" | "generating" | "unavailable" | null
  children?: React.ReactNode
}

export function MayorHeader({ businessName, subtitle, badge, children }: MayorHeaderProps) {
  const defaultSubtitle = badge === "live"
    ? "Here's what's happening this week so far."
    : "Mayor reviewed your business this week."

  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-3 text-muted-foreground font-medium text-base">
          Hey {businessName},<br />
          {subtitle || defaultSubtitle}
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-[#EA601A]" />
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Mayor&apos;s Weekly Brief
          </h1>
          {badge === "live" && (
            <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
          {badge === "final" && (
            <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              Final
            </span>
          )}
          {badge === "generating" && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Generating
            </span>
          )}
          {badge === "unavailable" && (
            <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:bg-muted/30">
              Unavailable
            </span>
          )}
        </div>
      </div>
      {children && (
        <div className="flex items-center">
          {children}
        </div>
      )}
    </div>
  )
}
