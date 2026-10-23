"use client"

import { useEffect, useMemo, useState } from "react"
import { Banknote, CheckCircle2, CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDateTime, formatPrice } from "@/lib/localization"

export type OfflinePaymentMethod = "cash" | "pos_card"

type PreparationEvidence = {
  totalLines: number
  readyLines: number
  inProgressLines: number
  pendingLines: number
  derivedStatus: "placed" | "in_progress" | "ready"
}

type TimelineEntry = {
  label: string
  at: string
  by?: string | null
  reason?: string | null
}

export type ReconciliationOrder = {
  orderId: string
  servicePoint: string
  createdAt: string
  total: number
  currency?: string
  status: "placed" | "in_progress" | "ready" | "completed" | "cancelled"
  paymentStatus: "paid" | "pending" | "unpaid"
  paymentChannel: "online" | "offline"
  paymentMethod: "online" | "offline" | "cash" | "pos_card"
  paidVia?: "online_card" | "pos_card" | "cash" | null
  paidAt?: string | null
  completedAt?: string | null
  canMarkPaid: boolean
  canMarkCompleted: boolean
  preparationEvidence?: PreparationEvidence | null
  timeline: TimelineEntry[]
}

export type ReconciliationIntent = {
  recordOfflinePayment: boolean
  offlinePaymentMethod?: OfflinePaymentMethod
  completeOrder: boolean
  historicalServiceCorrection?: { reason?: string }
}

export type ReconciliationExecutionResult = {
  success: boolean
  message: string
  payment: {
    state: "not_needed" | "recorded" | "already_recorded" | "failed"
    message: string
  }
  fulfillment: {
    state: "not_needed" | "completed" | "already_completed" | "historically_corrected" | "not_attempted" | "failed"
    message: string
  }
  persisted?: {
    paymentStatus?: string | null
    orderStatus?: string | null
    completedAt?: string | null
    reconciledAt?: string | null
    reconciledBy?: string | null
    correctionNote?: string | null
  }
}

type PaymentDecision = "" | OfflinePaymentMethod | "no"
type ServedDeclaration = "" | "served" | "not_served"

