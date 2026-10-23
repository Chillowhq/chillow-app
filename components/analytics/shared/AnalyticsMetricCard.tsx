import type { ReactNode } from "react"

type AnalyticsMetricCardProps = {
  icon: ReactNode
  iconClassName: string
  value: ReactNode
  label: string
  meta?: ReactNode
}

export function AnalyticsMetricCard({
  icon,
  iconClassName,
  value,
  label,
  meta,
}: AnalyticsMetricCardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClassName}`}
        >
          {icon}
        </div>
        {meta}
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}
