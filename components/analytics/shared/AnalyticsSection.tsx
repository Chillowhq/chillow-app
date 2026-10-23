import type { ReactNode } from "react"

type AnalyticsSectionProps = {
  icon: ReactNode
  iconClassName: string
  title: string
  subtitle: string
  children: ReactNode
}

export function AnalyticsSection({
  icon,
  iconClassName,
  title,
  subtitle,
  children,
}: AnalyticsSectionProps) {
  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg ${iconClassName}`}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-black text-foreground leading-tight">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground font-medium">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}
