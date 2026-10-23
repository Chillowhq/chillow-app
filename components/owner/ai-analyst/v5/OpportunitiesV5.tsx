import { Lightbulb } from "lucide-react"
import { MayorOpportunityV5 } from "@/types/ai-business-analyst"

export function OpportunitiesV5({ items }: { items: MayorOpportunityV5[] }) {
  if (!items || items.length === 0) return null

  return (
    <section className="mt-12 space-y-4">
      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        Opportunities
      </h3>
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col p-5 rounded-xl border border-border/60 bg-blue-50/30 dark:bg-blue-950/10 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="font-semibold text-[15px] text-foreground block">{item.title}</span>
                  <p className="text-[14px] text-muted-foreground leading-relaxed">{item.evidence}</p>
                </div>
                {item.recommendation && (
                  <div className="text-[14px] font-medium text-blue-900 dark:text-blue-200">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1">Mayor Recommends</span>
                    {item.recommendation}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
