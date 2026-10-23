"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Trash2, Plus, Minus, Send, Banknote, CreditCard } from "lucide-react"
import { useCartStore } from "@/store/cart-store"
import AllergySelector from "@/components/allergy-selector"
import OrderTypeSelector from "@/components/order-type-selector"
import TipSelector, { type TipState } from "@/components/tip-selector"
import { apiClient } from "@/lib/axios-config"
import { toast } from "sonner"
import { MenuItem } from "@/app/owner/menu/page"
import { formatPrice } from "@/lib/localization"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { getMenuImageSrc, setFallbackMenuImage } from "@/lib/menu-image"
import { calculateCheckoutEstimate } from "@/lib/checkout-pricing"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type StaffPaymentMethod = "cash" | "pos_card"

export default function WaiterCheckoutPage() {
  const params = useParams()
  const servicePointId = params.servicePointId as string

  const { user, loading: authLoading } = useAuthGuard({ requiredRole: "waiter" })

  const [isHydrated, setIsHydrated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingData, setIsFetchingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<any>(null)
  const [servicePointDisplayLabel, setServicePointDisplayLabel] = useState("")
  const [tip, setTip] = useState<TipState>({ amount: 0, type: null, percentage: null })
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<StaffPaymentMethod | null>(null)
  const [paymentDialogError, setPaymentDialogError] = useState<string | null>(null)
  const orderIdempotencyKey = useRef<string | null>(null)

  // Local menu data for lookup
  const [, setMenuItems] = useState<MenuItem[]>([])

  const { items, removeItem, setItemQuantity, clearCart, allergies, specialNotes, clearOrderDetails, orderType, ensureContext } =
    useCartStore()
  const router = useRouter()

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    orderIdempotencyKey.current = null
  }, [items, allergies, specialNotes, orderType, tip])

  useEffect(() => {
    if (!user || authLoading) return
    ensureContext({
      actor: "waitstaff",
      businessId: user.businessId,
      servicePointId,
    })
    fetchData()
  }, [authLoading, ensureContext, servicePointId, user])

  const fetchData = async () => {
    setIsFetchingData(true)
    try {
      const rid = user?.businessId
      if (!rid) return
      
      const [settingsRes, menuRes, servicePointsRes] = await Promise.all([
        apiClient.get(`/public/business-config?businessId=${rid}`),
        apiClient.get(`/menu-items?businessId=${rid}`),
        apiClient.get("/waitstaff/service-points"),
      ])

      setRestaurant(settingsRes.data)

      const normalized = menuRes.data.map((item: any) => ({
        ...item,
        id: item._id,
        image: item.imageUrl,
        orderCategory: item.type
      }))
      setMenuItems(normalized)
      const currentServicePoint = Array.isArray(servicePointsRes.data)
        ? servicePointsRes.data.find((item: any) => item.servicePointId === servicePointId)
        : null
      setServicePointDisplayLabel(
        currentServicePoint?.label || currentServicePoint?.code || "Selected service point",
      )
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

  const handlePlaceOrder = async (selectedPaymentMethod: StaffPaymentMethod | null = null) => {
    setIsLoading(true)
    setError(null)
    if (selectedPaymentMethod) setPaymentDialogError(null)

    if (!orderType) {
      const message = "Choose Dine-In or Takeout before sending this order."
      setError(message)
      if (selectedPaymentMethod) setPaymentDialogError(message)
      toast.error(message)
      setIsLoading(false)
      return
    }

    try {
      const cartItems = items.map((item) => ({
        itemName: item.name,
        quantity: item.quantity,
        price: item.price,
        orderCategory: item.orderCategory,
        notes: specialNotes || "",
        allergies: allergies || [],
        image: item.image || "",
      }))

      const payload = {
        servicePointId,
        orderType: orderType,
        items: cartItems,
        currency: restaurant?.currency || "USD",
        tipAmount: Number(tipAmount.toFixed(2)),
        tipType: tipAmount > 0 ? tip.type : null,
        tipPercentage: tipAmount > 0 && tip.type === "percentage" ? tip.percentage : null,
        ...(selectedPaymentMethod ? { paymentMethod: selectedPaymentMethod } : {}),
      }

      orderIdempotencyKey.current = orderIdempotencyKey.current || crypto.randomUUID()
      await apiClient.post("/waitstaff/orders", payload, {
        headers: { "Idempotency-Key": orderIdempotencyKey.current },
      })

      toast.success(
        selectedPaymentMethod
          ? `Payment recorded via ${selectedPaymentMethod === "cash" ? "Cash" : "POS Card"}. Order sent to Kitchen/Bar.`
          : "Order sent to Kitchen/Bar. Payment can be collected later.",
      )
      setPaymentDialogOpen(false)
      setPaymentMethod(null)
      setPaymentDialogError(null)
      clearCart()
      clearOrderDetails()
      
      router.push("/waitstaff")
    } catch (err: any) {
      console.error("Order submission failed:", err)
      const status = err?.response?.status
      const data = err?.response?.data

      let submissionError: string

      if ((status === 400 || status === 409) && Array.isArray(data?.items) && data.items.length > 0) {
        // Structured stock validation failure from backend
        const lines = data.items.map((f: any) =>
          f.available === 0
            ? `• ${f.itemName} is sold out`
            : `• ${f.itemName} — Only ${f.available} available`
        )
        submissionError = data.items.length === 1
          ? lines[0].replace("• ", "")
          : `Some items are no longer available:\n${lines.join("\n")}`
      } else {
        submissionError = data?.error ||
          data?.message ||
          (status
            ? "Failed to place order. Please review it and try again."
            : "We could not confirm whether the order was created. Retry from this screen to safely reuse the same request.")
      }

      setError(submissionError)
      if (selectedPaymentMethod) setPaymentDialogError(submissionError)
      toast.error(submissionError)
      if (status && status >= 400 && status < 500) orderIdempotencyKey.current = null
    } finally {
      setIsLoading(false)
    }
  }


  if (!isHydrated || authLoading || isFetchingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md w-full p-8 rounded-3xl bg-secondary/30 border border-border">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-black mb-2 text-foreground">Your cart is empty</h2>
          <p className="text-muted-foreground mb-8 text-sm">Add some delicious items to get started.</p>
          <Link
            href={`/waitstaff/take-order/${servicePointId}`}
            className="block w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 rounded-xl transition-colors"
          >
            Back to Menu
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-44 md:pb-36">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/waitstaff/take-order/${servicePointId}`} className="p-2 -ml-2 hover:bg-secondary rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Link>
            <div>
              <h1 className="text-lg font-black tracking-tight">Order Review</h1>
              <p className="text-xs font-semibold text-muted-foreground">{servicePointDisplayLabel}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r-xl">
            <p className="text-sm font-bold text-destructive">{error}</p>
          </div>
        )}

        {/* Order Items */}
        <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-secondary/30 border-b border-border flex justify-between items-center">
            <h2 className="font-bold text-foreground">Items ({items.length})</h2>
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to clear the cart?")) {
                  clearCart()
                  clearOrderDetails()
                  router.push(`/waitstaff/take-order/${servicePointId}`)
                }
              }}
              className="text-xs font-bold text-destructive hover:opacity-80 transition-opacity uppercase tracking-wider flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="divide-y divide-border">
            {items.map((item) => {
              return (
                <div key={item.id} className="p-4 hover:bg-secondary/20 transition-colors">
                  <div className="flex gap-4">
                    {/* Item Image */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-border bg-muted">
                      <img
                        src={getMenuImageSrc(item.image)}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(event) => setFallbackMenuImage(event.currentTarget)}
                      />
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-foreground truncate pr-2">{item.name}</h3>
                        <span className="font-black whitespace-nowrap text-foreground">
                          {formatPrice(item.price * item.quantity, restaurant?.currency)}
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center bg-secondary/50 rounded-lg border border-border overflow-hidden">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                          <button
                            onClick={() => setItemQuantity(item.id, item.quantity + 1)}
                            className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          {formatPrice(item.price, restaurant?.currency)} each
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Order Type & Allergies */}
        <section className="space-y-4">
          <OrderTypeSelector
            dineInEnabled={restaurant?.orderingPreferences?.dineInEnabled ?? true}
            takeoutEnabled={restaurant?.orderingPreferences?.takeoutEnabled ?? true}
          />
          <AllergySelector />
        </section>

        {tipsEnabled && (
          <TipSelector
            subtotal={subtotal}
            currency={restaurant?.currency}
            value={tip}
            onChange={setTip}
          />
        )}

        {/* Order Summary */}
        <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex justify-between text-sm text-muted-foreground font-medium">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal, restaurant?.currency)}</span>
          </div>

          {tax > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground font-medium">
              <span>Tax ({restaurant.taxRate}%)</span>
              <span>{formatPrice(tax, restaurant?.currency)}</span>
            </div>
          )}
          
          {platformFee > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground font-medium">
              <span>{restaurant?.platformFeeLabel || "Service Fee"}</span>
              <span>{formatPrice(platformFee, restaurant?.currency)}</span>
            </div>
          )}

          {tipAmount > 0 && (
            <div className="flex justify-between text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <span>Tip</span>
              <span>{formatPrice(tipAmount, restaurant?.currency)}</span>
            </div>
          )}

          <div className="pt-3 mt-3 border-t border-border flex justify-between items-end">
            <span className="text-base font-bold text-foreground">Total</span>
            <span className="text-2xl font-black text-primary">
              {formatPrice(total, restaurant?.currency)}
            </span>
          </div>
        </section>

      </main>

      {/* Staff order actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50">
        <div className="max-w-2xl mx-auto space-y-2">
          <button
            onClick={() => handlePlaceOrder(null)}
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black py-4 px-6 rounded-xl flex justify-between items-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-[0.98]"
          >
            <span className="flex items-center gap-2 uppercase tracking-wide">
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {isLoading ? "Sending..." : "Send to Kitchen"}
            </span>
            <span>{formatPrice(total, restaurant?.currency)}</span>
          </button>
        
          <button
            type="button"
            onClick={() => {
              setPaymentMethod(null)
              setPaymentDialogError(null)
              setPaymentDialogOpen(true)
            }}
            disabled={isLoading || (
              restaurant?.paymentPreferences?.acceptCash === false &&
              restaurant?.paymentPreferences?.acceptPosCard === false
            )}
            className="w-full border-2 border-primary bg-background text-primary hover:bg-primary/5 font-black py-3.5 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            Collect Payment First
          </button>
        </div>
      </div>

      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          if (isLoading) return
          setPaymentDialogOpen(open)
          if (!open) {
            setPaymentMethod(null)
            setPaymentDialogError(null)
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="pr-8 text-2xl font-black leading-tight">How did the guest pay?</DialogTitle>
            <DialogDescription>
              Record the payment method, then send the order to Kitchen/Bar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
            {(restaurant?.paymentPreferences?.acceptCash ?? true) && (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setPaymentMethod("cash")}
                className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 font-black transition-all ${
                  paymentMethod === "cash"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-secondary"
                }`}
              >
                <Banknote className="h-8 w-8 text-emerald-600" />
                Cash
              </button>
            )}
            {(restaurant?.paymentPreferences?.acceptPosCard ?? true) && (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setPaymentMethod("pos_card")}
                className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 font-black transition-all ${
                  paymentMethod === "pos_card"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-secondary"
                }`}
              >
                <CreditCard className="h-8 w-8 text-blue-600" />
                POS Card
              </button>
            )}
          </div>

          {paymentDialogError && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
            >
              {paymentDialogError}
            </div>
          )}

          <DialogFooter className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
            <button
              type="button"
              onClick={() => {
                setPaymentDialogOpen(false)
                setPaymentMethod(null)
                setPaymentDialogError(null)
              }}
              disabled={isLoading}
              className="min-h-12 rounded-xl border border-border px-6 font-bold hover:bg-secondary disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => paymentMethod && handlePlaceOrder(paymentMethod)}
              disabled={!paymentMethod || isLoading}
              className="min-h-12 rounded-xl bg-primary px-6 text-sm font-black text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:whitespace-nowrap sm:text-base"
            >
              {isLoading ? "Confirming..." : "Confirm Payment & Send to Kitchen"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
