"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  QrCode,
  UserCheck,
} from "lucide-react"
import GuestWaitstaffRequestSheet from "@/components/guest-waitstaff-request-sheet"
import { useCustomerGuestRealtime } from "@/components/providers/customer-guest-realtime-provider"
import {
  DEFAULT_WAITSTAFF_REQUEST_REASON,
  type WaitstaffRequestReasonId,
} from "@/lib/waitstaff-request-reasons"
import {
  getMenuWaitstaffCopy,
  MENU_RESOLVED_PRESENTATION_MS,
  resolveMenuWaitstaffDisplayState,
  type MenuWaitstaffDisplayState,
} from "@/lib/waitstaff-request-presentation"

type GuestWaitstaffRequestCardProps = {
  servicePointId: string
  servicePointLabel: string
}

const STATE_STYLES: Record<
  MenuWaitstaffDisplayState,
  { card: string; icon: string }
> = {
  idle: {
    card:
      "border-[var(--brand-primary,#EA601A)]/20 bg-[var(--brand-primary,#EA601A)]/8 text-foreground shadow-sm",
    icon:
      "bg-[var(--brand-primary,#EA601A)]/12 text-[var(--brand-primary,#EA601A)]",
  },
  recovering: {
    card: "border-border bg-card text-foreground",
    icon: "bg-secondary text-muted-foreground",
  },
  pending: {
    card:
      "border-emerald-200/80 bg-emerald-50/80 text-emerald-950 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
    icon:
      "bg-emerald-500 text-white dark:bg-emerald-500 dark:text-emerald-950",
  },
  acknowledged: {
    card:
      "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100",
    icon: "bg-blue-600 text-white dark:bg-blue-500 dark:text-blue-950",
  },
  resolved: {
    card:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
    icon:
      "bg-emerald-500 text-white dark:bg-emerald-500 dark:text-emerald-950",
  },
  missed: {
    card:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
    icon: "bg-amber-500 text-white dark:bg-amber-500 dark:text-amber-950",
  },
  error: {
    card:
      "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100",
    icon: "bg-red-500 text-white dark:bg-red-500 dark:text-red-950",
  },
  expired: {
    card:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
    icon: "bg-amber-500 text-white dark:bg-amber-500 dark:text-amber-950",
  },
}

const COUNTDOWN_RING_CIRCUMFERENCE = 2 * Math.PI * 17

function formatCountdownForAccessibility(countdown: string) {
  const [minutesValue, secondsValue] = countdown.split(":").map(Number)
  const minutes = Number.isFinite(minutesValue) ? minutesValue : 0
  const seconds = Number.isFinite(secondsValue) ? secondsValue : 0
  const parts = []
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`)
  if (seconds) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`)
  return `Request again available in ${parts.join(" ")}.`
}

function RequestCooldownRing({
  countdown,
  progress,
}: {
  countdown: string
  progress: number
}) {
  const normalizedProgress = Math.min(1, Math.max(0, progress))
  const dashOffset = COUNTDOWN_RING_CIRCUMFERENCE * (1 - normalizedProgress)

  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <svg
        viewBox="0 0 40 40"
        className="absolute inset-0 h-full w-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          strokeWidth="2.5"
          className="stroke-current text-emerald-950/15 dark:text-emerald-100/20"
        />
        <circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={COUNTDOWN_RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          className="stroke-[var(--brand-primary,#EA601A)] transition-[stroke-dashoffset] duration-700 ease-linear motion-reduce:transition-none"
        />
      </svg>
      <span
        aria-hidden="true"
        className="relative font-mono text-[9px] font-black tracking-[-0.04em] tabular-nums"
      >
        {countdown}
      </span>
      <span className="sr-only">
        {formatCountdownForAccessibility(countdown)}
      </span>
    </span>
  )
}

function StateIcon({ state }: { state: MenuWaitstaffDisplayState }) {
  const className = "h-5 w-5"
  if (state === "recovering") {
    return <Loader2 className={`${className} animate-spin motion-reduce:animate-none`} aria-hidden="true" />
  }
  if (state === "acknowledged") return <UserCheck className={className} aria-hidden="true" />
  if (state === "resolved") return <CheckCircle2 className={className} aria-hidden="true" />
  if (state === "missed") return <Clock className={className} aria-hidden="true" />
  if (state === "error") return <AlertCircle className={className} aria-hidden="true" />
  if (state === "expired") return <QrCode className={className} aria-hidden="true" />
  return <Bell className={className} aria-hidden="true" />
}

