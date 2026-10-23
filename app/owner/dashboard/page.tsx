"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import {
  ShoppingBag,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  ArrowRight,
  RefreshCw,
  Star,
  MessageSquare,
  UtensilsCrossed,
  CreditCard,
  Zap,
  ChevronRight,
  Package,
  MonitorPlay,
} from "lucide-react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import { apiClient } from "@/lib/axios-config"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { hasManagementArea, hasManagementPermission, MANAGEMENT_ACCESS_AREAS, MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import { formatPrice } from "@/lib/localization"
import { useBusinessSettings } from "@/contexts/BusinessContext"
import GuidedSetupChecklist, { type SetupProgress } from "@/components/owner/GuidedSetupChecklist"
import { PageHeader } from "@/components/shared/PageHeader"
import { useSetupProgress } from "@/contexts/SetupProgressContext"
import { useEventSource } from "@/hooks/use-event-source"
import { HotelDashboard } from "@/components/owner/dashboard/HotelDashboard"
import type { HotelDashboardPayload } from "@/types/owner-dashboard"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Snapshot {
  todayOrders: number
  todayRevenue: number
  tablesServed: number
  totalMenuItems: number
  activeOrders: number
}

interface BusinessHealth {
  onlinePayments: "active" | "not_configured"
  billing: "active" | "past_due" | "incomplete"
  staffOnline: number
}

interface ActionItem {
  type: string
  severity: "error" | "warning" | "info"
  message: string
  href: string
}

interface ActivityEvent {
  type: string
  icon: string
  message: string
  sub: string
  time: string
}

interface FeedbackPreview {
  id: string
  rating: number
  comment: string
  sentiment: string
  createdAt: string
}

interface HourlyPoint {
  hour: string
  revenue: number
}

interface SessionOverview {
  activeSessionsNow: number
  activeTablesNow: number
  tables: { servicePointLabel: string; label?: string; activeDevices: number }[]
}

interface DashboardPayload {
  dashboardType?: "foodService" | "hotel"
  snapshot: Snapshot
  businessHealth: BusinessHealth
  actionItems: ActionItem[]
  activityFeed: ActivityEvent[]
  feedbackPreview: FeedbackPreview[]
  hourlyRevenue: HourlyPoint[]
  reconciliationCount?: number
  sessionOverview?: SessionOverview
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good Morning"
  if (h < 17) return "Good Afternoon"
  return "Good Evening"
}

function relativeTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}

