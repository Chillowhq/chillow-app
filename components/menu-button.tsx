"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  LayoutGrid,
  X,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { FeedbackModal } from "@/components/feedback-modal"
import { useCustomerGuestRealtime } from "@/components/providers/customer-guest-realtime-provider"
import { useCustomerTheme } from "@/components/providers/customer-theme-provider"

import { apiClient } from "@/lib/axios-config"
import { getBusinessId } from "@/lib/business-info"
import { isRestaurantOpen } from "@/lib/operating-hours"

// Removed MenuButtonProps since it fetches its own state

const DISCOVERY_KEY = "qs_menu_btn_discovered"
const IDLE_DELAY_MIN_MS = 8000
const IDLE_DELAY_RANGE_MS = 2000
const TOOLTIP_DURATION_MS = 3000

const INTERACTION_HOVER = 1
const INTERACTION_FOCUS = 2
const INTERACTION_PRESS = 4

function formatRelativeTime(timestamp: number) {
  const diffInMinutes = Math.floor((Date.now() - timestamp) / 60000)
  if (diffInMinutes < 1) return "Just now"
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  return `${Math.floor(diffInHours / 24)}d ago`
}

export default function MenuButton() {
  const { themeVars } = useCustomerTheme()
  const [open, setOpen] = useState(false)
  const [notificationsExpanded, setNotificationsExpanded] = useState(false)
  const [callWaiterEnabled, setCallWaiterEnabled] = useState(true)
  const [restaurant, setRestaurant] = useState<any>(null)
  const params = useParams()
  const router = useRouter()
  const servicePointId = params.servicePointId as string

  const {
    notifications,
    unreadCount,
    isSessionValid,
    markAsRead,
    markAllAsRead,
    feedbackOrder,
    setFeedbackOrder
  } = useCustomerGuestRealtime().notifications

  // ── Discovery state (first visit tooltip) ──
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipDismissing, setTooltipDismissing] = useState(false)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Idle attention halo ──
  const ringRef = useRef<HTMLSpanElement>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Badge pop ──
  const prevUnreadRef = useRef(unreadCount)
  const [badgePop, setBadgePop] = useState(false)

  // A bitmask keeps overlapping hover/focus/press states in one value.
  const [interactionMask, setInteractionMask] = useState(0)
  const isInteracting = interactionMask !== 0

  // When popover opens, do NOT auto-mark all as read.
  // The user must explicitly tap "Mark all read" or tap individual items.

  // Fetch settings once on mount to check if callWaiterEnabled is true
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const id = getBusinessId()
        if (!id || id === "undefined") return
        const res = await apiClient.get(`/public/business-config?businessId=${id}`)

        const restaurant = res.data
        const isEnabled = restaurant?.orderingPreferences?.callWaiterEnabled ?? restaurant?.settings?.callWaiterEnabled ?? true
        const isOpen = isRestaurantOpen(restaurant?.operatingHours, restaurant?.timezone)

        setCallWaiterEnabled(isEnabled && isOpen)
        setRestaurant(restaurant)
      } catch { }
    }
    fetchSettings()
  }, [])

  // Timer to update relative timestamps
  const [, setNow] = useState(Date.now())
  useEffect(() => {
    if (!open) return
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [open])

  // ── First-visit discovery tooltip ──
  useEffect(() => {
    try {
      const discovered = sessionStorage.getItem(DISCOVERY_KEY)
      if (!discovered) {
        // Let the page settle before introducing the helper.
        const tooltipDelay = setTimeout(() => {
          setShowTooltip(true)
          // Auto-dismiss tooltip
          tooltipTimerRef.current = setTimeout(() => {
            setTooltipDismissing(true)
            setTimeout(() => {
              setShowTooltip(false)
              setTooltipDismissing(false)
            }, 300)
          }, TOOLTIP_DURATION_MS)
        }, 600)
        sessionStorage.setItem(DISCOVERY_KEY, "1")
        return () => clearTimeout(tooltipDelay)
      }
    } catch {
      // sessionStorage unavailable — skip
    }
  }, [])

  // Dismiss tooltip when button is tapped
  const dismissTooltip = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    if (showTooltip) {
      setTooltipDismissing(true)
      setTimeout(() => {
        setShowTooltip(false)
        setTooltipDismissing(false)
      }, 250)
    }
  }, [showTooltip])

  // ── One idle halo every 8–10s while the control is untouched ──
  useEffect(() => {
    const ring = ringRef.current

    const stopHalo = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      ring?.classList.remove("menu-btn-ring-a", "menu-btn-ring-b")
    }

    stopHalo()

    if (open || isInteracting || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return stopHalo
    }

    const scheduleHalo = () => {
      const delay = IDLE_DELAY_MIN_MS + Math.random() * IDLE_DELAY_RANGE_MS

      idleTimerRef.current = setTimeout(() => {
        const halo = ringRef.current
        if (!halo) return

        // Alternate equivalent class names to restart the one-shot animation
        // without forcing layout or measuring the DOM.
        const nextClass = halo.classList.contains("menu-btn-ring-a")
          ? "menu-btn-ring-b"
          : "menu-btn-ring-a"
        halo.classList.remove("menu-btn-ring-a", "menu-btn-ring-b")
        halo.classList.add(nextClass)
        scheduleHalo()
      }, delay)
    }

    scheduleHalo()

    return stopHalo
  }, [isInteracting, open])

  // ── Badge pop when unread goes from 0 → positive ──
  useEffect(() => {
    if (prevUnreadRef.current === 0 && unreadCount > 0) {
      setBadgePop(true)
      const t = setTimeout(() => setBadgePop(false), 400)
      return () => clearTimeout(t)
    }
    prevUnreadRef.current = unreadCount
  }, [unreadCount])

  const setInteraction = useCallback((flag: number, active: boolean) => {
    setInteractionMask((current) => active ? current | flag : current & ~flag)
  }, [])

  const closeMenu = useCallback(() => {
    setNotificationsExpanded(false)
    setOpen(false)
  }, [])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setOpen(true)
          dismissTooltip()
        } else {
          closeMenu()
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          className={`
            fixed z-50 w-14 h-14 rounded-full
            bg-[var(--brand-secondary,#2B304C)]
            text-[var(--brand-primary,var(--color-primary))]
            border-2 border-[var(--brand-primary,var(--color-primary))]/30
            cursor-pointer select-none
            flex items-center justify-center
            transform-gpu transition-[transform,box-shadow] duration-[240ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]
            hover:shadow-[0_8px_30px_rgba(0,0,0,0.18)]
            active:scale-[0.96] active:shadow-md
            motion-reduce:transition-none
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,var(--color-primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-background
            shadow-xl
            ${open ? "shadow-2xl scale-100 bg-[var(--brand-secondary,#2B304C)]/90" : ""}
          `}
          style={{
            top: "max(1rem, env(safe-area-inset-top))",
            right: "max(1rem, env(safe-area-inset-right))",
          }}
          onMouseEnter={() => setInteraction(INTERACTION_HOVER, true)}
          onMouseLeave={() => {
            setInteraction(INTERACTION_HOVER, false)
            setInteraction(INTERACTION_PRESS, false)
          }}
          onPointerDown={() => setInteraction(INTERACTION_PRESS, true)}
          onPointerUp={() => setInteraction(INTERACTION_PRESS, false)}
          onPointerCancel={() => setInteraction(INTERACTION_PRESS, false)}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) {
              setInteraction(INTERACTION_FOCUS, true)
            }
          }}
          onBlur={() => setInteraction(INTERACTION_FOCUS, false)}
          aria-label={`Menu and notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
          aria-expanded={open}
          aria-controls="quickserve-customer-menu"
        >
          {/* The halo expands independently; the button itself never moves. */}
          <span
            ref={ringRef}
            aria-hidden="true"
            className="absolute inset-0 rounded-full border-2 border-[var(--brand-primary,var(--color-primary))]/40 pointer-events-none opacity-0"
          />

          {/* Central menu icon transitions into a close affordance. */}
          <span aria-hidden="true" className="relative block w-6 h-6">
            <LayoutGrid
              className={`absolute inset-0 w-6 h-6 transform-gpu transition-[transform,opacity] duration-[260ms] ease-out motion-reduce:transition-none ${open ? "rotate-45 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
                }`}
            />
            <X
              className={`absolute inset-0 w-6 h-6 transform-gpu transition-[transform,opacity] duration-[260ms] ease-out motion-reduce:transition-none ${open ? "rotate-0 scale-100 opacity-100" : "-rotate-45 scale-75 opacity-0"
                }`}
            />
          </span>

          {/* Unread badge */}
          {unreadCount > 0 && (
            <span
              className={`
                absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold
                px-1.5 py-0.5 rounded-full min-w-[20px]
                flex items-center justify-center shadow-sm
                ${badgePop ? "menu-badge-pop" : ""}
              `}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close guest utility menu"
          onClick={closeMenu}
          className="fixed inset-0 z-40 cursor-default bg-black/35 backdrop-blur-[1px] animate-in fade-in-0 duration-200 motion-reduce:animate-none"
        />
      )}

      {/* One-time helper tooltip */}
      {showTooltip && (
        <div
          role="status"
          aria-live="polite"
          className={`
            fixed z-50 pointer-events-none
            bg-foreground/90 text-background text-xs font-medium
            px-3 py-1.5 rounded-lg shadow-lg
            whitespace-nowrap
            ${tooltipDismissing ? "menu-tooltip-out" : "menu-tooltip-in"}
          `}
          style={{
            top: "max(2rem, calc(env(safe-area-inset-top) + 1rem))",
            right: "max(5.5rem, calc(env(safe-area-inset-right) + 4.5rem))",
          }}
        >
          Tap for menu &amp; notifications
        </div>
      )}

      <PopoverContent
        id="quickserve-customer-menu"
        aria-label="Guest utility menu"
        style={themeVars}
        sideOffset={12}
        collisionPadding={16}
        className="customer-menu-panel w-[min(calc(100vw-2rem),22rem)] max-h-[calc(100dvh-6rem)] overflow-hidden rounded-[1.75rem] border-border/70 bg-card/98 p-3 shadow-2xl backdrop-blur-xl motion-reduce:animate-none"
        align="end"
      >
        {/* Quick Actions at the top */}
        <div className="space-y-1" data-testid="guest-utility-menu-list">
          <div className="space-y-1">
            {callWaiterEnabled && (
              isSessionValid ? (
                <Link
                  href={`/s/${servicePointId}/waitstaff-request`}
                  className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#EA601A)]"
                  onClick={closeMenu}
                  data-testid="guest-utility-waitstaff"
                >
                  <span className="group flex min-h-18 w-full items-center gap-3 rounded-2xl border border-[var(--brand-primary,#EA601A)]/15 bg-[var(--brand-primary,#EA601A)]/10 px-4 py-3 text-left transition-[background-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--brand-primary,#EA601A)]/15 hover:shadow-sm active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#EA601A)] motion-reduce:transform-none motion-reduce:transition-none">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary,#EA601A)]/15 text-[var(--brand-primary,#EA601A)]">
                      <Bell className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-foreground">
                        Request Waitstaff
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                        Get assistance at your service point.
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--brand-primary,#EA601A)] transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none" />
                  </span>
                </Link>
              ) : (
                <div data-testid="guest-utility-waitstaff">
                  <button
                    type="button"
                    disabled
                    className="flex min-h-18 w-full cursor-not-allowed items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-left opacity-65"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                      <Bell className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-foreground">
                        Request Waitstaff
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                        Session expired. Rescan the QR code.
                      </span>
                    </span>
                  </button>
                </div>
              )
            )}
            <Link
              href={`/s/${servicePointId}/orders`}
              className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={closeMenu}
              data-testid="guest-utility-orders"
            >
              <span className="group flex min-h-17 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-[background-color,transform] duration-200 ease-out hover:bg-secondary/65 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-foreground">
                    My Orders
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                    Order history
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none" />
              </span>
            </Link>
          </div>
        </div>

        <button
          type="button"
          data-testid="guest-utility-notifications"
          aria-expanded={notificationsExpanded}
          aria-controls="guest-utility-notification-list"
          onClick={() => setNotificationsExpanded((current) => !current)}
          className="group flex min-h-17 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-200 ease-out hover:bg-secondary/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-sm font-black text-foreground">
            Notifications
          </span>
          {unreadCount > 0 && (
            <span className="flex min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 py-1 text-[10px] font-black text-white shadow-sm">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out motion-reduce:transition-none ${
              notificationsExpanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {/* Notifications List */}
        <div
          aria-hidden={!notificationsExpanded}
          inert={!notificationsExpanded}
          className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none ${
            notificationsExpanded
              ? "mt-2 grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <section
              id="guest-utility-notification-list"
              data-testid="guest-utility-notification-list"
              aria-label="Notifications"
              className="overflow-hidden rounded-2xl border border-border/70 bg-secondary/30"
            >
              <div className="flex items-center justify-between border-b border-border/70 px-3 py-2.5">
                <p className="text-xs font-black text-foreground">
                  Recent notifications
                </p>
                {notifications.some((notification) => !notification.isRead) && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-[min(42dvh,21rem)] space-y-1 overflow-y-auto overscroll-contain p-2">
          {notifications.length === 0 ? (
            <div className="py-8 px-4 text-center flex flex-col items-center justify-center opacity-70">
              <Bell className="w-8 h-8 text-muted-foreground mb-2 opacity-20" />
              <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <button
                key={notif.id}
                type="button"
                onClick={() => {
                  markAsRead(notif.id)
                  if (notif.actionUrl) {
                    closeMenu()
                    router.push(notif.actionUrl)
                  }
                }}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-2 group ${notif.actionUrl ? 'cursor-pointer hover:scale-[1.02] active:scale-95' : 'cursor-default'
                  } ${notif.isRead ? 'bg-transparent hover:bg-secondary/50 opacity-80' : 'bg-secondary hover:bg-secondary/80 shadow-sm'
                  }`}
              >
                <div className="flex gap-3 items-start flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-semibold text-sm truncate ${!notif.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notif.title}
                      </span>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary, #EA601A)' }} />
                      )}
                    </div>
                    <p className={`text-xs leading-relaxed mb-2 ${!notif.isRead ? 'text-foreground/90' : 'text-muted-foreground/80'}`}>
                      {notif.subtitle}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(notif.timestamp)}
                    </div>
                  </div>
                </div>
                {notif.actionUrl && (
                  <ChevronRight className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${!notif.isRead ? '' : 'text-muted-foreground/50'}`}
                    style={!notif.isRead ? { color: 'var(--brand-primary, #EA601A)' } : {}}
                  />
                )}
              </button>
            ))
          )}
              </div>
            </section>
          </div>
        </div>
      </PopoverContent>

      {feedbackOrder && (
        <FeedbackModal
          isOpen={!!feedbackOrder}
          setIsOpen={(open) => { if (!open) setFeedbackOrder(null) }}
          orderId={feedbackOrder.orderId}
          businessId={feedbackOrder.businessId || getBusinessId()}
          onSubmitted={() => setFeedbackOrder(null)}
          reservationUrl={restaurant?.slug && restaurant?.countryCode ? `/reserve/${restaurant.countryCode.toLowerCase()}/${restaurant.slug}` : undefined}
          businessName={restaurant?.displayName || restaurant?.name}
        />
      )}
    </Popover>
  )
}
