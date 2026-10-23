"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Users,
  Settings,
  Menu,
  LogOut,
  Loader2,
  QrCode,
  MessageSquare,
  BarChart3,
  ChevronRight,
  CalendarClock,
  ArrowLeftRight,
  Wallet,
  Palette,
  Sparkles,
  Boxes,
  BedDouble,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { BusinessProvider } from "@/contexts/BusinessContext"
import { SetupProgressProvider } from "@/contexts/SetupProgressContext"
import SetupJourneyTracker from "@/components/owner/SetupJourneyTracker"
import { OwnerNotificationCenter } from "@/components/owner/notifications/OwnerNotificationCenter"
import {
  useOwnerNotifications,
  type OwnerNotificationsController,
} from "@/hooks/use-owner-notifications"
import {
  getFirstPermittedManagementPath,
  hasManagementArea,
  hasManagementPermission,
  MANAGEMENT_ACCESS_AREAS,
  MANAGER_PERMISSIONS,
  resolveManagementPageAccess,
  type ManagementAccessArea,
  type ManagerPermission,
} from "@/lib/manager-permissions"

const MANAGEMENT_PORTAL_ROLES = ["owner", "co_owner", "manager"]

// ─────────────────────────────────────────────
// Navigation Configuration
// ─────────────────────────────────────────────
type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  disabled?: boolean
  badge?: string
  requiredPermission?: ManagerPermission
  requiredArea: ManagementAccessArea
}

type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

const navigationItemCatalog: Record<string, NavItem> = {
  orders: { href: "/owner/orders", label: "Orders", icon: ShoppingBag, requiredPermission: MANAGER_PERMISSIONS.ORDERS_VIEW, requiredArea: MANAGEMENT_ACCESS_AREAS.ORDERS },
  transactions: { href: "/owner/transactions", label: "Transactions", icon: ArrowLeftRight, requiredPermission: MANAGER_PERMISSIONS.TRANSACTIONS_VIEW, requiredArea: MANAGEMENT_ACCESS_AREAS.TRANSACTIONS },
  reservations: { href: "/owner/reservations", label: "Reservations", icon: CalendarClock, requiredPermission: MANAGER_PERMISSIONS.RESERVATIONS_VIEW, requiredArea: MANAGEMENT_ACCESS_AREAS.RESERVATIONS },
  housekeeping: { href: "/housekeeping", label: "Housekeeping", icon: BedDouble, requiredPermission: MANAGER_PERMISSIONS.HOUSEKEEPING_VIEW, requiredArea: MANAGEMENT_ACCESS_AREAS.HOUSEKEEPING },
  menu: { href: "/owner/menu", label: "Menu", icon: UtensilsCrossed, requiredPermission: MANAGER_PERMISSIONS.MENU_VIEW, requiredArea: MANAGEMENT_ACCESS_AREAS.MENU },
  inventory: { href: "/owner/inventory", label: "Inventory", icon: Boxes, requiredPermission: MANAGER_PERMISSIONS.INVENTORY_VIEW, requiredArea: MANAGEMENT_ACCESS_AREAS.INVENTORY },
  servicePoints: { href: "/owner/service-points", label: "Service Points", icon: QrCode, requiredPermission: MANAGER_PERMISSIONS.SERVICE_POINTS_VIEW, requiredArea: MANAGEMENT_ACCESS_AREAS.SERVICE_POINTS },
  staff: { href: "/owner/staff", label: "Staff Management", icon: Users, requiredPermission: MANAGER_PERMISSIONS.STAFF_VIEW, requiredArea: MANAGEMENT_ACCESS_AREAS.STAFF_MANAGEMENT },
  analytics: { href: "/owner/analytics", label: "Analytics", icon: BarChart3, requiredPermission: MANAGER_PERMISSIONS.ANALYTICS_VIEW, requiredArea: MANAGEMENT_ACCESS_AREAS.ANALYTICS },
  feedback: { href: "/owner/feedback", label: "Customer Feedback", icon: MessageSquare, requiredPermission: MANAGER_PERMISSIONS.FEEDBACK_VIEW, requiredArea: MANAGEMENT_ACCESS_AREAS.FEEDBACK },
  guests: { href: "/owner/guests", label: "Guests / CRM", icon: Users, requiredPermission: MANAGER_PERMISSIONS.CRM_VIEW, requiredArea: MANAGEMENT_ACCESS_AREAS.CRM },
  aiBusinessAnalyst: { href: "/owner/ai-business-analyst", label: "AI Business Analyst", icon: Sparkles, requiredPermission: MANAGER_PERMISSIONS.AI_ANALYST_VIEW, requiredArea: MANAGEMENT_ACCESS_AREAS.AI_ANALYST },
  billing: { href: "/owner/billing", label: "Payments & Billing", icon: Wallet, requiredArea: MANAGEMENT_ACCESS_AREAS.PAYMENTS_AND_BILLING },
  branding: { href: "/owner/branding", label: "Branding", icon: Palette, requiredArea: MANAGEMENT_ACCESS_AREAS.BRANDING },
  settings: { href: "/owner/settings", label: "Settings", icon: Settings, requiredPermission: MANAGER_PERMISSIONS.SETTINGS_OPERATIONAL_MANAGE, requiredArea: MANAGEMENT_ACCESS_AREAS.BUSINESS_SETTINGS },
}

