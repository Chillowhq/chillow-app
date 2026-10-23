"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { Beer, AlertCircle, Volume2, VolumeX, LayoutGrid, List, LogOut } from "lucide-react"
import { BarOrderCard, BarOrder } from "@/components/bar-order-card"
import apiClient from "@/lib/axios-config"
import { toast } from "sonner"
import { useEventSource } from "@/hooks/use-event-source"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { AuthProvider } from "@/contexts/AuthContext"
import { MANAGEMENT_ACCESS_AREAS, MANAGER_PERMISSIONS } from "@/lib/manager-permissions"

function BarPageInner() {
  const { user, logout } = useAuthGuard({
    requiredRole: ["bartender", "owner", "co_owner", "manager"],
    requiredArea: MANAGEMENT_ACCESS_AREAS.ORDERS,
  })
  const [orders, setOrders] = useState<BarOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [filter, setFilter] = useState<"all" | "placed" | "in_progress" | "ready">("all")
  const [viewMode, setViewMode] = useState<"cards" | "batch">("cards")

  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    const saved = localStorage.getItem("bar-audio-enabled")
    return saved === null ? false : saved === "true"
  })

  const audioEnabledRef = useRef(audioEnabled)
  useEffect(() => {
    audioEnabledRef.current = audioEnabled
  }, [audioEnabled])

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get("/bar/orders", { params: { businessId: user?.businessId } })
      setOrders(res.data.orders)
      setError(null)
    } catch (err) {
      console.error("[Failed to fetch bar orders]", err)
      setError("Failed to fetch drinks")
    } finally {
      setLoading(false)
      setLastUpdated(new Date())
    }
  }

  // SSE Handlers
  const sseUrl = user
    ? `/events?role=bar&businessId=${user.businessId}&permission=${MANAGER_PERMISSIONS.ORDERS_VIEW}`
    : ""
  useEventSource(sseUrl, {
    order_created: (data: { order: BarOrder }) => {
      setOrders((prev) => {
        if (prev.some(o => o.orderId === data.order.orderId)) return prev

        if (audioEnabledRef.current && (data.order.status === "placed" || data.order.status === "ready")) {
          audioRef.current?.play().catch(() => { })
          toast.info(`New Drinks For Order ${data.order.orderId}!`, { duration: 3000 })
        }
        return [...prev, data.order].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      })
      setLastUpdated(new Date())
    },
    order_updated: (data: { order: BarOrder }) => {
      setOrders((prev) => {
        const index = prev.findIndex(o => o.orderId === data.order.orderId)
        const ACTIVE_STATUSES = ["placed", "in_progress", "ready"]
        if (!ACTIVE_STATUSES.includes(data.order.status)) {
          return prev.filter(o => o.orderId !== data.order.orderId)
        }
        if (index === -1) return [...prev, data.order]
        const next = [...prev]
        next[index] = data.order
        return next
      })
      setLastUpdated(new Date())
    }
  })

  useEffect(() => {
    if (user) fetchOrders()
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

  const handleFulfillmentAction = async (
    orderId: string,
    action: "start" | "ready",
    orderLineIds: string[],
  ) => {
    try {
      const response = await apiClient.patch(`/bar/orders/${orderId}/fulfillment`, {
        action,
        ...(orderLineIds.length > 0 ? { orderLineIds } : {}),
      })
      setOrders((prev) => prev.map((order) => order.orderId === orderId
        ? response.data.order || {
            ...order,
            status: response.data.status,
            stationStatus: response.data.stationStatus,
          }
        : order))
      toast.success(action === "start" ? "Preparation started" : "Drinks marked ready")
    } catch (err) {
      console.error("[Failed to update bar fulfilment]", err)
      toast.error("Failed to update drinks")
      throw err
    }
  }

  const batchItems = useMemo(() => {
    const items: Record<string, { qty: number; notes: string[] }> = {}
    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.itemName
        if (!items[key]) items[key] = { qty: 0, notes: [] }
        items[key].qty += item.quantity
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
          <p className="text-muted-foreground">Loading bar orders...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-gradient-to-b from-background to-background/95 backdrop-blur-md border-b border-border/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
                <Beer className="w-10 h-10 text-primary" />
                BAR DASHBOARD
                <span className="text-xs font-bold px-3 py-1.5 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-full text-primary">
                  ACTIVE
                </span>
              </h1>
              <p className="text-muted-foreground font-semibold mt-1">Manage prepared and ready-to-serve drinks independently</p>
            </div>

            <div className="flex items-center gap-3">
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
                  className={`p-2 rounded-lg transition-all ${viewMode === "cards" ? "bg-white dark:bg-black shadow-sm" : "text-muted-foreground"}`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("batch")}
                  className={`p-2 rounded-lg transition-all ${viewMode === "batch" ? "bg-white dark:bg-black shadow-sm" : "text-muted-foreground"}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>

              <div className="text-right hidden sm:block">
                <p className="text-xs text-muted-foreground font-mono">{getTimeAgo()}</p>
              </div>

              <button
                onClick={logout}
                className="p-3 hover:bg-destructive/10 hover:text-destructive rounded-xl transition-colors border border-border flex items-center gap-2 group"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-xs font-black uppercase hidden lg:inline">Sign Out</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-5 rounded-2xl border-2 transition-all shadow-md ${totalActive > 0 ? "bg-gradient-to-br from-secondary to-secondary/50 border-border" : "bg-secondary/30 border-transparent"}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-foreground/10 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-foreground/70" />
                </div>
                <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Active</span>
              </div>
              <p className="text-4xl font-black text-foreground">{totalActive}</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/10 p-5 rounded-2xl border-2 border-blue-200 dark:border-blue-900/50 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                 <span className="text-xs font-black uppercase text-blue-800 dark:text-blue-200 tracking-widest">NEW</span>
              </div>
              <p className="text-4xl font-black text-blue-600 dark:text-blue-400">{placedCount}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-50/50 dark:from-amber-950/30 dark:to-amber-950/10 p-5 rounded-2xl border-2 border-amber-200 dark:border-amber-900/50 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                 <span className="text-xs font-black uppercase text-amber-800 dark:text-amber-200 tracking-widest">IN PROGRESS</span>
              </div>
              <p className="text-4xl font-black text-amber-600 dark:text-amber-400">{inProgressCount}</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-50/50 dark:from-green-950/30 dark:to-green-950/10 p-5 rounded-2xl border-2 border-green-200 dark:border-green-900/50 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                 <span className="text-xs font-black uppercase text-green-800 dark:text-green-200 tracking-widest">READY</span>
              </div>
              <p className="text-4xl font-black text-green-600 dark:text-green-400">{readyCount}</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap mt-6">
            {(["all", "placed", "in_progress", "ready"] as const).map((f) => {
              const count = f === "all" ? totalActive : f === "placed" ? placedCount : f === "in_progress" ? inProgressCount : readyCount
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${filter === f ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/30 scale-105" : "bg-secondary text-foreground hover:bg-secondary/80 border border-border/50"}`}
                >
                  {f.replace("_", " ")}
                  <span className="ml-2 text-xs opacity-75">({count})</span>
                </button>
              )
            })}
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
            <button onClick={fetchOrders} className="px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg text-sm font-bold hover:bg-red-200">
              Retry Connection
            </button>
          </div>
        )}

        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center opacity-50">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
              <Beer className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Bar Clear</h3>
            <p className="text-muted-foreground">No active drink orders in this filter.</p>
          </div>
        ) : (
          <>
            {viewMode === "cards" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredOrders.map((order) => (
                  <BarOrderCard key={order.orderId} order={order} onFulfillmentAction={handleFulfillmentAction} />
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

export default function BarPage() {
  return (
    <AuthProvider>
      <BarPageInner />
    </AuthProvider>
  )
}
