"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  AlertCircle,
  BedDouble,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Copy,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  Loader2,
  ReceiptText,
  Search,
  TrendingUp,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react"
import { toast } from "sonner"

import ReceiptModal from "@/components/receipt-modal"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useBusinessSettings } from "@/contexts/BusinessContext"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import apiClient from "@/lib/axios-config"
import { formatDateTime, formatPrice } from "@/lib/localization"
import type { ServicePoint } from "@/types/service-point"
import type {
  OwnerTransaction,
  TransactionPaidVia,
  TransactionPagination,
  TransactionPaymentChannel,
  TransactionPaymentStatus,
  TransactionSummary,
  TransactionTimeRange,
} from "@/types/transaction"

type TransactionModuleView = "overview" | "lodging" | "foodService"
type DimensionFilter<T extends string> = "all" | T

type BusinessTransactionSettings = {
  currency?: string
  timezone?: string
  name?: string
}

const EMPTY_SUMMARY: TransactionSummary = {
  totalRevenue: 0,
  totalQuickServeFees: 0,
  netRevenue: 0,
  totalTips: 0,
  paidOrders: 0,
  pendingOrders: 0,
  onlinePayments: 0,
  offlinePayments: 0,
}

const EMPTY_PAGINATION: TransactionPagination = {
  nextCursor: null,
  previousCursor: null,
  hasNextPage: false,
  hasPreviousPage: false,
  limit: 25,
  totalCount: 0,
}

const RANGE_LABELS: Record<TransactionTimeRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7days": "Last 7 Days",
  thisMonth: "This Month",
  custom: "Custom",
}

function shortTransactionReference(transaction: OwnerTransaction) {
  const canonicalId = transaction.transactionId || transaction.orderId
  const trailingDigits = canonicalId.match(/(\d{4})$/)?.[1]
  if (trailingDigits) return `#${trailingDigits}`

  const fallback = canonicalId.split("-").filter(Boolean).at(-1) || canonicalId
  return `#${fallback.slice(-4).toUpperCase()}`
}

function paymentStatusLabel(status: TransactionPaymentStatus) {
  return status.replaceAll("_", " ")
}

function paymentMethodLabel(method: TransactionPaidVia | null) {
  switch (method) {
    case "online_card":
      return "Online card"
    case "pos_card":
      return "POS card"
    case "cash":
      return "Cash"
    default:
      return "Not collected"
  }
}

function statusClasses(status: TransactionPaymentStatus) {
  switch (status) {
    case "paid":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
    case "pending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
    case "unpaid":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300"
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
    case "partially_refunded":
      return "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
    case "refunded":
      return "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
  }
}

function statusDotClasses(status: TransactionPaymentStatus) {
  switch (status) {
    case "paid":
      return "bg-emerald-600"
    case "pending":
      return "bg-amber-600"
    case "unpaid":
      return "bg-orange-600"
    case "failed":
      return "bg-red-600"
    case "partially_refunded":
      return "bg-violet-600"
    case "refunded":
      return "bg-slate-600"
  }
}

