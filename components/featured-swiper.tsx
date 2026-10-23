"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import type { MenuItem } from "@/app/owner/menu/page"
import { formatPrice } from "@/lib/localization"
import { getMenuImageSrc, setFallbackMenuImage } from "@/lib/menu-image"

interface FeaturedSwiperProps {
  items: MenuItem[]
  currency?: string
  onItemClick?: (item: MenuItem) => void
}

const FEATURED_AUTOPLAY_INTERVAL_MS = 3_600
const FEATURED_AUTOPLAY_RESUME_DELAY_MS = 6_000

function getAvailableQuantity(item: MenuItem) {
  if (typeof item.inventory?.availableQuantity === "number") return item.inventory.availableQuantity
  return typeof item.stockQuantity === "number" ? item.stockQuantity : null
}

export default function FeaturedSwiper({
  items,
  currency = "USD",
  onItemClick,
}: FeaturedSwiperProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isPointerActive, setIsPointerActive] = useState(false)
  const [isMouseOver, setIsMouseOver] = useState(false)
  const [autoplayDelayMs, setAutoplayDelayMs] = useState(
    FEATURED_AUTOPLAY_INTERVAL_MS,
  )
  const [autoplayRevision, setAutoplayRevision] = useState(0)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const didSwipe = useRef(false)

  const featuredItems = useMemo(
    () =>
      items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => Number(Boolean(b.item.image)) - Number(Boolean(a.item.image)) || a.index - b.index)
        .slice(0, 5)
        .map(({ item }) => item),
    [items],
  )

  useEffect(() => {
    if (currentSlide >= featuredItems.length) setCurrentSlide(0)
  }, [currentSlide, featuredItems.length])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const syncPreference = () => setPrefersReducedMotion(media.matches)
    syncPreference()
    media.addEventListener("change", syncPreference)
    return () => media.removeEventListener("change", syncPreference)
  }, [])

  useEffect(() => {
    if (
      featuredItems.length < 2 ||
      prefersReducedMotion ||
      isPointerActive ||
      isMouseOver
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      setCurrentSlide((current) => {
        const safeCurrent = Math.min(current, featuredItems.length - 1)
        return (safeCurrent + 1) % featuredItems.length
      })
      setAutoplayDelayMs(FEATURED_AUTOPLAY_INTERVAL_MS)
    }, autoplayDelayMs)

    return () => window.clearTimeout(timer)
  }, [
    autoplayDelayMs,
    autoplayRevision,
    currentSlide,
    featuredItems.length,
    isMouseOver,
    isPointerActive,
    prefersReducedMotion,
  ])

  const resetAutoplayAfterInteraction = () => {
    setAutoplayDelayMs(FEATURED_AUTOPLAY_RESUME_DELAY_MS)
    setAutoplayRevision((revision) => revision + 1)
  }

  const nextSlide = () => {
    if (featuredItems.length > 1) {
      setCurrentSlide((previous) => (previous + 1) % featuredItems.length)
      resetAutoplayAfterInteraction()
    }
  }

  const previousSlide = () => {
    if (featuredItems.length > 1) {
      setCurrentSlide((previous) => (previous - 1 + featuredItems.length) % featuredItems.length)
      resetAutoplayAfterInteraction()
    }
  }

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
    resetAutoplayAfterInteraction()
  }

  if (featuredItems.length === 0) return null

  const activeItem = featuredItems[currentSlide]

  return (
    <section
      className="relative w-full touch-pan-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-primary,#EA601A)]"
      aria-roledescription="carousel"
      aria-label="Featured menu items"
      tabIndex={0}
      onFocusCapture={resetAutoplayAfterInteraction}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault()
          previousSlide()
        }
        if (event.key === "ArrowRight") {
          event.preventDefault()
          nextSlide()
        }
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setIsMouseOver(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setIsMouseOver(false)
        setIsPointerActive(false)
        pointerStart.current = null
        resetAutoplayAfterInteraction()
      }}
      onPointerDown={(event) => {
        didSwipe.current = false
        setIsPointerActive(true)
        resetAutoplayAfterInteraction()
        pointerStart.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerCancel={() => {
        setIsPointerActive(false)
        pointerStart.current = null
        resetAutoplayAfterInteraction()
      }}
      onPointerUp={(event) => {
        const start = pointerStart.current
        setIsPointerActive(false)
        pointerStart.current = null
        if (!start) return

        const deltaX = event.clientX - start.x
        const deltaY = event.clientY - start.y
        if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return
        didSwipe.current = true
        if (deltaX < 0) nextSlide()
        else previousSlide()
      }}
    >
      <div className="relative h-[23rem] overflow-hidden bg-muted shadow-[0_20px_60px_-26px_rgba(0,0,0,0.45)] min-[390px]:h-[24rem] sm:h-[29rem] lg:mx-auto lg:mt-5 lg:h-[32rem] lg:max-w-6xl lg:rounded-[2rem]">
        {featuredItems.map((item, index) => {
          const availableQuantity = getAvailableQuantity(item)
          const threshold = item.inventory?.lowStockThreshold ?? item.lowStockThreshold ?? 5
          const isLowStock =
            item.isAvailable &&
            availableQuantity !== null &&
            availableQuantity > 0 &&
            (item.inventory?.isLowStock === true || availableQuantity <= threshold)
          const isSoldOut = !item.isAvailable && (
            item.availabilityStatus === "sold_out" || availableQuantity === 0
          )

          return (
            <div
              key={item.id || item._id}
              aria-hidden={index !== currentSlide}
              className="absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none"
              style={{
                opacity: index === currentSlide ? 1 : 0,
                pointerEvents: index === currentSlide ? "auto" : "none",
                zIndex: index === currentSlide ? 10 : 0,
              }}
            >
              <Image
                src={getMenuImageSrc(item.image)}
                alt={item.name}
                fill
                sizes="(min-width: 1024px) 1152px, 100vw"
                className="absolute inset-0 h-full w-full object-cover object-center [filter:saturate(1.08)_contrast(1.03)]"
                priority={index === 0}
                onError={(event) => setFallbackMenuImage(event.currentTarget)}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(4,8,18,.66)_0%,rgba(4,8,18,.36)_48%,rgba(4,8,18,.08)_82%)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(4,8,18,.36)_0%,transparent_54%)]"
              />

              <button
                type="button"
                onClick={() => {
                  if (didSwipe.current) {
                    didSwipe.current = false
                    return
                  }
                  resetAutoplayAfterInteraction()
                  onItemClick?.(item)
                }}
                tabIndex={index === currentSlide ? 0 : -1}
                className="relative z-20 flex h-full w-full flex-col justify-center px-12 pb-20 pt-[max(2rem,env(safe-area-inset-top))] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white sm:px-20 sm:pb-24 lg:px-24"
                aria-label={`View details for ${item.name}`}
              >
                <span className="max-w-sm space-y-3.5 sm:max-w-lg">
                  <span className="flex flex-wrap items-center gap-2.5">
                    <span
                      className="inline-flex min-h-9 items-center rounded-full px-3.5 text-xs font-black uppercase tracking-wider text-[var(--brand-text-on-brand,white)] shadow-sm"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--brand-gradient-from, #EA601A), var(--brand-gradient-to, #ff8c42))",
                      }}
                    >
                      {item.category}
                    </span>
                    {!item.isAvailable && (
                      <span className="inline-flex min-h-9 items-center rounded-full bg-red-500 px-3.5 text-xs font-black uppercase tracking-wider text-white shadow-sm">
                        {isSoldOut ? "Sold out" : "Unavailable"}
                      </span>
                    )}
                    {isLowStock && (
                      <span className="inline-flex min-h-9 items-center rounded-full bg-amber-500 px-3.5 text-xs font-black uppercase tracking-wider text-white shadow-sm">
                        Only {availableQuantity} left
                      </span>
                    )}
                  </span>

                  <span className="block text-[clamp(2.25rem,9vw,4rem)] font-black leading-[1.02] tracking-[-0.035em] text-white [text-shadow:0_2px_18px_rgba(0,0,0,.35)]">
                    {item.name}
                  </span>

                  {item.description && (
                    <span className="line-clamp-2 max-w-md text-sm font-normal leading-snug text-white/90 sm:text-base">
                      {item.description}
                    </span>
                  )}

                  <span className="inline-flex rounded-full bg-white px-5 py-2.5 text-2xl font-black tracking-tight text-[var(--brand-primary,#EA601A)] shadow-[0_10px_30px_-12px_rgba(0,0,0,.65)] sm:text-3xl">
                    {formatPrice(item.price, currency)}
                  </span>
                </span>
              </button>
            </div>
          )
        })}

        {featuredItems.length > 1 && (
          <>
            <button
              type="button"
              onClick={previousSlide}
              className="absolute left-3 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-slate-950/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_10px_28px_-12px_rgba(0,0,0,.8)] backdrop-blur-md transition hover:bg-slate-950/40 active:scale-95 motion-reduce:transition-none sm:left-5"
              aria-label="Previous featured item"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={2.25} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              className="absolute right-3 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-slate-950/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_10px_28px_-12px_rgba(0,0,0,.8)] backdrop-blur-md transition hover:bg-slate-950/40 active:scale-95 motion-reduce:transition-none sm:right-5"
              aria-label="Next featured item"
            >
              <ChevronRight className="h-7 w-7" strokeWidth={2.25} aria-hidden="true" />
            </button>

            <div
              className="absolute bottom-10 left-1/2 z-30 flex -translate-x-1/2 items-center rounded-full border border-white/15 bg-slate-950/30 px-1.5 shadow-lg backdrop-blur-md sm:bottom-12"
              aria-label={`Featured item ${currentSlide + 1} of ${featuredItems.length}`}
            >
              {featuredItems.map((item, index) => (
                <button
                  type="button"
                  key={item.id || item._id || index}
                  onClick={() => goToSlide(index)}
                  aria-label={`Show featured item ${index + 1}: ${item.name}`}
                  aria-current={index === currentSlide ? "true" : undefined}
                  className="flex h-10 w-7 items-center justify-center"
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 rounded-full bg-white transition-all motion-reduce:transition-none ${
                      index === currentSlide ? "w-5" : "w-2 opacity-55"
                    }`}
                  />
                </button>
              ))}
            </div>
          </>
        )}

        <p className="sr-only" aria-live="polite">
          Featured item {currentSlide + 1} of {featuredItems.length}: {activeItem.name}
        </p>
      </div>
    </section>
  )
}
