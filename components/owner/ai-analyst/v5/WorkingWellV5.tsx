import { CheckCircle2 } from "lucide-react"
import { MayorWorkingWellV5 } from "@/types/ai-business-analyst"

export function WorkingWellV5({ items }: { items: MayorWorkingWellV5[] }) {
  if (!items || items.length === 0) return null

  return (
    <section className="mt-12 space-y-4">
      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        What's Working
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col p-4 rounded-xl border border-border/60 bg-emerald-50/30 dark:bg-emerald-950/10 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-sm text-foreground">{item.title}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed pl-6">{item.explanation}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
