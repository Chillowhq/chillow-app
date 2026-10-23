"use client"

import { Minus, Plus } from "lucide-react"
import Image from "next/image"
import type { MenuItem } from "@/app/owner/menu/page"
import { useCartStore } from "@/store/cart-store"
import { formatPrice } from "@/lib/localization"
import { getMenuImageSrc, setFallbackMenuImage } from "@/lib/menu-image"

interface MenuCardProps {
  item: MenuItem
  currency?: string
  onClick: () => void
  showCategory?: boolean
  isBusinessOpen?: boolean
}

function getAvailableQuantity(item: MenuItem) {
  if (typeof item.inventory?.availableQuantity === "number") return item.inventory.availableQuantity
  return typeof item.stockQuantity === "number" ? item.stockQuantity : null
}

export default function MenuCard({
  item,
  currency,
  onClick,
  showCategory = false,
  isBusinessOpen = true,
}: MenuCardProps) {
  const items = useCartStore((state) => state.items)
  const addItem = useCartStore((state) => state.addItem)
  const removeItem = useCartStore((state) => state.removeItem)
  const cartItem = items.find((cartEntry) => cartEntry.id === item.id)
  const quantity = cartItem?.quantity || 0
  const availableQuantity = getAvailableQuantity(item)
  const threshold = item.inventory?.lowStockThreshold ?? item.lowStockThreshold ?? 5
  const isLowStock =
    item.isAvailable &&
    availableQuantity !== null &&
    availableQuantity > 0 &&
    (item.inventory?.isLowStock === true || availableQuantity <= threshold)
  const availabilityLabel = item.availabilityStatus === "sold_out" || availableQuantity === 0
    ? "Sold out"
    : "Unavailable"
  const canAdd = item.isAvailable && isBusinessOpen

  const handleQuickAdd = () => {
    if (!canAdd) return
    addItem({
      id: item.id!,
      name: item.name,
      price: item.price,
      image: getMenuImageSrc(item.image),
      category: item.category,
      description: item.description || "",
      quantity: 1,
      orderCategory: item.type || "food",
    })
  }

  return (
    <article className="group relative h-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-shadow hover:shadow-lg motion-reduce:transition-none">
      <button
        type="button"
        onClick={onClick}
        className="block h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-primary,#EA601A)]"
        aria-label={`View details for ${item.name}`}
      >
        <span className="relative block aspect-[4/3] w-full overflow-hidden bg-muted">
          <Image
            src={getMenuImageSrc(item.image)}
            alt={item.name}
            fill
            sizes="(max-width: 767px) 54vw, (max-width: 1023px) 33vw, 232px"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
            onError={(event) => setFallbackMenuImage(event.currentTarget)}
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" aria-hidden="true" />

          <span className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-col items-start gap-1.5">
            {showCategory && (
              <span className="max-w-full truncate rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black capitalize text-slate-900 shadow-sm">
                {item.category}
              </span>
            )}
            {!item.isAvailable && (
              <span className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                {availabilityLabel}
              </span>
            )}
            {isLowStock && (
              <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                Only {availableQuantity} left
              </span>
            )}
          </span>
        </span>

        <span className={`flex min-h-[8.5rem] flex-col p-3.5 ${!item.isAvailable ? "opacity-65" : ""}`}>
          <span className="line-clamp-2 text-base font-black leading-tight text-foreground group-hover:text-[var(--brand-primary,#EA601A)] sm:text-lg">
            {item.name}
          </span>
          {item.description && (
            <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {item.description}
            </span>
          )}
          <span className="mt-auto pt-3 text-lg font-black text-[var(--brand-primary,#EA601A)] sm:text-xl">
            {formatPrice(item.price, currency)}
          </span>
        </span>
      </button>

      <div className="absolute bottom-3 right-3 z-20" role="group" aria-label={`${item.name} quantity`}>
        {quantity === 0 ? (
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={!canAdd}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--brand-text-on-brand,white)] shadow-lg transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none motion-reduce:transition-none"
            style={canAdd ? { backgroundColor: "var(--brand-primary, #EA601A)" } : undefined}
            aria-label={isBusinessOpen ? `Add ${item.name} to order` : `Ordering is closed for ${item.name}`}
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        ) : (
          <div className="flex items-center rounded-full border border-border/70 bg-background/95 p-0.5 shadow-xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => removeItem(item.id!)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition hover:bg-secondary active:scale-95 motion-reduce:transition-none"
              aria-label={`Remove one ${item.name} from order`}
            >
              <Minus className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="w-7 text-center text-sm font-black tabular-nums text-foreground" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={!canAdd}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--brand-text-on-brand,white)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground motion-reduce:transition-none"
              style={canAdd ? { backgroundColor: "var(--brand-primary, #EA601A)" } : undefined}
              aria-label={isBusinessOpen ? `Add one more ${item.name} to order` : `Ordering is closed for ${item.name}`}
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