function StatusBadge({ status }: { status: TransactionPaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold capitalize ${statusClasses(status)}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${statusDotClasses(status)}`}
      />
      {paymentStatusLabel(status)}
    </span>
  )
}

function transactionDisplayAmount(transaction: OwnerTransaction) {
  if (
    Number(transaction.refundedAmountCents || 0) > 0 &&
    typeof transaction.netRetainedAmountCents === "number"
  ) {
    return transaction.netRetainedAmountCents / 100
  }
  return Number(transaction.total || 0)
}

function transactionPlatformFee(transaction: OwnerTransaction) {
  const splitFeeCents =
    Number(transaction.customerPlatformFeeCents || 0) +
    Number(transaction.businessAbsorbedPlatformFeeCents || 0)
  if (splitFeeCents > 0) return splitFeeCents / 100
  if (Number(transaction.platformFeeCents || 0) > 0) {
    return Number(transaction.platformFeeCents) / 100
  }
  if (transaction.platformFeeTotal !== undefined) {
    return Number(transaction.platformFeeTotal || 0)
  }
  return null
}

function TransactionDetailsSheet({
  transaction,
  currency,
  timezone,
  isResendingReceipt,
  onOpenChange,
  onSendReceipt,
  onOpenReceiptModal,
}: {
  transaction: OwnerTransaction | null
  currency: string
  timezone: string
  isResendingReceipt: boolean
  onOpenChange: (open: boolean) => void
  onSendReceipt: (email: string) => void
  onOpenReceiptModal: () => void
}) {
  if (!transaction) return null

  const transactionCurrency = transaction.currency || currency
  const canonicalId = transaction.transactionId || transaction.orderId
  const refundedAmount = Number(transaction.refundedAmountCents || 0)
  const originalPaidAmount =
    typeof transaction.originalAmountPaidCents === "number"
      ? transaction.originalAmountPaidCents / 100
      : Number(transaction.total || 0)
  const retainedAmount = transactionDisplayAmount(transaction)
  const platformFee = transactionPlatformFee(transaction)
  const canSendReceipt =
    transaction.sourceType === "order" && transaction.status !== "cancelled"

  const copyCanonicalId = async () => {
    try {
      await navigator.clipboard.writeText(canonicalId)
      toast.success("Transaction ID copied")
    } catch {
      toast.error("Could not copy the transaction ID")
    }
  }

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-5 py-5 pr-14 text-left">
          <div className="mb-2">
            <StatusBadge status={transaction.paymentStatus} />
          </div>
          <SheetTitle className="text-2xl font-black tracking-tight">
            {shortTransactionReference(transaction)}
          </SheetTitle>
          <SheetDescription asChild>
            <div className="space-y-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-xs">{canonicalId}</span>
                <button
                  type="button"
                  onClick={copyCanonicalId}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Copy transaction ID ${canonicalId}`}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <p>{formatDateTime(transaction.createdAt, timezone)}</p>
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {transaction.paymentReconciliationStatus === "required" && (
            <section
              role="alert"
              aria-label="Payment reconciliation required"
              className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-black">Payment reconciliation required</p>
                  <p className="mt-1 text-sm">
                    {Number(transaction.unexpectedPaymentCount || 0)} unexpected successful payment
                    {Number(transaction.unexpectedPaymentCount || 0) === 1 ? "" : "s"} totaling{" "}
                    {formatPrice(
                      Number(transaction.unexpectedPaymentAmountCents || 0) / 100,
                      transactionCurrency,
                    )}. Review the Stripe payments before taking financial action.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section aria-labelledby="transaction-amount-heading">
            <p
              id="transaction-amount-heading"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              {refundedAmount > 0 ? "Net retained" : "Transaction amount"}
            </p>
            <p className="mt-1 text-4xl font-black tracking-tight">
              {formatPrice(retainedAmount, transactionCurrency)}
            </p>
          </section>

          <div className="my-6 h-px bg-border" />

          <section aria-labelledby="payment-information-heading">
            <h3 id="payment-information-heading" className="font-black">
              Payment information
            </h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd><StatusBadge status={transaction.paymentStatus} /></dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Channel</dt>
                <dd className="font-bold capitalize">{transaction.paymentChannel}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Method</dt>
                <dd className="font-bold">{paymentMethodLabel(transaction.paidVia)}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Service Point</dt>
                <dd className="text-right font-bold">
                  {transaction.servicePointLabel || "Not assigned"}
                </dd>
              </div>
            </dl>
          </section>

          <div className="my-6 h-px bg-border" />

          <section aria-labelledby="financial-breakdown-heading">
            <h3 id="financial-breakdown-heading" className="font-black">
              Financial breakdown
            </h3>
            <dl className="mt-3 space-y-3 text-sm">
              {transaction.subtotal !== undefined && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-bold">
                    {formatPrice(Number(transaction.subtotal || 0), transactionCurrency)}
                  </dd>
                </div>
              )}
              {transaction.taxAmount !== undefined && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {transaction.taxLabel || "Tax"}
                    {transaction.taxRateApplied
                      ? ` (${transaction.taxRateApplied}%)`
                      : ""}
                  </dt>
                  <dd className="font-bold">
                    {formatPrice(Number(transaction.taxAmount || 0), transactionCurrency)}
                  </dd>
                </div>
              )}
              {platformFee !== null && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {transaction.platformFeeLabel || "Platform commission"}
                  </dt>
                  <dd className="font-bold">
                    {formatPrice(platformFee, transactionCurrency)}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Tips</dt>
                <dd className="font-bold">
                  {Number(transaction.tipAmount || 0) > 0
                    ? formatPrice(Number(transaction.tipAmount), transactionCurrency)
                    : "No tip added"}
                </dd>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-bold">
                    {refundedAmount > 0
                      ? "Original amount paid"
                      : ["paid", "partially_refunded", "refunded"].includes(
                            transaction.paymentStatus,
                          )
                        ? "Total paid"
                        : "Transaction total"}
                  </dt>
                  <dd className="font-black">
                    {formatPrice(originalPaidAmount, transactionCurrency)}
                  </dd>
                </div>
              </div>
              {refundedAmount > 0 && (
                <>
                  <div className="flex items-center justify-between gap-4 text-violet-700 dark:text-violet-300">
                    <dt>Total refunded</dt>
                    <dd className="font-bold">
                      -{formatPrice(refundedAmount / 100, transactionCurrency)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <dt className="font-bold">Net retained</dt>
                    <dd className="font-black">
                      {formatPrice(retainedAmount, transactionCurrency)}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </section>

          {Boolean(transaction.refundAdjustments?.length) && (
            <>
              <div className="my-6 h-px bg-border" />
              <section aria-labelledby="refund-adjustments-heading">
                <h3 id="refund-adjustments-heading" className="font-black">
                  Refund adjustments
                </h3>
                <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                  {transaction.refundAdjustments?.map((refund) => (
                    <div
                      key={refund.refundId}
                      className="flex items-start justify-between gap-4 p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-bold capitalize">{refund.type} refund</p>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">
                          {refund.reason.replaceAll("_", " ")}
                          {refund.refundedAt
                            ? ` · ${formatDateTime(refund.refundedAt, timezone)}`
                            : ""}
                        </p>
                      </div>
                      <p className="shrink-0 font-black text-violet-700 dark:text-violet-300">
                        -{formatPrice(refund.amountCents / 100, refund.currency || transactionCurrency)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {Boolean(transaction.items?.length) && (
            <>
              <div className="my-6 h-px bg-border" />
              <section aria-labelledby="transaction-items-heading">
                <h3 id="transaction-items-heading" className="font-black">
                  Items ({transaction.items.length})
                </h3>
                <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                  {transaction.items.map((item, index) => (
                    <li
                      key={`${item.itemName}-${index}`}
                      className="flex items-start justify-between gap-4 p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-bold">
                          {item.quantity} × {item.itemName}
                        </p>
                        {item.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
                        )}
                      </div>
                      <p className="shrink-0 font-bold">
                        {formatPrice(Number(item.lineTotal || 0), transactionCurrency)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          <div className="my-6 h-px bg-border" />

          <section aria-labelledby="service-information-heading">
            <h3 id="service-information-heading" className="font-black">
              Service information
            </h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">Service Point</dt>
                <dd className="text-right font-bold">
                  {transaction.servicePointLabel || "Not assigned"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Service type</dt>
                <dd className="font-bold capitalize">
                  {transaction.orderType?.replaceAll("-", " ") || "Not recorded"}
                </dd>
              </div>
              {transaction.checkInDate && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Check-in</dt>
                  <dd className="font-bold">{transaction.checkInDate}</dd>
                </div>
              )}
              {transaction.checkOutDate && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Check-out</dt>
                  <dd className="font-bold">{transaction.checkOutDate}</dd>
                </div>
              )}
            </dl>
          </section>

          {(transaction.customerName || transaction.receiptEmail) && (
            <>
              <div className="my-6 h-px bg-border" />
              <section aria-labelledby="customer-information-heading">
                <h3 id="customer-information-heading" className="font-black">
                  Customer information
                </h3>
                <dl className="mt-3 space-y-3 text-sm">
                  {transaction.customerName && (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-muted-foreground">Name</dt>
                      <dd className="text-right font-bold">{transaction.customerName}</dd>
                    </div>
                  )}
                  {transaction.receiptEmail && (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="break-all text-right font-bold">
                        {transaction.receiptEmail}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            </>
          )}

          <div className="my-6 h-px bg-border" />

          <section aria-labelledby="receipt-status-heading">
            <h3 id="receipt-status-heading" className="font-black">
              {transaction.sourceType === "reservation"
                ? "Booking confirmation"
                : "Receipt"}
            </h3>
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-border p-3">
              {transaction.receiptEmail &&
              (transaction.receiptSentAt || transaction.receiptSent) ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div>
                <p className="font-bold">
                  {transaction.receiptEmail &&
                  (transaction.receiptSentAt || transaction.receiptSent)
                    ? transaction.sourceType === "reservation"
                      ? "Confirmation sent"
                      : "Receipt sent"
                    : transaction.sourceType === "reservation"
                      ? "No confirmation recorded"
                      : "No receipt sent"}
                </p>
                {transaction.receiptEmail && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {transaction.receiptEmail}
                    {transaction.receiptSentAt
                      ? ` · ${formatDateTime(transaction.receiptSentAt, timezone)}`
                      : ""}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        <SheetFooter className="grid grid-cols-1 gap-3 border-t border-border bg-background p-4 sm:grid-cols-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canSendReceipt && transaction.receiptEmail ? (
            <Button
              disabled={isResendingReceipt}
              onClick={() => onSendReceipt(transaction.receiptEmail!)}
            >
              {isResendingReceipt ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ReceiptText className="h-4 w-4" />
              )}
              Resend Receipt
            </Button>
          ) : canSendReceipt ? (
            <Button onClick={onOpenReceiptModal}>
              <ReceiptText className="h-4 w-4" />
              Send Receipt
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default function TransactionsPage() {
  const { user } = useAuthGuard()
  const {
    businessType,
    modules,
    capabilities,
    currency: businessCurrency,
    timezone: businessTimezone,
  } = useBusinessSettings()

  const [transactions, setTransactions] = useState<OwnerTransaction[]>([])
  const [summary, setSummary] = useState<TransactionSummary>(EMPTY_SUMMARY)
  const [pagination, setPagination] =
    useState<TransactionPagination>(EMPTY_PAGINATION)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [range, setRange] = useState<TransactionTimeRange>("today")
  const [customRange, setCustomRange] = useState({ from: "", to: "" })
  const [tempCustomRange, setTempCustomRange] = useState({ from: "", to: "" })
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] =
    useState<DimensionFilter<TransactionPaymentStatus>>("all")
  const [channelFilter, setChannelFilter] =
    useState<DimensionFilter<TransactionPaymentChannel>>("all")
  const [methodFilter, setMethodFilter] =
    useState<DimensionFilter<TransactionPaidVia>>("all")
  const [servicePointFilter, setServicePointFilter] = useState("all")
  const [transactionModule, setTransactionModule] =
    useState<TransactionModuleView>("overview")
  const [currentPage, setCurrentPage] = useState(1)

  const [selectedTransaction, setSelectedTransaction] =
    useState<OwnerTransaction | null>(null)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [isResendingReceipt, setIsResendingReceipt] = useState(false)
  const [businessSettings, setBusinessSettings] =
    useState<BusinessTransactionSettings | null>(null)
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([])
  const lastTransactionTrigger = useRef<HTMLElement | null>(null)

  const enabledModules = capabilities?.visibleModules || modules
  const isHotel =
    capabilities?.identity.shell === "hotel" || businessType === "hotel"
  const isHybridHotel =
    isHotel &&
    enabledModules.includes("lodging") &&
    enabledModules.includes("foodService")
  const activeTransactionModule = isHybridHotel ? transactionModule : "overview"
  const summaryCurrency = businessSettings?.currency || businessCurrency
  const summaryTimezone = businessSettings?.timezone || businessTimezone

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    statusFilter !== "all" ||
    channelFilter !== "all" ||
    methodFilter !== "all" ||
    servicePointFilter !== "all"
  const activeFilterCount = [
    statusFilter,
    channelFilter,
    methodFilter,
    servicePointFilter,
  ].filter((value) => value !== "all").length

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (!user?.businessId) return

    const loadSupportingData = async () => {
      const [settingsResult, servicePointsResult] = await Promise.allSettled([
        apiClient.get<BusinessTransactionSettings>("/business/settings"),
        apiClient.get<ServicePoint[]>("/owner/service-points"),
      ])

      if (settingsResult.status === "fulfilled") {
        setBusinessSettings(settingsResult.value.data)
      }
      if (servicePointsResult.status === "fulfilled") {
        setServicePoints(
          Array.isArray(servicePointsResult.value.data)
            ? servicePointsResult.value.data
            : [],
        )
      }
    }

    void loadSupportingData()
  }, [user?.businessId])

  const fetchTransactions = useCallback(
    async (options?: {
      cursor?: string
      direction?: "next" | "previous"
      pageNumber?: number
    }) => {
      if (!user?.businessId) return
      if (range === "custom" && (!customRange.from || !customRange.to)) return

      setIsLoading(true)
      setError(null)

      try {
        const queryParams = new URLSearchParams({
          range,
          module: activeTransactionModule,
        })
        if (debouncedSearch) queryParams.set("search", debouncedSearch)
        if (statusFilter !== "all") {
          queryParams.set("paymentStatus", statusFilter)
        }
        if (channelFilter !== "all") {
          queryParams.set("paymentChannel", channelFilter)
        }
        if (methodFilter !== "all") queryParams.set("paidVia", methodFilter)
        if (servicePointFilter !== "all") {
          queryParams.set("servicePoint", servicePointFilter)
        }
        if (range === "custom") {
          queryParams.set("from", customRange.from)
          queryParams.set("to", customRange.to)
        }
        if (options?.cursor) {
          queryParams.set("cursor", options.cursor)
          queryParams.set("direction", options.direction || "next")
        }

        const response = await apiClient.get<{
          transactions: OwnerTransaction[]
          summary: TransactionSummary
          pagination: TransactionPagination
        }>(`/owner/transactions?${queryParams.toString()}`)

        setTransactions(response.data.transactions || [])
        setSummary(response.data.summary || EMPTY_SUMMARY)
        setPagination(response.data.pagination || EMPTY_PAGINATION)
        setCurrentPage(options?.pageNumber || 1)
      } catch (requestError) {
        console.error("Failed to fetch transactions:", requestError)
        setError("Financial activity could not be loaded. Please try again.")
      } finally {
        setIsLoading(false)
      }
    },
    [
      activeTransactionModule,
      channelFilter,
      customRange.from,
      customRange.to,
      debouncedSearch,
      methodFilter,
      range,
      servicePointFilter,
      statusFilter,
      user?.businessId,
    ],
  )

  useEffect(() => {
    void fetchTransactions()
  }, [fetchTransactions])

  const servicePointOptions = useMemo(() => {
    const labels = new Set(
      servicePoints.map((servicePoint) => servicePoint.label).filter(Boolean),
    )
    transactions.forEach((transaction) => {
      if (transaction.servicePointLabel) labels.add(transaction.servicePointLabel)
    })
    return [...labels].sort((first, second) => first.localeCompare(second))
  }, [servicePoints, transactions])

  const clearFilters = () => {
    setSearchQuery("")
    setDebouncedSearch("")
    setStatusFilter("all")
    setChannelFilter("all")
    setMethodFilter("all")
    setServicePointFilter("all")
  }

  const openTransaction = (
    transaction: OwnerTransaction,
    trigger: HTMLElement,
  ) => {
    lastTransactionTrigger.current = trigger
    setSelectedTransaction(transaction)
  }

  const closeTransaction = () => {
    setSelectedTransaction(null)
    window.requestAnimationFrame(() => lastTransactionTrigger.current?.focus())
  }

  const handleSendReceipt = async (email: string) => {
    if (!selectedTransaction) return
    if (selectedTransaction.sourceType === "reservation") {
      toast.info("Hotel booking confirmations are sent automatically after payment.")
      return
    }

    try {
      setIsResendingReceipt(true)
      await apiClient.post(`/orders/${selectedTransaction.orderId}/receipt`, {
        email,
      })
      const receiptSentAt = new Date().toISOString()
      const updateReceipt = (transaction: OwnerTransaction) =>
        transaction.orderId === selectedTransaction.orderId
          ? {
              ...transaction,
              receiptSent: true,
              receiptEmail: email,
              receiptSentAt,
            }
          : transaction

      setSelectedTransaction((current) =>
        current ? updateReceipt(current) : current,
      )
      setTransactions((current) => current.map(updateReceipt))
      setIsReceiptModalOpen(false)
      toast.success("Receipt sent successfully")
    } catch (requestError) {
      console.error("Failed to send receipt:", requestError)
      toast.error("Failed to send receipt. Please try again.")
    } finally {
      setIsResendingReceipt(false)
    }
  }

  const applyCustomRange = () => {
    if (!tempCustomRange.from || !tempCustomRange.to) return
    if (tempCustomRange.from > tempCustomRange.to) {
      toast.error("The start date must be before the end date.")
      return
    }
    setCustomRange(tempCustomRange)
    setRange("custom")
    setShowCustomPicker(false)
  }

  const channelTotal = summary.onlinePayments + summary.offlinePayments
  const onlinePercentage = channelTotal
    ? Math.round((summary.onlinePayments / channelTotal) * 100)
    : 0
  const offlinePercentage = channelTotal ? 100 - onlinePercentage : 0
  const firstVisible = pagination.totalCount
    ? (currentPage - 1) * pagination.limit + 1
    : 0
  const lastVisible = pagination.totalCount
    ? Math.min(firstVisible + transactions.length - 1, pagination.totalCount)
    : 0

  return (
    <div className="min-h-full bg-background pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Transactions
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track payments and financial activity across your business.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
            {(["today", "yesterday", "7days", "thisMonth"] as const).map(
              (period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => {
                    setRange(period)
                    setShowCustomPicker(false)
                  }}
                  aria-pressed={range === period}
                  className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm ${
                    range === period
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {RANGE_LABELS[period]}
                </button>
              ),
            )}
            <Popover open={showCustomPicker} onOpenChange={setShowCustomPicker}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-pressed={range === "custom"}
                  className={`flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm ${
                    range === "custom"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  Custom
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-4">
                <h2 className="font-black">Custom date range</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-bold">
                    From
                    <input
                      type="date"
                      value={tempCustomRange.from}
                      onChange={(event) =>
                        setTempCustomRange((current) => ({
                          ...current,
                          from: event.target.value,
                        }))
                      }
                      className="h-10 rounded-lg border border-input bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold">
                    To
                    <input
                      type="date"
                      value={tempCustomRange.to}
                      onChange={(event) =>
                        setTempCustomRange((current) => ({
                          ...current,
                          to: event.target.value,
                        }))
                      }
                      className="h-10 rounded-lg border border-input bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                </div>
                <Button
                  className="mt-4 w-full"
                  disabled={!tempCustomRange.from || !tempCustomRange.to}
                  onClick={applyCustomRange}
                >
                  Apply range
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>

      {isHybridHotel && (
        <div className="border-b border-border bg-background">
          <div
            className="mx-auto flex max-w-[1600px] gap-1 px-4 pt-3 sm:px-6"
            role="tablist"
            aria-label="Transaction modules"
          >
            {([
              { id: "overview", label: "Overview", icon: LayoutDashboard },
              { id: "lodging", label: "Lodging", icon: BedDouble },
              { id: "foodService", label: "Food Service", icon: UtensilsCrossed },
            ] as const).map((tab) => {
              const Icon = tab.icon
              const isActive = activeTransactionModule === tab.id
              return (
                <button
                  key={tab.id}
                  id={`transactions-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="transactions-module-panel"
                  onClick={() => setTransactionModule(tab.id)}
                  className={`relative flex min-h-11 items-center gap-2 rounded-t-xl px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 ${
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}

      <main
        id={isHybridHotel ? "transactions-module-panel" : undefined}
        role={isHybridHotel ? "tabpanel" : undefined}
        aria-labelledby={
          isHybridHotel ? `transactions-tab-${activeTransactionModule}` : undefined
        }
        className="mx-auto max-w-[1600px] space-y-4 p-4 sm:p-6"
      >
        {error && !isLoading ? (
          <section
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/30"
          >
            <AlertCircle className="mx-auto h-8 w-8 text-red-600" />
            <h2 className="mt-3 font-black">Transactions unavailable</h2>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-4" onClick={() => void fetchTransactions()}>
              Retry
            </Button>
          </section>
        ) : (
          <>
            <section aria-label="Financial summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Gross Revenue",
                  value: summary.totalRevenue,
                  copy: "Before platform fees · excludes tips",
                  icon: WalletCards,
                  iconClass: "bg-orange-50 text-primary dark:bg-orange-950/30",
                },
                {
                  label: "QuickServe Fees",
                  value: summary.totalQuickServeFees,
                  copy: "Platform commission",
                  icon: CreditCard,
                  iconClass: "bg-violet-50 text-violet-600 dark:bg-violet-950/30",
                },
                {
                  label: "Net Revenue",
                  value: summary.netRevenue,
                  copy: "After platform fees",
                  icon: TrendingUp,
                  iconClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30",
                },
                {
                  label: "Tips",
                  value: summary.totalTips,
                  copy: "Collected separately · passed through to staff",
                  icon: HandCoins,
                  iconClass: "bg-blue-50 text-blue-600 dark:bg-blue-950/30",
                },
              ].map((card) => {
                const Icon = card.icon
                return (
                  <article
                    key={card.label}
                    className="flex min-h-32 items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className={`rounded-xl p-2.5 ${card.iconClass}`} aria-hidden="true">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {card.label}
                      </p>
                      {isLoading ? (
                        <Skeleton className="mt-2 h-8 w-28" />
                      ) : (
                        <p className="mt-1 text-2xl font-black tracking-tight">
                          {formatPrice(card.value, summaryCurrency)}
                        </p>
                      )}
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {card.copy}
                      </p>
                    </div>
                  </article>
                )
              })}
            </section>

            <section
              aria-label="Payment activity"
              className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-[0.8fr_1.2fr]"
            >
              <div className="flex items-center gap-3 border-b border-border p-4 lg:border-b-0 lg:border-r">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary" aria-hidden="true">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Transaction activity
                  </p>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-6 w-48" />
                  ) : (
                    <>
                      <p className="mt-1 text-lg font-black">
                        {pagination.totalCount} {pagination.totalCount === 1 ? "transaction" : "transactions"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {summary.paidOrders} captured · {summary.pendingOrders} awaiting payment
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Collection by channel
                </p>
                {isLoading ? (
                  <Skeleton className="mt-3 h-12 w-full" />
                ) : (
                  <>
                    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                      <span className="bg-blue-600" style={{ width: `${onlinePercentage}%` }} />
                      <span className="bg-slate-400" style={{ width: `${offlinePercentage}%` }} />
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
                        <span className="text-muted-foreground">Online</span>
                        <strong>{formatPrice(summary.onlinePayments, summaryCurrency)}</strong>
                        <span className="text-muted-foreground">({onlinePercentage}%)</span>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
                        <span className="text-muted-foreground">Offline</span>
                        <strong>{formatPrice(summary.offlinePayments, summaryCurrency)}</strong>
                        <span className="text-muted-foreground">({offlinePercentage}%)</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="transaction-ledger-heading">
              <div className="border-b border-border p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 id="transaction-ledger-heading" className="text-lg font-black">
                      Transaction ledger
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Find and inspect financial activity in this period.
                    </p>
                  </div>
                  {activeFilterCount > 0 && (
                    <p className="text-xs font-bold text-primary">
                      {activeFilterCount} active {activeFilterCount === 1 ? "filter" : "filters"}
                    </p>
                  )}
                </div>

                <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(18rem,1fr)_repeat(4,minmax(8rem,auto))_auto]">
                  <label className="relative block">
                    <span className="sr-only">Search transactions</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search by transaction ID, customer, or service point..."
                      className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>

                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DimensionFilter<TransactionPaymentStatus>)}>
                    <SelectTrigger className="h-10" aria-label="Filter by payment status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="partially_refunded">Partially refunded</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value as DimensionFilter<TransactionPaymentChannel>)}>
                    <SelectTrigger className="h-10" aria-label="Filter by payment channel">
                      <SelectValue placeholder="Channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All channels</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={methodFilter} onValueChange={(value) => setMethodFilter(value as DimensionFilter<TransactionPaidVia>)}>
                    <SelectTrigger className="h-10" aria-label="Filter by payment method">
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All methods</SelectItem>
                      <SelectItem value="online_card">Online card</SelectItem>
                      <SelectItem value="pos_card">POS card</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={servicePointFilter} onValueChange={setServicePointFilter}>
                    <SelectTrigger className="h-10" aria-label="Filter by service point">
                      <SelectValue placeholder="Service Point" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Service Points</SelectItem>
                      {servicePointOptions.map((label) => (
                        <SelectItem key={label} value={label}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {hasActiveFilters && (
                    <Button variant="ghost" className="h-10" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>

              <div className="hidden lg:block">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-secondary/50 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="w-[25%] px-5 py-3">Transaction</th>
                      <th className="w-[20%] px-5 py-3">Service Point</th>
                      <th className="w-[17%] px-5 py-3">Amount</th>
                      <th className="w-[18%] px-5 py-3">Status</th>
                      <th className="w-[20%] px-5 py-3">Channel / Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoading ? (
                      Array.from({ length: 6 }, (_, index) => (
                        <tr key={index}>
                          <td className="px-5 py-4" colSpan={5}>
                            <Skeleton className="h-10 w-full" />
                          </td>
                        </tr>
                      ))
                    ) : transactions.length ? (
                      transactions.map((transaction) => (
                        <tr
                          key={`${transaction.sourceType}-${transaction.orderId}`}
                          tabIndex={0}
                          aria-label={`Open transaction ${shortTransactionReference(transaction)}`}
                          aria-selected={selectedTransaction?.orderId === transaction.orderId}
                          onClick={(event) => openTransaction(transaction, event.currentTarget)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              openTransaction(transaction, event.currentTarget)
                            }
                          }}
                          className="cursor-pointer outline-none transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-selected:bg-primary/5"
                        >
                          <td className="px-5 py-4">
                            <div className="font-black">{shortTransactionReference(transaction)}</div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {formatDateTime(transaction.createdAt, summaryTimezone)}
                            </div>
                          </td>
                          <td className="truncate px-5 py-4 font-medium text-muted-foreground">
                            {transaction.servicePointLabel || "Not assigned"}
                          </td>
                          <td className="px-5 py-4 text-base font-black">
                            {formatPrice(transactionDisplayAmount(transaction), transaction.currency || summaryCurrency)}
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={transaction.paymentStatus} />
                            {transaction.paymentReconciliationStatus === "required" && (
                              <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                                Reconciliation required
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-bold capitalize">{transaction.paymentChannel}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {paymentMethodLabel(transaction.paidVia)}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-14 text-center">
                          <ReceiptText className="mx-auto h-9 w-9 text-muted-foreground" />
                          <p className="mt-3 font-black">
                            {hasActiveFilters
                              ? "No transactions match these filters."
                              : "No transactions in this period."}
                          </p>
                          {hasActiveFilters && (
                            <Button variant="outline" className="mt-4" onClick={clearFilters}>
                              Clear filters
                            </Button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-border lg:hidden">
                {isLoading ? (
                  Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="p-4"><Skeleton className="h-24 w-full" /></div>
                  ))
                ) : transactions.length ? (
                  transactions.map((transaction) => (
                    <button
                      key={`${transaction.sourceType}-${transaction.orderId}`}
                      type="button"
                      onClick={(event) => openTransaction(transaction, event.currentTarget)}
                      className="grid w-full gap-3 p-4 text-left outline-none transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      aria-label={`Open transaction ${shortTransactionReference(transaction)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-black">{shortTransactionReference(transaction)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(transaction.createdAt, summaryTimezone)}
                          </p>
                        </div>
                        <p className="shrink-0 text-lg font-black">
                          {formatPrice(transactionDisplayAmount(transaction), transaction.currency || summaryCurrency)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <StatusBadge status={transaction.paymentStatus} />
                          {transaction.paymentReconciliationStatus === "required" && (
                            <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                              Reconciliation required
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Service Point</p>
                          <p className="truncate font-bold">
                            {transaction.servicePointLabel || "Not assigned"}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Payment</p>
                          <p className="truncate font-bold capitalize">
                            {transaction.paymentChannel} · {paymentMethodLabel(transaction.paidVia)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-6 py-14 text-center">
                    <ReceiptText className="mx-auto h-9 w-9 text-muted-foreground" />
                    <p className="mt-3 font-black">
                      {hasActiveFilters
                        ? "No transactions match these filters."
                        : "No transactions in this period."}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="outline" className="mt-4" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {!isLoading && pagination.totalCount > 0 && (
                <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-center text-xs font-medium text-muted-foreground sm:text-left">
                    Showing {firstVisible}–{lastVisible} of {pagination.totalCount} transactions
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.hasPreviousPage || isLoading}
                      onClick={() =>
                        void fetchTransactions({
                          cursor: pagination.previousCursor || undefined,
                          direction: "previous",
                          pageNumber: Math.max(1, currentPage - 1),
                        })
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.hasNextPage || isLoading}
                      onClick={() =>
                        void fetchTransactions({
                          cursor: pagination.nextCursor || undefined,
                          direction: "next",
                          pageNumber: currentPage + 1,
                        })
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <TransactionDetailsSheet
        transaction={selectedTransaction}
        currency={summaryCurrency}
        timezone={summaryTimezone}
        isResendingReceipt={isResendingReceipt}
        onOpenChange={(open) => {
          if (!open) closeTransaction()
        }}
        onSendReceipt={(email) => void handleSendReceipt(email)}
        onOpenReceiptModal={() => setIsReceiptModalOpen(true)}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onSend={handleSendReceipt}
        onDecline={() => setIsReceiptModalOpen(false)}
        defaultEmail={selectedTransaction?.receiptEmail || ""}
        businessName={businessSettings?.name || "the business"}
      />
    </div>
  )
}
