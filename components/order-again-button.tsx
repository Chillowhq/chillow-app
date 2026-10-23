"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/axios-config"
import { useCartStore } from "@/store/cart-store"
import { getBusinessId } from "@/lib/business-info"
import { ensureSessionId, getTableToken } from "@/lib/guest-session"

interface OrderAgainButtonProps {
  orderId: string
  servicePointId: string
  /** Optional extra CSS classes */
  className?: string
  /** Render as a full-width block button (used in order history list) */
  block?: boolean
}

export default function OrderAgainButton({
  orderId,
  servicePointId,
  className = "",
  block = false,
}: OrderAgainButtonProps) {
  const router = useRouter()
  const { setItems, clearOrderDetails } = useCartStore()
  const [isLoading, setIsLoading] = useState(false)

  const handleOrderAgain = async (e: React.MouseEvent) => {
    // Prevent parent click handlers (e.g. order card navigation) from firing
    e.stopPropagation()

    setIsLoading(true)
    try {
      const businessId = getBusinessId()
      const sessionId = ensureSessionId()
      const tableSessionToken = getTableToken(servicePointId)

      const res = await apiClient.post(`/orders/${encodeURIComponent(orderId)}/reorder`, {
        businessId,
        sessionId: sessionId || undefined,
        servicePointId,
        tableSessionToken: tableSessionToken || undefined,
      })

      const { items, unavailableItems, addedCount } = res.data

      if (addedCount === 0) {
        toast.error("None of the items from this order are currently available.")
        return
      }

      // Replace cart contents with validated, current-price items
      clearOrderDetails()
      setItems(items)

      // Show summary toast
      if (unavailableItems && unavailableItems.length > 0) {
        toast.warning(
          `${addedCount} ${addedCount === 1 ? "item" : "items"} added to cart. ` +
          `${unavailableItems.length} ${unavailableItems.length === 1 ? "item is" : "items are"} no longer available: ` +
          unavailableItems.join(", "),
          { duration: 6000 }
        )
      } else {
        toast.success(
          `${addedCount} ${addedCount === 1 ? "item" : "items"} added to cart!`
        )
      }

      // Navigate to the cart / order review page
      router.push(`/s/${servicePointId}/order`)
    } catch (err: any) {
      console.error("[OrderAgain] Failed:", err)
      toast.error(err?.response?.data?.error || "Failed to load order. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const base =
    "inline-flex items-center justify-center gap-1.5 font-bold text-xs rounded-xl transition-all active:scale-95 select-none"

  const styles = block
    ? `${base} w-full py-2.5 bg-[var(--brand-muted,var(--primary)/10)] text-[var(--brand-primary,var(--color-primary))] hover:opacity-80 border border-[var(--brand-primary,var(--color-primary))]/20 ${className}`
    : `${base} px-3 py-1.5 bg-[var(--brand-muted,var(--primary)/10)] text-[var(--brand-primary,var(--color-primary))] hover:opacity-80 ${className}`

  return (
    <button
      onClick={handleOrderAgain}
      disabled={isLoading}
      className={styles}
      aria-label="Order Again"
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5" />
      )}
      {isLoading ? "Loading…" : "Order Again"}
    </button>
  )
}
