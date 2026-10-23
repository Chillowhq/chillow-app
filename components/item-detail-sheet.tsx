"use client"

import { useState, useEffect, type CSSProperties } from "react"
import { Plus, Minus, X } from "lucide-react"
import Image from "next/image"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/store/cart-store"
import type { MenuItem } from "@/app/owner/menu/page"
import { formatPrice } from "@/lib/localization"
import { getMenuImageSrc, setFallbackMenuImage } from "@/lib/menu-image"

import { useCustomerTheme } from "@/components/providers/customer-theme-provider"

interface ItemDetailSheetProps {
    item: MenuItem | null
    isOpen: boolean
    onClose: () => void
    currency?: string
    isBusinessOpen?: boolean
}

export default function ItemDetailSheet({ item, isOpen, onClose, currency = "USD", isBusinessOpen = true }: ItemDetailSheetProps) {
    const { useBranding, branding } = useCustomerTheme()
    const items = useCartStore((state) => state.items)
    const addItem = useCartStore((state) => state.addItem)
    const setItemQuantity = useCartStore((state) => state.setItemQuantity)

    const cartItem = item ? items.find((i) => i.id === item.id) : null
    const [quantity, setQuantity] = useState(1)

    // Sync quantity with cart when sheet opens
    useEffect(() => {
        if (isOpen && item) {
            setQuantity(cartItem?.quantity || 1)
        }
    }, [isOpen, item, cartItem?.quantity])

    if (!item) return null

    const availableQuantity = typeof item.inventory?.availableQuantity === "number"
        ? item.inventory.availableQuantity
        : typeof item.stockQuantity === "number"
            ? item.stockQuantity
            : null
    const lowStockThreshold = item.inventory?.lowStockThreshold ?? item.lowStockThreshold ?? 5
    const unavailableLabel = item.availabilityStatus === "sold_out" || availableQuantity === 0
        ? "Sold Out"
        : "Unavailable"
    const canOrderItem = item.isAvailable && isBusinessOpen

    const handleIncrease = () => {
        if (!canOrderItem) return
        setQuantity((prev) => prev + 1)
    }
    const handleDecrease = () => setQuantity((prev) => (prev > 1 ? prev - 1 : 1))

    const handleAddToCart = () => {
        if (!canOrderItem) return
        if (cartItem) {
            setItemQuantity(item.id!, quantity)
        } else {
            addItem({
                ...item,
                id: item.id!,
                image: getMenuImageSrc(item.image),
                quantity: quantity,
                orderCategory: (item.type || "food") as "food" | "drinks"
            } as any)
        }
        onClose()
    }

    const isInCart = !!cartItem

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="bottom"
                className="rounded-t-[32px] p-0 flex flex-col border-none sm:max-w-lg sm:mx-auto shadow-2xl focus:outline-none"
                style={{
                    maxHeight: "85dvh",
                    // Fallback for browsers that don't support dvh
                    "--sheet-max-h": "85svh",
                } as CSSProperties}
            >
                {/* Visually hidden accessibility header */}
                <SheetHeader className="sr-only">
                    <SheetTitle>{item.name}</SheetTitle>
                    <SheetDescription>{item.description}</SheetDescription>
                </SheetHeader>

                {/* ── Fixed Image Section ── */}
                <div className="relative w-full h-64 sm:h-80 shrink-0">
                    <Image
                        src={getMenuImageSrc(item.image)}
                        alt={item.name}
                        fill
                        sizes="(min-width: 640px) 512px, 100vw"
                        className="w-full h-full object-cover rounded-t-[32px]"
                        onError={(event) => setFallbackMenuImage(event.currentTarget)}
                    />

                    {/* Drag handle — floats over image top-center */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/40 rounded-full pointer-events-none z-10" />

                    {/* Close button — floats over image top-right, always reachable */}
                    <button
                        onClick={onClose}
                        aria-label={`Close ${item.name} details`}
                        className="absolute top-4 right-4 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/55 transition-colors active:scale-95 motion-reduce:transition-none"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Scrollable Text Content ── */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    <div className="p-6 pb-4">
                        <div className="flex items-start justify-between mb-2 gap-3">
                            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-tight">
                                {item.name}
                            </h2>
                            <div 
                                className="text-2xl sm:text-3xl font-black bg-clip-text text-transparent shrink-0"
                                style={{ backgroundImage: useBranding ? `linear-gradient(to right, ${branding?.primaryColor || '#EA601A'}, ${branding?.accentColor || '#ff8c42'})` : "linear-gradient(to right, #EA601A, #ff8c42)" }}
                            >
                                {formatPrice(item.price, currency)}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mb-6 flex-wrap">
                            <span className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-lg text-[10px] font-black uppercase tracking-wider border border-border/50">
                                {item.category}
                            </span>
                            {!item.isAvailable && (
                                <span className="px-2.5 py-1 bg-red-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm">
                                    {unavailableLabel}
                                </span>
                            )}
                            {item.isAvailable && availableQuantity !== null && availableQuantity > 0 && (item.inventory?.isLowStock === true || availableQuantity <= lowStockThreshold) && (
                                <span className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm">
                                    Only {availableQuantity} left
                                </span>
                            )}
                        </div>

                        {item.description && <div className="space-y-6">
                            <div>
                                <h3 className="text-xs font-black text-foreground uppercase tracking-widest mb-3 opacity-50 flex items-center gap-2">
                                    <span className="w-4 h-px bg-foreground opacity-20" />
                                    Description
                                </h3>
                                <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                                    {item.description}
                                </p>
                            </div>
                        </div>}
                    </div>
                </div>

                {/* ── Fixed bottom action bar — safe area aware ── */}
                <div
                    className="shrink-0 px-6 pt-4 pb-6 bg-background/95 backdrop-blur-xl border-t border-border/50 flex flex-col gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
                    style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
                >
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center bg-secondary/80 rounded-2xl p-1 gap-1 border border-border/50">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="w-12 h-12 rounded-xl text-foreground hover:bg-background transition-all active:scale-90 disabled:opacity-50"
                                onClick={handleDecrease}
                                disabled={!canOrderItem}
                                aria-label={`Decrease ${item.name} quantity`}
                            >
                                <Minus className="size-5" />
                            </Button>
                            <span className="w-8 text-center font-black text-xl text-foreground tabular-nums">{quantity}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="w-12 h-12 rounded-xl text-foreground hover:bg-background transition-all active:scale-90 disabled:opacity-50"
                                onClick={handleIncrease}
                                disabled={!canOrderItem}
                                aria-label={`Increase ${item.name} quantity`}
                            >
                                <Plus className="size-5" />
                            </Button>
                        </div>

                        <Button
                            className={`flex-1 h-14 rounded-2xl font-black text-lg transition-all active:scale-95 group shadow-xl motion-reduce:transition-none ${canOrderItem
                                    ? "text-[var(--brand-text-on-brand,white)] hover:brightness-105"
                                    : "bg-muted text-muted-foreground shadow-none cursor-not-allowed"
                                }`}
                            style={canOrderItem ? {
                                background: useBranding ? `linear-gradient(to right, ${branding?.primaryColor || '#EA601A'}, ${branding?.accentColor || '#ff8c42'})` : "linear-gradient(to right, #EA601A, #ff8c42)",
                                boxShadow: useBranding ? `0 10px 15px -3px ${branding?.primaryColor ? branding.primaryColor + '33' : 'rgba(234,96,26,0.2)'}, 0 4px 6px -4px ${branding?.primaryColor ? branding.primaryColor + '33' : 'rgba(234,96,26,0.2)'}` : "0 10px 15px -3px rgba(234,96,26,0.2), 0 4px 6px -4px rgba(234,96,26,0.2)"
                            } : {}}
                            onClick={handleAddToCart}
                            disabled={!canOrderItem}
                        >
                            {!isBusinessOpen ? "Closed" : !item.isAvailable ? unavailableLabel : isInCart ? "Update Order" : "Add to Cart"}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