export default function GuestWaitstaffRequestCard({
  servicePointId,
  servicePointLabel,
}: GuestWaitstaffRequestCardProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedReason, setSelectedReason] =
    useState<WaitstaffRequestReasonId>(DEFAULT_WAITSTAFF_REQUEST_REASON)
  const [completedResolutionKey, setCompletedResolutionKey] = useState("")

  const {
    currentRequest,
    status,
    countdown,
    countdownProgress,
    isRecovering,
    isSubmitting,
    error,
    recoveryError,
    expiredSession,
    submitRequest,
    refresh,
  } = useCustomerGuestRealtime().waitstaff

  const resolutionKey = useMemo(() => {
    if (status !== "resolved" || !currentRequest) return ""
    return `${currentRequest._id}:${currentRequest.resolvedAt || currentRequest.updatedAt || "resolved"}`
  }, [currentRequest, status])

  useEffect(() => {
    if (!resolutionKey) return
    setCompletedResolutionKey("")
    const timer = window.setTimeout(() => {
      setCompletedResolutionKey(resolutionKey)
    }, MENU_RESOLVED_PRESENTATION_MS)
    return () => window.clearTimeout(timer)
  }, [resolutionKey])

  const displayState = resolveMenuWaitstaffDisplayState({
    status,
    isRecovering,
    hasError: Boolean(error || recoveryError),
    expiredSession,
    resolvedPresentationComplete: Boolean(
      resolutionKey && completedResolutionKey === resolutionKey,
    ),
  })
  const copy = getMenuWaitstaffCopy(
    displayState,
    currentRequest?.acknowledgedByName || currentRequest?.claimedByName,
    servicePointLabel,
  )
  const styles = STATE_STYLES[displayState]
  const canOpenRequestSheet = ["idle", "missed", "error"].includes(displayState)
  const canOpenRequestDetail = ["pending", "acknowledged"].includes(displayState)
  const canRefresh = displayState === "error" && recoveryError && !error
  const showCountdown =
    displayState === "pending" &&
    Boolean(countdown) &&
    countdownProgress !== null

  const handleCardAction = () => {
    if (displayState === "expired") {
      router.push("/scan")
      return
    }
    if (canRefresh) {
      void refresh()
      return
    }
    if (canOpenRequestSheet) setSheetOpen(true)
    if (canOpenRequestDetail) {
      router.push(`/s/${servicePointId}/waitstaff-request`)
    }
  }

  const handleSubmit = async () => {
    const request = await submitRequest(selectedReason, servicePointLabel)
    if (request) setSheetOpen(false)
  }

  const isActionable =
    canOpenRequestSheet ||
    canOpenRequestDetail ||
    displayState === "expired" ||
    canRefresh

  return (
    <>
      <section
        aria-label="Waitstaff request"
        className="mx-auto max-w-5xl pb-5"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <button
          type="button"
          data-testid="guest-waitstaff-request-card"
          data-state={displayState}
          onClick={handleCardAction}
          disabled={!isActionable || isSubmitting}
          className={`group flex min-h-16 w-full items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#EA601A)] focus-visible:ring-offset-2 disabled:cursor-default sm:mx-auto sm:max-w-4xl sm:gap-3 sm:px-5 motion-reduce:transform-none motion-reduce:transition-none ${styles.card} ${
            isActionable
              ? "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              : ""
          }`}
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${styles.icon}`}
          >
            <StateIcon state={displayState} />
          </span>
          <span className="min-w-0 flex-1" aria-live="polite">
            <span className="block text-sm font-black sm:text-base">
              {copy.title}
            </span>
            <span className="mt-0.5 block text-xs font-medium leading-relaxed opacity-80 sm:text-sm">
              {copy.message}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {showCountdown && countdownProgress !== null && (
              <RequestCooldownRing
                countdown={countdown}
                progress={countdownProgress}
              />
            )}
            {isActionable && (
              <ChevronRight
                className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
                aria-hidden="true"
              />
            )}
          </span>
        </button>
      </section>

      <GuestWaitstaffRequestSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        servicePointLabel={servicePointLabel}
        selectedReason={selectedReason}
        onSelectReason={setSelectedReason}
        onSubmit={() => void handleSubmit()}
        isSubmitting={isSubmitting}
      />
    </>
  )
}
