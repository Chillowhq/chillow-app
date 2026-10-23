"use client"

import { useEffect } from "react"
import { useCartStore } from "@/store/cart-store"
import { UtensilsCrossed, Utensils } from "lucide-react"

interface OrderTypeSelectorProps {
  dineInEnabled?: boolean
  takeoutEnabled?: boolean
}

export default function OrderTypeSelector({
  dineInEnabled,
  takeoutEnabled,
}: OrderTypeSelectorProps) {
  const { orderType, setOrderType } = useCartStore()

  // Auto-select if only one option is available
  useEffect(() => {
    // Wait until settings are loaded
    if (dineInEnabled === undefined || takeoutEnabled === undefined) return;

    if (dineInEnabled && !takeoutEnabled && orderType !== "dine-in") {
      setOrderType("dine-in")
    }
    if (!dineInEnabled && takeoutEnabled && orderType !== "takeout") {
      setOrderType("takeout")
    }
  }, [dineInEnabled, takeoutEnabled, orderType, setOrderType])

  // Do not render order type options until the real business settings are loaded
  if (dineInEnabled === undefined || takeoutEnabled === undefined) return null

  // If neither is available, hide the section
  if (!dineInEnabled && !takeoutEnabled) return null

  return (
    <div className="bg-card rounded-xl p-6 border border-border my-8">
      <label className="block text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
        Service Type
      </label>

      <div className={`grid gap-4 ${dineInEnabled && takeoutEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
        {dineInEnabled && (
          <button
            onClick={() => setOrderType("dine-in")}
              className={`relative flex-1 flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                orderType === "dine-in" 
                ? "border-[var(--brand-primary,var(--color-primary))] bg-[var(--brand-muted-bg,rgba(234,96,26,0.05))]" 
                : "border-border hover:border-[var(--brand-primary,var(--color-primary))]/50 bg-background"
              }`}
          >
            <Utensils className={`w-8 h-8 ${orderType === "dine-in" ? "text-[var(--brand-primary,var(--color-primary))]" : "text-muted-foreground"}`} />
            <span className={`font-semibold mt-3 ${orderType === "dine-in" ? "text-foreground" : "text-muted-foreground"}`}>Dine In</span>
            <span className="text-xs text-center mt-1 text-muted-foreground">Eat in this venue</span>
            
            {orderType === "dine-in" && <div className="absolute top-2 right-2 w-3 h-3 bg-[var(--brand-primary,var(--color-primary))] rounded-full" />}
          </button>
        )}

        {takeoutEnabled && (
          <button
            onClick={() => setOrderType("takeout")}
              className={`relative flex-1 flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                orderType === "takeout" 
                ? "border-[var(--brand-primary,var(--color-primary))] bg-[var(--brand-muted-bg,rgba(234,96,26,0.05))]" 
                : "border-border hover:border-[var(--brand-primary,var(--color-primary))]/50 bg-background"
              }`}
          >
            <UtensilsCrossed className={`w-8 h-8 ${orderType === "takeout" ? "text-[var(--brand-primary,var(--color-primary))]" : "text-muted-foreground"}`} />
            <span className={`font-semibold mt-3 ${orderType === "takeout" ? "text-foreground" : "text-muted-foreground"}`}>Takeout</span>
            <span className="text-xs text-center mt-1 text-muted-foreground">Pick up your order</span>
            
            {orderType === "takeout" && <div className="absolute top-2 right-2 w-3 h-3 bg-[var(--brand-primary,var(--color-primary))] rounded-full" />}
          </button>
        )}
      </div>
    </div>
  )
}
