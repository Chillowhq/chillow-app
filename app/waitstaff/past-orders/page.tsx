"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  Mail,
  MoreHorizontal,
  Receipt,
  RefreshCw,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import apiClient from "@/lib/axios-config"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { formatDateTime, formatPrice } from "@/lib/localization"
import { Button } from "@/components/ui/button"
import {
  OrderReconciliationDialog,
  type ReconciliationExecutionResult,
  type ReconciliationIntent,
  type ReconciliationOrder,
} from "@/components/waitstaff/OrderReconciliationDialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// -
// Types
// -

type DateRange = "all" | "yesterday" | "7days" | "thisMonth" | "custom"
type OrderStatusFilter = "all" | "needs_reconciliation" | "placed" | "in_progress" | "ready" | "completed" | "cancelled"
type PaymentStatusFilter = "all" | "paid" | "pending"
type PaymentMethodFilter = "all" | "online" | "offline" | "cash" | "pos_card"

type HistoryItem = {
  itemName: string
  quantity: number
  lineTotal?: number
  notes?: string
  allergies?: string[]
}

type TimelineEntry = {
  label: string
  at: string
  by?: string | null
  reason?: string | null
}

type PreparationEvidence = {
  totalLines: number
  readyLines: number
  inProgressLines: number
  pendingLines: number
  derivedStatus: "placed" | "in_progress" | "ready"
}

type HistoricalServiceCorrection = {
  confirmedAt: string
  reason: string
  confirmedBy?: { name?: string | null; role?: string | null } | null
}

type HistoryOrder = {
  orderId: string
  servicePoint: string
  servicePointLabel: string
  waiter?: string
  createdAt: string
  updatedAt?: string
  readyAt?: string | null
  completedAt?: string | null
  servedAt?: string | null
  cancelledAt?: string | null
  paymentStatus: "paid" | "pending" | "unpaid"
  paymentChannel: "online" | "offline"
  paymentMethod: "online" | "offline" | "cash" | "pos_card"
  paidVia?: "online_card" | "pos_card" | "cash" | null
  paidAt?: string | null
  total: number
  subtotal?: number
  taxAmount?: number
  platformFeeTotal?: number
  tipAmount?: number
  tipType?: "percentage" | "custom" | null
  tipPercentage?: number | null
  currency?: string
  status: "placed" | "in_progress" | "ready" | "completed" | "cancelled"
  canMarkPaid: boolean
  /** Whether this order can be forward-reconciled to completed */
  canMarkCompleted: boolean
  reconciliationStatus?: "ready_to_complete" | "payment_required" | "prep_not_confirmed" | "historically_corrected" | "already_completed" | "cancelled"
  reconciliationReason?: string | null
  preparationEvidence?: PreparationEvidence | null
  historicalServiceCorrection?: HistoricalServiceCorrection | null
  receiptEmail?: string
  receiptSent?: boolean
  receiptSentAt?: string | null
  items: HistoryItem[]
  timeline: TimelineEntry[]
}

type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

// -
// Static option lists
// -

