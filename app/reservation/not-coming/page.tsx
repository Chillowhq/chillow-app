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
  Users,
  XCircle,
} from "lucide-react"
import apiClient from "@/lib/axios-config"
import { ReservationLinkSkeleton } from "@/components/customer-loading-skeletons"

type NotComingOutcome =
  | "ready"
  | "cancelled"
  | "already_cancelled"
  | "already_arrived"
  | "inactive"
  | "expired"
  | "invalid"
  | "unavailable"

interface NotComingReservation {
  restaurantName: string
  date?: string
  startTime?: string
  endTime?: string
  guestName?: string
  guestCount?: number
  servicePointLabel?: string | null
  notes?: string | null
  status: string
}

interface NotComingResponse {
  outcome: NotComingOutcome
  message: string
  reservation: NotComingReservation | null
}

const FALLBACK_RESPONSES: Record<NotComingOutcome, string> = {
  ready: "Your reservation is ready for cancellation.",
  cancelled:
    "Your reservation has been cancelled. Thanks for letting the restaurant know. Your table has been released.",
  already_cancelled: "This reservation has already been cancelled.",
  already_arrived:
    "You have already been marked as arrived. Please speak with the restaurant if you need help.",
  inactive: "This reservation can no longer be changed.",
  expired: "This link is no longer active. Please contact the business.",
  invalid: "This link is no longer active. Please contact the business.",
  unavailable: "Cancellation is temporarily unavailable.",
}

function responseFromError(error: any): NotComingResponse {
  const response = error?.response?.data
  const outcome = response?.outcome as NotComingOutcome | undefined
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

function ReservationSummary({ reservation }: { reservation: NotComingReservation }) {
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
      </div>
    </div>
  )
}

function StatusScreen({ result }: { result: NotComingResponse }) {
  const successful = result.outcome === "cancelled"
  const alreadyCancelled = result.outcome === "already_cancelled"
  const alreadyArrived = result.outcome === "already_arrived"
  const expired = result.outcome === "expired"

  const Icon = successful || alreadyCancelled
    ? CheckCircle2
    : alreadyArrived
      ? MapPin
      : expired
        ? Clock
        : AlertTriangle

  const iconColor = successful || alreadyCancelled
    ? "text-green-600"
    : alreadyArrived
      ? "text-blue-600"
      : expired
        ? "text-amber-600"
        : "text-red-500"

  const iconBg = successful || alreadyCancelled
    ? "bg-green-100 dark:bg-green-950/40"
    : alreadyArrived
      ? "bg-blue-100 dark:bg-blue-950/40"
      : expired
        ? "bg-amber-100 dark:bg-amber-950/40"
        : "bg-red-100 dark:bg-red-950/40"

  const title = successful
    ? "Reservation cancelled"
    : alreadyCancelled
      ? "Already cancelled"
      : alreadyArrived
        ? "You've already arrived"
        : expired
          ? "Link expired"
          : "Unable to cancel"

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--color-primary)/0.12,_transparent_42%)] bg-background flex items-center justify-center p-5">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-xl sm:p-9"
        aria-live="polite"
      >
        <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${iconBg}`}>
          <Icon className={`h-10 w-10 ${iconColor}`} />
        </div>
        <h1 className="text-2xl font-black text-foreground">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {result.message}
        </p>
        {result.reservation?.restaurantName && (
          <p className="mt-5 text-sm font-bold text-foreground">
            {result.reservation.restaurantName}
          </p>
        )}
      </motion.section>
    </main>
  )
}

function NotComingPageContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")?.trim() || ""
  const [result, setResult] = useState<NotComingResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCancelling, setIsCancelling] = useState(false)

  const validateToken = useCallback(async () => {
    if (!token) {
      setResult({
        outcome: "invalid",
        message: "This cancellation link is invalid.",
        reservation: null,
      })
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await apiClient.post<NotComingResponse>(
        "/public/reservations/not-coming/validate",
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

  async function confirmCancellation() {
    if (!token || isCancelling) return
    setIsCancelling(true)
    try {
      const response = await apiClient.post<NotComingResponse>(
        "/public/reservations/not-coming/cancel",
        { token },
      )
      setResult(response.data)
    } catch (error) {
      setResult(responseFromError(error))
    } finally {
      setIsCancelling(false)
    }
  }

  if (isLoading || !result) return <LoadingScreen />
  if (result.outcome !== "ready" || !result.reservation) {
    return <StatusScreen result={result} />
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--color-primary)/0.12,_transparent_42%)] bg-background px-5 py-10 sm:py-16">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-xl"
      >
        <div className="bg-gradient-to-br from-orange-500 to-red-500 px-7 py-8 text-white">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <XCircle className="h-6 w-6" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/75">
            Cancel reservation
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight">Can't make it?</h1>
          <p className="mt-2 text-sm leading-6 text-white/80">
            Let {result.reservation.restaurantName} know so they can release your table for other guests.
          </p>
        </div>

        <div className="space-y-5 p-6 sm:p-7">
          <ReservationSummary reservation={result.reservation} />

          <button
            type="button"
            onClick={confirmCancellation}
            disabled={isCancelling}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-4 text-base font-black text-red-700 shadow-sm transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
          >
            {isCancelling ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5" />
                I Won't Be Coming
              </>
            )}
          </button>

          <p className="text-center text-xs leading-5 text-muted-foreground">
            This will cancel your reservation and release the table. This action cannot be undone.
          </p>
        </div>
      </motion.section>
    </main>
  )
}

export default function ReservationNotComingPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <NotComingPageContent />
    </Suspense>
  )
}
