"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ReservationDashboardRecord } from "./useReservationDashboard"

export type ReservationCancellationOutcome =
  | "cancel_unpaid"
  | "no_refund"
  | "full_refund"
  | "partial_refund"

export interface ReservationCancellationRequest {
  outcome: ReservationCancellationOutcome
  reason:
    | "guest_request"
    | "duplicate_booking"
    | "payment_issue"
    | "hotel_unavailable"
    | "other"
  notes?: string
  refundAmountCents?: number
}

const REASONS: Array<{
  value: ReservationCancellationRequest["reason"]
  label: string
}> = [
  { value: "guest_request", label: "Guest request" },
  { value: "duplicate_booking", label: "Duplicate booking" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "hotel_unavailable", label: "Hotel unavailable" },
  { value: "other", label: "Other" },
]

const CAPTURED_PAYMENT_STATUSES = new Set([
  "paid",
  "partially_refunded",
  "refunded",
])

function formatMoney(cents: number, currency?: string) {
  const normalizedCurrency = String(currency || "").toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    return `${(cents / 100).toFixed(2)}`
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: normalizedCurrency,
  }).format(cents / 100)
}

function formatStayDate(value?: string) {
  if (!value) return "—"
  const [year, month, day] = value.split("-").map(Number)
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
}

function Detail({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}

export function HotelReservationCancellationDialog({
  open,
  reservation,
  canRefund,
  isBusy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  reservation: ReservationDashboardRecord | null
  canRefund: boolean
  isBusy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (request: ReservationCancellationRequest) => Promise<void>
}) {
  const isPaid = CAPTURED_PAYMENT_STATUSES.has(
    reservation?.paymentStatus || "",
  )
  const refundEconomics = reservation?.refundEconomics
  const originalPaidAmountCents = Number(
    refundEconomics?.customerPaidAmountCents ??
      reservation?.originalPaidAmountCents ??
      0,
  )
  const customerPlatformFeeCents = Number(
    refundEconomics?.customerPlatformFeeCents || 0,
  )
  const customerProcessingFeeCents = Number(
    refundEconomics?.customerProcessingFeeCents || 0,
  )
  const businessPlatformFeeCents = Number(
    refundEconomics?.businessAbsorbedPlatformFeeCents || 0,
  )
  const refundedAmountCents = Number(
    refundEconomics?.successfulRefundedAmountCents ??
      reservation?.refundedAmountCents ??
      0,
  )
  const remainingRefundableAmountCents = Number(
    refundEconomics?.remainingRefundableAmountCents ??
      reservation?.remainingRefundableAmountCents ??
      Math.max(0, originalPaidAmountCents - refundedAmountCents),
  )
  const [outcome, setOutcome] =
    useState<ReservationCancellationOutcome>("cancel_unpaid")
  const [reason, setReason] =
    useState<ReservationCancellationRequest["reason"]>("guest_request")
  const [notes, setNotes] = useState("")
  const [partialAmount, setPartialAmount] = useState("")

  useEffect(() => {
    if (!open) return
    setOutcome(isPaid ? "no_refund" : "cancel_unpaid")
    setReason("guest_request")
    setNotes("")
    setPartialAmount("")
  }, [isPaid, open, reservation?._id])

  const partialAmountCents = useMemo(() => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(partialAmount)) return null
    const cents = Math.round(Number(partialAmount) * 100)
    return Number.isSafeInteger(cents) ? cents : null
  }, [partialAmount])
  const partialAmountInvalid =
    outcome === "partial_refund" &&
    (partialAmountCents === null ||
      partialAmountCents <= 0 ||
      partialAmountCents > remainingRefundableAmountCents)
  const unauthorizedPaidCancellation = isPaid && !canRefund
  const refundAmountForButton =
    outcome === "full_refund"
      ? remainingRefundableAmountCents
      : partialAmountCents || 0

  async function submit() {
    if (!reservation || partialAmountInvalid || unauthorizedPaidCancellation) {
      return
    }
    await onConfirm({
      outcome,
      reason,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(outcome === "partial_refund" && partialAmountCents !== null
        ? { refundAmountCents: partialAmountCents }
        : {}),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isBusy) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isPaid ? "Cancel Paid Reservation" : "Cancel Reservation"}
          </DialogTitle>
          <DialogDescription>
            {isPaid
              ? "Choose explicitly how the captured payment should be handled."
              : "Confirm the cancellation. No refund operation will be created."}
          </DialogDescription>
        </DialogHeader>

        {reservation && isPaid && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Detail label="Reservation Reference" value={reservation._id} />
            <Detail label="Guest" value={reservation.customerName || "—"} />
            <Detail
              label="Reservation Status"
              value={
                <span className="capitalize">
                  {reservation.status.replaceAll("_", " ")}
                </span>
              }
            />
            <Detail
              label="Payment Status"
              value={
                <span className="capitalize">
                  {String(reservation.paymentStatus || "—").replaceAll("_", " ")}
                </span>
              }
            />
            <Detail
              label="Customer Paid"
              value={formatMoney(
                originalPaidAmountCents,
                reservation.currency,
              )}
            />
            <Detail
              label="Chillow Fee (Non-Refundable)"
              value={formatMoney(
                customerPlatformFeeCents,
                reservation.currency,
              )}
            />
            <Detail
              label="Processing Fee (Non-Refundable)"
              value={formatMoney(
                customerProcessingFeeCents,
                reservation.currency,
              )}
            />
            <Detail
              label="Customer Will Receive"
              value={formatMoney(
                remainingRefundableAmountCents,
                reservation.currency,
              )}
            />
            {refundedAmountCents > 0 && (
              <Detail
                label="Already Refunded"
                value={formatMoney(refundedAmountCents, reservation.currency)}
              />
            )}
            {businessPlatformFeeCents > 0 && (
              <Detail
                label="Chillow Fee Absorbed by Hotel"
                value={
                  <div>
                    {formatMoney(
                      businessPlatformFeeCents,
                      reservation.currency,
                    )}
                    <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                      Non-refundable to hotel; not deducted from the guest.
                    </p>
                  </div>
                }
              />
            )}
            <Detail
              label="Currency"
              value={String(reservation.currency || "—").toUpperCase()}
            />
            <Detail
              label="Check-in"
              value={formatStayDate(reservation.checkInDate)}
            />
            <Detail
              label="Check-out"
              value={formatStayDate(reservation.checkOutDate)}
            />
          </div>
        )}

        {unauthorizedPaidCancellation ? (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Owner approval required</p>
              <p className="mt-1 text-sm">
                This paid reservation requires an owner or co-owner to decide
                how the captured payment should be handled.
              </p>
            </div>
          </div>
        ) : (
          <>
            {isPaid && (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-bold text-foreground">
                  Payment handling
                </legend>
                {[
                  {
                    value: "no_refund",
                    label: "Keep payment — no refund",
                    disabled: false,
                  },
                  {
                    value: "full_refund",
                    label: `Full refund — ${formatMoney(
                      remainingRefundableAmountCents,
                      reservation?.currency,
                    )}`,
                    disabled: remainingRefundableAmountCents <= 0,
                  },
                  {
                    value: "partial_refund",
                    label: "Partial refund",
                    disabled: remainingRefundableAmountCents <= 0,
                  },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
                  >
                    <input
                      type="radio"
                      name="payment-handling"
                      className="mt-0.5 h-4 w-4 accent-primary"
                      value={option.value}
                      checked={outcome === option.value}
                      disabled={option.disabled}
                      onChange={() =>
                        setOutcome(
                          option.value as ReservationCancellationOutcome,
                        )
                      }
                    />
                    <span className="text-sm font-semibold">{option.label}</span>
                  </label>
                ))}
                {outcome === "partial_refund" && (
                  <div className="rounded-lg border border-border p-3">
                    <Label htmlFor="partial-refund-amount">
                      Refund amount ({String(reservation?.currency || "").toUpperCase()})
                    </Label>
                    <Input
                      id="partial-refund-amount"
                      className="mt-2"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={partialAmount}
                      aria-invalid={partialAmountInvalid}
                      onChange={(event) => setPartialAmount(event.target.value)}
                    />
                    <p
                      className={`mt-1.5 text-xs ${
                        partialAmountInvalid
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      Enter more than zero and no more than{" "}
                      {formatMoney(
                        remainingRefundableAmountCents,
                        reservation?.currency,
                      )}
                      .
                    </p>
                  </div>
                )}
                {outcome === "full_refund" && (
                  <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Refunds the full eligible amount. Chillow and
                    payment-processing fees paid by the customer are
                    non-refundable.
                  </p>
                )}
              </fieldset>
            )}

            <div className="space-y-2">
              <Label htmlFor="cancellation-reason">Cancellation reason</Label>
              <select
                id="cancellation-reason"
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target
                      .value as ReservationCancellationRequest["reason"],
                  )
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                {REASONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cancellation-notes">Notes (optional)</Label>
              <Textarea
                id="cancellation-notes"
                maxLength={500}
                value={notes}
                placeholder="Add internal context for this decision."
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => onOpenChange(false)}
          >
            Keep Reservation
          </Button>
          {!unauthorizedPaidCancellation && (
            <Button
              type="button"
              variant="destructive"
              disabled={isBusy || partialAmountInvalid}
              onClick={() => void submit()}
            >
              {isBusy && <Loader2 className="animate-spin" />}
              {outcome === "no_refund"
                ? "Cancel Without Refund"
                : outcome === "full_refund" ||
                    outcome === "partial_refund"
                  ? `Refund ${formatMoney(
                      refundAmountForButton,
                      reservation?.currency,
                    )}`
                  : "Cancel Reservation"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