const dateRanges: { value: DateRange; label: string }[] = [
  { value: "yesterday", label: "Yesterday" },
  { value: "7days", label: "Last 7 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "custom", label: "Custom Range" },
]

const reconciliationDateRanges: { value: DateRange; label: string }[] = [
  { value: "all", label: "All Past Orders" },
  ...dateRanges,
]

const statuses: { value: OrderStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_reconciliation", label: "Needs Reconciliation" },
  { value: "placed", label: "Placed" },
  { value: "in_progress", label: "In Progress" },
  { value: "ready", label: "Ready" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

const paymentStatuses: { value: PaymentStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
]

const paymentMethods: { value: PaymentMethodFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "cash", label: "Cash" },
  { value: "pos_card", label: "POS Card" },
]

// -
// Pure helpers
// -

function statusLabel(status: HistoryOrder["status"]) {
  return status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)
}

function paymentStatusLabel(status: HistoryOrder["paymentStatus"]) {
  return status === "paid" ? "Paid" : "Pending"
}

function paymentMethodLabel(order: HistoryOrder) {
  if (order.paymentMethod === "cash") return "Cash"
  if (order.paymentMethod === "pos_card") return "POS Card"
  if (order.paymentMethod === "online") return "Online"
  return "Offline"
}

/**
 * Status badge colour.
 * Completed - green  |  Cancelled - red  |  Open (placed/in_progress/ready) - blue
 */
function statusClass(status: HistoryOrder["status"]) {
  if (status === "cancelled") return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
  if (status === "completed") return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800"
  // placed / in_progress / ready - order is still open - blue "needs attention"
  return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
}

/**
 * Payment badge colour.
 * Paid - green  |  Pending/Unpaid - amber (needs attention)
 */
function paymentClass(status: HistoryOrder["paymentStatus"]) {
  return status === "paid"
    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800"
    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
}

/** Whether an order needs reconciliation attention (unsettled payment OR not yet completed) */
function needsAttention(order: HistoryOrder) {
  return order.status !== "cancelled" && !(order.status === "completed" && order.paymentStatus === "paid")
}

function canSendReceipt(order: HistoryOrder) {
  return order.paymentStatus === "paid"
}

function receiptStatusLabel(order: HistoryOrder) {
  if (order.status === "cancelled") return "Cancelled order"
  return order.receiptSent ? "Sent" : "Not sent"
}

// -
// Derive canMarkCompleted on the frontend (backend validates independently)
// -

function resolveCanMarkCompleted(order: HistoryOrder): boolean {
  if (typeof order.canMarkCompleted === "boolean") return order.canMarkCompleted
  return order.status === "ready" && !(order.paymentChannel === "offline" && order.paymentStatus !== "paid")
}

function getReconciliationBadge(order: HistoryOrder) {
  if (order.historicalServiceCorrection) {
    return {
      label: "Corrected after review",
      className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700",
    }
  }
  if (order.status === "cancelled") {
    return {
      label: "Cancelled",
      className: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    }
  }
  if (order.status === "completed" && order.paymentStatus !== "paid") {
    return {
      label: order.paymentChannel === "offline" ? "Payment Required" : "Payment Pending",
      className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700",
    }
  }
  if (order.status === "completed") {
    return {
      label: "Completed",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    }
  }
  if (order.canMarkCompleted) {
    return {
      label: "Ready to Complete",
      className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700",
    }
  }
  if (order.reconciliationStatus === "payment_required" || (order.paymentChannel === "offline" && order.paymentStatus !== "paid")) {
    return {
      label: "Payment Required",
      className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700",
    }
  }
  return {
    label: "Review Required",
    className: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-700",
  }
}

// -
// Re-usable sub-components
// -

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-semibold normal-case tracking-normal text-foreground outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground break-words">{value || "-"}</p>
    </div>
  )
}

// -
// Actions Dropdown
// Structured for extensibility - future actions (Void, Refund, etc.) plug in
// as additional ActionItem entries without touching the layout.
// -

type ActionItem =
  | { type: "action"; label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }
  | { type: "separator" }

