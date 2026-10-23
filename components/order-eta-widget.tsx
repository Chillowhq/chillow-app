"use client"

import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from "react"
import { motion } from "framer-motion"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, ChevronDown, Clock, Coffee, Package, Pizza, ShoppingBag, UtensilsCrossed, Utensils, XCircle } from "lucide-react"
import { apiClient } from "@/lib/axios-config"
import { getBusinessId } from "@/lib/business-info"
import {
  getCustomerOrderProgress,
  getCustomerOrderPresentation,
} from "@/lib/customer-order-progress"
import type { CustomerOrderProgress } from "@/lib/customer-order-progress"
import { formatCountdown, formatAbsoluteTime } from "@/lib/order-eta"
import { ensureSessionId, getTableToken, isTableSessionValid, getSessionInstanceId } from "@/lib/guest-session"
import { useEventSource } from "@/hooks/use-event-source"
import { useFloatingWidgetPosition } from "@/hooks/use-floating-widget-position"
import { useCustomerTheme } from "@/components/providers/customer-theme-provider"

const WIDGET_STATUSES = new Set(["placed", "in_progress", "preparing", "ready"])
const TERMINAL_STATUSES = new Set(["cancelled", "completed", "served"])

type OrderEta = {
  orderId: string
  businessId?: string | null
  servicePointLabel?: string
  status: string
  sessionId?: string | null
  createdAt?: string
  updatedAt?: string
  estimatedPrepMinutes?: number | null
  estimatedReadyAt?: string | null
  customerProgress?: CustomerOrderProgress | null
  customerStatusMessage?: string | null
  total?: number
  currency?: string
  items?: any[]
}

function getCreatedTime(order: OrderEta) {
  const createdAt = Date.parse(order.createdAt || "")
  const updatedAt = Date.parse(order.updatedAt || "")
  if (Number.isFinite(createdAt)) return createdAt
  if (Number.isFinite(updatedAt)) return updatedAt
  return 0
}

function getMyOrderIds(businessId: string, servicePointId: string) {
  try {
    const sid = getSessionInstanceId(servicePointId)
    if (!sid) return []
    const stored = localStorage.getItem(`quickserve_my_orders_${businessId}_${servicePointId}_${sid}`)
    return stored ? (JSON.parse(stored) as string[]) : []
  } catch {
    return []
  }
}

function getStoredOrdersKey(businessId: string, servicePointId: string) {
  return `quickserve_order_eta_orders_${businessId}_${servicePointId}`
}

function getCollapsedOrdersKey(businessId: string, servicePointId: string) {
  return `quickserve_order_eta_collapsed_${businessId}_${servicePointId}`
}

function readStoredOrders(businessId: string, servicePointId: string) {
  try {
    const stored = localStorage.getItem(getStoredOrdersKey(businessId, servicePointId))
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? (parsed as OrderEta[]) : []
  } catch {
    return []
  }
}

function saveStoredOrders(businessId: string, servicePointId: string, orders: OrderEta[]) {
  try {
    const visible = orders.filter(shouldKeepWidgetOrder)
    if (visible.length === 0) {
      localStorage.removeItem(getStoredOrdersKey(businessId, servicePointId))
      return
    }
    localStorage.setItem(getStoredOrdersKey(businessId, servicePointId), JSON.stringify(visible))
  } catch { }
}

