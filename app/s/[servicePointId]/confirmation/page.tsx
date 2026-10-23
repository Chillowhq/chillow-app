"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import { CircleCheck as CheckCircle, RotateCcw, QrCode, ClipboardList, Utensils } from "lucide-react"
import ConfirmationLoading from "./loading"
import { apiClient } from "@/lib/axios-config"
import { toast } from "sonner"
import ReceiptModal from "@/components/receipt-modal"
import { formatPrice } from "@/lib/localization"
import { getBusinessId } from "@/lib/business-info"
import { clearJourneyForTable, ensureSessionId, getSessionInstanceId, getTableToken } from "@/lib/guest-session"
import { useCartStore } from "@/store/cart-store"
import { getTableMenuUrl } from "@/lib/customer-routes"
import { useCustomerTheme } from "@/components/providers/customer-theme-provider"
import { OrderConfirmationDetailsSkeleton } from "@/components/customer-loading-skeletons"

function ConfirmationContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const servicePointId = params.servicePointId as string
  const orderId = searchParams.get("orderId")
  const restaurantIdFromUrl = searchParams.get("businessId")
  const clearCart = useCartStore((state) => state.clearCart)
  const clearOrderDetails = useCartStore((state) => state.clearOrderDetails)
  const { useBranding, branding } = useCustomerTheme()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [savedEmail, setSavedEmail] = useState<string | null>(null)
  const [order, setOrder] = useState<any>(null)
  const [businessName, setBusinessName] = useState("the business")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check locally saved email on mount to restore state for UI
    const localEmail = localStorage.getItem("qs_receipt_email")
    if (localEmail) setSavedEmail(localEmail)

    if (!orderId) {
      setIsLoading(false)
      return
    }

    // Since we have an orderId, the payment/order was successful. We can safely clear the cart now.
    clearCart()
    clearOrderDetails()

    // Register this orderId so the notification hook can filter by it.
    // Scoped to the current session instance so old-session order IDs
    // cannot accidentally match a new session on the same service point.
    try {
      const businessId = restaurantIdFromUrl || getBusinessId()
      const sid = getSessionInstanceId(servicePointId)
      if (businessId && servicePointId && sid) {
        const myOrdersKey = `quickserve_my_orders_${businessId}_${servicePointId}_${sid}`
        const stored = localStorage.getItem(myOrdersKey)
        const myOrderIds: string[] = stored ? JSON.parse(stored) : []
        if (!myOrderIds.includes(orderId)) {
          myOrderIds.push(orderId)
          localStorage.setItem(myOrdersKey, JSON.stringify(myOrderIds))
        }
      }
    } catch (e) {
      console.warn("Failed to register orderId for notifications", e)
    }

    const fetchOrder = async () => {
      try {
        // Prefer businessId from URL (set during order creation) for exact match
        const businessId = restaurantIdFromUrl || getBusinessId()
        const sessionId = ensureSessionId()
        const tableSessionToken = getTableToken(servicePointId)
        const [res, bizRes] = await Promise.all([
          apiClient.get(`/orders/${encodeURIComponent(orderId)}`, {
            params: { businessId, sessionId: sessionId || "", scope: "current" },
            headers: tableSessionToken
              ? { "x-table-session-token": tableSessionToken }
              : undefined,
          }),
          apiClient.get(`/public/business-config?businessId=${encodeURIComponent(businessId)}`).catch(() => null)
        ])
        setOrder(res.data)
        if (res.data?.orderType === "takeout" && res.data?.paymentStatus === "paid") {
          clearJourneyForTable(servicePointId)
        }
        if (bizRes?.data?.displayName || bizRes?.data?.name) {
          setBusinessName(bizRes.data.displayName || bizRes.data.name)
        }
      } catch (err: any) {
        console.error("Failed to fetch order", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchOrder()

    const timer = setTimeout(() => {
      const declined = localStorage.getItem("qs_receipt_declined")
      if (!localEmail && !declined) {
        setIsModalOpen(true) // first time — ask once
      } else if (localEmail) {
        // returning user — silent save, no modal
        saveEmailToOrder(localEmail)
      }
    }, 700)

    return () => clearTimeout(timer)
  }, [orderId])

  const saveEmailToOrder = async (email: string) => {
    if (!orderId) return
    try {
      await apiClient.patch(`/orders/${orderId}/receipt-email`, { email, sessionId: ensureSessionId(), marketingConsent: false })
    } catch (err) {
      console.error("Failed to save email for receipt", err)
    }
  }

  const handleSendReceipt = async (email: string, marketingConsent: boolean) => {
    localStorage.setItem("qs_receipt_email", email)
    setSavedEmail(email)
    setIsModalOpen(false)
    if (!orderId) return
    try {
      await apiClient.patch(`/orders/${orderId}/receipt-email`, { email, sessionId: ensureSessionId(), marketingConsent })
    } catch (err) {
      console.error("Failed to save receipt email", err)
      toast.error("Failed to save receipt email. Please try again.")
    }
  }

  const handleDeclineReceipt = () => {
    localStorage.setItem("qs_receipt_declined", "true")
    setIsModalOpen(false)
  }

  // Derive compact summary
  const itemsCount = order?.items?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 0;

  let itemSummaryText = ""
  if (order?.items && order.items.length > 0) {
    const list = order.items.map((i: any) => `${i.quantity}× ${i.itemName}`)
    if (list.length <= 2) {
      itemSummaryText = list.join(", ")
    } else {
      itemSummaryText = `${list[0]}, ${list[1]} + ${list.length - 2} more`
    }
  }

  const tipAmount = Number(order?.tipAmount || 0)

  return (
    <main className="h-[100dvh] w-full bg-gradient-to-br from-background via-background to-secondary/20 flex flex-col justify-between items-center px-4 py-4 sm:py-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 w-full max-w-md relative z-10 flex flex-col items-stretch justify-around">

        {/* Top Section: Icon and Title */}
        <div className="flex flex-col items-center text-center mt-2">
          {/* Spring bounce icon animation using custom cubic-bezier for a natural pop-in bounce */}
          <div className="relative w-20 h-20 bg-gradient-to-br from-primary/20 to-accent/10 rounded-full flex items-center justify-center shadow-xl mb-4 animate-bounce">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-full blur-lg animate-bounce" />
            <CheckCircle className="w-10 h-10 text-primary relative z-10" />
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight mb-1">Order Confirmed!</h1>
          <p className="text-sm text-foreground/70 font-medium">Your order has been placed succesfully</p>
        </div>

        {/* Middle Section: Compact Order Card */}
        {isLoading ? (
          <OrderConfirmationDetailsSkeleton />
        ) : order ? (
          <div className="bg-card border border-border/60 rounded-[1.25rem] p-4 shadow-lg shadow-black/5 w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 my-4">

            {/* Top Row: Order ID & Table */}
            <div className="flex justify-between items-start mb-3 border-b border-border/40 pb-3">
              <div className="flex-1 pr-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black mb-0.5">Order ID</p>
                <p className="font-bold text-sm text-foreground truncate">{order.orderId}</p>
              </div>
              <div className="text-right pl-2 border-l border-border/40">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black mb-0.5">Service point</p>
                <div className="inline-flex items-center justify-center bg-primary/10 text-primary font-black text-sm px-2.5 py-0.5 rounded-lg">
                  {order.displayLabel || servicePointId}
                </div>
              </div>
            </div>

            {/* Middle Row: Items Summary */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Items ({itemsCount})</p>
              </div>
              <p className="text-xs font-semibold text-foreground/85 line-clamp-2 leading-relaxed">
                {itemSummaryText || "No items found"}
              </p>
            </div>

            {/* Bottom Row: Total & Payment */}
            <div className="flex justify-between items-end pt-3 border-t border-border/40 bg-secondary/20 -mx-4 -mb-4 px-4 py-3 rounded-b-[1.25rem]">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black mb-0.5">Status</p>
                <p className={`text-xs font-black uppercase tracking-wider ${order.paymentStatus === 'paid' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  • {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                </p>
              </div>
              <div className="text-right">
                {tipAmount > 0 && (
                  <div className="mb-2 flex items-center justify-end gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Tip</span>
                    <span>{formatPrice(tipAmount, order.currency)}</span>
                  </div>
                )}
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black mb-0.5">Total</p>
                <p className="font-black text-lg text-primary leading-none">
                  {formatPrice(order.total || 0, order.currency)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card/40 border border-destructive/20 rounded-[1.25rem] h-32 flex flex-col items-center justify-center my-4 shadow-sm">
            <p className="text-sm font-bold text-destructive">Could not load order</p>
          </div>
        )}

        {/* Buttons Grid Section */}
        <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <button
            onClick={() => {
              clearCart()
              if (searchParams.get("waiterMode") === "true") {
                router.push("/waitstaff/take-order")
              } else {
                const rId = restaurantIdFromUrl || order?.businessId || getBusinessId()
                // Always navigate to stable menu route — never back to /q/
                router.push(getTableMenuUrl(servicePointId, rId))
              }
            }}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={useBranding ? {
              background: `linear-gradient(to bottom right, ${branding?.primaryColor || '#EA601A'}, ${branding?.accentColor || '#ff8c42'})`,
              color: 'white',
              boxShadow: `0 10px 15px -3px ${branding?.primaryColor ? branding.primaryColor + '33' : 'rgba(234,96,26,0.2)'}`
            } : {
              background: 'linear-gradient(to bottom right, #EA601A, #ff8c42)',
              color: 'white',
              boxShadow: '0 10px 15px -3px rgba(234,96,26,0.2)'
            }}
          >
            <RotateCcw className="w-5 h-5 mb-1.5 opacity-90" />
            <span className="text-[11px] font-black text-center leading-tight tracking-wide">
              {searchParams.get("waiterMode") === "true" ? (
                <>TAKE NEW<br />ORDER</>
              ) : (
                <>EXPLORE<br />MENU</>
              )}
            </span>
          </button>

          {searchParams.get("waiterMode") !== "true" ? (
            <>
              <button
                disabled={!orderId}
                onClick={() => router.push(`/s/${servicePointId}/status?orderId=${encodeURIComponent(orderId!)}&businessId=${encodeURIComponent(restaurantIdFromUrl || getBusinessId())}&scope=current`)}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-card hover:bg-card/80 text-foreground border border-border shadow-sm active:scale-95 transition-all disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ClipboardList className="w-5 h-5 mb-1.5 text-primary opacity-90" />
                <span className="text-[11px] font-bold text-center leading-tight">TRACK<br />ORDER</span>
              </button>

              <button
                onClick={() => router.push(`/s/${servicePointId}/orders`)}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-card hover:bg-card/80 text-foreground border border-border shadow-sm active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Utensils className="w-5 h-5 mb-1.5 text-foreground/70" />
                <span className="text-[11px] font-bold text-center leading-tight">Order<br />History</span>
              </button>

              <button
                onClick={() => router.push("/scan")}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground border-transparent shadow-sm active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <QrCode className="w-5 h-5 mb-1.5 text-foreground/70" />
                <span className="text-[11px] font-bold text-center leading-tight">Scan<br />QR Code</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/waitstaff")}
              className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground border-transparent shadow-sm active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ClipboardList className="w-5 h-5 mb-1.5 text-foreground/70" />
              <span className="text-[11px] font-bold text-center leading-tight">Waiter<br />Dashboard</span>
            </button>
          )}
        </div>

        {/* Bottom Section: Receipt and Help */}
        <div className="mt-4 pt-4 border-t border-border/40 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          {savedEmail ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-2.5 px-3 bg-primary/10 hover:bg-primary/20 rounded-xl border border-primary/20 mb-3 flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
            >
              <span className="text-primary text-sm">✓</span>
              <p className="text-[11px] text-foreground font-semibold truncate">
                Receipt to <span className="font-black text-primary">{savedEmail}</span>
              </p>
            </button>
          ) : (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-3 px-3 bg-secondary/50 hover:bg-secondary text-foreground rounded-xl text-xs font-bold transition-colors border border-border/50 mb-3 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <span>📧</span> Need a receipt? Tap here
            </button>
          )}


        </div>
      </div>

      <ReceiptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSend={handleSendReceipt}
        onDecline={handleDeclineReceipt}
        defaultEmail={savedEmail || ""}
        businessName={businessName}
      />
    </main>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<ConfirmationLoading />}>
      <ConfirmationContent />
    </Suspense>
  )
}
