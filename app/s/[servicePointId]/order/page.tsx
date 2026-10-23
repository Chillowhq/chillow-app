"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, Trash2, Plus, Minus } from "lucide-react"
import { useCartStore } from "@/store/cart-store"
import AllergySelector from "@/components/allergy-selector"
import OrderTypeSelector from "@/components/order-type-selector"
import TipSelector, { type TipState } from "@/components/tip-selector"
import { apiClient } from "@/lib/axios-config"
import {
  ensureSessionId,
  getTableToken,
  clearTableToken,
  getJourneyId,
  saveJourneyForTable,
} from "@/lib/guest-session"
import { toast } from "sonner"
import { getBusinessId } from "@/lib/business-info"
import { MenuItem } from "@/app/owner/menu/page"
import { formatPrice } from "@/lib/localization"
import { getServicePointTerm } from "@/contexts/BusinessContext"
import { getMenuImageSrc, setFallbackMenuImage } from "@/lib/menu-image"
import { calculateCheckoutEstimate } from "@/lib/checkout-pricing"
import { OrderSummarySkeleton } from "@/components/customer-loading-skeletons"

type PaymentChannel = "online" | "offline"

export default function TableOrderPage() {
  const params = useParams()
  const servicePointId = params.servicePointId as string
  const searchParams = useSearchParams()
  const isLegacyWaiterUrl = searchParams.get("waiterMode") === "true"

  const [isHydrated, setIsHydrated] = useState(false)
  const [loadingAction, setLoadingAction] = useState<PaymentChannel | null>(null)
  const [isFetchingData, setIsFetchingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<any>(null)
  const [tip, setTip] = useState<TipState>({ amount: 0, type: null, percentage: null })
  const orderIdempotencyKeys = useRef<Partial<Record<PaymentChannel, string>>>({})

  // Local menu data for lookup
  const [, setMenuItems] = useState<MenuItem[]>([])

  const { items, removeItem, setItemQuantity, clearCart, allergies, specialNotes, clearOrderDetails, orderType, ensureContext } =
    useCartStore()
  const router = useRouter()

  useEffect(() => {
    setIsHydrated(true)
    if (isLegacyWaiterUrl) {
      router.replace(`/waitstaff/take-order/${servicePointId}/checkout`)
      return
    }
    fetchData()
  }, [isLegacyWaiterUrl, router, servicePointId])

  useEffect(() => {
    orderIdempotencyKeys.current = {}
  }, [items, allergies, specialNotes, orderType, tip])

  const fetchData = async () => {
    setIsFetchingData(true)
    try {
      const rid = getBusinessId()
      if (!rid) {
        setError("Business context is unavailable. Please return to the menu.")
        return
      }
      ensureContext({ actor: "customer", businessId: rid, servicePointId })
      // Fetch settings and menu items in parallel
      const [settingsRes, menuRes] = await Promise.all([
        apiClient.get(`/public/business-config?businessId=${rid}`),
        apiClient.get(`/menu-items?businessId=${rid}`)
      ])

      setRestaurant(settingsRes.data)

      const normalized = menuRes.data.map((item: any) => ({
        ...item,
        id: item._id,
        image: item.imageUrl,
        orderCategory: item.type
      }))
      setMenuItems(normalized)
    } catch (err) {
      console.error("Failed to load data for order page", err)
    } finally {
      setIsFetchingData(false)
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tipsEnabled = restaurant?.settings?.tipsEnabled === true || restaurant?.tipsEnabled === true
  const tipAmount = tipsEnabled ? tip.amount : 0
  const { tax, platformFee, total } = calculateCheckoutEstimate({
    subtotal,
    business: restaurant,
    tipAmount,
  })

  useEffect(() => {
    if (!tipsEnabled && tip.amount > 0) {
      setTip({ amount: 0, type: null, percentage: null })
      return
    }

    if (tipsEnabled && tip.type === "percentage" && tip.percentage) {
      const nextAmount = Math.max(0, Math.round(subtotal * (tip.percentage / 100) * 100) / 100)
      if (nextAmount !== tip.amount) {
        setTip({ amount: nextAmount, type: "percentage", percentage: tip.percentage })
      }
    }
  }, [tipsEnabled, subtotal, tip.amount, tip.percentage, tip.type])

  const handlePlaceOrder = async (channel: PaymentChannel) => {
    setLoadingAction(channel)
    setError(null)

    // Validate order type selection
    if (!orderType) {
      setError("Please choose a service type — Dine-In or Takeout.")
      setLoadingAction(null)
      return
    }

    try {
      const sessionId = ensureSessionId()
      const st = getTableToken(servicePointId)

      if (!sessionId) {
        setError("Session not available. Please refresh the page.")
        setLoadingAction(null)
        return
      }

      if (!st) {
        setError("Session expired or missing. Please rescan the QR code.")
        setLoadingAction(null)
        return
      }

      const cartItems = items.map((item) => ({
        itemName: item.name,
        quantity: item.quantity,
        price: item.price,          // used by paymentController for Stripe line items
        orderCategory: item.orderCategory,
        notes: specialNotes || "",
        allergies: allergies || [],
        image: item.image || "",
      }))

      // ── ONLINE: Stripe Checkout ──────────────────────────────────────────────
      if (channel === "online") {
        const existingEmail = localStorage.getItem("qs_receipt_email")
        
        const journeyId = getJourneyId(servicePointId)
        const payload: any = {
          servicePointId,
          tableSessionToken: st,
          sessionId,
          journeyId,
          orderType: orderType,
          items: cartItems,
          currency: restaurant?.currency || "USD",
          tipAmount: Number(tipAmount.toFixed(2)),
          tipType: tipAmount > 0 ? tip.type : null,
          tipPercentage: tipAmount > 0 && tip.type === "percentage" ? tip.percentage : null,
        }
        
        if (existingEmail) {
          payload.receiptEmail = existingEmail
        }

        const idempotencyKey = orderIdempotencyKeys.current.online || crypto.randomUUID()
        orderIdempotencyKeys.current.online = idempotencyKey
        const response = await apiClient.post("/payments/checkout", payload, {
          headers: { "Idempotency-Key": idempotencyKey },
        })

        const { sessionUrl, journeyId: resolvedJourneyId } = response.data
        if (resolvedJourneyId) {
          saveJourneyForTable(servicePointId, resolvedJourneyId)
        }

        // Hard redirect to Stripe-hosted checkout page
        // We do NOT clear the cart here, so it's preserved if the user cancels.
        window.location.href = sessionUrl
        // Keep the clicked action pending because the page is navigating away.
        return
      }

      // ── OFFLINE: Pay later (cash / POS card) ────────────────────────────────
      const existingEmail = localStorage.getItem("qs_receipt_email")
      const rid = getBusinessId()
      const journeyId = getJourneyId(servicePointId)
      const orderData: any = {
        servicePointId,
        tableSessionToken: st,
        sessionId,
        journeyId,
        orderType: orderType,
        paymentChannel: "offline",
        paymentStatus: "unpaid",
        paidVia: null,
        businessId: rid,
        items: cartItems.map((item) => ({
          ...item,
          unitPrice: item.price,
        })),
        total: Number(total.toFixed(2)),
        currency: restaurant?.currency || "USD",
        tipAmount: Number(tipAmount.toFixed(2)),
        tipType: tipAmount > 0 ? tip.type : null,
        tipPercentage: tipAmount > 0 && tip.type === "percentage" ? tip.percentage : null,
      }

      if (existingEmail) {
        orderData.receiptEmail = existingEmail
      }

      const idempotencyKey = orderIdempotencyKeys.current.offline || crypto.randomUUID()
      orderIdempotencyKeys.current.offline = idempotencyKey
      const response = await apiClient.post("/orders", orderData, {
        headers: { "Idempotency-Key": idempotencyKey },
      })
      const {
        orderId,
        businessId: savedRestaurantId,
        journeyId: resolvedJourneyId,
      } = response.data
      if (resolvedJourneyId) {
        saveJourneyForTable(servicePointId, resolvedJourneyId)
      }

      toast.success("Order sent. You are required to pay later with cash or POS (card).", { duration: 4000 })

      const confirmUrl = `/s/${servicePointId}/confirmation?orderId=${encodeURIComponent(orderId)}&businessId=${encodeURIComponent(savedRestaurantId || rid)}`
      router.replace(confirmUrl)

      setTimeout(() => {
        clearCart()
        clearOrderDetails()
      }, 0)
    } catch (err: any) {
      console.error("Error placing order:", err)
      const status = err?.response?.status
      const data = err?.response?.data

      if (status === 403) {
        clearTableToken(servicePointId)
        const term = getServicePointTerm(restaurant?.capabilities)
        const base = data?.error || data?.message || `${term.singular} session expired or invalid.`
        setError(`${base} Please rescan the QR code.`)
      } else if ((status === 400 || status === 409) && Array.isArray(data?.items) && data.items.length > 0) {
        // Structured stock validation failure from backend
        const lines = data.items.map((f: any) =>
          f.available === 0
            ? `• ${f.itemName} is sold out`
            : `• ${f.itemName} — Only ${f.available} available`
        )
        setError(
          data.items.length === 1
            ? lines[0].replace("• ", "")
            : `Some items are no longer available:\n${lines.join("\n")}`
        )
      } else {
        setError(data?.error || data?.message || "Failed to place order. Please try again.")
      }

      if (status && status >= 400 && status < 500) {
        orderIdempotencyKeys.current[channel] = undefined
      }

      setLoadingAction(null)
    }
  }


  if (isLegacyWaiterUrl || !isHydrated || isFetchingData) {
    return <OrderSummarySkeleton />
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[var(--brand-primary,var(--color-primary))] hover:opacity-80 transition-opacity duration-200 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold text-foreground">Order Summary</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <span className="text-3xl">🛒</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Cart is empty</h3>
            <p className="text-muted-foreground mb-6">Add items from the menu to get started</p>
            <button
              onClick={() => router.back()}
              className="px-6 py-2 bg-[var(--brand-primary,var(--color-primary))] text-white rounded-lg font-medium hover:opacity-90 transition-opacity duration-200"
            >
              Continue your order
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-8">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-card rounded-xl p-4 border border-border flex items-start justify-between gap-4 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="w-14 h-14 flex-shrink-0 rounded-md overflow-hidden bg-secondary flex items-center justify-center">
                    <img
                      src={getMenuImageSrc(item.image)}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(event) => setFallbackMenuImage(event.currentTarget)}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground mb-1 truncate">{item.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{formatPrice(item.price, restaurant?.currency)} each</p>
                    <div className="flex items-center gap-2 bg-secondary rounded-lg p-1 w-fit">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 hover:bg-background rounded transition-colors duration-200"
                      >
                        <Minus className="w-4 h-4 text-foreground" />
                      </button>
                      <span className="w-6 text-center font-semibold text-foreground text-sm">{item.quantity}</span>
                      <button
                        onClick={() => setItemQuantity(item.id, item.quantity + 1)}
                        className="p-1 hover:bg-background rounded transition-colors duration-200"
                      >
                        <Plus className="w-4 h-4 text-foreground" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-[var(--brand-primary,var(--color-primary))] mb-3">{formatPrice(item.price * item.quantity, restaurant?.currency)}</p>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 hover:bg-destructive/10 rounded-lg transition-colors duration-200 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <OrderTypeSelector
              dineInEnabled={restaurant?.orderingPreferences?.dineInEnabled ?? true}
              takeoutEnabled={restaurant?.orderingPreferences?.takeoutEnabled ?? true}
            />

            <AllergySelector />

            {tipsEnabled && (
              <div className="my-8">
                <TipSelector
                  subtotal={subtotal}
                  currency={restaurant?.currency}
                  value={tip}
                  onChange={setTip}
                />
              </div>
            )}

            <div className="bg-card rounded-xl p-6 border border-border my-8 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">{formatPrice(subtotal, restaurant?.currency)}</span>
              </div>

              {platformFee > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{restaurant.platformFeeLabel || "Platform Fee"}</span>
                  <span className="text-foreground">{formatPrice(platformFee, restaurant?.currency)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Tax ({restaurant?.taxRate || 0}%)</span>
                <span className="text-foreground">{formatPrice(tax, restaurant?.currency)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Tip</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(tipAmount, restaurant?.currency)}</span>
                </div>
              )}
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-2xl font-bold text-[var(--brand-primary,var(--color-primary))]">{formatPrice(total, restaurant?.currency)}</span>
              </div>
            </div>

            <div className="space-y-3 pb-8">
              {error && (
                <div className="bg-destructive/10 border border-destructive rounded-lg p-3">
                  <p className="text-destructive text-sm font-medium">{error}</p>

                  {/* ✅ optional: rescan button (recommended) */}
                  {error.toLowerCase().includes("rescan") && (
                    <button
                      onClick={() => {
                        router.push("/scan")
                      }}
                      className="mt-3 w-full bg-card border border-border rounded-lg py-2 text-sm font-semibold hover:bg-secondary transition"
                    >
                      Rescan QR
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {(() => {
                  const showOnline = restaurant?.paymentPreferences?.acceptOnlinePayments ?? true;
                  const showOfflineSetting = restaurant?.paymentPreferences?.acceptOfflinePayments ?? true;
                  const offlineAvailable = restaurant?.offlinePaymentsAvailable ?? true; // Default true if backend not updated

                  if (!showOnline && showOfflineSetting && !offlineAvailable) {
                    return (
                      <div className="w-full bg-secondary/50 border border-border text-muted-foreground rounded-xl py-4 px-4 font-semibold text-center text-sm">
                        Payment is currently unavailable. Please contact staff.
                      </div>
                    );
                  }

                  return (
                    <>
                      {showOnline && (
                        <button
                          onClick={() => handlePlaceOrder("online")}
                          disabled={loadingAction !== null}
                          className="w-full bg-[var(--brand-primary,var(--color-primary))] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-4 px-4 font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                        >
                          {loadingAction === "online" ? (
                            <>
                              <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full"></div>
                              Redirecting...
                            </>
                          ) : (
                            "Pay with Card"
                          )}
                        </button>
                      )}

                      {showOfflineSetting && (
                        !offlineAvailable ? (
                          <div className="w-full bg-secondary/50 border border-border text-muted-foreground rounded-xl py-4 px-4 font-semibold text-center text-sm">
                            Offline payment is currently unavailable. Please pay by card or ask staff for assistance.
                          </div>
                        ) : (
                          <button
                            onClick={() => handlePlaceOrder("offline")}
                            disabled={loadingAction !== null}
                            className="w-full bg-[var(--brand-secondary,#2B304C)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-4 px-4 font-semibold transition-all duration-200 active:scale-95"
                          >
                            {loadingAction === "offline" ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Sending...
                              </span>
                            ) : (
                              "Send to Kitchen (Pay Cash/Later)"
                            )}
                          </button>
                        )
                      )}
                    </>
                  );
                })()}
              </div>

              <button
                onClick={clearCart}
                disabled={loadingAction !== null}
                className="w-full bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed text-foreground rounded-xl py-3 px-4 font-medium transition-colors duration-200"
              >
                Clear Cart
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