function ActionsDropdown({ actions, align = "right" }: { actions: ActionItem[]; align?: "right" | "left" }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onOutside)
    return () => document.removeEventListener("mousedown", onOutside)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="gap-1"
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">Actions</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div
          className={`absolute z-50 mt-1.5 w-52 rounded-xl border border-border bg-popover shadow-xl ring-1 ring-black/5 focus:outline-none ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="py-1.5">
            {actions.map((item, i) => {
              if (item.type === "separator") {
                return <hr key={i} className="my-1 border-border" />
              }
              return (
                <button
                  key={i}
                  disabled={item.disabled}
                  onClick={() => {
                    if (!item.disabled) {
                      item.onClick()
                      setOpen(false)
                    }
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors
                    ${item.disabled
                      ? "cursor-not-allowed opacity-40"
                      : item.danger
                      ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      : "text-foreground hover:bg-secondary/60"
                    }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// -
// Page component
// -

export default function WaiterPastOrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuthGuard({ requiredRole: ["waiter", "manager", "owner", "co_owner"] })
  const canReconcileOrders = ["owner", "co_owner"].includes(user?.role || "")
    || Boolean(user?.permissions?.includes("orders.reconcile"))
  const canViewPastOrders = canReconcileOrders
    || Boolean(user?.permissions?.includes("orders.reconciliation.view"))
  const hasViewOnlyAccess = canViewPastOrders && !canReconcileOrders

  // Filter state — range can be seeded from ?range= query param
  const initialStatus = (searchParams.get("status") as OrderStatusFilter) || "all"
  const initialRange = (searchParams.get("range") as DateRange) || (initialStatus === "needs_reconciliation" ? "all" : "yesterday")
  const [range, setRange] = useState<DateRange>(initialRange)
  const [status, setStatus] = useState<OrderStatusFilter>(initialStatus)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>("all")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodFilter>("all")
  const [search, setSearch] = useState("")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [page, setPage] = useState(1)

  // Data state
  const [orders, setOrders] = useState<HistoryOrder[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)

  // Dialog / action state
  const [selectedOrder, setSelectedOrder] = useState<HistoryOrder | null>(null)
  const [reviewOrder, setReviewOrder] = useState<HistoryOrder | null>(null)

  // Send Receipt dialog state
  const [receiptDialogOrder, setReceiptDialogOrder] = useState<HistoryOrder | null>(null)
  const [receiptEmailInput, setReceiptEmailInput] = useState("")
  const [sendingReceipt, setSendingReceipt] = useState(false)

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", [])

  // - Data fetching -

  const fetchOrders = useCallback(async () => {
    if (authLoading) return
    if (!canViewPastOrders) {
      setOrders([])
      setAccessDenied(true)
      setError("You don't have permission to view past orders. Ask your manager or business owner.")
      return
    }
    if (!user?.businessId) return
    if (range === "custom" && (!customFrom || !customTo)) return

    setLoading(true)
    setError(null)
    setAccessDenied(false)

    try {
      const params: Record<string, string | number> = {
        range,
        status,
        paymentStatus,
        paymentMethod,
        search,
        page,
        limit: 25,
      }

      if (range === "custom") {
        params.from = customFrom
        params.to = customTo
      }

      const res = await apiClient.get("/waitstaff/past-orders", { params })
      const raw: HistoryOrder[] = res.data.orders || []

      // Derive canMarkCompleted on the client; backend independently validates
      const enriched = raw.map((o) => ({
        ...o,
        canMarkCompleted: typeof o.canMarkCompleted === "boolean" ? o.canMarkCompleted : resolveCanMarkCompleted(o),
      }))

      setOrders(enriched)
      setPagination((current) => res.data.pagination || current)
    } catch (err: any) {
      console.error("[waiter past orders]", err)
      const denied = err?.response?.status === 401 || err?.response?.status === 403
      setAccessDenied(denied)
      setError(denied
        ? "You don't have permission to view past orders. Ask your manager or business owner."
        : err?.response?.data?.error || "Failed to load past orders")
    } finally {
      setLoading(false)
    }
  }, [authLoading, canViewPastOrders, customFrom, customTo, page, paymentMethod, paymentStatus, range, search, status, user?.businessId])

  useEffect(() => {
    const timeout = window.setTimeout(fetchOrders, search ? 300 : 0)
    return () => window.clearTimeout(timeout)
  }, [fetchOrders, search])

  const resetToFirstPage = () => setPage(1)

  const handleUnifiedReconcile = async (
    order: ReconciliationOrder,
    intent: ReconciliationIntent,
  ): Promise<ReconciliationExecutionResult> => {
    let payment: ReconciliationExecutionResult["payment"] = {
      state: "not_needed",
      message: order.paymentChannel === "online" && order.paymentStatus !== "paid"
        ? "Online payment remains pending provider confirmation."
        : "No payment change was needed.",
    }
    let fulfillment: ReconciliationExecutionResult["fulfillment"] = {
      state: "not_needed",
      message: "No fulfillment change was needed.",
    }
    let persisted: NonNullable<ReconciliationExecutionResult["persisted"]> = {
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
    }

    if (intent.recordOfflinePayment) {
      if (!intent.offlinePaymentMethod) {
        return {
          success: false,
          message: "Choose the verified offline payment method before continuing.",
          payment: { state: "failed", message: "Offline payment was not recorded." },
          fulfillment: { state: "not_attempted", message: "Order completion was not attempted." },
        }
      }
      try {
        const response = await apiClient.patch(`/waitstaff/reconciliation/orders/${order.orderId}/mark-paid`, {
          paidVia: intent.offlinePaymentMethod,
        })
        payment = response.data?.alreadyPaid
          ? { state: "already_recorded", message: "Payment had already been recorded." }
          : { state: "recorded", message: `Offline payment was recorded as ${intent.offlinePaymentMethod === "cash" ? "cash" : "POS card"}.` }
        persisted = {
          ...persisted,
          paymentStatus: response.data?.paymentStatus || "paid",
          reconciledAt: response.data?.reconciliation?.recordedAt || response.data?.paidAt || null,
          reconciledBy: response.data?.reconciliation?.performedBy?.name || null,
        }
      } catch (err: any) {
        const message = err?.response?.data?.message || err?.response?.data?.error || "Unable to record the offline payment."
        await fetchOrders()
        return {
          success: false,
          message,
          payment: { state: "failed", message },
          fulfillment: { state: "not_attempted", message: "Order completion was not attempted." },
          persisted,
        }
      }
    }

    if (intent.completeOrder) {
      try {
        const response = await apiClient.patch(`/orders/${order.orderId}/reconcile-complete`)
        fulfillment = response.data?.replayed
          ? { state: "already_completed", message: "The order was already completed by another authorized action." }
          : { state: "completed", message: "The order handoff was completed using the recorded preparation evidence." }
        persisted = {
          ...persisted,
          orderStatus: response.data?.status || "completed",
          completedAt: response.data?.completedAt || null,
          reconciledAt: response.data?.reconciliation?.recordedAt || response.data?.completedAt || null,
          reconciledBy: response.data?.reconciliation?.performedBy?.name || null,
        }
      } catch (err: any) {
        const message = err?.response?.data?.error || err?.response?.data?.message || "Unable to complete this order."
        fulfillment = { state: "failed", message }
        await fetchOrders()
        return {
          success: false,
          message: payment.state === "recorded" || payment.state === "already_recorded"
            ? `Payment was recorded, but the order was not completed: ${message}`
            : message,
          payment,
          fulfillment,
          persisted,
        }
      }
    } else if (intent.historicalServiceCorrection) {
      try {
        const response = await apiClient.patch(
          `/waitstaff/reconciliation/orders/${order.orderId}/historical-service-correction`,
          { reason: intent.historicalServiceCorrection.reason },
        )
        fulfillment = response.data?.replayed
          ? { state: "historically_corrected", message: "This order had already been reconciled as completed." }
          : { state: "historically_corrected", message: "The order is now completed. Its original preparation history was kept." }
        const reconciliation = response.data?.reconciliationHistory?.at?.(-1)
        persisted = {
          ...persisted,
          orderStatus: response.data?.status || "completed",
          completedAt: response.data?.completedAt || null,
          reconciledAt: reconciliation?.recordedAt || response.data?.historicalServiceCorrection?.confirmedAt || response.data?.completedAt || null,
          reconciledBy: reconciliation?.performedBy?.name || response.data?.historicalServiceCorrection?.confirmedBy?.name || null,
          correctionNote: response.data?.historicalServiceCorrection?.reason || reconciliation?.reason || null,
        }
      } catch (err: any) {
        const message = err?.response?.data?.error || err?.response?.data?.message || "Unable to reconcile this order."
        fulfillment = { state: "failed", message }
        await fetchOrders()
        return {
          success: false,
          message: payment.state === "recorded" || payment.state === "already_recorded"
            ? `Payment was recorded, but the order was not completed: ${message}`
            : message,
          payment,
          fulfillment,
          persisted,
        }
      }
    } else if (intent.recordOfflinePayment) {
      fulfillment = {
        state: "not_attempted",
        message: "The order remains open because preparation has not been recorded as ready.",
      }
    }

    await fetchOrders()
    const fullyCompleted = fulfillment.state === "completed" || fulfillment.state === "already_completed"
    const historicallyCorrected = fulfillment.state === "historically_corrected"
    const paymentRecorded = payment.state === "recorded" || payment.state === "already_recorded"
    return {
      success: fullyCompleted || historicallyCorrected || paymentRecorded,
      message: fullyCompleted
        ? "The permitted reconciliation actions were completed."
        : historicallyCorrected
          ? "The order is now completed. Its original preparation history was kept."
        : paymentRecorded
          ? "Payment was recorded. The order still needs preparation evidence before it can be completed."
          : "No order change was required.",
      payment,
      fulfillment,
      persisted,
    }
  }

  // - Send Receipt -

  const openReceiptDialog = (order: HistoryOrder) => {
    if (!canReconcileOrders || !canSendReceipt(order)) {
      toast.error("You don't have permission to change past orders.")
      return
    }

    setReceiptDialogOrder(order)
    setReceiptEmailInput(order.receiptEmail || "")
  }

  const handleSendReceipt = async () => {
    if (!receiptDialogOrder) return
    if (!canReconcileOrders || !canSendReceipt(receiptDialogOrder)) {
      toast.error("You don't have permission to change past orders.")
      setReceiptDialogOrder(null)
      setReceiptEmailInput("")
      return
    }

    const email = receiptEmailInput.trim()
    if (!email) {
      toast.error("Please enter an email address.")
      return
    }
    setSendingReceipt(true)
    try {
      await apiClient.post(`/orders/${receiptDialogOrder.orderId}/receipt`, { email })
      toast.success(`Receipt sent to ${email}`)
      setReceiptDialogOrder(null)
      await fetchOrders()
    } catch (err: any) {
      console.error("[send receipt]", err)
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to send receipt"
      )
    } finally {
      setSendingReceipt(false)
    }
  }

  // - Build per-row action list -

  function buildActions(order: HistoryOrder): ActionItem[] {
    const receiptActions: ActionItem[] = canReconcileOrders && canSendReceipt(order)
      ? [
          {
            type: "action",
            label: "Send Receipt",
            icon: <Mail className="h-4 w-4 text-purple-600" />,
            onClick: () => openReceiptDialog(order),
          },
        ]
      : []

    const unresolved = needsAttention(order)
    return [
      {
        type: "action",
        label: "View Details",
        icon: <Eye className="h-4 w-4" />,
        onClick: () => setSelectedOrder(order),
      },
      ...(canReconcileOrders && unresolved ? [{
        type: "action" as const,
        label: "Review & Reconcile",
        icon: <AlertTriangle className="h-4 w-4 text-orange-600" />,
        onClick: () => setReviewOrder(order),
      }] : []),
      ...(receiptActions.length > 0 ? [{ type: "separator" as const }, ...receiptActions] : []),
    ]
  }

  // - Auth loading guard -

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!canViewPastOrders) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <section className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-black text-foreground">Past Orders access is not available</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ask your manager or business owner to grant View Reconciliation or Reconcile Past Orders access.
          </p>
          <Button className="mt-5" variant="outline" onClick={() => router.back()}>
            Go back
          </Button>
        </section>
      </main>
    )
  }

  // - Render -

  return (
    <main className="min-h-screen bg-background pb-20">
      {/* - Header - */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <Button variant="outline" size="icon" onClick={() => user?.role === "waiter" ? router.push("/waitstaff") : router.back()} title="Back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-orange-500">Reconciliation Portal</p>
                <h1 className="text-2xl font-black tracking-tight text-foreground">Past Orders</h1>
                <p className="text-sm text-muted-foreground">
                  {hasViewOnlyAccess
                    ? "Review past orders and their recorded details."
                    : "Recover operational mistakes, reconcile payments, and finalize past orders."}
                </p>
                {hasViewOnlyAccess && (
                  <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    View-only access
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={fetchOrders} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* - Filters - */}
          <section className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <FilterSelect
                label="Date"
                value={range}
                options={status === "needs_reconciliation" ? reconciliationDateRanges : dateRanges}
                onChange={(value) => { setRange(value); resetToFirstPage() }}
              />
              <FilterSelect
                label="Status"
                value={status}
                options={statuses}
                onChange={(value) => {
                  setStatus(value)
                  setRange((current) => value === "needs_reconciliation" ? "all" : current === "all" ? "yesterday" : current)
                  resetToFirstPage()
                }}
              />
              <FilterSelect
                label="Payment Status"
                value={paymentStatus}
                options={paymentStatuses}
                onChange={(value) => { setPaymentStatus(value); resetToFirstPage() }}
              />
              <FilterSelect
                label="Payment Method"
                value={paymentMethod}
                options={paymentMethods}
                onChange={(value) => { setPaymentMethod(value); resetToFirstPage() }}
              />
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground md:col-span-2">
                Search
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(event) => { setSearch(event.target.value); resetToFirstPage() }}
                    placeholder="Order number, service point, waiter"
                    className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </label>
            </div>

            {range === "custom" && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
                <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  From
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(event) => { setCustomFrom(event.target.value); resetToFirstPage() }}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  To
                  <input
                    type="date"
                    value={customTo}
                    onChange={(event) => { setCustomTo(event.target.value); resetToFirstPage() }}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              </div>
            )}
          </section>
        </div>
      </header>

      {/* - Main content - */}
      <section className="px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            <p className="text-sm font-semibold">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchOrders}>Retry</Button>
          </div>
        )}

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading orders..." : `${pagination.total} order${pagination.total === 1 ? "" : "s"} found`}
          </p>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </p>
        </div>

        {/* - Desktop table - */}
        <div className="hidden rounded-xl border border-border bg-card shadow-sm lg:block">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-secondary/70 text-[11px] font-black uppercase tracking-widest text-muted-foreground [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl">
              <tr>
                <th className="px-4 py-3 text-left">Order Number</th>
                <th className="px-4 py-3 text-left">Service Point</th>
                <th className="px-4 py-3 text-left">Waitstaff</th>
                <th className="px-4 py-3 text-left">Created At</th>
                <th className="px-4 py-3 text-left">Completed At</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-left">Payment Method</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border [&_tr:last-child_td:first-child]:rounded-bl-[11px] [&_tr:last-child_td:last-child]:rounded-br-[11px]">
              {orders.map((order) => (
                <tr
                  key={order.orderId}
                  className={`bg-card hover:bg-secondary/30 transition-colors ${needsAttention(order) ? "border-l-2 border-l-amber-400" : ""}`}
                >
                  <td className="px-4 py-4 font-black text-foreground">{order.orderId}</td>
                  <td className="px-4 py-4 font-semibold">{order.servicePoint || "-"}</td>
                  <td className="px-4 py-4 text-muted-foreground">{order.waiter || "-"}</td>
                  <td className="px-4 py-4 text-muted-foreground">{formatDateTime(order.createdAt, timezone)}</td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {order.completedAt ? formatDateTime(order.completedAt, timezone) : "-"}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-black uppercase ${paymentClass(order.paymentStatus)}`}>
                      {paymentStatusLabel(order.paymentStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{paymentMethodLabel(order)}</td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-black text-foreground">{formatPrice(order.total || 0, order.currency || "USD")}</p>
                    {Number(order.tipAmount || 0) > 0 && (
                      <p className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Includes {formatPrice(Number(order.tipAmount || 0), order.currency || "USD")} tip
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1 items-start">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClass(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                    {order.reconciliationStatus && order.status !== "cancelled" && !(order.status === "completed" && order.paymentStatus === "paid") && (
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${getReconciliationBadge(order).className}`}>
                        {getReconciliationBadge(order).label}
                      </span>
                    )}
                  </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <ActionsDropdown actions={buildActions(order)} align="right" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* - Mobile cards - */}
        <div className="grid grid-cols-1 gap-4 lg:hidden">
          {orders.map((order) => (
            <article
              key={order.orderId}
              className={`rounded-xl border bg-card p-4 shadow-sm transition-colors ${
                needsAttention(order) ? "border-amber-300 dark:border-amber-700" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{order.servicePoint || "Service Point"}</p>
                  <h2 className="mt-1 text-lg font-black text-foreground">{order.orderId}</h2>
                  {order.waiter && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{order.waiter}</p>
                  )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClass(order.status)}`}>
                  {statusLabel(order.status)}
                  </span>
                  {order.reconciliationStatus && order.status !== "cancelled" && !(order.status === "completed" && order.paymentStatus === "paid") && (
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${getReconciliationBadge(order).className}`}>
                      {getReconciliationBadge(order).label}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <DetailRow label="Created" value={formatDateTime(order.createdAt, timezone)} />
                <DetailRow label="Completed" value={order.completedAt ? formatDateTime(order.completedAt, timezone) : "-"} />
                <DetailRow label="Payment" value={paymentStatusLabel(order.paymentStatus)} />
                <DetailRow label="Method" value={paymentMethodLabel(order)} />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div>
                  <span className="text-xl font-black text-foreground">{formatPrice(order.total || 0, order.currency || "USD")}</span>
                  {Number(order.tipAmount || 0) > 0 && (
                    <p className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Includes {formatPrice(Number(order.tipAmount || 0), order.currency || "USD")} tip
                    </p>
                  )}
                </div>
                <ActionsDropdown actions={buildActions(order)} align="right" />
              </div>
            </article>
          ))}
        </div>

        {/* - Empty state - */}
        {!loading && !error && !accessDenied && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
            <Receipt className="mb-4 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-black text-foreground">No Orders Found</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Try a different date range, payment filter, or search term.</p>
          </div>
        )}

        {/* - Pagination - */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={!pagination.hasPreviousPage || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={!pagination.hasNextPage || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* - View Details Modal - */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-black">
                  <FileText className="h-5 w-5" />
                  Order {selectedOrder.orderId}
                </DialogTitle>
                <DialogDescription>
                  {selectedOrder.servicePoint || "Service point"} - {formatDateTime(selectedOrder.createdAt, timezone)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-5">
                <section className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4 md:grid-cols-4">
                  <DetailRow label="Status" value={statusLabel(selectedOrder.status)} />
                  <DetailRow label="Payment" value={paymentStatusLabel(selectedOrder.paymentStatus)} />
                  <DetailRow label="Method" value={paymentMethodLabel(selectedOrder)} />
                  {Number(selectedOrder.tipAmount || 0) > 0 && (
                    <DetailRow label="Tip" value={formatPrice(Number(selectedOrder.tipAmount || 0), selectedOrder.currency || "USD")} />
                  )}
                  <DetailRow label="Total" value={formatPrice(selectedOrder.total || 0, selectedOrder.currency || "USD")} />
                  {/* Customer email is intentionally omitted - it is optional and not required for reconciliation */}
                  <DetailRow label="Waiter" value={selectedOrder.waiter || "-"} />
                  <DetailRow label="Receipt" value={receiptStatusLabel(selectedOrder)} />
                  <DetailRow label="Completed" value={selectedOrder.completedAt ? formatDateTime(selectedOrder.completedAt, timezone) : "-"} />
                  {selectedOrder.receiptEmail && (
                    <DetailRow label="Receipt Email" value={selectedOrder.receiptEmail} />
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Items Ordered</h3>
                  <div className="rounded-lg border border-border">
                    {selectedOrder.items.map((item, index) => (
                      <div key={`${item.itemName}-${index}`} className="border-b border-border p-3 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-foreground">{item.quantity}x {item.itemName}</p>
                            {item.notes && <p className="mt-1 text-sm text-muted-foreground">Note: {item.notes}</p>}
                            {item.allergies && item.allergies.length > 0 && (
                              <p className="mt-1 text-sm font-semibold text-red-600">Allergies: {item.allergies.join(", ")}</p>
                            )}
                          </div>
                          <p className="font-black text-foreground">{formatPrice(item.lineTotal || 0, selectedOrder.currency || "USD")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Timeline</h3>
                  <div className="space-y-2 rounded-lg border border-border p-4">
                    {selectedOrder.timeline.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No timeline entries available.</p>
                    ) : (
                      selectedOrder.timeline.map((entry, index) => (
                        <div key={`${entry.label}-${index}`} className="flex items-start justify-between gap-4 text-sm">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">
                              {entry.label}{entry.by ? ` by ${entry.by}` : ""}
                            </p>
                            {entry.reason ? <p className="mt-1 text-xs font-normal text-muted-foreground">Correction note: {entry.reason}</p> : null}
                          </div>
                          <span className="text-muted-foreground">{formatDateTime(entry.at, timezone)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              <DialogFooter className="flex-wrap gap-2">
                {canReconcileOrders && canSendReceipt(selectedOrder) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const order = selectedOrder
                      setSelectedOrder(null)
                      openReceiptDialog(order)
                    }}
                  >
                    <Mail className="h-4 w-4" />
                    Send Receipt
                    {selectedOrder.receiptSent && (
                      <span className="ml-1.5 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        Sent
                      </span>
                    )}
                  </Button>
                )}
                {canReconcileOrders && selectedOrder.status !== "cancelled" && !(selectedOrder.status === "completed" && selectedOrder.paymentStatus === "paid") && (
                  <Button
                    onClick={() => {
                      setSelectedOrder(null)
                      setReviewOrder(selectedOrder)
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Review &amp; Reconcile
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* - Send Receipt Dialog - */}
      <Dialog
        open={!!receiptDialogOrder}
        onOpenChange={(open) => {
          if (!open) {
            setReceiptDialogOrder(null)
            setReceiptEmailInput("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black">
              <Mail className="h-5 w-5 text-purple-600" />
              Send Receipt
            </DialogTitle>
            <DialogDescription>
              {receiptDialogOrder?.receiptSent
                ? `A receipt was previously sent for order ${receiptDialogOrder?.orderId}. You can resend it to the same or a different address.`
                : `Enter the customer's email address to send a receipt for order ${receiptDialogOrder?.orderId}.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Email Address
              <input
                type="email"
                value={receiptEmailInput}
                onChange={(e) => setReceiptEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !sendingReceipt && handleSendReceipt()}
                placeholder="customer@example.com"
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
            </label>
            {receiptDialogOrder?.receiptSent && receiptDialogOrder?.receiptEmail && (
              <p className="text-xs text-muted-foreground">
               This receipt was previously sent to:{" "}
                <span className="font-semibold text-foreground">{receiptDialogOrder.receiptEmail}</span>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setReceiptDialogOrder(null); setReceiptEmailInput("") }}
              disabled={sendingReceipt}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendReceipt}
              disabled={sendingReceipt || !receiptEmailInput.trim()}
            >
              {sendingReceipt
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Mail className="h-4 w-4" />
              }
              {sendingReceipt ? "Sending..." : "Send Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderReconciliationDialog
        open={!!reviewOrder}
        order={reviewOrder}
        timezone={timezone}
        canReconcile={canReconcileOrders}
        onOpenChange={(open) => {
          if (!open) setReviewOrder(null)
        }}
        onReconcile={handleUnifiedReconcile}
      />

    </main>
  )
}