import type { DashboardUser } from '@/contexts/AuthContext';
function resolveNavigationGroups(user?: DashboardUser | null): NavGroup[] {
  const capabilities = user?.capabilities;
  const entitlements = user?.entitlements || { crm: false, advancedAnalytics: false, advancedBranding: false };
  const resolvedGroups = capabilities?.navigation.groups
    ?.map((group) => ({
      id: group.id,
      label: group.label,
      items: group.items
        .map((itemId) => {
          const baseItem = navigationItemCatalog[itemId];
          if (!baseItem) return null;
          const item = { ...baseItem };
          if (itemId === 'analytics' && !entitlements.advancedAnalytics) item.badge = 'Growth';
          if (itemId === 'guests' && !entitlements.crm) item.badge = 'Growth';
          if (itemId === 'branding' && !entitlements.advancedBranding) item.badge = 'Growth';
          if (itemId === 'aiBusinessAnalyst' && !(entitlements as any).aiBusinessAnalyst) item.badge = 'Growth';
          return item;
        })
        .filter((item): item is NavItem => Boolean(item)),
    }))
    .filter((group) => group.items.length > 0) || []

  // Ensure transactions is available whenever at least one module (lodging, foodService, etc.) is active
  const hasTransactionProducingModule =
    (capabilities?.visibleModules && capabilities.visibleModules.length > 0) ||
    resolvedGroups.length > 0

  if (hasTransactionProducingModule) {
    const hasTransactions = resolvedGroups.some((group) =>
      group.items.some((item) => item.href === "/owner/transactions")
    )

    if (!hasTransactions && resolvedGroups.length > 0) {
      const targetGroup =
        resolvedGroups.find((g) =>
          g.items.some((i) => i.href === "/owner/orders" || i.href === "/owner/reservations")
        ) || resolvedGroups[0]

      if (targetGroup) {
        const insertIdx = targetGroup.items.findIndex(
          (i) => i.href === "/owner/orders" || i.href === "/owner/reservations"
        )
        if (insertIdx !== -1) {
          targetGroup.items.splice(insertIdx + 1, 0, navigationItemCatalog.transactions)
        } else {
          targetGroup.items.push(navigationItemCatalog.transactions)
        }
      }
    }
  }

  // Account workspaces are platform-level management surfaces rather than
  // business-module capabilities. Keep them present even when a cached/legacy
  // capability payload does not list the account navigation group.
  const accountItems = [
    navigationItemCatalog.billing,
    navigationItemCatalog.branding,
    navigationItemCatalog.settings,
  ]
  let accountGroup = resolvedGroups.find((group) => group.id === "account")
  if (!accountGroup) {
    accountGroup = { id: "account", label: "Account", items: [] }
    resolvedGroups.push(accountGroup)
  }
  for (const item of accountItems) {
    const alreadyPresent = resolvedGroups.some((group) => (
      group.items.some((current) => current.href === item.href)
    ))
    if (!alreadyPresent) accountGroup.items.push(item)
  }

  return resolvedGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (user?.role === "manager") {
          return Boolean(item.requiredPermission) && hasManagementPermission(user, item.requiredPermission!)
        }
        if (user?.role === "co_owner") return hasManagementArea(user, item.requiredArea)
        return true
      }),
    }))
    .filter((group) => group.items.length > 0)
}

