"use client"

import { useMemo, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import {
  Bell,
  ArrowLeft,
  Check,
  AlertCircle,
  UserCheck,
  QrCode,
} from "lucide-react"
import { getTableMenuUrl } from "@/lib/customer-routes"
import { getBusinessId } from "@/lib/business-info"
import { useCustomerGuestRealtime } from "@/components/providers/customer-guest-realtime-provider"
import {
  DEFAULT_WAITSTAFF_REQUEST_REASON,
  WAITSTAFF_REQUEST_REASONS,
  isWaitstaffRequestReasonId,
  type WaitstaffRequestReasonId,
} from "@/lib/waitstaff-request-reasons"

function normalizeTableNumber(raw: string) {
  const val = (raw || "").trim()
  if (!val) return ""
  if (/^\d+$/.test(val)) return `table-${val}`
  return val
}

export default function WaiterRequestPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const rawTableId = params.servicePointId as string
  const activeBusinessId = getBusinessId()
  const servicePointLabel = useMemo(
    () => normalizeTableNumber(rawTableId || ""),
    [rawTableId],
  )

  const [selectedReason, setSelectedReason] =
    useState<WaitstaffRequestReasonId>(() => {
      const requestedReason = searchParams.get("reason")
      return isWaitstaffRequestReasonId(requestedReason)
        ? requestedReason
        : DEFAULT_WAITSTAFF_REQUEST_REASON
    })
  const {
    currentRequest: activeCall,
    isSubmitting: isLoading,
    error,
    countdown,
    expiredSession: isSessionExpired,
    submitRequest,
  } = useCustomerGuestRealtime().waitstaff

  const handleRequestWaiter = () => {
    void submitRequest(selectedReason, servicePointLabel)
  }

  const status = activeCall?.status || null
  const waiterName =
    activeCall?.acknowledgedByName?.trim() || activeCall?.claimedByName?.trim()
  const displayState = isLoading
    ? "sending"
    : error && !activeCall
      ? "error"
      : status || "idle"
  const canCallAgain =
    !activeCall || status === "resolved" || status === "missed"
  const buttonDisabled = isLoading || !canCallAgain

  const statusTitle =
    displayState === "sending"
      ? "Sending request..."
      : displayState === "pending"
        ? "Waitstaff requested"
        : displayState === "acknowledged"
          ? "Request Acknowledged"
          : displayState === "resolved"
            ? "Request Resolved"
            : displayState === "missed"
              ? "Request Expired"
              : displayState === "error"
                ? "Request not sent"
                : "Need Assistance?"

  const statusMessage =
    displayState === "sending"
      ? "Please wait while we notify the team."
      : displayState === "pending"
        ? "We've notified the team. A waiter will acknowledge your request shortly."
        : displayState === "acknowledged"
          ? `${waiterName || "A team member"} has seen your request.`
          : displayState === "resolved"
            ? "Your request has been resolved. You can request help again if needed."
            : displayState === "missed"
              ? "This request expired before it was acknowledged. You can try again."
              : displayState === "error"
                ? "We could not send the request. Your table session remains open."
                : "Click the button below to request a waiter. We'll get to you as soon as possible."

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-secondary transition-colors duration-200"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Request Waitstaff</h1>
        </div>
      </header>

      {isSessionExpired ? (
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="w-full max-w-md mx-auto rounded-2xl border border-border bg-background p-8 text-center space-y-5">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <QrCode className="w-10 h-10 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Session Expired</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Your table session is no longer active. Please rescan the QR code
                at your table to request service.
              </p>
            </div>
            <button
              onClick={() => router.push("/scan")}
              className="w-full flex flex-col items-center justify-center p-3.5 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground border-transparent shadow-sm active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <QrCode className="w-5 h-5 mb-1.5 text-foreground/70" />
              <span className="text-[11px] font-bold text-center leading-tight">
                Scan<br />QR Code
              </span>
            </button>
            <button
              onClick={() => router.push(getTableMenuUrl(rawTableId, activeBusinessId))}
              className="w-full py-3 px-6 rounded-2xl border border-border text-foreground hover:bg-secondary transition-colors duration-200 font-medium"
            >
              Back to Menu
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="w-full max-w-md mx-auto space-y-6">
            <div
              data-testid="waitstaff-request-dialog"
              data-state={displayState}
              className="rounded-2xl border border-border bg-background p-6 text-center space-y-4"
            >
              <div className="flex justify-center">
                {displayState === "acknowledged" ? (
                  <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <UserCheck className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  </div>
                ) : displayState === "resolved" ? (
                  <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
                  </div>
                ) : (
                  <Bell
                    className={`w-10 h-10 text-[var(--brand-primary,var(--color-primary))] ${
                      displayState === "pending" || displayState === "sending"
                        ? "animate-pulse"
                        : "animate-bounce"
                    }`}
                  />
                )}
              </div>

              <div className="space-y-2" aria-live="polite">
                <h2 className="text-2xl font-bold text-foreground">
                  {statusTitle}
                </h2>
                <p className="text-muted-foreground">{statusMessage}</p>
              </div>

              {(status === "pending" || status === "acknowledged") &&
                countdown &&
                !isLoading && (
                <div className="flex flex-col gap-2 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-left">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                      A waitstaff request is active for this service point.
                    </p>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-300 ml-8">
                    It can be requested again after resolution or in:{" "}
                    <span className="font-mono font-bold text-lg">
                      {countdown}
                    </span>
                  </p>
                </div>
                )}

              {status === "acknowledged" && !isLoading && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-left">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                    A member of staff has acknowledged your request.
                  </p>
                </div>
              )}

              {status === "resolved" && !isLoading && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-left">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                  <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                    Your request is resolved.
                  </p>
                </div>
              )}

              {canCallAgain && !isLoading && (
                <div className="space-y-6 text-left border-t border-border pt-6 mt-6">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                      How can we help?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {WAITSTAFF_REQUEST_REASONS.map((reason) => (
                        <button
                          key={reason.id}
                          type="button"
                          aria-pressed={selectedReason === reason.id}
                          onClick={() => setSelectedReason(reason.id)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            selectedReason === reason.id
                              ? "bg-[var(--brand-primary,var(--color-primary))] text-white shadow-md scale-105"
                              : "bg-secondary text-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {selectedReason === reason.id && (
                            <Check className="w-3 h-3 inline mr-1" />
                          )}
                          {reason.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-left">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {error}
                  </p>
                </div>
              )}

              <button
                onClick={handleRequestWaiter}
                disabled={buttonDisabled}
                className="w-full py-4 px-6 rounded-2xl bg-linear-to-r from-[var(--brand-gradient-from,var(--color-primary))] to-[var(--brand-gradient-to,var(--color-accent))] text-white font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
                    Sending request...
                  </span>
                ) : !canCallAgain ? (
                  <span className="flex items-center justify-center gap-2">
                    <Bell className="w-5 h-5" />
                    Request in progress...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Bell className="w-5 h-5" />
                    {error ? "Try Again" : "Request Waiter Now"}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={() => router.push(getTableMenuUrl(rawTableId, activeBusinessId))}
              className="w-full py-3 px-6 rounded-2xl border border-border text-foreground hover:bg-secondary transition-colors duration-200 font-medium"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
