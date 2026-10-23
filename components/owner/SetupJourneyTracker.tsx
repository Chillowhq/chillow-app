"use client"

import { useState } from "react"
import Link from "next/link"
import { useSetupProgress } from "@/contexts/SetupProgressContext"
import { ArrowRight, CheckCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/axios-config"

export default function SetupJourneyTracker() {
  const { progress, loading, refreshSetupProgress } = useSetupProgress()
  const [localDismissed, setLocalDismissed] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)

  // Don't render if progress hasn't loaded or is already dismissed/complete
  if (!progress || loading || progress.dismissed || localDismissed) return null

  const handleFinish = async () => {
    try {
      setIsDismissing(true)
      await apiClient.post('/owner/setup-progress/dismiss')
      setLocalDismissed(true)
      await refreshSetupProgress()
    } catch (err) {
      console.error("Failed to dismiss setup guide:", err)
    } finally {
      setIsDismissing(false)
    }
  }

  // If complete, show the success state
  if (progress.complete) {
    return (
      <div className="fixed bottom-4 sm:top-24 sm:bottom-auto sm:right-8 sm:left-auto left-1/2 -translate-x-1/2 sm:translate-x-0 z-50 w-[calc(100%-2rem)] sm:w-auto">
        <div className="bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-200 dark:border-emerald-800 shadow-lg rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 animate-in slide-in-from-bottom-5 sm:slide-in-from-right-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-sm text-emerald-900 dark:text-emerald-100">Setup complete</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">You're ready to start taking orders.</p>
            </div>
          </div>
          <Button 
            onClick={handleFinish} 
            disabled={isDismissing}
            size="sm"
            className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {isDismissing ? "Finishing..." : "Finish"}
          </Button>
        </div>
      </div>
    )
  }

  // Pending State
  if (!progress.nextAction) return null

  return (
    <div className="fixed bottom-4 sm:top-24 sm:bottom-auto sm:right-8 sm:left-auto left-1/2 -translate-x-1/2 sm:translate-x-0 z-50 w-[calc(100%-2rem)] max-w-sm sm:w-80 animate-in slide-in-from-bottom-5 sm:slide-in-from-right-5">
      <div className="bg-card border shadow-xl rounded-2xl overflow-hidden flex flex-col relative">
        <button 
          onClick={() => setLocalDismissed(true)} 
          className="absolute top-2 right-2 p-1 text-muted-foreground hover:bg-secondary rounded-full"
          aria-label="Hide temporarily"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between mb-2 pr-6">
            <span className="text-[10px] uppercase font-black tracking-widest text-primary">Quickstart</span>
            <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {progress.completedCoreCount} of {progress.totalCoreCount}
            </span>
          </div>
          
          <div className="flex items-center gap-1 mb-3">
            {/* Simple dot progress indicator */}
            {Array.from({ length: progress.totalCoreCount }).map((_, i) => (
              <div key={i} className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                {i < progress.completedCoreCount && (
                  <div className="w-full h-full bg-primary" />
                )}
              </div>
            ))}
          </div>

          <h3 className="text-sm font-bold text-foreground leading-tight">{progress.nextAction.title}</h3>
        </div>
        
        <div className="p-3 pt-0">
          <Button asChild className="w-full rounded-xl font-bold text-sm h-10 shadow-sm">
            <Link href={progress.nextAction.href}>
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
