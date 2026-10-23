"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  UtensilsCrossed,
  BellRing,
  Hand,
  Utensils,
  PhoneCall,
  UserCheck,
  Volume2,
  VolumeX,
  RefreshCw,
  LogOut,
  Archive,
  Maximize,
  Minimize,
} from "lucide-react"
import apiClient from "@/lib/axios-config"
import { toast } from "sonner"
import { WaiterOrderCard } from "@/components/waitstaff-order-card"
import { KitchenOrder } from "@/components/kitchen-order-card"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useFocusMode } from "@/hooks/use-focus-mode"

import { useEventSource } from "@/hooks/use-event-source"

type OrdersFilter = "all" | "placed" | "in_progress" | "ready"
type CallsFilter = "all" | "pending" | "acknowledged" | "resolved" | "missed"
type Mode = "orders" | "calls"

type WaiterCounts = {
  placed: number
  in_progress: number
  ready: number
  completed: number
}

type ServiceRequest = {
  _id: string
  servicePointId: string
  displayLabel?: string
  servicePointLabel?: string
  servicePointQrCode?: string
  reason?: string
  note?: string
  status: "pending" | "acknowledged" | "resolved" | "missed"
  claimedBy: string | null
  claimedAt: string | null
  acknowledgedByStaffId?: string | null
  acknowledgedByName?: string | null
  resolvedBy: string | null
  resolvedByStaffId?: string | null
  resolvedByName?: string | null
  resolvedAt: string | null
  createdAt: string
  pendingExpiresAt?: string
  acknowledgedExpiresAt?: string
  missedAt?: string
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h`
}


export default function WaiterPage() {
  const router = useRouter()
  const { user, logout } = useAuthGuard({ requiredRole: "waiter" })
  const canViewPastOrders = Boolean(
    user?.permissions?.includes("orders.reconciliation.view")
    || user?.permissions?.includes("orders.reconcile"),
  )
  const { isFocusMode, enterFocusMode, exitFocusMode } = useFocusMode()
  const [mode, setMode] = useState<Mode>("orders")
  const [filter, setFilter] = useState<OrdersFilter>("placed")
  const [callsFilter, setCallsFilter] = useState<CallsFilter>("all")

  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [calls, setCalls] = useState<ServiceRequest[]>([])
  const [restaurant, setRestaurant] = useState<any>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // ✅ default sound ON
  const [audioEnabled, setAudioEnabled] = useState(true)
  const audioEnabledRef = useRef(audioEnabled)
  useEffect(() => {
    audioEnabledRef.current = audioEnabled
  }, [audioEnabled])

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Track previous “ready order ids” + “pending call ids”
  const prevReadyIds = useRef<Set<string>>(new Set())
  const prevPendingCallIds = useRef<Set<string>>(new Set())

  // Waiter ID dynamically pulls from secure staff session cookie context
  const staffId = user?.staffId || ""
  const callsRevisionRef = useRef(0)
  const callsReconciliationInFlightRef = useRef<Promise<void> | null>(null)
  const callsScopeRef = useRef("")

  useEffect(() => {
    callsScopeRef.current = [user?.businessId || "", staffId].join(":")
    callsRevisionRef.current += 1
    callsReconciliationInFlightRef.current = null
  }, [staffId, user?.businessId])
  useEffect(() => {
    audioRef.current = new Audio("/sounds/bell-sound-1.mp3")
  }, [])

  // ✅ CHANGED: ALWAYS fetch status=all so counts are correct no matter which tab you're on
  const fetchOrders = async () => {
    const res = await apiClient.get("/waitstaff", {
      params: { status: "all", businessId: user?.businessId },
      headers: { "X-STAFF-ID": staffId },
    })

    return {
      orders: (res.data.orders || []) as KitchenOrder[],
    }
  }

  const fetchCalls = useCallback(async () => {
    const res = await apiClient.get("/waitstaff/calls", {
      params: { status: "all", businessId: user?.businessId },
      headers: { "X-STAFF-ID": staffId },
    })
    return res.data.calls as ServiceRequest[]
  }, [staffId, user?.businessId])

  const fetchInitialData = async () => {
    const callsScopeAtStart = callsScopeRef.current
    const callsRevisionAtStart = callsRevisionRef.current
    try {
      setLoading(true)
      setError(null)

      const rid = user?.businessId || ""
      const [{ orders: newOrders }, newCalls, settingsRes, spRes] = await Promise.all([
        fetchOrders(),
        fetchCalls(),
        apiClient.get(`/public/business-config?businessId=${rid}`),
        apiClient.get("/waitstaff/service-points", { headers: { "X-STAFF-ID": staffId } }).catch(() => ({ data: [] }))
      ])

      const spMap = new Map()
      if (Array.isArray(spRes.data)) {
        spRes.data.forEach((sp: any) => {
          spMap.set(sp.servicePointId || sp._id, sp.label || sp.name)
        })
      }

      const applyDisplayLabel = (item: any) => {
        const canonicalServicePointId =
          item.servicePointId ||
          (item.servicePointLabel?.startsWith("sp_")
            ? item.servicePointLabel
            : "")
        if (!item.displayLabel && canonicalServicePointId) {
          item.displayLabel =
            spMap.get(canonicalServicePointId) ||
            item.servicePointLabel ||
            canonicalServicePointId
        }
        return item
      }

      newOrders.forEach(applyDisplayLabel)
      newCalls.forEach(applyDisplayLabel)

      prevReadyIds.current = new Set(newOrders.filter((o) => o.status === "ready").map((o) => o.orderId))
      setOrders(newOrders)
      if (
        callsScopeAtStart === callsScopeRef.current &&
        callsRevisionRef.current === callsRevisionAtStart
      ) {
        prevPendingCallIds.current = new Set(newCalls.filter((c) => c.status === "pending").map((c) => c._id))
        callsRevisionRef.current += 1
        setCalls(newCalls)
      }
      setRestaurant(settingsRes.data)
    } catch (err) {
      console.error("[waiter fetchInitialData]", err)
      setError("Failed to fetch waiter data")
    } finally {
      setLoading(false)
      setLastUpdated(new Date())
    }
  }

  // Effect to fetch service points so SSE events can also be mapped
  const [servicePointMap, setServicePointMap] = useState<Map<string, string>>(new Map())
  useEffect(() => {
     if (!staffId) return
     apiClient.get("/waitstaff/service-points", { headers: { "X-STAFF-ID": staffId } })
       .then(res => {
          if (Array.isArray(res.data)) {
             const m = new Map()
             res.data.forEach((sp: any) => m.set(sp.servicePointId || sp._id, sp.label || sp.name))
             setServicePointMap(m)
          }
       })
       .catch(err => console.error("Failed to load SP map for SSE", err))
  }, [staffId])

  const reconcileCalls = useCallback(() => {
    if (!user?.businessId || !staffId) return Promise.resolve()

    const inFlight = callsReconciliationInFlightRef.current
    if (inFlight) return inFlight

    const callsScopeAtStart = callsScopeRef.current
    const callsRevisionAtStart = callsRevisionRef.current
    const reconciliation = fetchCalls()
      .then((freshCalls) => {
        if (
          callsScopeRef.current !== callsScopeAtStart ||
          callsRevisionRef.current !== callsRevisionAtStart
        ) {
          return
        }

        const reconciledCalls = freshCalls.map((call) => {
          if (call.displayLabel) return call
          const servicePointId = call.servicePointId ||
            (call.servicePointLabel?.startsWith("sp_") ? call.servicePointLabel : "")
          if (!servicePointId) return call
          return {
            ...call,
            displayLabel:
              servicePointMap.get(servicePointId) ||
              call.servicePointLabel ||
              servicePointId,
          }
        })

        callsRevisionRef.current += 1
        setCalls(reconciledCalls)
        setLastUpdated(new Date())
      })
      .catch((err) => {
        console.error("[waitstaff reconcileCalls]", err)
      })
      .finally(() => {
        if (callsReconciliationInFlightRef.current === reconciliation) {
          callsReconciliationInFlightRef.current = null
        }
      })

    callsReconciliationInFlightRef.current = reconciliation
    return reconciliation
  }, [fetchCalls, servicePointMap, staffId, user?.businessId])

  // SSE — only connect once businessId is available from the session
  const sseUrl = user ? `/events?role=waiter&businessId=${user.businessId}` : ""
  useEventSource(sseUrl, {
    order_created: (data: { order: KitchenOrder }) => {
      if (data.order.servicePointLabel?.startsWith("sp_")) {
         data.order.displayLabel = servicePointMap.get(data.order.servicePointLabel) || data.order.servicePointLabel
      }
      setOrders(prev => {
        if (prev.some(o => o.orderId === data.order.orderId)) return prev
        return [data.order, ...prev]
      })

      if (audioEnabledRef.current && data.order.status === "ready") {
        audioRef.current?.play().catch(() => { })
        toast.success("New Order Ready!", { duration: 3000 })
      }

      // Stripe-paid orders arrive as "placed" + "paid" — notify waiter
      if (audioEnabledRef.current && data.order.paymentStatus === "paid" && data.order.status !== "ready") {
        audioRef.current?.play().catch(() => { })
        toast.success(`💳 New paid order — ${data.order.servicePointLabel}`, { duration: 4000 })
      }
    },
    order_updated: (data: { order: KitchenOrder }) => {
      if (data.order.servicePointLabel?.startsWith("sp_")) {
         data.order.displayLabel = servicePointMap.get(data.order.servicePointLabel) || data.order.servicePointLabel
      }
      setOrders(prev => {
        const index = prev.findIndex(o => o.orderId === data.order.orderId)
        if (index === -1) return [data.order, ...prev]
        const next = [...prev]
        const oldOrder = next[index]
        next[index] = data.order

        // Status change: order became ready
        if (oldOrder.status !== data.order.status) {
          if (audioEnabledRef.current && data.order.status === "ready") {
            audioRef.current?.play().catch(() => { })
            toast.success("Order Ready!", { duration: 3000 })
          }
        }

        // Payment status change: pending/unpaid → paid (Stripe webhook just fired)
        if (oldOrder.paymentStatus !== "paid" && data.order.paymentStatus === "paid") {
          if (audioEnabledRef.current) {
            audioRef.current?.play().catch(() => { })
          }
          toast.success(`💳 Payment confirmed — ${data.order.servicePointLabel}`, { duration: 4000 })
        }

        return next
      })
    },
    waiter_call_created: (data: { call: ServiceRequest }) => {
      callsRevisionRef.current += 1
      setCalls(prev => {
        if (prev.some(c => c._id === data.call._id)) return prev
        if (audioEnabledRef.current && data.call.status === "pending") {
          audioRef.current?.play().catch(() => { })
          toast.success("New Waiter Call!", { duration: 3000 })
        }
        return [data.call, ...prev]
      })
    },
    waiter_call_updated: (data: { call: ServiceRequest }) => {
      callsRevisionRef.current += 1
      setCalls(prev => {
        // Keep resolved calls in local state — filter chips control visibility
        const index = prev.findIndex(c => c._id === data.call._id)
        if (index === -1) return [data.call, ...prev]
        const next = [...prev]
        next[index] = data.call
        return next
      })
    }
  }, { onReconnect: reconcileCalls })

  // Load data once the authenticated user is available from the session
  useEffect(() => {
    if (user) {
      fetchInitialData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Mirror backend stale-call deadlines locally to keep the dashboard in sync.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setCalls(prev => {
        let changed = false
        const next = prev.map(c => {
          const expiresAt = c.status === "pending"
            ? c.pendingExpiresAt
            : c.status === "acknowledged"
              ? c.acknowledgedExpiresAt
              : null
          if (expiresAt && new Date(expiresAt).getTime() <= now) {
            changed = true
            return { ...c, status: "missed", missedAt: new Date().toISOString() } as ServiceRequest
          }
          return c
        })
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const filteredOrders = useMemo(() => {
    return filter === "all" ? orders : orders.filter((o) => o.status === filter)
  }, [orders, filter])

  // ✅ derived counts
  const counts = useMemo(() => {
    const c = { placed: 0, in_progress: 0, ready: 0, completed: 0 }
    orders.forEach((o) => {
      if (o.status in c) c[o.status as keyof WaiterCounts]++
    })
    return c
  }, [orders])

  // ✅ CHANGED: tab counts come from backend counts, not filtered client list
  const placedCount = counts.placed
  const inProgressCount = counts.in_progress
  const readyCount = counts.ready
  const completedCount = counts.completed

  const totalItemsCount = useMemo(() => {
    return filteredOrders.reduce(
      (total, order) => total + order.items.reduce((sum, item) => sum + item.quantity, 0),
      0,
    )
  }, [filteredOrders])

  const pendingCallsCount = calls.filter((c) => c.status === "pending").length
  const acknowledgedCallsCount = calls.filter((c) => c.status === "acknowledged").length
  const resolvedCallsCount = calls.filter((c) => c.status === "resolved").length
  const missedCallsCount = calls.filter((c) => c.status === "missed").length
  const allCallsCount = calls.length

  const filteredCalls = useMemo(() => {
    if (callsFilter === "all") return calls
    return calls.filter((c) => c.status === callsFilter)
  }, [calls, callsFilter])

  const getTimeAgo = () => {
    const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
    if (seconds < 1) return "just now"
    if (seconds < 60) return `${seconds}s ago`
    return `${Math.floor(seconds / 60)}m ago`
  }

  const handleMarkServed = async (orderId: string) => {
    const previous = [...orders]
    setOrders((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, status: "completed" } : o)))

    try {
      await apiClient.patch(
        `/waitstaff/orders/${orderId}/status`,
        { status: "completed", businessId: user?.businessId },
        { headers: { "X-STAFF-ID": staffId, "X-STAFF-NAME": user?.name || "Staff" } },
      )
      toast.success("Order marked as served")
      fetchInitialData() // ✅ optional but helps keep counts perfectly in sync
    } catch (err) {
      console.error("[mark served]", err)
      setOrders(previous)
      toast.error("Failed to mark served")
    }
  }

  const handleMarkPaid = async (orderId: string, paidVia: "cash" | "pos_card") => {
    const previous = [...orders]
    setOrders((prev) =>
      prev.map((o) => (o.orderId === orderId ? { ...o, paymentStatus: "paid", paidVia } : o))
    )

    try {
      await apiClient.patch(
        `/orders/${orderId}/mark-paid`,
        { paidVia, businessId: user?.businessId },
        { headers: { "X-STAFF-ID": staffId } }
      )
      toast.success(`Payment recorded via ${paidVia === "cash" ? "Cash" : "POS Card"}`)
      fetchInitialData()
    } catch (err: any) {
      console.error("[mark paid]", err)
      setOrders(previous)
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to record payment")
      throw err // Re-throw so the card component can handle UI states
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    try {
      await apiClient.post(
        `/waitstaff/orders/${orderId}/cancel`,
        { businessId: user?.businessId },
        { headers: { "X-STAFF-ID": staffId } }
      )
      // SSE will handle the state update, but we can proactively fetch to be safe
      fetchInitialData()
    } catch (err: any) {
      console.error("[cancel order]", err)
      throw err // throw to card component to show its own toast if needed
    }
  }

  //  claim requires waiter name + staff id from authenticated session
  const claimCall = async (id: string) => {
    try {
      // Use authenticated session user — not legacy localStorage
      const staffName = user?.name || "Staff Member"
      const staffIdToUse = user?.staffId

      const res = await apiClient.patch(
        `/waitstaff/calls/${id}/claim`,
        { businessId: user?.businessId },
        { headers: { "X-STAFF-ID": staffIdToUse, "X-STAFF-NAME": staffName } },
      )

      const updated: ServiceRequest = res.data.call
      callsRevisionRef.current += 1
      setCalls((prev) => prev.map((c) => (c._id === id ? updated : c)))
      toast.success("Call acknowledged")
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 409) {
        toast.info("Already claimed by another waiter/device")
        fetchInitialData()
        return
      }
      const msg = err?.response?.data?.error || "Failed to acknowledge call"
      toast.error(msg)
    }
  }

  const resolveCall = async (id: string) => {
    try {
      const staffName = user?.name || "Staff Member"
      const staffIdToUse = user?.staffId

      const res = await apiClient.patch(
        `/waitstaff/calls/${id}/resolve`,
        { businessId: user?.businessId },
        { headers: { "X-STAFF-ID": staffIdToUse, "X-STAFF-NAME": staffName } },
      )
      const updated: ServiceRequest = res.data.call
      callsRevisionRef.current += 1
      setCalls((prev) => prev.map((c) => (c._id === id ? updated : c)))
      toast.success("Call resolved")
      fetchInitialData()
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 409) {
        toast.info("This call is handled by another waiter/device")
        fetchInitialData()
        return
      }
      toast.error("Failed to resolve call")
    }
  }

  const handleLogout = logout

  if (loading && orders.length === 0 && calls.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading waiter dashboard...</p>
        </div>
      </div>
    )
  }

  // ── Focus Mode: order filter tabs (shared) ──────────────────────────────────
  const orderFilterTabs = (
    <div className="flex gap-2 flex-wrap">
      {(["ready", "placed", "in_progress", "all"] as const).map((f) => (
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${filter === f ? "bg-primary text-primary-foreground shadow-md scale-105" : "bg-secondary hover:bg-secondary/80"
            }`}
        >
          {f === "in_progress" ? "In Progress" : f}
          {f !== "all" && (
            <span className="ml-2 text-xs opacity-75">
              (
              {f === "placed"
                ? placedCount
                : f === "in_progress"
                  ? inProgressCount
                  : readyCount}
              )
            </span>
          )}
        </button>
      ))}
    </div>
  )

  // ── Focus Mode: calls filter tabs (shared) ──────────────────────────────────
  const callsFilterTabs = (
    <div className="flex gap-2 flex-wrap">
      {(["all", "pending", "acknowledged", "resolved", "missed"] as const).map((f) => {
        const count =
          f === "all" ? allCallsCount
            : f === "pending" ? pendingCallsCount
              : f === "acknowledged" ? acknowledgedCallsCount
                : f === "resolved" ? resolvedCallsCount
                  : missedCallsCount
        return (
          <button
            key={f}
            onClick={() => setCallsFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${callsFilter === f
              ? "bg-violet-600 text-white shadow-md shadow-violet-500/30 scale-105"
              : "bg-violet-100 dark:bg-violet-950/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-900 dark:text-violet-100"
              }`}
          >
            {f}
            <span className="ml-2 text-xs opacity-75">({count})</span>
          </button>
        )
      })}
    </div>
  )

  // ── Focus Mode: content area (shared between normal & focus) ────────────────
  const contentArea = (
    <div key={mode} className={`w-full px-4 sm:px-6 lg:px-8 py-6 ${!isFocusMode ? 'animate-in fade-in duration-200' : ''}`}>
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between">
          <p className="font-medium text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </p>
          <button
            onClick={fetchInitialData}
            className="px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg text-sm font-bold hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {mode === "orders" ? (
        filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center opacity-50">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
              <UtensilsCrossed className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No Orders</h3>
            <p className="text-muted-foreground">No orders in this filter.</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${isFocusMode ? 'xl:grid-cols-4 2xl:grid-cols-5' : 'xl:grid-cols-4'} gap-4`}>
            {filteredOrders.map((order) => (
              <WaiterOrderCard
                key={order.orderId}
                order={order}
                onMarkServed={handleMarkServed}
                onMarkPaid={handleMarkPaid}
                onCancelOrder={handleCancelOrder}
                paymentPreferences={restaurant?.paymentPreferences}
                currency={restaurant?.currency}
              />
            ))}
          </div>
        )
      ) : (
        // CALLS MODE
        filteredCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center opacity-50">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
              <BellRing className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              {callsFilter === "all"
                ? "No Calls Yet"
                : callsFilter === "pending"
                  ? "No Pending Calls"
                  : callsFilter === "acknowledged"
                    ? "No Acknowledged Calls"
                    : callsFilter === "resolved"
                      ? "No Resolved Calls"
                      : "No Missed Calls"}
            </h3>
            <p className="text-muted-foreground">
              {callsFilter === "all"
                ? "No waiter calls have been made yet."
                : callsFilter === "pending"
                  ? "All caught up — no calls waiting for attention."
                  : callsFilter === "acknowledged"
                    ? "No calls are currently acknowledged."
                    : callsFilter === "resolved"
                      ? "No calls have been resolved yet."
                      : "No calls were missed."}
            </p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${isFocusMode ? 'xl:grid-cols-4 2xl:grid-cols-5' : 'xl:grid-cols-4'} gap-4`}>
            {filteredCalls.map((c) => {
              const isMine = c.claimedBy === staffId
              const isPending = c.status === "pending"
              const isAck = c.status === "acknowledged"
              const isResolved = c.status === "resolved"
              const isMissed = c.status === "missed"

              return (
                <div
                  key={c._id}
                  className={`rounded-2xl border overflow-hidden shadow-sm ${isPending
                    ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                    : isAck
                      ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                      : isResolved
                        ? "border-green-300 bg-green-50 dark:bg-green-950/20"
                        : "border-gray-300 bg-gray-50 dark:bg-gray-900/20"
                    }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded text-white uppercase ${isPending
                              ? "bg-red-600"
                              : isAck
                                ? "bg-amber-600"
                                : isResolved
                                  ? "bg-green-600"
                                  : "bg-gray-600"
                              }`}
                          >
                            {isPending ? "PENDING" : isAck ? "ACKNOWLEDGED" : isResolved ? "RESOLVED" : "MISSED"}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground">
                            {timeAgo(c.createdAt)} ago
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <div className="px-3 py-2 rounded-xl bg-black text-white font-black text-sm">
                            {c.displayLabel ||
                              servicePointMap.get(c.servicePointId) ||
                              c.servicePointQrCode ||
                              c.servicePointLabel ||
                              c.servicePointId ||
                              "Service point"}
                          </div>
                         
                        </div>

                        {(c.reason || c.note) && (
                          <div className="mt-3 text-sm">
                            {c.reason && (
                              <p className="font-bold text-foreground">
                                Reason: <span className="font-medium">{c.reason}</span>
                              </p>
                            )}
                            {c.note && <p className="text-muted-foreground">"{c.note}"</p>}
                          </div>
                        )}

                        {isAck && (
                          <div className="mt-3 text-xs font-bold text-muted-foreground flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            {c.acknowledgedByName
                              ? `Acknowledged by ${c.acknowledgedByName}`
                              : isMine
                              ? "Acknowledged by you"
                              : "Acknowledged by another waiter"}
                          </div>
                        )}

                        {isResolved && (
                          <div className="mt-3 text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-1">
                            ✓ {c.resolvedByName ? `Resolved by ${c.resolvedByName}` : "Resolved"}
                          </div>
                        )}
                      </div>
                    </div>

                    {(!isResolved && !isMissed) && (
                      <div className="mt-4 flex gap-2">
                        {isPending ? (
                          <button
                            onClick={() => claimCall(c._id)}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2"
                          >
                            <Hand className="w-4 h-4" />
                            ACKNOWLEDGE
                          </button>
                        ) : (
                          <button
                            onClick={() => resolveCall(c._id)}
                            disabled={!isMine}
                            className={`flex-1 font-black py-3 rounded-xl flex items-center justify-center gap-2 ${isMine
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : "bg-secondary text-muted-foreground cursor-not-allowed"
                              }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            RESOLVE
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )

  // ── Focus Mode layout ──────────────────────────────────────────────────────
  if (isFocusMode) {
    return (
      <main className={`min-h-screen transition-colors duration-300 ${mode === "calls"
        ? "bg-violet-50/40 dark:bg-violet-950/10"
        : "bg-background"
        }`}>
        {/* Compact sticky focus header */}
        <header className={`sticky top-0 z-50 backdrop-blur-md border-b shadow-md transition-colors duration-300 ${mode === "calls"
          ? "bg-violet-50/95 dark:bg-violet-950/90 border-violet-200 dark:border-violet-800"
          : "bg-background/95 border-border/50"
          }`}>
          <div className="w-full px-4 py-3">
            {/* Top row: mode toggle + inline counts + controls */}
            <div className="flex items-center justify-between gap-3">
              {/* Left: mode toggle + counts */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setMode("orders")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-1 ${mode === "orders"
                      ? "bg-orange-500 text-white shadow-md"
                      : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                      }`}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    Orders
                  </button>
                  <button
                    onClick={() => setMode("calls")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-1.5 ${mode === "calls"
                      ? "bg-violet-600 text-white shadow-md"
                      : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                      }`}
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    Requests
                    {pendingCallsCount > 0 && (
                      <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full">
                        {pendingCallsCount}
                      </span>
                    )}
                  </button>
                </div>

              </div>

              {/* Right: controls */}
              <div className="flex items-center gap-2">
                {restaurant?.orderingPreferences?.enableWaiterOrdering !== false && (
                  <button
                    onClick={() => router.push("/waitstaff/take-order")}
                    className="px-3 py-1.5 bg-[var(--brand-primary,var(--color-primary))] hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Take Order</span>
                  </button>
                )}
                <button
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className={`p-2.5 rounded-xl border transition-all ${audioEnabled ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-transparent text-muted-foreground"}`}
                  title={audioEnabled ? "Mute" : "Unmute"}
                >
                  {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button
                  onClick={fetchInitialData}
                  disabled={loading}
                  className="p-2.5 hover:bg-secondary rounded-xl transition-colors disabled:opacity-50 border border-border"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => { void exitFocusMode() }}
                  className="px-3 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-1.5"
                  title="Exit Focus Mode"
                >
                  <Minimize className="w-4 h-4" />
                  <span className="hidden sm:inline">Exit Focus</span>
                </button>
              </div>
            </div>

            {/* Filter tabs row */}
            <div className="mt-3">
              {mode === "orders" ? orderFilterTabs : callsFilterTabs}
            </div>
          </div>
        </header>

        {contentArea}
      </main>
    )
  }

  // ── Normal (non-focus) layout ──────────────────────────────────────────────
  return (
    <main className={`min-h-screen pb-20 transition-colors duration-300 ${mode === "calls"
      ? "bg-violet-50/40 dark:bg-violet-950/10"
      : "bg-background"
      }`}>
      <header className={`sticky top-0 z-40 backdrop-blur-sm border-b shadow-sm transition-colors duration-300 ${mode === "calls"
        ? "bg-violet-50/95 dark:bg-violet-950/90 border-violet-200 dark:border-violet-800"
        : "bg-background/95 border-border"
        }`}>
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          {/* Top row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
             
              <p className={`text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5 transition-colors duration-300 ${mode === "calls" ? "text-violet-600 dark:text-violet-400" : "text-orange-500 dark:text-orange-400"
                }`}>
                {mode === "calls"
                  ? <><PhoneCall className="w-3 h-3" /> Customer Assistance</>
                  : <><Utensils className="w-3 h-3" /> Order Management</>}
              </p>

              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setMode("orders")}
                  className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all flex items-center gap-1.5 ${mode === "orders"
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105"
                    : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                    }`}
                >
                  <Utensils className="w-4 h-4" />
                  Orders
                </button>

                <button
                  onClick={() => setMode("calls")}
                  className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${mode === "calls"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-500/30 scale-105"
                    : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                    }`}
                >
                  <BellRing className="w-4 h-4" />
                  Requests
                  {pendingCallsCount > 0 && (
                    <span className="ml-1 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">
                      {pendingCallsCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user?.name && (
                <span className="text-sm text-muted-foreground hidden sm:block mr-2">
                  Hi, <span className="font-semibold text-foreground">{user.name}</span>
                </span>
              )}
              {canViewPastOrders && (
                <button
                  onClick={() => router.push("/waitstaff/past-orders")}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-1 border border-border"
                >
                  <Archive className="w-4 h-4" />
                  <span className="hidden sm:inline">Past Orders</span>
                </button>
              )}
              {restaurant?.orderingPreferences?.enableWaiterOrdering !== false && (
                <button
                  onClick={() => router.push("/waitstaff/take-order")}
                  className="px-4 py-2 bg-[var(--brand-primary,var(--color-primary))] hover:opacity-90 text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-1"
                >
                  <Utensils className="w-4 h-4" />
                  <span className="hidden sm:inline">Take Order</span>
                </button>
              )}
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`p-3 rounded-xl border transition-all ${audioEnabled ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-transparent text-muted-foreground"
                  }`}
                title={audioEnabled ? "Mute Alerts" : "Enable Sound Alerts"}
              >
                {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              <button
                onClick={() => { void enterFocusMode() }}
                className="p-3 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-all flex items-center gap-2"
                title="Focus Mode"
              >
                <Maximize className="w-5 h-5" />
                <span className="text-xs font-black uppercase hidden lg:inline">Focus</span>
              </button>

              <div className="text-right hidden sm:block">
                <p className="text-xs text-muted-foreground font-mono">{getTimeAgo()}</p>
              </div>

              <button
                onClick={fetchInitialData}
                disabled={loading}
                className="p-3 hover:bg-secondary rounded-xl transition-colors disabled:opacity-50 border border-border"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button
                onClick={handleLogout}
                className="p-3 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-colors border border-border flex items-center gap-2 group"
                title="Log Out"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-xs font-black uppercase hidden lg:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Summary row — different panels per mode */}
          {mode === "orders" ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900">
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-black uppercase text-blue-900 dark:text-blue-100 tracking-wide">
                    Total Items
                  </span>
                </div>
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{totalItemsCount}</p>
              </div>

              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-xl border border-green-100 dark:border-green-900">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-black uppercase text-green-900 dark:text-green-100 tracking-wide">
                    Ready
                  </span>
                </div>
                <p className="text-3xl font-black text-green-600 dark:text-green-400">{readyCount}</p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-100 dark:border-purple-900">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-black uppercase text-purple-900 dark:text-purple-100 tracking-wide">
                    Completed
                  </span>
                </div>
                <p className="text-3xl font-black text-purple-600 dark:text-purple-400">{completedCount}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-violet-50 dark:bg-violet-950/20 p-4 rounded-xl border border-violet-100 dark:border-violet-900">
                <div className="flex items-center gap-2 mb-1">
                  <PhoneCall className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-black uppercase text-violet-900 dark:text-violet-100 tracking-wide">
                    All Calls
                  </span>
                </div>
                <p className="text-3xl font-black text-violet-600 dark:text-violet-400">{allCallsCount}</p>
              </div>

              <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900">
                <div className="flex items-center gap-2 mb-1">
                  <BellRing className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-black uppercase text-red-900 dark:text-red-100 tracking-wide">
                    Pending
                  </span>
                </div>
                <p className="text-3xl font-black text-red-600 dark:text-red-400">{pendingCallsCount}</p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-black uppercase text-blue-900 dark:text-blue-100 tracking-wide">
                    Acknowledged
                  </span>
                </div>
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{acknowledgedCallsCount}</p>
              </div>

              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-xl border border-green-100 dark:border-green-900">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-black uppercase text-green-900 dark:text-green-100 tracking-wide">
                    Resolved
                  </span>
                </div>
                <p className="text-3xl font-black text-green-600 dark:text-green-400">{resolvedCallsCount}</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-950/20 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-xs font-black uppercase text-gray-900 dark:text-gray-100 tracking-wide">
                    Missed
                  </span>
                </div>
                <p className="text-3xl font-black text-gray-600 dark:text-gray-400">{missedCallsCount}</p>
              </div>
            </div>
          )}

          {/* Tabs for orders only */}
          {mode === "orders" && (
            <div className="mt-4">
              {orderFilterTabs}
            </div>
          )}

          {mode === "calls" && (
            <div className="mt-4">
              {callsFilterTabs}
            </div>
          )}
        </div>
      </header>

      {contentArea}
    </main>
  )
}
