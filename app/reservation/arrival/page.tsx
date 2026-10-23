"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react"
import apiClient from "@/lib/axios-config"
import { ReservationLinkSkeleton } from "@/components/customer-loading-skeletons"

type ArrivalOutcome =
  | "ready"
  | "checked_in"
  | "already_checked_in"
  | "inactive"
  | "expired"
  | "not_ready"
  | "invalid"
  | "unavailable"

interface ArrivalReservation {
  restaurantName: string
  date?: string
  startTime?: string
  endTime?: string
  guestName?: string
  guestCount?: number
  servicePointLabel?: string | null
  notes?: string | null
  status: string
  arrivedAt?: string | null
}

interface ArrivalResponse {
  outcome: ArrivalOutcome
  message: string
  reservation: ArrivalReservation | null
}

const FALLBACK_RESPONSES: Record<ArrivalOutcome, string> = {
  ready: "Your reservation is ready for arrival check-in.",
  checked_in: "You're checked in! We've notified the restaurant that you've arrived. Please wait to be seated.",
  already_checked_in: "You're already checked in.",
  inactive: "This reservation is no longer active.",
  expired: "This check-in link has expired.",
  not_ready: "This reservation is not ready for arrival check-in.",
  invalid: "This check-in link is invalid.",
  unavailable: "Arrival check-in is temporarily unavailable.",
}

function responseFromError(error: any): ArrivalResponse {
  const response = error?.response?.data
  const outcome = response?.outcome as ArrivalOutcome | undefined
  if (outcome && outcome in FALLBACK_RESPONSES) {
    return {
      outcome,
      message: response?.message || FALLBACK_RESPONSES[outcome],
      reservation: response?.reservation || null,
    }
  }

  return {
    outcome: "unavailable",
    message: FALLBACK_RESPONSES.unavailable,
    reservation: null,
  }
}

function formatDate(value?: string) {
  if (!value) return "Date unavailable"
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(value?: string) {
  if (!value) return ""
  const [hours, minutes] = value.split(":").map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes))
}

function LoadingScreen() {
  return <ReservationLinkSkeleton />
}

function ReservationSummary({ reservation }: { reservation: ArrivalReservation }) {
  const time = reservation.endTime
    ? `${formatTime(reservation.startTime)} – ${formatTime(reservation.endTime)}`
    : formatTime(reservation.startTime)

  return (
    <div className="rounded-2xl border border-border bg-muted/25 p-4 text-left">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
        Your reservation
      </p>
      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-bold text-foreground">{formatDate(reservation.date)}</p>
            {time && <p className="text-muted-foreground">{time}</p>}
          </div>
        </div>
        {typeof reservation.guestCount === "number" && (
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 shrink-0 text-primary" />
            <p className="font-semibold text-foreground">
              {reservation.guestCount} {reservation.guestCount === 1 ? "guest" : "guests"}
            </p>
          </div>
        )}
        {reservation.servicePointLabel && (
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <p className="font-semibold text-foreground">{reservation.servicePointLabel}</p>
          </div>
        )}
        {reservation.notes && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-bold text-muted-foreground">Reservation notes</p>
            <p className="mt-1 text-sm text-foreground">{reservation.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusScreen({
  result,
  onRetry,
}: {
  result: ArrivalResponse
  onRetry: () => void
}) {
  const successful = result.outcome === "checked_in" || result.outcome === "already_checked_in"
  const expired = result.outcome === "expired"
  const inactive = result.outcome === "inactive"
  const unavailable = result.outcome === "unavailable"
  const Icon = successful ? CheckCircle2 : expired ? Clock : AlertTriangle

  const title = result.outcome === "checked_in"
    ? "You're checked in!"
    : result.outcome === "already_checked_in"
      ? "You're already checked in."
      : inactive
        ? "Reservation unavailable"
        : expired
          ? "Check-in link expired"
          : unavailable
            ? "Check-in temporarily unavailable"
            : "Link unavailable"

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--color-primary)/0.12,_transparent_42%)] bg-background flex items-center justify-center p-5">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-xl sm:p-9"
        aria-live="polite"
      >
        <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${successful ? "bg-green-100 dark:bg-green-950/40" : expired ? "bg-amber-100 dark:bg-amber-950/40" : "bg-red-100 dark:bg-red-950/40"}`}>
          <Icon className={`h-10 w-10 ${successful ? "text-green-600" : expired ? "text-amber-600" : "text-red-500"}`} />
        </div>
        <h1 className="text-2xl font-black text-foreground">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {result.outcome === "checked_in"
            ? "We've notified the venue that you've arrived. Thank you for coming"
            : result.message}
        </p>
        {result.reservation?.restaurantName && (
          <p className="mt-5 text-sm font-bold text-foreground">
            {result.reservation.restaurantName}
          </p>
        )}
        {unavailable && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        )}
      </motion.section>
    </main>
  )
}

function ArrivalPageContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")?.trim() || ""
  const [result, setResult] = useState<ArrivalResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingIn, setIsCheckingIn] = useState(false)

  const validateToken = useCallback(async () => {
    if (!token) {
      setResult({
        outcome: "invalid",
        message: "This check-in link is invalid.",
        reservation: null,
      })
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await apiClient.post<ArrivalResponse>(
        "/public/reservations/arrival/validate",
        { token },
      )
      setResult(response.data)
    } catch (error) {
      setResult(responseFromError(error))
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void validateToken()
  }, [validateToken])

  async function checkIn() {
    if (!token || isCheckingIn) return
    setIsCheckingIn(true)
    try {
      const response = await apiClient.post<ArrivalResponse>(
        "/public/reservations/arrival/check-in",
        { token },
      )
      setResult(response.data)
    } catch (error) {
      setResult(responseFromError(error))
    } finally {
      setIsCheckingIn(false)
    }
  }

  if (isLoading || !result) return <LoadingScreen />
  if (result.outcome !== "ready" || !result.reservation) {
    return <StatusScreen result={result} onRetry={validateToken} />
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--color-primary)/0.12,_transparent_42%)] bg-background px-5 py-10 sm:py-16">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-xl"
      >
        <div className="bg-gradient-to-br from-primary to-accent px-7 py-8 text-primary-foreground">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <MapPin className="h-6 w-6" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/75">Arrival check-in</p>
          <h1 className="mt-2 text-3xl font-black leading-tight">Let the host know you're here</h1>
          <p className="mt-2 text-sm leading-6 text-white/80">
            Welcome to {result.reservation.restaurantName}. Check in when your whole party has arrived.
          </p>
        </div>

        <div className="space-y-5 p-6 sm:p-7">
          <ReservationSummary reservation={result.reservation} />
          <button
            type="button"
            onClick={checkIn}
            disabled={isCheckingIn}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-base font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCheckingIn ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Checking you in...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                I'm Here
              </>
            )}
          </button>
          {/* <p className="text-center text-xs leading-5 text-muted-foreground">
            This tells the restaurant you've arrived. A host will seat you when your table is ready.
          </p> */}
        </div>
      </motion.section>
    </main>
  )
}

export default function ReservationArrivalPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ArrivalPageContent />
    </Suspense>
  )
}