function displayStatus(value: string | null | undefined) {
  if (!value) return "Not recorded"
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function paymentSummary(order: ReconciliationOrder) {
  if (order.paymentStatus !== "paid") return order.paymentChannel === "online" ? "Pending online payment" : "Payment not recorded"
  if (order.paidVia === "cash") return "Paid by cash"
  if (order.paidVia === "pos_card") return "Paid by POS card"
  return "Paid"
}

function correctionPreview({ recordPayment, completeOrder }: { recordPayment: boolean; completeOrder: boolean }) {
  if (recordPayment && completeOrder) return "This will record the offline payment and mark the order as completed."
  if (recordPayment) return "This will record the offline payment. The order status will stay unchanged."
  if (completeOrder) return "This will mark the order as completed."
  return null
}

export function OrderReconciliationDialog({
  open,
  order,
  timezone,
  canReconcile,
  onOpenChange,
  onReconcile,
}: {
  open: boolean
  order: ReconciliationOrder | null
  timezone: string
  canReconcile: boolean
  onOpenChange: (open: boolean) => void
  onReconcile: (order: ReconciliationOrder, intent: ReconciliationIntent) => Promise<ReconciliationExecutionResult>
}) {
  const [paymentDecision, setPaymentDecision] = useState<PaymentDecision>("")
  const [servedDeclaration, setServedDeclaration] = useState<ServedDeclaration>("")
  const [correctionReason, setCorrectionReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ReconciliationExecutionResult | null>(null)

  useEffect(() => {
    if (!open) return
    setPaymentDecision("")
    setServedDeclaration("")
    setCorrectionReason("")
    setSubmitting(false)
    setResult(null)
  }, [open, order?.orderId])

  const assessment = useMemo(() => {
    if (!order) return null
    const paymentNeedsRecording = order.paymentChannel === "offline" && order.paymentStatus !== "paid" && order.canMarkPaid
    const paymentAwaitingProvider = order.paymentChannel === "online" && order.paymentStatus !== "paid"
    const fulfillmentNeedsConfirmation = !["completed", "cancelled"].includes(order.status)
    const recordedPreparationIsReady = fulfillmentNeedsConfirmation && (
      order.canMarkCompleted || order.status === "ready" || order.preparationEvidence?.derivedStatus === "ready"
    )
    return {
      paymentNeedsRecording,
      paymentAwaitingProvider,
      fulfillmentNeedsConfirmation,
      recordedPreparationIsReady,
      needsAdministrativeCorrection: fulfillmentNeedsConfirmation && !recordedPreparationIsReady,
    }
  }, [order])

  if (!order || !assessment) return null

  const recordsOfflinePayment = assessment.paymentNeedsRecording && ["cash", "pos_card"].includes(paymentDecision)
  const paymentCanSupportCompletion = order.paymentStatus === "paid" || recordsOfflinePayment
  const serviceConfirmed = servedDeclaration === "served"
  const administrativeCorrectionRequested = assessment.needsAdministrativeCorrection && serviceConfirmed
  const administrativeCorrectionReady = administrativeCorrectionRequested
    && canReconcile
  const completesThroughNormalWorkflow = serviceConfirmed
    && assessment.recordedPreparationIsReady
    && paymentCanSupportCompletion
  const completesThroughAdministrativeCorrection = administrativeCorrectionReady && paymentCanSupportCompletion
  const completesOrder = completesThroughNormalWorkflow || completesThroughAdministrativeCorrection
  const hasAction = recordsOfflinePayment || completesOrder
  const hasAnsweredFulfillmentQuestion = !assessment.fulfillmentNeedsConfirmation || servedDeclaration !== ""
  const canSubmit = canReconcile
    && !submitting
    && !result
    && hasAnsweredFulfillmentQuestion
    && hasAction
  const preview = correctionPreview({ recordPayment: recordsOfflinePayment, completeOrder: completesOrder })

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      setResult(await onReconcile(order, {
        recordOfflinePayment: recordsOfflinePayment,
        offlinePaymentMethod: recordsOfflinePayment ? paymentDecision as OfflinePaymentMethod : undefined,
        completeOrder: completesThroughNormalWorkflow,
        historicalServiceCorrection: completesThroughAdministrativeCorrection
          ? { reason: correctionReason.trim() || undefined }
          : undefined,
      }))
    } finally {
      setSubmitting(false)
    }
  }

  const resultCompleted = result?.persisted?.orderStatus === "completed"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Reconcile Order
          </DialogTitle>
          <DialogDescription>
            Confirm what happened and Chillow will update the recorded order safely.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
          <section className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm">
            <p className="font-bold text-foreground">Order: {order.orderId}</p>
            <p className="mt-1 text-muted-foreground">
              {order.servicePoint || "Service point unavailable"} · {formatPrice(order.total || 0, order.currency || "USD")}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
              <div><p className="text-xs font-semibold text-muted-foreground">Payment</p><p className="mt-0.5 font-semibold text-foreground">{paymentSummary(order)}</p></div>
              <div><p className="text-xs font-semibold text-muted-foreground">Order</p><p className="mt-0.5 font-semibold text-foreground">{displayStatus(order.status)}</p></div>
            </div>
          </section>

          {!canReconcile ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
              You don&apos;t have permission to reconcile orders. Ask your manager or business owner.
            </p>
          ) : null}

          {assessment.paymentNeedsRecording ? (
            <section className="space-y-2.5">
              <p className="font-semibold text-foreground">Was payment received?</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { value: "cash", label: "Yes, Cash", icon: Banknote },
                  { value: "pos_card", label: "Yes, POS Card", icon: CreditCard },
                  { value: "no", label: "No" },
                ].map(({ value, label, icon: Icon }) => (
                  <label key={value} className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-center text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input className="sr-only" type="radio" name="payment-decision" value={value} checked={paymentDecision === value} onChange={() => setPaymentDecision(value as PaymentDecision)} />
                    {Icon ? <Icon className="h-4 w-4" /> : null}{label}
                  </label>
                ))}
              </div>
            </section>
          ) : null}

          {assessment.paymentAwaitingProvider ? (
            <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100">
              Payment is still awaiting provider confirmation. It cannot be confirmed here.
            </p>
          ) : null}

          {assessment.fulfillmentNeedsConfirmation ? (
            <section className="space-y-2.5">
              <p className="font-semibold text-foreground">Was this order served?</p>
              <p className="text-sm text-muted-foreground">Chillow still shows this order as {displayStatus(order.status)}.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "served", label: "Yes, it was served" },
                  { value: "not_served", label: "No, it wasn't served" },
                ].map(({ value, label }) => (
                  <label key={value} className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border px-3 py-2 text-center text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input className="sr-only" type="radio" name="served-declaration" value={value} checked={servedDeclaration === value} onChange={() => setServedDeclaration(value as ServedDeclaration)} />
                    {label}
                  </label>
                ))}
              </div>
            </section>
          ) : null}

          {administrativeCorrectionRequested ? (
            canReconcile ? (
              <label className="block space-y-2 text-sm font-semibold text-foreground" htmlFor="correction-note">
                <span>
                  Correction note <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <textarea
                  id="correction-note"
                  value={correctionReason}
                  onChange={(event) => setCorrectionReason(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="e.g. Waiter forgot to mark the order completed."
                  className="w-full rounded-lg border border-border bg-background p-2.5 font-normal text-foreground outline-none focus:border-primary"
                />
              </label>
            ) : null
          ) : null}

          {preview ? <p className="rounded-lg bg-secondary/50 p-3 text-sm font-medium text-foreground">{preview}</p> : null}

          {result ? (
            <section className={`rounded-xl border p-3.5 text-sm ${result.success ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100" : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100"}`}>
              <p className="font-bold">{result.success ? (resultCompleted ? "Order reconciled" : "Payment recorded") : "Reconciliation needs attention"}</p>
              <p className="mt-1">{result.message}</p>
              {result.persisted ? <p className="mt-2 text-xs font-medium">Payment: {displayStatus(result.persisted.paymentStatus)} · Order: {displayStatus(result.persisted.orderStatus)}</p> : null}
              {result.persisted?.reconciledBy && result.persisted?.reconciledAt ? <p className="mt-1 text-xs">Reconciled by {result.persisted.reconciledBy} · {formatDateTime(result.persisted.reconciledAt, timezone)}</p> : null}
              {result.persisted?.correctionNote ? <p className="mt-1 text-xs">Correction note: {result.persisted.correctionNote}</p> : null}
            </section>
          ) : null}

          {order.timeline.length > 0 ? (
            <details className="rounded-lg border border-border p-3 text-sm">
              <summary className="cursor-pointer font-semibold text-foreground">View details</summary>
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {order.timeline.map((entry, index) => (
                  <div key={`${entry.label}-${entry.at}-${index}`} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-muted-foreground">{entry.label}{entry.by ? ` by ${entry.by}` : ""}{entry.reason ? ` — ${entry.reason}` : ""}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(entry.at, timezone)}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border bg-background px-5 py-4 sm:px-6">
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>{result ? "Close" : "Cancel"}</Button>
          {!result ? <Button disabled={!canSubmit} onClick={submit}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{submitting ? "Reconciling..." : "Reconcile Order"}</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
