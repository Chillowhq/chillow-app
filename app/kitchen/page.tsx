"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { Clock, ChefHat, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Volume2, VolumeX, LayoutGrid, List, LogOut, Maximize, Minimize } from "lucide-react"
import { KitchenOrderCard, KitchenOrder } from "@/components/kitchen-order-card"
import apiClient from "@/lib/axios-config"
import { toast } from "sonner"
import { useEventSource } from "@/hooks/use-event-source"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useFocusMode } from "@/hooks/use-focus-mode"

export default function KitchenPage() {
  const { user, logout } = useAuthGuard()
  const { isFocusMode, enterFocusMode, exitFocusMode } = useFocusMode()
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [filter, setFilter] = useState<"all" | "placed" | "in_progress" | "ready">("all")
  const [viewMode, setViewMode] = useState<"cards" | "batch">("cards")

  // Default ON, while preserving an explicit saved mute preference.
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    const saved = localStorage.getItem("kitchen-audio-enabled")
    return saved === null ? true : saved === "true"
  })

  // Ref to audio for use in effects
  const audioEnabledRef = useRef(audioEnabled)
  useEffect(() => {
    audioEnabledRef.current = audioEnabled
  }, [audioEnabled])

  // ✅ Track previous IDs to detect NEW placed orders
  const prevOrderIds = useRef<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    audioRef.current = new Audio("/sounds/bell-sound-1.mp3")
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kitchen-audio-enabled", String(audioEnabled))
    }
  }, [audioEnabled])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get("/kitchen", { params: { businessId: user?.businessId } })
      const newOrders: KitchenOrder[] = res.data.orders

      prevOrderIds.current = new Set(newOrders.map((o) => o.orderId))

      setOrders(newOrders)
      setError(null)
    } catch (err) {
      console.error("[Failed to fetch kitchen orders]", err)
      setError("Failed to fetch orders")
    } finally {
      setLoading(false)
      setLastUpdated(new Date())
    }
  }

  // SSE Handlers
  const sseUrl = user ? `/events?role=kitchen&businessId=${user.businessId}` : ""
  useEventSource(sseUrl, {
    order_created: (data: { order: KitchenOrder }) => {
      setOrders((prev) => {
        // Prevent duplicates
        if (prev.some(o => o.orderId === data.order.orderId)) return prev

        // Alert if new placed order
        if (audioEnabledRef.current && data.order.status === "placed") {
          audioRef.current?.play().catch(() => { })
          toast.info(`New Order ${data.order.orderId} Received!`, { duration: 3000 })
        }

        return [...prev, data.order].sort((a, b) => {
          // Basic sort if needed, or rely on existing logic
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        })
      })
      setLastUpdated(new Date())
    },
    order_updated: (data: { order: KitchenOrder }) => {
      setOrders((prev) => {
        const index = prev.findIndex(o => o.orderId === data.order.orderId)

        // If status transitioned to something not in ACTIVE_STATUSES, we might need to remove it
        const ACTIVE_STATUSES = ["placed", "in_progress", "ready"]
        if (!ACTIVE_STATUSES.includes(data.order.status)) {
          return prev.filter(o => o.orderId !== data.order.orderId)
        }

        if (index === -1) {
          return [...prev, data.order]
        }

        const next = [...prev]
        next[index] = data.order
        return next
      })
      setLastUpdated(new Date())
    }
  })

  // Load orders once the authenticated user is available
  useEffect(() => {
    if (user) {
      fetchOrders()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const filteredOrders = useMemo(
    () => (filter === "all" ? orders : orders.filter((o) => (o.stationStatus || o.status) === filter)),
    [orders, filter],
  )

  const placedCount = orders.filter((o) => (o.stationStatus || o.status) === "placed").length
  const inProgressCount = orders.filter((o) => (o.stationStatus || o.status) === "in_progress").length
  const readyCount = orders.filter((o) => (o.stationStatus || o.status) === "ready").length
  const totalActive = placedCount + inProgressCount + readyCount

  const getTimeAgo = () => {
    const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
    if (seconds < 1) return "just now"
    if (seconds < 60) return `${seconds}s ago`
    return `${Math.floor(seconds / 60)}m ago`
  }

  const handleLogout = logout

  const handleFulfillmentAction = async (orderId: string, action: "start" | "ready") => {
    const previousOrders = [...orders]

    if (action === "ready") {
      toast.success("Order Marked Ready", { duration: 2500 })
    }

    try {
      const response = await apiClient.patch(`/kitchen/orders/${orderId}/fulfillment`, { action })
      setOrders((prev) => prev.map((order) => order.orderId === orderId
        ? response.data.order || {
            ...order,
            status: response.data.status,
            stationStatus: response.data.stationStatus,
          }
        : order))
    } catch (err) {
      console.error("[Failed to update status]", err)
      setOrders(previousOrders)
      toast.error("Failed to update status")
      throw err
    }
  }

  // ✅ Batch View Aggregation (aggregate notes safely)
  const batchItems = useMemo(() => {
    const items: Record<string, { qty: number; notes: string[] }> = {}

    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.itemName
        if (!items[key]) items[key] = { qty: 0, notes: [] }

        items[key].qty += item.quantity

        // item.notes can be undefined/null
        if (item.notes && item.notes.trim().length > 0) items[key].notes.push(item.notes.trim())
      })
    })

    return Object.entries(items).sort((a, b) => b[1].qty - a[1].qty)
  }, [filteredOrders])

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading kitchen orders...</p>
        </div>
      </div>
    )
  }

  // ── Focus Mode filter tabs (shared between normal & focus headers) ──────────
  const filterTabs = (
    <div className="flex gap-2 flex-wrap">
      {(["all", "placed", "in_progress", "ready"] as const).map((f) => {
        const count =
          f === "all" ? totalActive
            : f === "placed" ? placedCount
              : f === "in_progress" ? inProgressCount
                : readyCount

        return (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${filter === f
              ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/30 scale-105"
              : "bg-secondary text-foreground hover:bg-secondary/80 border border-border/50"
              }`}
          >
            {f.replace("_", " ")}
            <span className="ml-2 text-xs opacity-75">
              ({count})
            </span>
          </button>
        )
      })}
    </div>
  )

  // ── Focus Mode compact header ──────────────────────────────────────────────
  if (isFocusMode) {
    return (
      <main className="min-h-screen bg-background">
        {/* Compact sticky focus header */}
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50 shadow-md">
          <div className="w-full px-4 py-3">
            {/* Top row: inline counts + controls */}
            <div className="flex items-center justify-between gap-4">
              {/* Inline counts */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <ChefHat className="w-5 h-5 text-foreground" />
                  <span className="text-sm font-black text-foreground">Kitchen</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAudioEnabled((v) => !v)}
                  className={`p-2.5 rounded-xl border transition-all ${audioEnabled
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-secondary border-transparent text-muted-foreground"
                    }`}
                  title={audioEnabled ? "Mute Alerts" : "Enable Sound Alerts"}
                >
                  {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>

                <div className="flex bg-secondary p-1 rounded-xl border border-border">
                  <button
                    onClick={() => setViewMode("cards")}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === "cards" ? "bg-white dark:bg-black shadow-sm" : "text-muted-foreground"}`}
                    title="Card View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("batch")}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === "batch" ? "bg-white dark:bg-black shadow-sm" : "text-muted-foreground"}`}
                    title="Batch View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

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
              {filterTabs}
            </div>
          </div>
        </header>

        {/* Content — full width */}
        <div className="w-full px-4 py-4">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between">
              <p className="font-medium text-red-800 dark:text-red-200 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {error}
              </p>
              <button
                onClick={fetchOrders}
                className="px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg text-sm font-bold hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          )}

          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center opacity-50">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
                <ChefHat className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Kitchen Clear</h3>
              <p className="text-muted-foreground">No active orders in this filter.</p>
            </div>
          ) : (
            <>
              {viewMode === "cards" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                  {filteredOrders.map((order) => (
                    <KitchenOrderCard key={order.orderId} order={order} onFulfillmentAction={handleFulfillmentAction} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {batchItems.map(([name, data]) => (
                    <div key={name} className="bg-card border border-border p-6 rounded-2xl shadow-sm">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-xl font-black text-foreground">{name}</h3>
                        <span className="text-3xl font-black text-primary bg-primary/10 px-4 py-2 rounded-xl">
                          {data.qty}
                        </span>
                      </div>

                      {data.notes.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900">
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-2">
                            Special Instructions
                          </p>
                          <ul className="space-y-1">
                            {data.notes.map((note, idx) => (
                              <li key={idx} className="text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                "{note}"
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    )
  }

  // ── Normal (non-focus) layout ──────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-gradient-to-b from-background to-background/95 backdrop-blur-md border-b border-border/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            

            <div className="flex items-center gap-3">
              {user?.name && (
                <span className="text-sm text-muted-foreground hidden sm:block mr-2">
                  Hi, <span className="font-semibold text-foreground">{user.name}</span>
                </span>
              )}
              <button
                onClick={() => setAudioEnabled((v) => !v)}
                className={`p-3 rounded-xl border transition-all ${audioEnabled
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-secondary border-transparent text-muted-foreground"
                  }`}
                title={audioEnabled ? "Mute Alerts" : "Enable Sound Alerts"}
              >
                {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              <div className="flex bg-secondary p-1 rounded-xl border border-border">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-2 rounded-lg transition-all ${viewMode === "cards" ? "bg-white dark:bg-black shadow-sm" : "text-muted-foreground"
                    }`}
                  title="Card View"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("batch")}
                  className={`p-2 rounded-lg transition-all ${viewMode === "batch" ? "bg-white dark:bg-black shadow-sm" : "text-muted-foreground"
                    }`}
                  title="Batch View"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>

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
                onClick={handleLogout}
                className="p-3 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-colors border border-border flex items-center gap-2 group"
                title="Log Out"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-xs font-black uppercase hidden lg:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Enhanced Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className={`p-5 rounded-2xl border-2 transition-all shadow-md ${totalActive > 0 ? "bg-gradient-to-br from-secondary to-secondary/50 border-border" : "bg-secondary/30 border-transparent"
                }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-foreground/10 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-foreground/70" />
                </div>
                <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">All Orders</span>
              </div>
              <p className="text-4xl font-black text-foreground">{totalActive}</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/10 p-5 rounded-2xl border-2 border-blue-200 dark:border-blue-900/50 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-black uppercase text-blue-800 dark:text-blue-200 tracking-widest">
                  Placed
                </span>
              </div>
              <p className="text-4xl font-black text-blue-600 dark:text-blue-400">{placedCount}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-50/50 dark:from-amber-950/30 dark:to-amber-950/10 p-5 rounded-2xl border-2 border-amber-200 dark:border-amber-900/50 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-950 rounded-lg">
                  <ChefHat className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs font-black uppercase text-amber-800 dark:text-amber-200 tracking-widest">
                  Cooking
                </span>
              </div>
              <p className="text-4xl font-black text-amber-600 dark:text-amber-400">{inProgressCount}</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-50/50 dark:from-green-950/30 dark:to-green-950/10 p-5 rounded-2xl border-2 border-green-200 dark:border-green-900/50 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-green-100 dark:bg-green-950 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-xs font-black uppercase text-green-800 dark:text-green-200 tracking-widest">
                  Ready
                </span>
              </div>
              <p className="text-4xl font-black text-green-600 dark:text-green-400">{readyCount}</p>
            </div>
          </div>

          {/* Enhanced Filter Tabs */}
          <div className="mt-6">
            {filterTabs}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between">
            <p className="font-medium text-red-800 dark:text-red-200 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </p>
            <button
              onClick={fetchOrders}
              className="px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg text-sm font-bold hover:bg-red-200"
            >
              Retry Connection
            </button>
          </div>
        )}

        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center opacity-50">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
              <ChefHat className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Kitchen Clear</h3>
            <p className="text-muted-foreground">No active orders in this filter.</p>
          </div>
        ) : (
          <>
            {viewMode === "cards" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredOrders.map((order) => (
                  <KitchenOrderCard key={order.orderId} order={order} onFulfillmentAction={handleFulfillmentAction} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {batchItems.map(([name, data]) => (
                  <div key={name} className="bg-card border border-border p-6 rounded-2xl shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-black text-foreground">{name}</h3>
                      <span className="text-3xl font-black text-primary bg-primary/10 px-4 py-2 rounded-xl">
                        {data.qty}
                      </span>
                    </div>

                    {data.notes.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-2">
                          Special Instructions
                        </p>
                        <ul className="space-y-1">
                          {data.notes.map((note, idx) => (
                            <li key={idx} className="text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              "{note}"
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
