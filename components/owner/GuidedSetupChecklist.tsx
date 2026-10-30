"use client"

import Link from "next/link"
import {
  BadgeCheck,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  Circle,
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface SetupTask {
  id: string
  stage: number
  title: string
  description: string
  href: string
  classification: "required" | "recommended" | "verification"
  completed: boolean
}

export interface SetupProgress {
  title: string
  subtitle: string
  tasks: SetupTask[]
  nextAction: SetupTask | null
  completedRequiredCount: number
  totalRequiredCount: number
  completedCoreCount: number
  totalCoreCount: number
  completedRecommendedCount?: number
  totalRecommendedCount?: number
  progressPercent: number
  complete: boolean
  completionMessage?: string
  bookingReadiness?: {
    operationalSetupComplete: boolean
    onlineReservationsEnabled: boolean
    publicStayReservationsEnabled: boolean
    publicBookingEligible: boolean
    blockers: string[]
  } | null
  dismissed: boolean
  counts: Record<string, number>
}

interface GuidedSetupChecklistProps {
  progress: SetupProgress
  collapsed: boolean
  dismissing?: boolean
  onToggleCollapsed: () => void
  onDismiss: () => void
}

export default function GuidedSetupChecklist({
  progress,
  collapsed,
  dismissing,
  onToggleCollapsed,
  onDismiss,
}: GuidedSetupChecklistProps) {
  if (progress.dismissed) return null

  const previewTask = progress.tasks.find((task) => task.id === "booking_preview")

  if (progress.complete) {
    return (
      <section className="bg-card border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <BadgeCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground">Your Chillow workspace is ready</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {progress.completionMessage || "You have completed all required setup requirements."}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {previewTask ? <Button asChild variant="outline" className="rounded-xl font-bold"><Link href={previewTask.href}>Preview booking page</Link></Button> : null}
            <Button onClick={onDismiss} disabled={dismissing} className="rounded-xl font-bold w-full sm:w-fit bg-emerald-600 hover:bg-emerald-700 text-white">
              {dismissing ? "Dismissing..." : "Finish Setup"}
            </Button>
          </div>
        </div>
      </section>
    )
  }

  const progressPercent = Math.round(Math.max(0, Math.min(100, Number(progress.progressPercent) || 0)))

  const requiredTasks = progress.tasks.filter((task) => task.classification === "required")
  const optionalTasks = progress.tasks.filter((task) => task.classification !== "required")

  return (
    <section className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="w-full p-5 sm:p-6 text-left flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div
            className="relative w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"
            aria-label={`${progressPercent}% setup complete`}
          >
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
              <circle
                cx="24"
                cy="24"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                className="opacity-15"
              />
              <circle
                cx="24"
                cy="24"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${progressPercent} ${100 - progressPercent}`}
                className="transition-all duration-500"
              />
            </svg>
            <span className="text-[11px] font-black leading-none">{progressPercent}%</span>
          </div>
          
          <div>
            <h2 className="text-lg font-black text-foreground">{progress.title || "Business Setup"}</h2>
            <p className="text-sm text-muted-foreground mt-1">{progress.subtitle || "Get Ready to Accept Orders"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="min-w-[140px]">
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-[11px] font-bold text-muted-foreground mt-1 text-right">
              {progress.completedRequiredCount}/{progress.totalRequiredCount} required tasks
            </p>
          </div>
          <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", !collapsed && "rotate-180")} />
        </div>
      </button>

      {!collapsed && (
        <div className="px-5 sm:px-6 pb-6">
          {progress.nextAction && (
             <div className="mb-8 p-4 rounded-xl border-2 border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                   <span className="text-[10px] uppercase font-bold tracking-wider text-primary mb-1 block">Required setup • Next step</span>
                   <h3 className="font-black text-foreground text-lg">{progress.nextAction.title}</h3>
                   <p className="text-sm text-muted-foreground">{progress.nextAction.description}</p>
                </div>
                <Button asChild className="rounded-xl font-bold shrink-0 shadow-md">
                   <Link href={progress.nextAction.href}>
                     {progress.nextAction.title}
                     <ArrowRight className="w-4 h-4 ml-2" />
                   </Link>
                </Button>
             </div>
          )}

          {progress.bookingReadiness ? (
            <div className="mb-6 rounded-xl border border-border bg-secondary/20 p-4">
              <h3 className="text-sm font-bold text-foreground">Public booking status</h3>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                <p>Operational setup: <span className="font-semibold text-foreground">{progress.bookingReadiness.operationalSetupComplete ? "Complete" : "In progress"}</span></p>
                <p>Online reservations: <span className="font-semibold text-foreground">{progress.bookingReadiness.onlineReservationsEnabled ? "Enabled" : "Disabled"}</span></p>
                <p>Public stay booking: <span className="font-semibold text-foreground">{progress.bookingReadiness.publicStayReservationsEnabled ? "Enabled" : "Disabled"}</span></p>
                <p>Guest booking: <span className="font-semibold text-foreground">{progress.bookingReadiness.publicBookingEligible ? "Eligible" : "Not yet eligible"}</span></p>
              </div>
              {progress.bookingReadiness.blockers.length > 0 ? <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{progress.bookingReadiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : null}
            </div>
          ) : null}

          {/* Required Tasks */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Required setup
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {requiredTasks.map((task) => {
                const done = task.completed
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "p-4 rounded-xl border flex items-start gap-3 transition-colors",
                      done ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20" : "border-border bg-background"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      done ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400" : "bg-secondary text-muted-foreground"
                    )}>
                      {done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-bold", done ? "text-foreground/80" : "text-foreground")}>{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                    </div>
                    {!done && (
                      <Button asChild size="sm" variant="ghost" className="shrink-0 h-8 rounded-lg px-2">
                        <Link href={task.href}>
                          Fix <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recommended / Optional Tasks */}
          {optionalTasks.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-sm font-bold text-foreground mb-3">Recommended Next Steps</h3>
              <p className="text-xs text-muted-foreground mb-4 -mt-1">These tasks help you get the most out of Chillow but do not block setup completion.</p>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {optionalTasks.map((task) => {
                  const done = task.completed
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "p-3.5 rounded-xl border flex items-center gap-3 transition-colors",
                        done ? "border-transparent bg-secondary/30 opacity-70" : "border-border bg-card hover:bg-secondary/20"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                        done ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-500" : "bg-secondary text-muted-foreground"
                      )}>
                        {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{task.title}</p>
                          {!done && task.classification === "verification" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest bg-primary/10 text-primary font-bold">
                              Test
                            </span>
                          )}
                        </div>
                      </div>
                      {!done && (
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs rounded-lg shrink-0 shadow-sm">
                          <Link href={task.href}>
                            Configure
                          </Link>
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </section>
  )
}
