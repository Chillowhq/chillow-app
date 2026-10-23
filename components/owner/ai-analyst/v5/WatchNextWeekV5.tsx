import { Eye } from "lucide-react"
import { MayorWatchItemV5 } from "@/types/ai-business-analyst"

export function WatchNextWeekV5({ items }: { items: MayorWatchItemV5[] }) {
  if (!items || items.length === 0) return null

  return (
    <section className="mt-12 space-y-4">
      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5" />
        Keep an eye on next week
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col p-4 rounded-lg border border-border/60 bg-card shadow-sm">
            <span className="font-medium text-sm text-foreground mb-1">{item.title}</span>
            <p className="text-sm text-muted-foreground">{item.reason}</p>
            {item.metric && (
              <span className="text-[11px] font-mono text-muted-foreground/70 mt-2 bg-muted/50 w-fit px-1.5 py-0.5 rounded">
                {item.metric}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
