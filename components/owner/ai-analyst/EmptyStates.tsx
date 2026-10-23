import { Sparkles, Clock, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function NotGeneratedState() {
  return (
    <Card className="border-dashed border-muted/60 shadow-sm mt-8 max-w-2xl">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="rounded-full bg-[#EA601A]/10 p-4 mb-2">
          <Sparkles className="h-8 w-8 text-[#EA601A]" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Mayor is preparing your first weekly briefing
          </h3>
          <p className="max-w-md text-[15px] text-muted-foreground leading-relaxed mx-auto">
            QuickServe needs a completed week of activity before Mayor can give you a reliable business review.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function GeneratingState() {
  return (
    <Card className="border-dashed border-muted/60 shadow-sm mt-8 max-w-2xl">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="relative mb-2">
          <div className="absolute inset-0 rounded-full bg-[#EA601A]/20 animate-ping" />
          <div className="relative rounded-full bg-[#EA601A]/10 p-4">
            <Sparkles className="h-8 w-8 text-[#EA601A]" />
          </div>
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Mayor is preparing your weekly brief
          </h3>
          <p className="max-w-md text-[15px] text-muted-foreground leading-relaxed mx-auto">
            Your business data for this week has been finalized and Mayor is generating the analysis.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function FailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-dashed border-muted/60 shadow-sm mt-8 max-w-2xl">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="rounded-full bg-red-50 p-4 mb-2 dark:bg-red-900/10">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Mayor couldn't load this week's briefing
          </h3>
          <p className="max-w-md text-[15px] text-muted-foreground leading-relaxed mx-auto mb-6">
            Your QuickServe analytics are still available. You can try loading again.
          </p>
          <Button variant="outline" onClick={onRetry} className="font-medium">
            Try again
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-dashed border-muted/60 shadow-sm mt-8 max-w-2xl">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="rounded-full bg-red-50 p-4 mb-2 dark:bg-red-900/10">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground mb-2">
            We couldn't load your weekly briefing
          </h3>
          <p className="max-w-md text-[15px] text-muted-foreground leading-relaxed mx-auto mb-6">
            Please check your connection and try again.
          </p>
          <Button variant="outline" onClick={onRetry} className="font-medium">
            Try again
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function InsufficientDataState() {
  return (
    <Card className="border-dashed border-muted/60 shadow-sm mt-8 max-w-2xl">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="rounded-full bg-[#EA601A]/10 p-4 mb-2">
          <Clock className="h-8 w-8 text-[#EA601A]" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Mayor is still learning from your activity
          </h3>
          <p className="max-w-md text-[15px] text-muted-foreground leading-relaxed mx-auto">
            There isn't enough completed activity yet to produce a reliable weekly business briefing. Continue using QuickServe and your weekly briefing will become more detailed.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function StableWeekState({ businessName }: { businessName: string }) {
  return (
    <Card className="border-dashed border-emerald-200 dark:border-emerald-900/30 shadow-sm mt-8 max-w-2xl bg-emerald-50/30 dark:bg-emerald-900/5">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="rounded-full bg-emerald-100 p-4 mb-2 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground mb-2">
            A steady week for {businessName}
          </h3>
          <p className="max-w-md text-[15px] text-muted-foreground leading-relaxed mx-auto">
            Mayor didn't find any material changes that need your attention this week.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
