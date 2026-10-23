import type { ReactNode } from "react"

type AnalyticsEmptyStateProps = {
  icon: ReactNode
  title: string
  description: string
  className?: string
}

export function AnalyticsEmptyState({
  icon,
  title,
  description,
  className = "",
}: AnalyticsEmptyStateProps) {
  return (
    <div
      className={`bg-card rounded-2xl border border-border/60 p-8 text-center shadow-sm ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-secondary mx-auto flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {description}
      </p>
    </div>
  )
}