const SEVERITY_CONFIG = {
  error: { icon: XCircle, bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800/50", text: "text-red-700 dark:text-red-400", iconColor: "text-red-500" },
  warning: { icon: AlertTriangle, bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800/50", text: "text-amber-700 dark:text-amber-400", iconColor: "text-amber-500" },
  info: { icon: Info, bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800/50", text: "text-blue-700 dark:text-blue-400", iconColor: "text-blue-500" },
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-3 h-full">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="mt-auto">
        <p className="text-2xl font-black text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{label}</p>
      </div>
      {sub && <p className="text-xs font-medium text-muted-foreground/70">{sub}</p>}
    </div>
  )
}

function HealthBadge({ status, label }: { status: "green" | "yellow" | "red" | "gray"; label: string }) {
  const cfg = {
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    yellow: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    gray: "bg-secondary text-muted-foreground",
  }
  const dot = { green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-red-500", gray: "bg-gray-400" }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[status]}`} />
      {label}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OwnerCommandCenter() {
  const { user } = useAuthGuard()
  const { currency } = useBusinessSettings()
  const { progress: setupProgress, refreshSetupProgress } = useSetupProgress()
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [setupCollapsed, setSetupCollapsed] = useState(false)
  const [dismissingSetup, setDismissingSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const visibleActionItems = (data?.actionItems || []).filter((item) => (
    !item.href.startsWith("/owner/billing")
    || hasManagementArea(user, MANAGEMENT_ACCESS_AREAS.PAYMENTS_AND_BILLING)
  ))

  const fetchGenerationRef = useRef(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async (isSilent = false) => {
    if (!user?.businessId) return
    const fetchGeneration = ++fetchGenerationRef.current
    if (!isSilent) setLoading(true)
    setPageError(null)
    try {
      const dashRes = await apiClient.get<DashboardPayload>("/owner/dashboard")
      if (fetchGeneration === fetchGenerationRef.current) setData(dashRes.data)
    } catch (err) {
      console.error("[Dashboard fetch error]", err)
      if (fetchGeneration === fetchGenerationRef.current) {
        setPageError("Dashboard data could not be loaded. Please try again.")
      }
    } finally {
      if (fetchGeneration === fetchGenerationRef.current) setLoading(false)
    }
  }, [user?.businessId])

  const triggerDebouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchData(true)
    }, 1500)
  }, [fetchData])

  useEffect(() => {
    setData(null)
    setPageError(null)
    if (user?.businessId) void fetchData(false)
  }, [user?.businessId, fetchData])

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Operational Realtime SSE Subscription (debounced invalidation)
  const sseUrl = user?.businessId
    ? `/events?role=owner&businessId=${user.businessId}&permission=${MANAGER_PERMISSIONS.DASHBOARD_VIEW}`
    : ""

  const handleOperationalSseEvent = useCallback(() => {
    triggerDebouncedRefresh()
  }, [triggerDebouncedRefresh])

  const sseHandlers = useMemo(() => ({
    order_created: handleOperationalSseEvent,
    order_updated: handleOperationalSseEvent,
    waiter_call_created: handleOperationalSseEvent,
    waiter_call_updated: handleOperationalSseEvent,
    reservation_created: handleOperationalSseEvent,
    reservation_updated: handleOperationalSseEvent,
    reservation_checked_in: handleOperationalSseEvent,
    housekeeping_changed: handleOperationalSseEvent,
    service_points_changed: handleOperationalSseEvent,
  }), [handleOperationalSseEvent])

  useEventSource(sseUrl, sseHandlers, {
    onReconnect: () => {
      triggerDebouncedRefresh()
    }
  })



  const dismissSetupGuide = async () => {
    if (!setupProgress?.complete) return

    try {
      setDismissingSetup(true)
      await apiClient.post<{ setupProgress: SetupProgress }>("/owner/setup-progress/dismiss")
      await refreshSetupProgress()
    } catch (err) {
      console.error("[Dismiss setup guide error]", err)
    } finally {
      setDismissingSetup(false)
    }
  }

  const userName = user?.name || "there"

  // Skeleton Initial Load
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background pb-16">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
          <PageHeader
            className="px-6 py-4 flex items-center justify-between gap-4"
            title="Dashboard"
            titleClassName="text-xl tracking-normal"
            description={todayLabel()}
            descriptionClassName="mt-0 text-xs"
            action={
              <button disabled className="p-2 border border-border rounded-lg opacity-40 hover:bg-transparent" aria-label="Refresh Dashboard">
                <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
              </button>
            }
          />
        </header>
        <div className="px-6 py-6 space-y-8 max-w-7xl mx-auto animate-pulse">
          <div className="h-[88px] bg-secondary/40 rounded-2xl w-full border border-border/50" />
          <div className="space-y-3">
            <div className="h-4 w-32 bg-secondary/40 rounded" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-32 bg-secondary/40 rounded-2xl border border-border/50" />
              <div className="h-32 bg-secondary/40 rounded-2xl border border-border/50" />
              <div className="h-32 bg-secondary/40 rounded-2xl border border-border/50" />
              <div className="h-32 bg-secondary/40 rounded-2xl border border-border/50" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-48 bg-secondary/40 rounded-2xl w-full border border-border/50" />
            <div className="lg:col-span-2 h-48 bg-secondary/40 rounded-2xl w-full border border-border/50" />
          </div>
        </div>
      </div>
    )
  }

  if (pageError && !data) {
    return (
      <div className="min-h-screen bg-background pb-16">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
          <PageHeader className="px-4 py-4 sm:px-6" title="Dashboard" description="Dashboard data is unavailable" />
        </header>
        <div className="mx-auto flex min-h-80 max-w-xl flex-col items-center justify-center px-6 text-center">
          <AlertTriangle className="size-9 text-destructive" />
          <h1 className="mt-4 text-lg font-black text-foreground">Dashboard could not be loaded</h1>
          <p className="mt-2 text-sm text-muted-foreground">{pageError}</p>
          <button type="button" className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-secondary" onClick={() => void fetchData(false)}>Retry</button>
        </div>
      </div>
    )
  }

  if (data?.dashboardType === "hotel") {
    return (
      <HotelDashboard
        data={data as unknown as HotelDashboardPayload}
        userName={userName}
        loading={loading}
        onRefresh={() => void fetchData(false)}
        setupProgress={setupProgress}
        setupCollapsed={setupCollapsed}
        dismissingSetup={dismissingSetup}
        onToggleSetup={() => setSetupCollapsed((value) => !value)}
        onDismissSetup={() => void dismissSetupGuide()}
      />
    )
  }

  const snap = data?.snapshot
  const health = data?.businessHealth
  const fp = currency

  // Health statuses
  const paymentsStatus: "green" | "yellow" | "red" = health?.onlinePayments === "active" ? "green" : "red"
  const billingStatus: "green" | "yellow" | "red" =
    health?.billing === "active" ? "green" : health?.billing === "past_due" ? "red" : "yellow"


  return (
    <div className="min-h-screen bg-background pb-16">
      {/* ── Sticky Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <PageHeader
          className="px-6 py-4 flex items-center justify-between gap-4"
          title="Dashboard"
          titleClassName="text-xl tracking-normal"
          description={todayLabel()}
          descriptionClassName="mt-0 text-xs"
          action={
            <button
              onClick={() => fetchData(false)}
              disabled={loading}
              className="p-2 hover:bg-secondary rounded-lg transition-colors disabled:opacity-40 border border-border outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              title="Refresh"
              aria-label="Refresh Dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          }
        />
      </header>

      <div className="px-6 py-6 space-y-8 max-w-7xl mx-auto">

        {/* 1. Welcome Header */}
        <div className="bg-gradient-to-r from-[#EA601A]/10 via-card to-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{greeting()} 👋</p>
              <h2 className="text-2xl font-black text-foreground mt-0.5">{userName}</h2>
              <p className="text-sm text-muted-foreground mt-1">{todayLabel()}</p>
            </div>
            {snap && snap.activeOrders > 0 && (
              <div className="shrink-0 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-black text-amber-600">{snap.activeOrders}</p>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Active Orders</p>
              </div>
            )}
          </div>
        </div>

        {/* 2. Guided Setup (Visible only if incomplete) */}
        {setupProgress && !setupProgress.dismissed && (
          <GuidedSetupChecklist
            progress={setupProgress}
            collapsed={setupCollapsed}
            dismissing={dismissingSetup}
            onToggleCollapsed={() => setSetupCollapsed((value) => !value)}
            onDismiss={dismissSetupGuide}
          />
        )}

        {/* 3. Today's Snapshot */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Today's Snapshot</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Orders Today"
              value={String(snap?.todayOrders ?? 0)}
              sub={snap?.activeOrders ? `${snap.activeOrders} active now` : undefined}
              icon={ShoppingBag}
              color="bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
            />
            <KpiCard
              label="Revenue Today"
              value={formatPrice(snap?.todayRevenue ?? 0, fp)}
              icon={DollarSign}
              color="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
            />
            <KpiCard
              label="Service Points Served"
              value={String(snap?.tablesServed ?? 0)}
              icon={UtensilsCrossed}
              color="bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400"
            />
            <KpiCard
              label="Menu Items"
              value={String(snap?.totalMenuItems ?? 0)}
              icon={Package}
              color="bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400"
            />
          </div>
        </section>

        {/* 4. Needs Attention & 5. Live Operations Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Needs Attention */}
          <section className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="mb-4">
              <h2 className="text-sm font-black text-foreground">Needs Attention</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Operational items requiring immediate action.</p>
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
              {!visibleActionItems.length && !((data?.reconciliationCount ?? 0) > 0) ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2 my-auto text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1" />
                  <p className="text-sm font-semibold text-foreground">You're all caught up.</p>
                  <p className="text-xs text-muted-foreground">No issues detected right now.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleActionItems.map((item, i) => {
                    const cfg = SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG]
                    const Icon = cfg.icon
                    return (
                      <Link key={i} href={item.href} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border} hover:opacity-80 transition-opacity group outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-${cfg.iconColor.split('-')[1]}-500`}>
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.iconColor}`} />
                        <p className={`text-xs font-medium flex-1 ${cfg.text}`}>{item.message}</p>
                        <ChevronRight className={`w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60 group-hover:opacity-100 ${cfg.text}`} />
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* Reconciliation Summary Card */}
              {(data?.reconciliationCount ?? 0) > 0 && (
                <Link href="/waitstaff/past-orders?status=needs_reconciliation" className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500 mt-auto">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-red-700 dark:text-red-400">Reconciliation</h3>
                      <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5 break-words">{data?.reconciliationCount} unresolved historical issue{data?.reconciliationCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-red-700 dark:text-red-400 shrink-0 pl-2">
                    Resolve <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              )}
            </div>
          </section>

          {/* Live Session Overview */}
          <section className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm overflow-hidden relative flex flex-col">
            <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-5">
              <MonitorPlay className="w-40 h-40" />
            </div>

            <div className="relative z-10 flex-1 flex flex-col">
              <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-foreground">Live Operations</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Real-time breakdown of active devices</p>
                </div>
                <button
                  onClick={() => fetchData(false)}
                  disabled={loading}
                  className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-secondary text-xs font-bold text-muted-foreground transition-colors disabled:opacity-40 flex items-center gap-1.5 w-fit outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  aria-label="Refresh Live Operations"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Active Customers Now</p>
                  <p className="text-3xl font-black mt-2 text-primary">{data?.sessionOverview?.activeSessionsNow ?? 0}</p>
                </div>
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Service Points</p>
                  <p className="text-3xl font-black mt-2 text-primary">{data?.sessionOverview?.activeTablesNow ?? 0}</p>
                </div>
              </div>


            </div>
          </section>
        </div>

        {/* 6. Quick Actions */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { href: "/owner/menu", icon: UtensilsCrossed, label: "Menu", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/20", permission: MANAGER_PERMISSIONS.MENU_VIEW, area: MANAGEMENT_ACCESS_AREAS.MENU },
              { href: "/owner/staff", icon: Users, label: "Staff", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20", permission: MANAGER_PERMISSIONS.STAFF_VIEW, area: MANAGEMENT_ACCESS_AREAS.STAFF_MANAGEMENT },
              { href: "/owner/orders", icon: ShoppingBag, label: "Orders", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/20", permission: MANAGER_PERMISSIONS.ORDERS_VIEW, area: MANAGEMENT_ACCESS_AREAS.ORDERS },
              { href: "/owner/billing", icon: CreditCard, label: "Billing", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20", permission: null, area: MANAGEMENT_ACCESS_AREAS.PAYMENTS_AND_BILLING },
              { href: "/owner/feedback", icon: MessageSquare, label: "Feedback", color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-950/20", permission: MANAGER_PERMISSIONS.FEEDBACK_VIEW, area: MANAGEMENT_ACCESS_AREAS.FEEDBACK },
              { href: "/owner/service-points", icon: Zap, label: "Service Points", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20", permission: MANAGER_PERMISSIONS.SERVICE_POINTS_VIEW, area: MANAGEMENT_ACCESS_AREAS.SERVICE_POINTS },
            ].filter((item) => {
              if (user?.role === "manager") return Boolean(item.permission && hasManagementPermission(user, item.permission))
              return hasManagementArea(user, item.area)
            })
              .map(({ href, icon: Icon, label, color, bg }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-2.5 p-4 bg-card border border-border rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all group text-center outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:bg-secondary/30"
              >
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <span className="text-xs font-semibold text-foreground">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* 7. Revenue Chart + Activity Feed Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Hourly Revenue Chart */}
          <section className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-black text-foreground">Revenue Today</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Hourly breakdown</p>
              </div>
              <p className="text-lg font-black text-foreground">{formatPrice(snap?.todayRevenue ?? 0, fp)}</p>
            </div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.hourlyRevenue ?? []}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EA601A" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#EA601A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    interval={2}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    tickFormatter={v => v > 0 ? formatPrice(v, fp).split(".")[0] : ""}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
                          <p className="font-semibold text-foreground">{label}</p>
                          <p className="text-muted-foreground">Revenue: <span className="font-bold text-[#EA601A]">{formatPrice(Number(payload[0]?.value ?? 0), fp)}</span></p>
                        </div>
                      )
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#EA601A" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Recent Activity Feed */}
          <section className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
            <h2 className="text-sm font-black text-foreground mb-4">Recent Activity</h2>
            {!data?.activityFeed?.length ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center my-auto">
                <Zap className="w-6 h-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No activity today yet.</p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[200px] pr-1">
                {data?.activityFeed?.map((event, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-base leading-none mt-0.5">{event.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{event.message}</p>
                      {event.sub && <p className="text-[10px] text-muted-foreground truncate">{event.sub}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{relativeTime(event.time)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 8. Recent Feedback + Business Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Feedback Preview */}
          <section className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-black text-foreground">Recent Feedback</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Latest customer reviews</p>
              </div>
              {hasManagementPermission(user, MANAGER_PERMISSIONS.FEEDBACK_VIEW) && (
                <Link href="/owner/feedback" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm">
                  View All <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
            {!data?.feedbackPreview?.length ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <MessageSquare className="w-7 h-7 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No feedback yet.</p>
                <p className="text-xs text-muted-foreground">Customer reviews will appear here after orders are served.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.feedbackPreview.slice(0, 2).map((fb) => (
                  <div key={String(fb.id)} className="p-4 rounded-xl border border-border/60 bg-secondary/10 space-y-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < fb.rating ? "fill-yellow-400 text-yellow-400" : "fill-muted text-muted"}`} />
                      ))}
                    </div>
                    <p className="text-xs text-foreground leading-relaxed line-clamp-2">
                      {fb.comment || <span className="italic text-muted-foreground">No comment provided.</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{relativeTime(fb.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Business Health */}
          <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-foreground mb-4">Business Health</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                <div className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  Online Payments
                </div>
                <HealthBadge status={paymentsStatus} label={health?.onlinePayments === "active" ? "Active" : "Not Configured"} />
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                <div className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  Billing
                </div>
                <HealthBadge
                  status={billingStatus}
                  label={health?.billing === "active" ? "Active" : health?.billing === "past_due" ? "Past Due" : "Incomplete"}
                />
              </div>
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  Staff Online
                </div>
                <HealthBadge
                  status={(health?.staffOnline ?? 0) > 0 ? "green" : "gray"}
                  label={`${health?.staffOnline ?? 0} online`}
                />
              </div>
            </div>
          </section>
        </div>

      </div>
    </div>
  )
}
