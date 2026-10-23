import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AnalyticsErrorState({
  message,
  onRetry,
  compact = false,
}: {
  message: string
  onRetry: () => void
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {message}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-12">
      <div className="max-w-lg mx-auto bg-card rounded-2xl border border-border p-8 text-center shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 mx-auto flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <p className="font-bold text-foreground">
          Analytics could not be loaded
        </p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          {message}
        </p>
        <Button onClick={onRetry}>Try again</Button>
      </div>
    </div>
  )
}
