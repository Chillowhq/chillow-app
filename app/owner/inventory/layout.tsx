"use client"

import { useEffect, useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BedDouble, Boxes, UtensilsCrossed } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthContext } from "@/contexts/AuthContext"
import {
  buildInventoryHref,
  getInventoryOperationalContexts,
  INVENTORY_OPERATIONAL_CONTEXTS,
  resolveInventoryOperationalContext,
} from "@/lib/inventory"
import { hasManagementPermission, MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import type { InventoryOperationalContext } from "@/types/business-capabilities"

const sharedNavigation = [
  { href: "/owner/inventory", label: "Overview", exact: true },
  { href: "/owner/inventory/items", label: "Items" },
  { href: "/owner/inventory/activity", label: "Stock activity" },
]

export default function InventoryWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading, refreshUser } = useAuthContext()
  const availableContexts = useMemo(() => getInventoryOperationalContexts(user), [user])
  const requestedContext = searchParams.get("context")
  const routePreferredContext: InventoryOperationalContext | undefined = pathname.startsWith("/owner/inventory/recipes")
    ? "foodService"
    : pathname.startsWith("/owner/inventory/room-supplies")
      ? "hotelOperations"
      : undefined
  const activeContext = resolveInventoryOperationalContext(user, requestedContext, routePreferredContext)
  const hasHotelOperations = availableContexts.includes("hotelOperations")
  const hasFoodService = availableContexts.includes("foodService")
  const mixedBusiness = availableContexts.length > 1
  const canViewRecipes = hasFoodService && hasManagementPermission(user, MANAGER_PERMISSIONS.MENU_VIEW)

  useEffect(() => {
    if (authLoading) return
    const refreshCapabilities = () => void refreshUser()
    refreshCapabilities()
    window.addEventListener("focus", refreshCapabilities)
    return () => window.removeEventListener("focus", refreshCapabilities)
  }, [authLoading, refreshUser])

  useEffect(() => {
    if (authLoading || !user || availableContexts.length === 0) return

    const invalidCapabilityRoute =
      (pathname.startsWith("/owner/inventory/recipes") && !hasFoodService) ||
      (pathname.startsWith("/owner/inventory/room-supplies") && !hasHotelOperations)
    const routeContextMismatch =
      (pathname.startsWith("/owner/inventory/recipes") && activeContext !== "foodService") ||
      (pathname.startsWith("/owner/inventory/room-supplies") && activeContext !== "hotelOperations")

    if (invalidCapabilityRoute || routeContextMismatch) {
      router.replace(buildInventoryHref("/owner/inventory", activeContext, mixedBusiness))
      return
    }

    if (mixedBusiness && requestedContext !== activeContext) {
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set("context", activeContext)
      router.replace(`${pathname}?${nextParams.toString()}`)
    }
  }, [
    activeContext,
    authLoading,
    availableContexts.length,
    hasFoodService,
    hasHotelOperations,
    mixedBusiness,
    pathname,
    requestedContext,
    router,
    searchParams,
    user,
  ])

  const inventoryNavigation = [
    ...sharedNavigation,
    ...(activeContext === "hotelOperations" && hasHotelOperations
      ? [{ href: "/owner/inventory/room-supplies", label: "Room Supplies" }]
      : []),
    ...(activeContext === "foodService" && canViewRecipes
      ? [{ href: "/owner/inventory/recipes", label: "Recipes" }]
      : []),
  ]
  const description = mixedBusiness
    ? "Manage stock across your hospitality operations."
    : activeContext === "hotelOperations"
      ? "Manage stock across your property."
      : "Manage stock for your Food Service operation."

  const contextHref = (context: InventoryOperationalContext) => {
    const sharedPath = pathname === "/owner/inventory" || pathname.startsWith("/owner/inventory/items") || pathname.startsWith("/owner/inventory/activity")
      ? pathname
      : "/owner/inventory"
    return buildInventoryHref(sharedPath, context, true)
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Boxes className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Inventory</h1>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          {mixedBusiness ? (
            <div className="mt-6 overflow-x-auto" role="tablist" aria-label="Inventory operational context">
              <div className="inline-flex min-w-max rounded-xl border bg-background p-1 shadow-sm">
                {INVENTORY_OPERATIONAL_CONTEXTS.filter((option) => availableContexts.includes(option.value)).map((option) => {
                  const isActive = activeContext === option.value
                  const Icon = option.value === "hotelOperations" ? BedDouble : UtensilsCrossed
                  return (
                    <Link
                      key={option.value}
                      href={contextHref(option.value)}
                      role="tab"
                      aria-selected={isActive}
                      className={cn(
                        "flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {option.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : null}

          <nav className="mt-5 flex gap-1 overflow-x-auto border-b" aria-label={`${activeContext === "hotelOperations" ? "Hotel Operations" : "Food Service"} inventory workspace`}>
            {inventoryNavigation.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={buildInventoryHref(item.href, activeContext, mixedBusiness)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative shrink-0 px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>

        {children}
      </div>
    </div>
  )
}
