import type { ReactNode } from "react"

export function AnalyticsShell({ children }: { children: ReactNode }) {
  return <div className="min-w-0 overflow-x-hidden pb-20">{children}</div>
}
