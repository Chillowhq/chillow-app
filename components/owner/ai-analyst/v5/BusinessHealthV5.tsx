import { ShieldAlert, AlertCircle, CheckCircle2, Minus, Info } from "lucide-react"
import { BusinessHealthV5Entry } from "@/types/ai-business-analyst"

export function BusinessHealthV5({ health }: { health: BusinessHealthV5Entry[] }) {
  if (!health || health.length === 0) return null

  return (
    <section className="mt-8 space-y-4">
      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        Business Health
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {health.map((h, i) => (
          <div key={i} className="flex flex-col p-4 rounded-xl border border-border/60 bg-card shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{h.area}</span>
              <HealthBadge status={h.status} />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{h.explanation}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function HealthBadge({ status }: { status: BusinessHealthV5Entry["status"] }) {
  const normalizedStatus = (status || "").toLowerCase().replace(" ", "_");
  switch (normalizedStatus) {
    case "healthy":
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Healthy
        </div>
      )
    case "stable":
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider">
          <Minus className="h-3.5 w-3.5" />
          Stable
        </div>
      )
    case "watch":
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
          <AlertCircle className="h-3.5 w-3.5" />
          Watch
        </div>
      )
    case "strained":
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-semibold uppercase tracking-wider">
          <ShieldAlert className="h-3.5 w-3.5" />
          Strained
        </div>
      )
    case "critical":
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold uppercase tracking-wider">
          <ShieldAlert className="h-3.5 w-3.5" />
          Critical
        </div>
      )
    case "insufficient_data":
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          <Info className="h-3.5 w-3.5" />
          Insufficient Data
        </div>
      )
    default:
      return null
  }
}
