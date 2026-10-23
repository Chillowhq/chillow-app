"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams, useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, CircleCheck as CheckCircle2, ChefHat, Truck, ClipboardList, CircleAlert as AlertCircle, XCircle } from "lucide-react"
import { apiClient } from "@/lib/axios-config"
import { OrderTimer } from "@/components/order-timer"
import { getCustomerOrderPresentation, getCustomerOrderProgress } from "@/lib/customer-order-progress"
import { formatAbsoluteTime } from "@/lib/order-eta"
import { formatPrice } from "@/lib/localization"
import { getBusinessId } from "@/lib/business-info"
import { getServicePointTerm } from "@/contexts/BusinessContext"
import { FeedbackModal } from "@/components/feedback-modal"
import { useEventSource } from "@/hooks/use-event-source"
import { ensureSessionId, getTableToken, isTableSessionValid } from "@/lib/guest-session"
import ReceiptModal from "@/components/receipt-modal"
import OrderAgainButton from "@/components/order-again-button"
import { toast } from "sonner"
import { OrderStatusSkeleton } from "@/components/customer-loading-skeletons"

export default function TableOrderStatusPage() {
  const router = useRouter()
  const params = useParams()
  const servicePointId = params.servicePointId as string
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId")
  const businessIdFromUrl = searchParams.get("businessId")
  const isHistoricalView = searchParams.get("scope") === "history"

  const [order, setOrder] = useState<any>(null)
  const [restaurant, setRestaurant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [nowMs, setNowMs] = useState(Date.now())
  
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [savedEmail, setSavedEmail] = useState("")

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }

    try {
      const businessId = businessIdFromUrl || getBusinessId()
      const sessionId = ensureSessionId()
      const tableSessionToken = getTableToken(servicePointId)
      const res = await apiClient.get(`/orders/${encodeURIComponent(orderId)}`, {
        params: {
          businessId,
          sessionId: sessionId || "",
          scope: isHistoricalView ? "history" : "current",
        },
        headers: isHistoricalView || !tableSessionToken
          ? undefined
          : { "x-table-session-token": tableSessionToken },
      })
      setOrder(res.data)
      if (res.data.receiptEmail) {
        setSavedEmail(res.data.receiptEmail)
      } else {
        const localEmail = localStorage.getItem("qs_receipt_email")
        if (localEmail) setSavedEmail(localEmail)
      }
    } catch {
      // Keep the last known order on screen if a recovery request fails.
    } finally {
      setLoading(false)
    }
  }, [businessIdFromUrl, isHistoricalView, orderId, servicePointId])

  useEffect(() => {
    if (!orderId) {
      setLoading(false)
      return
    }

    // Fetch restaurant settings once (for callWaiterEnabled)
    apiClient.get(`/public/business-config?businessId=${getBusinessId()}`)
      .then(res => setRestaurant(res.data))
      .catch(() => { })

    void fetchOrder()
  }, [fetchOrder, orderId])

  // ── Real-time SSE Updates ──
  const token = getTableToken(servicePointId)
  const deviceSessionId = ensureSessionId()
  const isSessionValid = isTableSessionValid(servicePointId)
  const activeBusinessId = businessIdFromUrl || getBusinessId()
  const sseUrl = !isHistoricalView && activeBusinessId && deviceSessionId && isSessionValid && token
    ? `/events?role=table&businessId=${encodeURIComponent(activeBusinessId)}&token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(deviceSessionId)}`
    : ""

  useEventSource(
    sseUrl,
    {
      order_updated: (data: any) => {
        const updatedOrder = data?.order
        if (updatedOrder && updatedOrder.orderId === orderId) {
          setOrder(updatedOrder)
          if (updatedOrder.receiptEmail && updatedOrder.receiptEmail !== savedEmail) {
            setSavedEmail(updatedOrder.receiptEmail)
          }
        }
      },
    },
    { onReconnect: fetchOrder },
  )

  const handleSendReceipt = async (email: string, marketingConsent: boolean) => {
    if (isHistoricalView) return
    localStorage.setItem("qs_receipt_email", email)
    setSavedEmail(email)
    setIsReceiptModalOpen(false)
    if (!orderId) return
    try {
      await apiClient.patch(`/orders/${orderId}/receipt-email`, { email, sessionId: ensureSessionId(), marketingConsent })
      toast.success("Receipt changed successfully!")
    } catch (err) {
      console.error("Failed to save receipt email", err)
      toast.error("Failed to change receipt. Please try again.")
    }
  }

  const isCancelled = order?.status === "cancelled"
  const tipAmount = Number(order?.tipAmount || 0)

  const getProgressStep = (status: string) => {
    switch (status) {
      case "placed":     return 1
      case "in_progress": return 2
      case "ready":     return 3
      case "completed": return 4
      default:          return 1
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "placed":      return <Clock className="w-5 h-5" />
      case "in_progress": return <ChefHat className="w-5 h-5" />
      case "ready":       return <Truck className="w-5 h-5" />
      case "completed":   return <CheckCircle2 className="w-5 h-5" />
      case "cancelled":   return <XCircle className="w-5 h-5" />
      default:            return <Clock className="w-5 h-5" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "placed":      return "Order Placed"
      case "in_progress": return "In Progress"
      case "ready":       return "Ready"
      case "completed":   return "Served"
      case "cancelled":   return "Order Cancelled"
      default:            return "Processing"
    }
  }

  // Dynamic table functionality - Handle missing orderId with table-specific back link
  if (!orderId) {
    return (
      <main className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="max-w-2xl mx-auto px-4 py-4">
            {/* Dynamic table back link */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-[var(--brand-primary,var(--color-primary))] hover:opacity-80 transition-opacity duration-200 mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </button>
            <h1 className="text-2xl font-bold text-foreground">Order Status</h1>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Order Selected</h3>
            <p className="text-muted-foreground mb-6">Open Order Status from your confirmation screen.</p>
            {/* Dynamic table back link */}
            <button
              onClick={() => router.back()}
              className="px-6 py-2 bg-[var(--brand-primary,var(--color-primary))] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Back
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (loading)
    return <OrderStatusSkeleton />

  if (!order)
    return (
      <main className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="max-w-2xl mx-auto px-4 py-4">
            {/* Dynamic table back link */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-[var(--brand-primary,var(--color-primary))] hover:opacity-80 transition-opacity duration-200 mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </button>
            <h1 className="text-2xl font-bold text-foreground">Order Status</h1>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Order Not Found</h3>
            <p className="text-muted-foreground mb-6">We could not retrieve your order details.</p>
            {/* Dynamic table back link */}
            <button
              onClick={() => router.back()}
              className="px-6 py-2 bg-[var(--brand-primary,var(--color-primary))] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Back
            </button>
          </div>
        </div>
      </main>
    )

  const displayItems = order.items.map((it: any) => `${it.quantity} × ${it.itemName}`)

  // --- Derived Categorization ---
  const getItemCategory = (item: any) => {
    if (item.type) return item.type
    if (item.orderCategory) return item.orderCategory
    return "food"
  }

  const foodItems = order.items?.filter((i: any) => getItemCategory(i) === "food") || []
  const drinkItems = order.items?.filter((i: any) => getItemCategory(i) === "drinks") || []
  const hasDrinks = drinkItems.length > 0
  const hasMixedOrder = foodItems.length > 0 && drinkItems.length > 0
  const isLegacy = foodItems.length === 0 && drinkItems.length === 0 && order.items.length > 0

  const displayServicePoint = order?.displayLabel || order?.servicePointLabel
  const term = getServicePointTerm(restaurant?.capabilities)
  const customerProgress = getCustomerOrderProgress(order)
  const presentation = getCustomerOrderPresentation(customerProgress, nowMs)
  const stationEtas = presentation.stationEtas

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* Dynamic table back link */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[var(--brand-primary,var(--color-primary))] hover:opacity-80 transition-opacity duration-200 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold text-foreground">{isHistoricalView ? "Order Details" : "Order Status"}</h1>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 sm:py-8">
        <div className="bg-card rounded-[1.5rem] p-5 sm:p-8 border border-border shadow-xl shadow-black/5">

          {/* Top Section: Header & Payment */}
          <div className="flex justify-between items-start mb-8 pb-6 border-b border-border/40">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black mb-1">Order ID</p>
              <h3 className="font-bold text-lg text-foreground tracking-tight mb-3">{order.orderId}</h3>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center bg-[var(--brand-muted,var(--primary))] text-[var(--brand-primary,var(--color-primary))] font-black text-xs px-2.5 py-1 rounded-lg">
                  {displayServicePoint ? `${displayServicePoint}` : term.singular}
                </div>
                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">

                  <OrderTimer createdAt={order.createdAt} />
                </div>
              </div>
            </div>

            <div className="text-right flex flex-col items-end">
              <p className="text-[10px] uppercase tracking-widest text-muted-
              foreground font-black mb-1">Total</p>
              <p className="font-black text-2xl text-[var(--brand-primary,var(--color-primary))] leading-none tracking-tight mb-2.5">
                {formatPrice(order.total || 0, order.currency)}
              </p>
              {tipAmount > 0 && (
                <p className="mb-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Tip {formatPrice(tipAmount, order.currency)}
                </p>
              )}
              <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${order.paymentStatus === 'paid' ? 'bg-green-500' : 'bg-amber-500'}`} />
                {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
              </div>
            </div>
          </div>

          <div className="mb-8 pb-8 border-b border-border/40">
            <p className="text-[10px] font-black text-muted-foreground mb-6 uppercase tracking-widest text-center">Order Progress</p>

            {/* Cancelled — replace progress tracker entirely */}
            {isCancelled ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-full flex items-center justify-center gap-3 sm:gap-4">
                  {/* Placed */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--brand-primary,var(--color-primary))] flex items-center justify-center text-white shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">Placed</span>
                  </div>

                  <div className="h-0.5 w-8 sm:w-12 bg-border rounded-full shrink-0" />

                  {/* Cancelled */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                      <XCircle className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">Cancelled</span>
                  </div>
                </div>
                {/* Explanation card */}
                <div className="w-full mt-2 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400 text-center leading-relaxed">
                    This order was cancelled before preparation began.
                  </p>
                  {order.paymentStatus !== "paid" && (
                    <p className="text-xs text-red-600/70 dark:text-red-400/70 text-center mt-1">
                      No payment has been taken.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              // Standard Layout
              <div className="flex items-center justify-between">
                {/* Step 1 */}
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 shadow-sm transition-colors ${getProgressStep(order.status) >= 1 ? "bg-[var(--brand-primary,var(--color-primary))] text-white" : "bg-card border-2 border-border text-muted-foreground"}`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-medium text-center text-foreground">Placed</p>
                </div>

                <div
                  className={`flex-1 h-1 mx-1 rounded-full ${getProgressStep(order.status) >= 2 ? "bg-[var(--brand-primary,var(--color-primary))]" : "bg-secondary"}`}
                />

                {/* Step 2 */}
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 shadow-sm transition-colors ${getProgressStep(order.status) >= 2 ? "bg-[var(--brand-primary,var(--color-primary))] text-white" : "bg-card border-2 border-border text-muted-foreground"}`}
                  >
                    <ChefHat className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-medium text-center text-foreground">In Progress</p>
                </div>

                <div
                  className={`flex-1 h-1 mx-1 rounded-full ${getProgressStep(order.status) >= 3 ? "bg-[var(--brand-primary,var(--color-primary))]" : "bg-secondary"}`}
                />

                {/* Step 3 */}
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 shadow-sm transition-colors ${getProgressStep(order.status) >= 3 ? "bg-[var(--brand-primary,var(--color-primary))] text-white" : "bg-card border-2 border-border text-muted-foreground"}`}
                  >
                    <Truck className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-medium text-center text-foreground">Ready</p>
                </div>

                <div
                  className={`flex-1 h-1 mx-1 rounded-full ${getProgressStep(order.status) >= 4 ? "bg-[var(--brand-primary,var(--color-primary))]" : "bg-secondary"}`}
                />

                {/* Step 4 */}
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 shadow-sm transition-colors ${getProgressStep(order.status) >= 4 ? "bg-[var(--brand-primary,var(--color-primary))] text-white" : "bg-card border-2 border-border text-muted-foreground"}`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-medium text-center text-foreground">Served</p>
                </div>
              </div>
            )}
          </div>

          {/* Status pill — hidden for cancelled (cancellation card above is sufficient) */}
          {!isCancelled && (
            <div className="mb-8 space-y-3">
              <div
                className={`flex items-center justify-center gap-3 w-full py-3 rounded-xl font-bold text-sm shadow-sm border border-transparent ${order.status === 'completed' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/50' : order.status === 'ready' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50' : order.status === 'in_progress' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50' : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50'}`}
              >
                {getStatusIcon(order.status)}
                <span className="tracking-wide">{getStatusText(order.status)}</span>
              </div>
              <p className="text-center text-sm font-semibold leading-relaxed text-muted-foreground">
                {presentation.headline}
              </p>
              {presentation.secondaryMessage && (
                <p className="text-center text-sm font-medium leading-relaxed text-muted-foreground">
                  {presentation.secondaryMessage}
                </p>
              )}
              {presentation.overallEstimatedReadyAt && (
                <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1">
                  <Clock className="h-3 w-3 text-[var(--brand-primary,var(--color-primary))]" />
                  <span className="text-xs font-bold text-foreground">
                    Expected around {formatAbsoluteTime(new Date(presentation.overallEstimatedReadyAt))}
                  </span>
                </div>
              )}
              {stationEtas.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {stationEtas.map((eta) => (
                    <div
                      key={eta.key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1"
                    >
                      <Clock className="h-3 w-3 text-[var(--brand-primary,var(--color-primary))]" />
                      <span className="text-xs font-bold text-foreground">{eta.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-b border-border/40 pb-6 mb-6">

            {/* Food items */}
            {foodItems.length > 0 && (
              <div className="mb-6 last:mb-0">
                {hasMixedOrder ? (
                  <p className="text-[10px] font-black text-muted-foreground mb-4 uppercase tracking-widest pl-1">
                    🍕 Food Items
                  </p>
                ) : (
                  <p className="text-[10px] font-black text-muted-foreground mb-4 uppercase tracking-widest pl-1">
                    Order Items
                  </p>
                )}
                <ul className="space-y-3">
                  {foodItems.map((item: any, index: number) => (
                    <li key={index} className="text-sm font-semibold text-foreground flex items-center gap-4 bg-secondary/30 p-2.5 rounded-[1rem]">
                      <span className="shrink-0 w-8 h-8 rounded-lg bg-card border border-border/50 shadow-sm flex items-center justify-center text-xs font-black text-[var(--brand-primary,var(--color-primary))]">{item.quantity}</span>
                      <span className="leading-tight">{item.itemName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Drink items */}
            {hasDrinks && (
              <div className={hasMixedOrder ? "mb-6 last:mb-0 bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-[1.25rem] border border-blue-100 dark:border-blue-900/30" : "mb-6 last:mb-0"}>
                {hasMixedOrder && (
                  <p className="text-[10px] font-black text-blue-700 dark:text-blue-400 mb-4 uppercase tracking-widest pl-1">
                    🍺 Drinks
                  </p>
                )}
                <ul className="space-y-3">
                  {drinkItems.map((item: any, index: number) => (
                    <li key={index} className="text-sm font-semibold text-foreground flex items-center gap-4 bg-card p-2.5 rounded-[1rem] shadow-sm border border-border/40">
                      <span className="shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-black text-blue-700 dark:text-blue-400">{item.quantity}</span>
                      <span className="leading-tight">{item.itemName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Fallback */}
            {isLegacy && (
              <ul className="space-y-3">
                {displayItems.map((item: string, index: number) => {
                  const [qty, ...nameParts] = item.split(" × ")
                  return (
                    <li key={index} className="text-sm font-semibold text-foreground flex items-center gap-4 bg-secondary/30 p-2.5 rounded-[1rem]">
                      <span className="shrink-0 w-8 h-8 rounded-lg bg-card border border-border/50 shadow-sm flex items-center justify-center text-xs font-black text-[var(--brand-primary,var(--color-primary))]">{qty}</span>
                      <span className="leading-tight">{nameParts.join(" × ")}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Receipt Section — hidden for cancelled orders */}
          {!isHistoricalView && !isCancelled && <div className="border-b border-border/40 pb-6 mb-6">
            <p className="text-[10px] font-black text-muted-foreground mb-3 uppercase tracking-widest pl-1">Receipt</p>
            {savedEmail ? (
              <div className="bg-secondary/30 p-4 rounded-[1rem] flex items-center justify-between border border-border/40">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground font-semibold mb-0.5">Sent to</p>
                    <p className="text-sm font-bold text-foreground">{savedEmail}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsReceiptModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-bold text-[var(--brand-primary,var(--color-primary))] bg-[var(--brand-muted,var(--primary))] rounded-lg hover:opacity-80 transition-opacity"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsReceiptModalOpen(true)}
                className="w-full bg-secondary/50 hover:bg-secondary border border-border p-4 rounded-[1rem] flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center text-foreground group-hover:scale-110 transition-transform">
                    📧
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Need a receipt?</p>
                    <p className="text-xs text-muted-foreground">Tap here to enter your email</p>
                  </div>
                </div>
                <span className="text-[var(--brand-primary,var(--color-primary))] font-black text-lg">→</span>
              </button>
            )}
          </div>}

          <div className="pt-2 text-center flex flex-col items-center gap-4">
            {!isHistoricalView && <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Assistance</p>
              <p className="text-xs text-muted-foreground font-medium max-w-[250px] mx-auto leading-relaxed">
                Your order is linked to {displayServicePoint ? `${displayServicePoint}` : `your ${term.lower}`}. Please remain seated.
              </p>
            </div>}
            
            {!isHistoricalView && order.status === "completed" && !order.feedbackSubmitted && (
              <button 
                onClick={() => setIsFeedbackModalOpen(true)}
                className="mt-4 px-6 py-2 bg-[var(--brand-muted,var(--primary))] text-[var(--brand-primary,var(--color-primary))] font-bold rounded-xl hover:opacity-80 transition-opacity text-sm flex items-center gap-2"
              >
                <span>⭐</span> Leave Feedback
              </button>
            )}

            {/* Order Again — not shown for cancelled orders */}
            {!isCancelled && (
              <OrderAgainButton
                orderId={order.orderId}
                servicePointId={servicePointId}
                className="mt-2"
              />
            )}
          </div>
        </div>
      </div>

      {order && (
        <>
          {!isHistoricalView && <FeedbackModal
            isOpen={isFeedbackModalOpen}
            setIsOpen={setIsFeedbackModalOpen}
            orderId={order.orderId}
            businessId={order.businessId}
            onSubmitted={() => {
              setOrder((prev: any) => ({ ...prev, feedbackSubmitted: true }))
            }}
            reservationUrl={restaurant?.slug && restaurant?.countryCode ? `/reserve/${restaurant.countryCode.toLowerCase()}/${restaurant.slug}` : undefined}
            businessName={restaurant?.displayName || restaurant?.name}
          />}
          {!isHistoricalView && <ReceiptModal
            isOpen={isReceiptModalOpen}
            onClose={() => setIsReceiptModalOpen(false)}
            onSend={handleSendReceipt}
            onDecline={() => setIsReceiptModalOpen(false)}
            defaultEmail={savedEmail || ""}
            businessName={restaurant?.displayName || restaurant?.name || "the restaurant"}
          />}
        </>
      )}
    </main>
  )
}
