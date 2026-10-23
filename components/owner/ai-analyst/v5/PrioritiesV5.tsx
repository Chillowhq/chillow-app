import { ChevronRight } from "lucide-react"
import { MayorPriorityV5 } from "@/types/ai-business-analyst"

export function PrioritiesV5({ priorities }: { priorities: MayorPriorityV5[] }) {
  if (!priorities || priorities.length === 0) return null

  return (
    <section className="mt-12 space-y-6">
      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        Mayor's Priorities
      </h3>
      <div className="space-y-6">
        {priorities.sort((a, b) => a.rank - b.rank).map((priority, i) => {
          const evidenceList = priority.evidence ? priority.evidence.split('\n').map(s => s.trim().replace(/^[•-]\s*/, '')).filter(Boolean) : [];
          const explanationsList = priority.possibleExplanations ? priority.possibleExplanations.split('\n').map(s => s.trim().replace(/^[•-]\s*/, '')).filter(Boolean) : [];

          return (
            <div key={i} className="flex flex-col md:flex-row gap-6 p-6 rounded-xl border border-border/80 bg-card shadow-sm">
              
              {/* Left Column: Number & Title */}
              <div className="md:w-1/3 space-y-3">
                <div className="text-3xl font-light text-muted-foreground/30">#{priority.rank}</div>
                <h4 className="text-xl font-semibold leading-tight text-foreground">{priority.title}</h4>
              </div>

              {/* Right Column: Finding, Evidence, Explanations, Recommendation */}
              <div className="md:w-2/3 space-y-6">
                
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Finding</h5>
                  <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">{priority.finding}</p>
                </div>

                {evidenceList.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Evidence</h5>
                    <ul className="space-y-1.5">
                      {evidenceList.map((ev, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[14px] text-muted-foreground leading-relaxed">
                          <span className="text-[#EA601A] mt-0.5">•</span>
                          <span>{ev}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {priority.whyItMatters && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Why It Matters</h5>
                    <p className="text-[14px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{priority.whyItMatters}</p>
                  </div>
                )}

                {explanationsList.length > 0 && (
                  <div className="rounded-lg bg-muted/40 p-4 border border-border/40 space-y-3">
                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Possible Explanations</h5>
                    <ul className="space-y-1.5">
                      {explanationsList.map((exp, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[14px] text-muted-foreground leading-relaxed">
                          <span className="text-muted-foreground/50 mt-0.5">•</span>
                          <span>{exp}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[12px] italic text-muted-foreground/80 border-t border-border/40 pt-2 mt-2">
                      Mayor can't determine which explanation is correct from the current data.
                    </p>
                  </div>
                )}

                {priority.recommendedAction && (
                  <div className="rounded-lg bg-[#EA601A]/5 p-5 border border-[#EA601A]/20 space-y-2">
                    <h5 className="text-[11px] font-bold text-[#EA601A] uppercase tracking-wider flex items-center gap-1">
                      Mayor Recommends
                    </h5>
                    <p className="text-[15px] font-medium leading-relaxed text-foreground whitespace-pre-wrap">
                      {priority.recommendedAction}
                    </p>
                  </div>
                )}

                {priority.watchNextWeek && (
                  <div className="space-y-1.5 pt-2">
                    <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Watch Next Week</h5>
                    <p className="text-[14px] leading-relaxed text-muted-foreground flex items-start gap-2 whitespace-pre-wrap">
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                      {priority.watchNextWeek}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
