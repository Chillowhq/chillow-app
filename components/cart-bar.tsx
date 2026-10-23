"use client"

import Link from "next/link"
import { ChevronRight, ShoppingBag } from "lucide-react"
import { formatPrice } from "@/lib/localization"

interface CartBarProps {
  itemCount: number
  subtotal: number
  servicePointId: string
  currency?: string
  isOpen?: boolean
  isWaiterMode?: boolean
}

export default function CartBar({
  itemCount,
  subtotal,
  servicePointId,
  currency,
  isOpen = true,
  isWaiterMode = false,
}: CartBarProps) {
  const href = isWaiterMode
    ? `/waitstaff/take-order/${servicePointId}/checkout`
    : `/s/${servicePointId}/order`
  const label = isOpen
    ? `View order, ${itemCount} ${itemCount === 1 ? "item" : "items"}, ${formatPrice(subtotal, currency)}`
    : `Ordering is closed. ${itemCount} ${itemCount === 1 ? "item" : "items"} in order.`

  const content = (
    <>
      <span className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <ShoppingBag className="h-6 w-6" aria-hidden="true" />
          <span
            className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-[var(--brand-primary,#EA601A)] shadow"
            aria-hidden="true"
          >
            {itemCount}
          </span>
        </span>
        <span className="text-left">
          <span className="block text-base font-black leading-tight">{isOpen ? "View Order" : "Closed"}</span>
          <span className="block text-xs font-medium text-white/80">
            {itemCount} {itemCount === 1 ? "item" : "items"} · {formatPrice(subtotal, currency)}
          </span>
        </span>
      </span>
      {isOpen && (
        <ChevronRight className="h-7 w-7 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
      )}
    </>
  )

  return (
    <div
      className="fixed inset-x-0 z-40 px-4"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-lg">
        {isOpen ? (
          <Link
            href={href}
            aria-label={label}
            className="group flex min-h-16 w-full items-center justify-between rounded-[1.4rem] px-5 py-3.5 text-[var(--brand-text-on-brand,white)] shadow-[0_16px_42px_-12px_rgba(0,0,0,.45)] transition active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#EA601A)] focus-visible:ring-offset-2 motion-reduce:transition-none"
            style={{
              background:
                "linear-gradient(to right, var(--brand-gradient-from, #EA601A), var(--brand-gradient-to, #ff8c42))",
            }}
          >
            {content}
          </Link>
        ) : (
          <div
            aria-label={label}
            className="flex min-h-16 w-full cursor-not-allowed items-center justify-between rounded-[1.4rem] bg-muted-foreground px-5 py-3.5 text-white opacity-90 shadow-xl"
          >
            {content}
          </div>
        )}
      </div>
    </div>
  )
}