// ─────────────────────────────────────────────
// Hook: Collapsible group state with localStorage
// ─────────────────────────────────────────────
function useGroupExpansion(pathname: string, navigationGroups: NavGroup[]) {
  const LS_KEY = "qs-owner-sidebar-groups"

  const getInitialState = (): Record<string, boolean> => {
    // Find which groups contain the active route
    const activeGroups = new Set<string>()
    for (const group of navigationGroups) {
      for (const item of group.items) {
        if (pathname.startsWith(item.href)) {
          activeGroups.add(group.id)
        }
      }
    }

    // Load persisted state
    let persisted: Record<string, boolean> = {}
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) persisted = JSON.parse(raw)
    } catch {}

    // Merge: always expand the active group
    const merged: Record<string, boolean> = {}
    for (const group of navigationGroups) {
      merged[group.id] = activeGroups.has(group.id) ? true : (persisted[group.id] ?? false)
    }
    return merged
  }

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Initialize on mount (client only)
  useEffect(() => {
    setExpanded(getInitialState())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand parent group when route changes
  useEffect(() => {
    setExpanded(prev => {
      const next = { ...prev }
      for (const group of navigationGroups) {
        for (const item of group.items) {
          if (pathname.startsWith(item.href)) {
            next[group.id] = true
          }
        }
      }
      return next
    })
  }, [pathname])

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return { expanded, toggle }
}

// ─────────────────────────────────────────────
// NavGroupItem Component
// ─────────────────────────────────────────────
function NavGroupSection({
  group,
  isExpanded,
  onToggle,
  pathname,
  onItemClick,
}: {
  group: NavGroup
  isExpanded: boolean
  onToggle: () => void
  pathname: string
  onItemClick?: () => void
}) {
  const isGroupActive = group.items.some(item => !item.disabled && pathname.startsWith(item.href))

  return (
    <div className="space-y-0.5">
      {/* Group Header */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors group ${
          isGroupActive
            ? "text-foreground"
            : "text-muted-foreground/60 hover:text-muted-foreground"
        }`}
      >
        <span>{group.label}</span>
        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* Group Items with CSS height animation */}
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: isExpanded ? `${group.items.length * 48}px` : "0px", opacity: isExpanded ? 1 : 0 }}
      >
        <div className="space-y-0.5 pb-1">
          {group.items.map((item) => {
            const isActive = !item.disabled && pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <div key={item.href}>
                {item.disabled ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground/40 cursor-not-allowed select-none">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-wider bg-secondary px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    onClick={onItemClick}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    )}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Sidebar Component
// ─────────────────────────────────────────────
function Sidebar({
  onItemClick,
  displayName,
  onLogout,
  navigationGroups,
  user,
  notifications,
  showNotificationCenter = true,
}: {
  onItemClick?: () => void
  displayName: string
  onLogout: () => void
  navigationGroups: NavGroup[]
  user: DashboardUser
  notifications: OwnerNotificationsController
  showNotificationCenter?: boolean
}) {
  const pathname = usePathname()
  const { expanded, toggle } = useGroupExpansion(pathname, navigationGroups)

  const isDashboardActive = pathname === "/owner/dashboard" || pathname === "/owner"
  const canViewDashboard = hasManagementPermission(user, MANAGER_PERMISSIONS.DASHBOARD_VIEW)
  const portalHome = getFirstPermittedManagementPath(user)

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <Link href={portalHome} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
            <img src="/icon.png" alt="Chillow logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-black text-base tracking-tight leading-none">
              <span className="text-[#2B304C]">Chillow</span>
      
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">{user.role === "manager" ? "Management Portal" : "Owner Portal"}</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {/* Dashboard — Top Level */}
        {canViewDashboard && (
          <Link
            href="/owner/dashboard"
            onClick={onItemClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              isDashboardActive
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            Dashboard
          </Link>
        )}

        {/* Divider */}
        <div className="border-t border-border/50" />

        {/* Grouped Navigation */}
        <div className="space-y-3">
          {navigationGroups.map(group => (
            <NavGroupSection
              key={group.id}
              group={group}
              isExpanded={!!expanded[group.id]}
              onToggle={() => toggle(group.id)}
              pathname={pathname}
              onItemClick={onItemClick}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-2">
        {showNotificationCenter ? <OwnerNotificationCenter variant="desktop" controller={notifications} /> : null}
        <div className="px-3 py-2.5 bg-secondary/40 rounded-xl mb-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Business</p>
          <p className="font-semibold text-sm truncate mt-0.5">{displayName}</p>
        </div>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 py-2.5 h-auto text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg font-medium transition-all"
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}

function OwnerLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const pageAccess = resolveManagementPageAccess(pathname)
  const { user, loading, logout } = useAuthGuard({
    requiredRole: pageAccess.requiredRole,
    allowedRoles: pageAccess.requiredRole ? undefined : MANAGEMENT_PORTAL_ROLES,
    requiredPermission: pageAccess.requiredPermission,
    requiredArea: pageAccess.requiredArea,
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const notifications = useOwnerNotifications(Boolean(user))
  const navigationGroups = resolveNavigationGroups(user)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  const displayName = user.displayName || "Business"

  return (
    <BusinessProvider 
      businessType={user.businessType} 
      modules={user.modules} 
      capabilities={user.capabilities}
      currency={user.currency}
      taxRate={user.taxRate}
      timezone={user.timezone}
    >
      <SetupProgressProvider>
        <div className="min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col border-r border-border bg-card z-40">
          <Sidebar displayName={displayName} onLogout={logout} navigationGroups={navigationGroups} user={user} notifications={notifications} />
        </aside>

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                <img src="/icon.png" alt="Chillow logo" className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-sm">Chillow</span>
            </div>
            <div className="flex items-center gap-1">
              <OwnerNotificationCenter variant="mobile" controller={notifications} />
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open owner navigation">
                    <Menu className="w-5 h-5" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-60">
                  <Sidebar
                    displayName={displayName}
                    onLogout={logout}
                    navigationGroups={navigationGroups}
                    user={user}
                    notifications={notifications}
                    showNotificationCenter={false}
                    onItemClick={() => setMobileOpen(false)}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="lg:pl-60 relative">
          {children}
        </main>
        
        {/* Setup Progress Tracker */}
        {user.role === "owner" && <SetupJourneyTracker />}
      </div>
      </SetupProgressProvider>
    </BusinessProvider>
  )
}

import { AuthProvider } from "@/contexts/AuthContext"

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OwnerLayoutInner>{children}</OwnerLayoutInner>
    </AuthProvider>
  )
}