function readCollapsedOrderIds(businessId: string, servicePointId: string) {
  try {
    const stored = localStorage.getItem(getCollapsedOrdersKey(businessId, servicePointId))
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function saveCollapsedOrderIds(businessId: string, servicePointId: string, orderIds: Set<string>) {
  try {
    const ids = Array.from(orderIds)
    if (ids.length === 0) {
      localStorage.removeItem(getCollapsedOrdersKey(businessId, servicePointId))
      return
    }
    localStorage.setItem(getCollapsedOrdersKey(businessId, servicePointId), JSON.stringify(ids))
  } catch { }
}

function shouldKeepWidgetOrder(order: OrderEta) {
  return !!order?.orderId && WIDGET_STATUSES.has(order.status) && !TERMINAL_STATUSES.has(order.status)
}

function normalizeWidgetOrders(orders: OrderEta[], businessId: string, servicePointId: string, sessionId: string | null) {
  return orders
    .filter(shouldKeepWidgetOrder)
    .filter((order) => isOwnOrder(order, businessId, servicePointId, sessionId))
    .sort((a, b) => getCreatedTime(b) - getCreatedTime(a))
}

function isOwnOrder(order: OrderEta, businessId: string, servicePointId: string, sessionId: string | null) {
  // Never compare a label against an id — only compare servicePointId directly.
  if (sessionId && order.sessionId && order.sessionId === sessionId) return true
  const myOrderIds = getMyOrderIds(businessId, servicePointId)
  return myOrderIds.includes(order.orderId)
}

function getStatusCopy(order: OrderEta, nowMs = Date.now()) {
  const progress = getCustomerOrderProgress(order)
  const presentation = getCustomerOrderPresentation(progress, nowMs)

  // 1. Cancelled
  if (order.status === "cancelled") {
    return {
      title: "Order Cancelled",
      subtitle: null,
      ringColor: "text-red-500",
      bgRingColor: "text-red-100 dark:text-red-950",
      isReady: false,
      isDelayed: false,
      showCallWaiter: false,
    }
  }

  // 2. Ready
  if (order.status === "ready") {
    return {
      title: presentation.headline,
      subtitle: presentation.secondaryMessage,
      ringColor: "text-green-500",
      bgRingColor: "text-green-100 dark:text-green-950",
      isReady: true,
      isDelayed: false,
      showCallWaiter: false,
    }
  }

  // 3. In Progress / Preparing
  if (order.status === "in_progress" || order.status === "preparing") {
    return {
      title: presentation.headline,
      subtitle: presentation.secondaryMessage,
      ringColor: "text-orange-500",
      bgRingColor: "text-orange-100 dark:text-orange-950",
      isReady: false,
      isDelayed: false,
      showCallWaiter: presentation.assistanceAvailable,
    }
  }

  // 4. Placed
  return {
    title: presentation.headline,
    subtitle: presentation.secondaryMessage,
    ringColor: "text-slate-400 dark:text-slate-500",
    bgRingColor: "text-slate-100 dark:text-slate-800",
    isReady: false,
    isDelayed: false,
    showCallWaiter: presentation.assistanceAvailable,
  }
}

function calculateProgress(order: OrderEta, nowMs: number) {
  if (order.status === "ready") return 100
  const progress = getCustomerOrderProgress(order)
  if (progress.etaMode !== "overall" || !progress.estimatedReadyAt) return 10

  const createdMs = Date.parse(progress.estimateStartedAt || order.updatedAt || "")
  const readyMs = Date.parse(progress.estimatedReadyAt)
  if (!Number.isFinite(createdMs) || !Number.isFinite(readyMs)) return 10
  if (readyMs <= createdMs) return 100

  const total = readyMs - createdMs
  const elapsed = nowMs - createdMs
  // Elapsed preparation estimates remain visibly in progress until fulfilment
  // reports ready; the ring must not imply completion on its own.
  return Math.min(95, Math.max(5, (elapsed / total) * 100))
}

const CIRCLE_RADIUS = 40
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

const FLOATING_WIDGET_SAFE_AREA_STYLE = {
  top: "max(1rem, env(safe-area-inset-top, 0px))",
  right: "max(1rem, env(safe-area-inset-right, 0px))",
  bottom: "max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 5.5rem))",
  left: "max(1rem, env(safe-area-inset-left, 0px))",
}

type DraggableOrderEtaButtonProps = {
  children: ReactNode
  className: string
  ariaLabel: string
  layoutKey: string
  onOpen: () => void
}

function DraggableOrderEtaButton({
  children,
  className,
  ariaLabel,
  layoutKey,
  onOpen,
}: DraggableOrderEtaButtonProps) {
  const {
    constraintsRef,
    widgetRef,
    x,
    y,
    isPositionReady,
    dragConstraints,
    onDragStart,
    onDragEnd,
    shouldHandleClick,
  } = useFloatingWidgetPosition({ enabled: true, layoutKey })

  return (
    <div
      ref={constraintsRef}
      className="pointer-events-none fixed z-50"
      style={FLOATING_WIDGET_SAFE_AREA_STYLE}
    >
      <motion.button
        ref={widgetRef}
        type="button"
        drag
        dragConstraints={dragConstraints}
        dragMomentum={false}
        dragElastic={0}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={(event) => {
          if (shouldHandleClick(event)) onOpen()
        }}
        aria-label={ariaLabel}
        style={{ x, y, touchAction: "none" }}
        className={`pointer-events-auto absolute left-0 top-0 cursor-grab select-none touch-none active:cursor-grabbing ${isPositionReady ? "" : "invisible"} ${className}`}
      >
        {children}
      </motion.button>
    </div>
  )
}

export default function OrderEtaWidget() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const servicePointId = params.servicePointId as string | undefined
  const requestedOrderId = searchParams.get("orderId")

  const { branding } = useCustomerTheme()

  const [businessId, setBusinessId] = useState("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [activeOrders, setActiveOrders] = useState<OrderEta[]>([])
  const [cancelledOrder, setCancelledOrder] = useState<OrderEta | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now())
  const [isSessionValid, setIsSessionValid] = useState(false)
  const [hasLoadedPersistedOrders, setHasLoadedPersistedOrders] = useState(false)
  const processedNewOrdersRef = useRef<Set<string>>(new Set())
  const collapsedOrderIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!servicePointId) return
    setCancelledOrder(null)
    setHasLoadedPersistedOrders(false)
    setBusinessId(searchParams.get("businessId") || getBusinessId())
    setSessionId(ensureSessionId())
    setIsSessionValid(isTableSessionValid(servicePointId))
  }, [searchParams, servicePointId])

  useEffect(() => {
    if (!businessId || !servicePointId) return

    const restoredOrders = normalizeWidgetOrders(readStoredOrders(businessId, servicePointId), businessId, servicePointId, sessionId)
    collapsedOrderIdsRef.current = new Set(readCollapsedOrderIds(businessId, servicePointId))
    setActiveOrders((prev) => (prev.length > 0 ? prev : restoredOrders))
    setHasLoadedPersistedOrders(true)
  }, [businessId, sessionId, servicePointId])

  useEffect(() => {
    if (!hasLoadedPersistedOrders || !businessId || !servicePointId) return
    saveStoredOrders(businessId, servicePointId, activeOrders)
  }, [activeOrders, businessId, hasLoadedPersistedOrders, servicePointId])

  const fetchActiveOrders = useCallback(async () => {
    if (!businessId || !servicePointId || !sessionId) return
    const currentToken = getTableToken(servicePointId)
    if (!currentToken) return

    try {
      const res = await apiClient.get("/orders/current", {
        params: { businessId, sessionId },
        headers: { "x-table-session-token": currentToken },
      })
      const orders: OrderEta[] = res.data || []

      const active = normalizeWidgetOrders(orders, businessId, servicePointId, sessionId)

      setActiveOrders(active)
    } catch (err) {
      console.error("[OrderEtaWidget] Failed to fetch active orders", err)
    }
  }, [businessId, sessionId, servicePointId])

  const mergeOrderFromEvent = useCallback((incoming?: OrderEta | null) => {
    if (!incoming) {
      fetchActiveOrders()
      return
    }

    if (!businessId || !servicePointId) return
    if (incoming.businessId && incoming.businessId !== businessId) return
    if (!isOwnOrder(incoming, businessId, servicePointId, sessionId)) return

    setNowMs(Date.now())

    if (incoming.status === "cancelled") {
      setCancelledOrder(incoming)
      setIsExpanded(true)
      collapsedOrderIdsRef.current.delete(incoming.orderId)
      saveCollapsedOrderIds(businessId, servicePointId, collapsedOrderIdsRef.current)
      setActiveOrders((prev) => prev.filter((order) => order.orderId !== incoming.orderId))
      return
    }

    setCancelledOrder(null)
    setActiveOrders((prev) => {
      const withoutIncoming = prev.filter((order) => order.orderId !== incoming.orderId)

      if (!shouldKeepWidgetOrder(incoming)) {
        return withoutIncoming
      }

      return normalizeWidgetOrders([incoming, ...withoutIncoming], businessId, servicePointId, sessionId)
    })
  }, [businessId, fetchActiveOrders, sessionId, servicePointId])

  useEffect(() => {
    fetchActiveOrders()
  }, [fetchActiveOrders])

  useEffect(() => {
    if (activeOrders.length === 0 && !cancelledOrder) {
      setIsExpanded(false)
      return
    }
    if (cancelledOrder || activeOrders.length === 0) return

    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [activeOrders.length, cancelledOrder])

  useEffect(() => {
    if (!cancelledOrder) return

    const timeout = window.setTimeout(() => {
      setCancelledOrder(null)
      setIsExpanded(false)
    }, 5000)

    return () => window.clearTimeout(timeout)
  }, [cancelledOrder])

  const token = servicePointId ? getTableToken(servicePointId) : null
  const sseUrl = businessId && servicePointId && sessionId && isSessionValid && token
    ? `/events?role=table&businessId=${encodeURIComponent(businessId)}&token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`
    : ""

  useEventSource(sseUrl, {
    order_created: (data: any) => {
      mergeOrderFromEvent(data?.order)
    },
    order_updated: (data: any) => {
      mergeOrderFromEvent(data?.order)
    },
  }, { onReconnect: fetchActiveOrders })

  // Keep cached active orders current. ETA remains backend-authoritative; the
  // client never restarts or fabricates a whole-order countdown.
  const visibleOrders = useMemo(() => {
    if (!businessId || !servicePointId) return []
    return normalizeWidgetOrders(activeOrders, businessId, servicePointId, sessionId)
  }, [activeOrders, businessId, sessionId, servicePointId])

  useEffect(() => {
    let shouldExpand = false
    const now = Date.now()
    const isConfirmationPage = pathname?.includes("/confirmation")
    const requestedOrder = isConfirmationPage && requestedOrderId
      ? visibleOrders.find((order) => order.orderId === requestedOrderId)
      : null

    if (requestedOrder && !collapsedOrderIdsRef.current.has(requestedOrder.orderId)) {
      processedNewOrdersRef.current.add(requestedOrder.orderId)
      shouldExpand = true
    }

    visibleOrders.forEach(order => {
      if (collapsedOrderIdsRef.current.has(order.orderId)) return

      if (!processedNewOrdersRef.current.has(order.orderId)) {
        processedNewOrdersRef.current.add(order.orderId)

        if (order.createdAt) {
          const createdMs = Date.parse(order.createdAt)
          if (Number.isFinite(createdMs) && (now - createdMs) < 15000) {
            shouldExpand = true
          }
        }
      }
    })

    if (shouldExpand) {
      setIsExpanded(true)
    }
  }, [pathname, requestedOrderId, visibleOrders])

  const expandWidget = useCallback(() => {
    visibleOrders.forEach((order) => collapsedOrderIdsRef.current.delete(order.orderId))
    if (businessId && servicePointId) saveCollapsedOrderIds(businessId, servicePointId, collapsedOrderIdsRef.current)
    setIsExpanded(true)
  }, [businessId, servicePointId, visibleOrders])

  const collapseWidget = useCallback(() => {
    visibleOrders.forEach((order) => collapsedOrderIdsRef.current.add(order.orderId))
    if (businessId && servicePointId) saveCollapsedOrderIds(businessId, servicePointId, collapsedOrderIdsRef.current)
    setIsExpanded(false)
  }, [businessId, servicePointId, visibleOrders])

  if (!cancelledOrder && (visibleOrders.length === 0 || !businessId || !servicePointId)) return null

  const handleViewOrder = (orderId: string) => {
    collapsedOrderIdsRef.current.add(orderId)
    if (businessId && servicePointId) saveCollapsedOrderIds(businessId, servicePointId, collapsedOrderIdsRef.current)
    setIsExpanded(false)
    router.push(`/s/${servicePointId}/status?orderId=${encodeURIComponent(orderId)}&businessId=${encodeURIComponent(businessId)}&scope=current`)
  }

  const handleCallWaiter = () => {
    visibleOrders.forEach((order) => collapsedOrderIdsRef.current.add(order.orderId))
    if (businessId && servicePointId) saveCollapsedOrderIds(businessId, servicePointId, collapsedOrderIdsRef.current)
    setIsExpanded(false)
    router.push(`/s/${servicePointId}/waitstaff-request?businessId=${encodeURIComponent(businessId)}&reason=${encodeURIComponent("Delayed order")}`)
  }

  if (cancelledOrder) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm animate-in fade-in" />
        <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] border-t border-border bg-card p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-10 w-10 rounded-full object-cover border border-border" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Utensils className="h-5 w-5" />
                </div>
              )}
              <span className="text-base font-black text-foreground">
                {branding?.displayName || "Your Order"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center text-center pb-6">
            <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
              <XCircle className="h-16 w-16" />
            </div>
            <div className="animate-in fade-in duration-500 flex flex-col items-center">
              <h2 className="mb-1 text-xl font-black text-foreground tracking-tight">Order cancelled</h2>
              <p className="text-sm font-medium text-muted-foreground">This order was cancelled</p>
            </div>
          </div>
        </div>
      </>
    )
  }
  // MINIMIZED STATE
  if (!isExpanded) {
    if (visibleOrders.length > 1) {
      // Multiple orders minimized
      return (
        <DraggableOrderEtaButton
          onOpen={expandWidget}
          layoutKey="multiple"
          ariaLabel={`Open ${visibleOrders.length} active orders. Drag to reposition.`}
          className="flex items-center gap-3 rounded-full border-2 border-[var(--brand-secondary,#2B304C)] bg-background/95 px-4 py-3 shadow-2xl backdrop-blur-xl transition hover:scale-105 active:scale-95 motion-reduce:transition-none dark:border-[var(--brand-secondary,#4A5568)]"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-muted,var(--primary))] text-[var(--brand-primary,var(--color-primary))]">
            <Utensils className="h-4 w-4" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-black text-foreground">{visibleOrders.length} Orders</span>
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Active</span>
          </div>
        </DraggableOrderEtaButton>
      )
    }

    // Single order minimized
    const order = visibleOrders[0]
    const customerProgress = getCustomerOrderProgress(order)
    const presentation = getCustomerOrderPresentation(customerProgress, nowMs)
    const hasOverallEta = !!presentation.overallEstimatedReadyAt
    const countdown = hasOverallEta
      ? formatCountdown(presentation.overallEstimatedReadyAt, nowMs)
      : null
    const copy = getStatusCopy(order, nowMs)
    const progress = calculateProgress(order, nowMs)
    const strokeDashoffset = CIRCLE_CIRCUMFERENCE - (progress / 100) * CIRCLE_CIRCUMFERENCE

    return (
      <DraggableOrderEtaButton
        onOpen={expandWidget}
        layoutKey="single"
        ariaLabel="Open your active order. Drag to reposition."
        className={`flex items-center gap-3 rounded-full border-2 border-[var(--brand-secondary,#2B304C)] bg-background/95 pr-5 pl-2 py-2 shadow-2xl backdrop-blur-xl transition hover:scale-105 active:scale-95 motion-reduce:transition-none dark:border-[var(--brand-secondary,#4A5568)] ${copy.isReady ? "motion-safe:animate-bounce border-green-500/30 dark:border-green-500/30" : ""}`}
      >
        <div className="relative h-10 w-10 shrink-0">
          <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
            <circle
              className={copy.bgRingColor}
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              r={CIRCLE_RADIUS}
              cx="50"
              cy="50"
            />
            <circle
              className={`${copy.ringColor} transition-all duration-1000 ease-in-out`}
              strokeWidth="8"
              strokeDasharray={CIRCLE_CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={CIRCLE_RADIUS}
              cx="50"
              cy="50"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <Utensils className={`h-4 w-4 ${copy.isReady ? "text-green-600" : "text-foreground"}`} />
            )}
          </div>
        </div>
        <div className="flex flex-col items-start" key={order.status}>
          <span className={`text-sm font-black animate-in fade-in duration-500 ${copy.isReady ? "text-green-600" : "text-foreground"}`}>
            {copy.isReady ? "Ready" : countdown || (order.status === "placed" ? "Placed" : "In Progress")}
          </span>
          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider animate-in fade-in duration-500">
            {copy.isReady || !countdown ? "Tap to view" : "ETA"}
          </span>
        </div>
      </DraggableOrderEtaButton>
    )
  }

  // EXPANDED STATE
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={collapseWidget}
      />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-[2.5rem] bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-full duration-300 max-h-[85dvh] overflow-y-auto">

        {/* ── HEADER ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            {/* Logo */}
            {branding?.logoUrl ? (
              <div className="h-14 w-14 rounded-2xl overflow-hidden border border-border shadow-sm shrink-0">
                <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-muted,hsl(var(--secondary)))] text-[var(--brand-primary,var(--color-primary))] shrink-0">
                <Utensils className="h-6 w-6" />
              </div>
            )}
            {/* Title area */}
            <div className="flex flex-col items-start">
              <span className="text-lg font-black text-foreground leading-tight">Active Order</span>
              {branding?.displayName && (
                <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                  {branding.displayName}
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--brand-primary,var(--color-primary))] text-white" aria-hidden="true">
                    <svg viewBox="0 0 10 8" fill="none" className="h-2 w-2"><path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={collapseWidget}
              aria-label="Minimize widget"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-muted-foreground transition hover:bg-secondary/80 active:scale-95"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── MULTIPLE ORDERS VIEW ──────────────────────────────── */}
        {visibleOrders.length > 1 ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto px-5 pb-8">
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Active Orders</p>
            {visibleOrders.map(order => {
              const customerProgress = getCustomerOrderProgress(order)
              const presentation = getCustomerOrderPresentation(customerProgress, nowMs)
              const countdown = presentation.overallEstimatedReadyAt
                ? formatCountdown(presentation.overallEstimatedReadyAt, nowMs)
                : null
              const copy = getStatusCopy(order, nowMs)
              return (
                <div key={order.orderId} className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm transition hover:shadow-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-muted,hsl(var(--secondary)))]">
                    <ShoppingBag className="h-5 w-5 text-[var(--brand-primary,var(--color-primary))]" />
                  </div>
                  <div className="flex-1 min-w-0" key={order.status}>
                    <p className="text-sm font-bold text-foreground mb-0.5 truncate animate-in fade-in duration-500">Order #{order.orderId.split("-").pop()}</p>
                    <p className={`text-xs font-semibold truncate animate-in fade-in duration-500 ${copy.isReady ? "text-green-600" : "text-muted-foreground"}`}>{copy.title}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0" key={order.status + "-time"}>
                    {(copy.isReady || countdown) && (
                      <span className={`text-base font-black tabular-nums animate-in fade-in duration-500 ${copy.isReady ? "text-green-600" : "text-foreground"}`}>
                        {copy.isReady ? "Ready ✓" : countdown}
                      </span>
                    )}
                    {presentation.assistanceAvailable && (
                      <button
                        onClick={handleCallWaiter}
                        className="px-3 py-1 rounded-full border border-border bg-secondary text-foreground text-xs font-bold transition hover:opacity-80 active:scale-95"
                      >
                        CALL WAITER
                      </button>
                    )}
                    <button
                      onClick={() => handleViewOrder(order.orderId)}
                      className="px-3 py-1 rounded-full bg-[var(--brand-muted,hsl(var(--secondary)))] text-[var(--brand-primary,var(--color-primary))] text-xs font-bold transition hover:opacity-80 active:scale-95"
                    >
                      View
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── SINGLE ORDER VIEW ──────────────────────────────── */
          (() => {
            const order = visibleOrders[0]
            const customerProgress = getCustomerOrderProgress(order)
            const presentation = getCustomerOrderPresentation(customerProgress, nowMs)
            const hasOverallEta = !!presentation.overallEstimatedReadyAt
            const countdown = hasOverallEta
              ? formatCountdown(presentation.overallEstimatedReadyAt, nowMs)
              : null
            const stationEtas = presentation.stationEtas
            const copy = getStatusCopy(order, nowMs)
            const progress = calculateProgress(order, nowMs)

            // Scaled ring — exact same math as before
            const LARGE_RADIUS = 80
            const LARGE_CIRCUMFERENCE = 2 * Math.PI * LARGE_RADIUS
            const strokeDashoffset = LARGE_CIRCUMFERENCE - (progress / 100) * LARGE_CIRCUMFERENCE

            // ── Order journey steps mapped from existing statuses ──────────
            const JOURNEY_STEPS = [
              { label: "Order Received", icon: ShoppingBag, statuses: ["placed"] },
              { label: "Preparing", icon: UtensilsCrossed, statuses: ["in_progress", "preparing"] },
              { label: "Ready", icon: Package, statuses: ["ready"] },
              { label: "Completed", icon: CheckCircle2, statuses: ["completed", "served"] },
            ]
            const activeStepIndex = JOURNEY_STEPS.findIndex(s => s.statuses.includes(order.status))

            return (
              <div className="flex flex-col pb-6" key={order.status}>

                {/* ── Timer section ─────────────────────────────────────── */}
                <div className="relative mx-5 overflow-hidden rounded-3xl bg-gradient-to-b from-[var(--brand-muted,hsl(var(--secondary)))] to-card px-4 pb-6 pt-5">

                  {/* Decorative background icons */}
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.06]">
                    <Pizza className="absolute left-2 top-4 h-14 w-14 rotate-[-15deg]" />
                    <Coffee className="absolute right-4 top-6 h-10 w-10 rotate-[12deg]" />
                    <UtensilsCrossed className="absolute bottom-4 left-4 h-12 w-12 rotate-[10deg]" />
                    <ShoppingBag className="absolute bottom-6 right-3 h-10 w-10 rotate-[-8deg]" />
                  </div>

                  {/* ETA is labelled as whole-order only when every unfinished
                      station has an authoritative completion estimate. */}
                  {!copy.isReady && (
                    <div className="relative z-10 mb-3 flex items-center justify-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[var(--brand-primary,var(--color-primary))]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {hasOverallEta ? "Estimated Time Remaining" : "Order Progress"}
                      </span>
                    </div>
                  )}

                  {/* Placed is a complete received marker; later states keep the existing progress math. */}
                  <div className="relative z-10 mx-auto mb-5 h-44 w-44 animate-in fade-in duration-500">
                    {order.status === "placed" && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-2 rounded-full border-[6px] border-stone-200/50 opacity-70 motion-safe:animate-[pulse_3.5s_ease-in-out_infinite] dark:border-stone-700/40"
                      />
                    )}
                    <svg className="h-full w-full -rotate-90 transform drop-shadow-sm" viewBox="0 0 200 200">
                      <circle
                        className={order.status === "placed" ? "text-stone-200/80 dark:text-stone-700/70" : copy.bgRingColor}
                        strokeWidth="14"
                        stroke="currentColor"
                        fill="transparent"
                        r={LARGE_RADIUS}
                        cx="100"
                        cy="100"
                      />
                      {order.status !== "placed" && (
                        <circle
                          className={`${copy.ringColor} transition-all duration-1000 ease-in-out`}
                          strokeWidth="14"
                          strokeDasharray={LARGE_CIRCUMFERENCE}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                          r={LARGE_RADIUS}
                          cx="100"
                          cy="100"
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {copy.isReady ? (
                        <>
                          <span className="text-4xl">🎉</span>
                          <span className="mt-2 text-sm font-bold text-green-600 uppercase tracking-widest">Ready</span>
                        </>
                      ) : countdown && order.status !== "placed" ? (
                        <>
                          <span className="text-[2.4rem] font-black text-foreground tabular-nums tracking-tighter leading-none">
                            {countdown}
                          </span>
                          <span className="mt-1 text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Minutes</span>
                        </>
                      ) : (
                        <>
                          <UtensilsCrossed className="h-10 w-10 text-[var(--brand-primary,var(--color-primary))]" />
                          <span className="mt-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {order.status === "placed" ? "Order Received" : "In Progress"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status copy */}
                  <div className="relative z-10 flex flex-col items-center text-center animate-in fade-in duration-500">
                    <h2 className="text-lg font-black text-foreground tracking-tight">{copy.title}</h2>
                    {copy.subtitle && (
                      <p className="mt-1 text-sm font-medium text-muted-foreground">{copy.subtitle}</p>
                    )}

                    {/* Expected time badge */}
                    {hasOverallEta && !copy.isReady && (() => {
                      const absTime = formatAbsoluteTime(new Date(presentation.overallEstimatedReadyAt!))
                      if (absTime) {
                        return (
                          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1">
                            <Clock className="h-3 w-3 text-[var(--brand-primary,var(--color-primary))]" />
                            <span className="text-xs font-bold text-foreground">Expected around {absTime}</span>
                          </div>
                        )
                      }
                      return null
                    })()}
                    {stationEtas.length > 0 && (
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        {stationEtas.map((eta) => (
                          <div
                            key={eta.key}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1"
                          >
                            <Clock className="h-3 w-3 text-[var(--brand-primary,var(--color-primary))]" />
                            <span className="text-xs font-bold text-foreground">{eta.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Order Journey Stepper ─────────────────────────────── */}
                <div className="mx-5 mt-5 overflow-hidden rounded-2xl border border-border bg-background px-4 py-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    {JOURNEY_STEPS.map((step, index) => {
                      const StepIcon = step.icon
                      const isDone = activeStepIndex > index
                      const isActive = activeStepIndex === index
                      return (
                        <div key={step.label} className="flex flex-1 flex-col items-center gap-1.5 relative">
                          {/* Connector line between steps */}
                          {index < JOURNEY_STEPS.length - 1 && (
                            <span
                              aria-hidden="true"
                              className={`absolute top-4 left-1/2 w-full h-[2px] -translate-y-1/2 transition-colors duration-500 ${isDone || isActive ? "bg-[var(--brand-primary,var(--color-primary))]" : "bg-border"
                                }`}
                              style={{ left: "50%", width: "calc(100% - 2rem)" }}
                            />
                          )}
                          {/* Icon circle */}
                          <div
                            className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500 ${isDone
                              ? "border-[var(--brand-primary,var(--color-primary))] bg-[var(--brand-primary,var(--color-primary))] text-white"
                              : isActive
                                ? "border-[var(--brand-primary,var(--color-primary))] bg-[var(--brand-muted,hsl(var(--secondary)))] text-[var(--brand-primary,var(--color-primary))]"
                                : "border-border bg-background text-muted-foreground"
                              }`}
                          >
                            {isDone ? (
                              <svg viewBox="0 0 10 8" fill="none" className="h-3 w-3"><path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            ) : (
                              <StepIcon className="h-3.5 w-3.5" />
                            )}
                          </div>
                          {/* Step number */}
                          <span className={`text-[9px] font-black uppercase tracking-wider leading-tight text-center transition-colors duration-500 ${isActive
                            ? "text-[var(--brand-primary,var(--color-primary))]"
                            : isDone
                              ? "text-foreground"
                              : "text-muted-foreground"
                            }`}>{step.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── Primary CTA ───────────────────────────────────────── */}
                <div className="mx-5 mt-4 flex flex-col gap-3">
                  {copy.showCallWaiter && (
                    <div className="animate-in slide-in-from-bottom-2 fade-in">
                      <p className="mb-2 text-center text-xs font-semibold text-muted-foreground">
                        Still waiting for preparation to start?
                      </p>
                      <button
                        onClick={handleCallWaiter}
                        className="w-full rounded-2xl bg-secondary py-4 text-sm font-black text-foreground transition hover:opacity-90 active:scale-[0.98]"
                      >
                        CALL WAITER
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => handleViewOrder(order.orderId)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary,var(--color-primary))] py-4 text-sm font-black text-white shadow-lg shadow-[var(--brand-primary,var(--color-primary))]/20 transition hover:opacity-90 active:scale-[0.98]"
                  >
                    <Utensils className="h-4 w-4" />
                    View Order Details
                  </button>

                  {copy.isReady && (
                    <button
                      onClick={collapseWidget}
                      className="w-full rounded-2xl border-2 border-border bg-background py-4 text-sm font-black text-muted-foreground transition hover:bg-secondary active:scale-[0.98]"
                    >
                      Minimize
                    </button>
                  )}
                </div>
              </div>
            )
          })()
        )}
      </div>
    </>
  )
}
