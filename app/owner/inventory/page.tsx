"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowRight,
  Boxes,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  PackageX,
  Plus,
  RefreshCw,
  Scale,
  TriangleAlert,
} from "lucide-react"
import apiClient from "@/lib/axios-config"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthContext } from "@/contexts/AuthContext"
import { hasManagementPermission, MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import {
  buildInventoryHref,
  getInventoryDomainsForBusiness,
  getInventoryOperationalContexts,
  resolveInventoryOperationalContext,
} from "@/lib/inventory"
import type {
  InventoryItem,
  InventoryItemsResponse,
  InventoryMovement,
  InventoryMovementResponse,
  InventoryOverviewResponse,
} from "@/types/inventory"
import { InventoryItemDrawer } from "@/components/owner/inventory/InventoryItemDrawer"
import { InventoryItemFormDialog } from "@/components/owner/inventory/InventoryItemFormDialog"
import { InventoryMovementDialog, type InventoryMovementAction } from "@/components/owner/inventory/InventoryMovementDialog"
import { InventoryActivityList, InventoryAttentionList } from "@/components/owner/inventory/InventoryOverviewPanels"

type InventoryOverviewApiResponse = InventoryOverviewResponse & {
  recentMovements?: InventoryMovement[]
}

type MovementTarget = {
  item: InventoryItem
  action: InventoryMovementAction
}

export default function InventoryOverviewPage() {
  const { user, loading: authLoading } = useAuthContext()
  const searchParams = useSearchParams()
  const availableContexts = useMemo(() => getInventoryOperationalContexts(user), [user])
  const operationalContext = resolveInventoryOperationalContext(user, searchParams.get("context"))
  const domainOptions = useMemo(
    () => getInventoryDomainsForBusiness(user, operationalContext),
    [operationalContext, user],
  )
  const includeContext = availableContexts.length > 1
  const canManage = hasManagementPermission(user, MANAGER_PERMISSIONS.INVENTORY_MANAGE)
  const canReceive = hasManagementPermission(user, MANAGER_PERMISSIONS.INVENTORY_RECEIVE)
  const canWaste = hasManagementPermission(user, MANAGER_PERMISSIONS.INVENTORY_WASTE)
  const canAdjust = hasManagementPermission(user, MANAGER_PERMISSIONS.INVENTORY_ADJUST)
  const canViewRecipes = operationalContext === "foodService" && hasManagementPermission(user, MANAGER_PERMISSIONS.MENU_VIEW)
  const [overview, setOverview] = useState<InventoryOverviewApiResponse | null>(null)
  const [attentionItems, setAttentionItems] = useState<InventoryItem[]>([])
  const [attentionError, setAttentionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [movementTarget, setMovementTarget] = useState<MovementTarget | null>(null)

  const inventoryParams = useMemo(() => ({
    domain: domainOptions.map((option) => option.value).join(","),
  }), [domainOptions])

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    if (!user?.businessId || domainOptions.length === 0) return
    setLoading(true)
    setError(null)
    setAttentionError(null)
    try {
      const overviewResult = await apiClient.get<InventoryOverviewApiResponse>("/owner/inventory/overview", {
        params: inventoryParams,
        signal,
      })
      if (signal?.aborted) return
      setOverview(overviewResult.data)

      const [outOfStockResult] = await Promise.allSettled([
        apiClient.get<InventoryItemsResponse>("/owner/inventory/items", {
          params: { ...inventoryParams, active: "true", stockStatus: "out_of_stock", limit: 5 },
          signal,
        }),
      ])
      if (signal?.aborted) return

      const outOfStockItems = outOfStockResult.status === "fulfilled" ? outOfStockResult.value.data.items : []
      const remainingSlots = Math.max(0, 5 - outOfStockItems.length)
      let lowStockItems: InventoryItem[] = []
      let lowStockFailed = false
      if (remainingSlots > 0) {
        const [lowStockResult] = await Promise.allSettled([
          apiClient.get<InventoryItemsResponse>("/owner/inventory/items", {
            params: { ...inventoryParams, active: "true", stockStatus: "low_stock", limit: remainingSlots },
            signal,
          }),
        ])
        if (signal?.aborted) return
        if (lowStockResult.status === "fulfilled") lowStockItems = lowStockResult.value.data.items
        else lowStockFailed = true
      }

      setAttentionItems([...outOfStockItems, ...lowStockItems].slice(0, 5))
      if (outOfStockResult.status === "rejected" || lowStockFailed) {
        setAttentionError("Items needing attention could not be loaded. Open Items to review stock.")
      }
    } catch (requestError) {
      if (signal?.aborted) return
      setError(requestError instanceof Error ? requestError.message : "Unable to load inventory overview")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [domainOptions.length, inventoryParams, user?.businessId])

  useEffect(() => {
    const controller = new AbortController()
    void loadOverview(controller.signal)
    return () => controller.abort()
  }, [loadOverview])

  const handleMovementCompleted = (result: InventoryMovementResponse) => {
    setMovementTarget(null)
    setAttentionItems((current) => current.map((item) => (
      item.inventoryItemId === result.item.inventoryItemId ? result.item : item
    )))
    void loadOverview()
  }

  const handleItemChanged = () => {
    void loadOverview()
  }

  if ((authLoading || loading) && !overview) {
    return (
      <div className="space-y-6" aria-label="Loading inventory overview">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-36 rounded-xl" />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }

  if (error && !overview) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <RefreshCw className="size-5" aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-semibold">Inventory overview could not be loaded</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Check your connection and try again. No inventory data was changed.</p>
          <Button className="mt-5" onClick={() => void loadOverview()}>Try again</Button>
        </CardContent>
      </Card>
    )
  }

  const summary = overview?.summary ?? { activeItems: 0, lowStockItems: 0, outOfStockItems: 0 }
  const inStockItems = Math.max(0, summary.activeItems - summary.lowStockItems - summary.outOfStockItems)
  const summaryCards = [
    {
      label: "Total items",
      value: summary.activeItems,
      description: "Active catalog items",
      icon: Boxes,
      tone: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
      href: buildInventoryHref("/owner/inventory/items", operationalContext, includeContext, { active: "true" }),
    },
    {
      label: "In stock",
      value: inStockItems,
      description: "Ready to use",
      icon: PackageCheck,
      tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      href: buildInventoryHref("/owner/inventory/items", operationalContext, includeContext, { active: "true" }),
    },
    {
      label: "Low stock",
      value: summary.lowStockItems,
      description: "Above zero and at alert level",
      icon: TriangleAlert,
      tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      href: buildInventoryHref("/owner/inventory/items", operationalContext, includeContext, { active: "true", stockStatus: "low_stock" }),
    },
    {
      label: "Out of stock",
      value: summary.outOfStockItems,
      description: "No available quantity",
      icon: PackageX,
      tone: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      href: buildInventoryHref("/owner/inventory/items", operationalContext, includeContext, { active: "true", stockStatus: "out_of_stock" }),
    },
  ]
  const itemsHref = buildInventoryHref("/owner/inventory/items", operationalContext, includeContext, { active: "true" })
  const activityHref = buildInventoryHref("/owner/inventory/activity", operationalContext, includeContext)

  return (
    <div className="space-y-6">
      <section aria-labelledby="inventory-summary-heading">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 id="inventory-summary-heading" className="text-lg font-semibold">Stock overview</h2>
            <p className="text-sm text-muted-foreground">Availability already accounts for reserved stock.</p>
          </div>
          {loading ? <RefreshCw className="size-4 animate-spin text-muted-foreground" aria-label="Refreshing inventory overview" /> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon
            return (
              <Link key={card.label} href={card.href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Card className="h-full gap-4 py-5 transition-colors group-hover:border-primary/40">
                  <CardHeader className="flex-row items-start justify-between space-y-0 px-5">
                    <div>
                      <CardDescription>{card.label}</CardDescription>
                      <CardTitle className="mt-3 text-3xl tabular-nums">{card.value}</CardTitle>
                    </div>
                    <div className={`flex size-10 items-center justify-center rounded-lg ${card.tone}`}>
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between px-5 text-sm text-muted-foreground">
                    <span>{card.description}</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Out-of-stock items appear before items nearing their alert level.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <InventoryAttentionList
              items={attentionItems}
              canReceive={canReceive}
              loading={loading && !overview}
              error={attentionError}
              onReceive={(item) => setMovementTarget({ item, action: "receive" })}
              onViewItem={setSelectedItemId}
            />
            <Button asChild variant="link" className="mt-3 h-auto px-0">
              <Link href={itemsHref}>View all stock items <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle>Recent stock activity</CardTitle>
            <CardDescription>Latest recorded inventory movements for this operational area.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <InventoryActivityList
              movements={overview?.recentMovements || []}
              timezone={user?.timezone || "UTC"}
              itemHref={(inventoryItemId) => buildInventoryHref("/owner/inventory/items", operationalContext, includeContext, { inventoryItemId })}
            />
            <Button asChild variant="link" className="mt-3 h-auto px-0">
              <Link href={activityHref}>View all activity <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="inventory-quick-actions-heading">
        <div className="mb-3">
          <h2 id="inventory-quick-actions-heading" className="text-base font-semibold">Quick actions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose an item before recording a stock movement.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {canManage ? (
            <Button variant="outline" className="h-auto justify-start px-4 py-4 text-left" onClick={() => setCreateOpen(true)}>
              <Plus className="size-5 text-primary" aria-hidden="true" />
              <span><span className="block font-semibold">Add new item</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Create a stock item to track.</span></span>
            </Button>
          ) : null}
          {canReceive ? (
            <Button asChild variant="outline" className="h-auto justify-start px-4 py-4 text-left">
              <Link href={itemsHref}><PackagePlus className="size-5 text-primary" aria-hidden="true" /><span><span className="block font-semibold">Receive stock</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Choose an item and add a delivery.</span></span></Link>
            </Button>
          ) : null}
          {canWaste ? (
            <Button asChild variant="outline" className="h-auto justify-start px-4 py-4 text-left">
              <Link href={itemsHref}><PackageMinus className="size-5 text-destructive" aria-hidden="true" /><span><span className="block font-semibold">Record waste</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Choose an item that was lost or spoiled.</span></span></Link>
            </Button>
          ) : null}
          {canAdjust ? (
            <Button asChild variant="outline" className="h-auto justify-start px-4 py-4 text-left">
              <Link href={itemsHref}><Scale className="size-5 text-primary" aria-hidden="true" /><span><span className="block font-semibold">Correct stock count</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Choose an item and record a correction.</span></span></Link>
            </Button>
          ) : null}
        </div>
      </section>

      {summary.activeItems === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center px-6 py-10 text-center">
            <Boxes className="size-9 text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-3 font-medium">No active inventory items</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Create your first item, then record its first delivery to add stock.</p>
            {canManage ? <Button className="mt-5" onClick={() => setCreateOpen(true)}>Add inventory item</Button> : <Button asChild variant="outline" className="mt-5"><Link href={itemsHref}>View items catalog</Link></Button>}
          </CardContent>
        </Card>
      ) : null}

      <InventoryItemDrawer
        key={selectedItemId || "closed-overview-item-drawer"}
        open={Boolean(selectedItemId)}
        itemId={selectedItemId}
        defaultCurrency={user?.currency || "EUR"}
        canManage={canManage}
        canReceive={canReceive}
        canWaste={canWaste}
        canAdjust={canAdjust}
        canViewRecipes={canViewRecipes}
        domainOptions={domainOptions}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedItemId(null)
        }}
        onItemChanged={handleItemChanged}
        onItemDeleted={() => {
          setSelectedItemId(null)
          void loadOverview()
        }}
        onViewItem={setSelectedItemId}
      />

      <InventoryItemFormDialog
        open={createOpen}
        mode="create"
        defaultCurrency={user?.currency || "EUR"}
        domainOptions={domainOptions}
        onOpenChange={setCreateOpen}
        onSaved={() => void loadOverview()}
        onViewExisting={setSelectedItemId}
        onReceiveFirstDelivery={canReceive ? (item) => setMovementTarget({ item, action: "receive" }) : undefined}
      />

      {movementTarget ? (
        <InventoryMovementDialog
          open
          item={movementTarget.item}
          action={movementTarget.action}
          defaultCurrency={user?.currency || "EUR"}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setMovementTarget(null)
          }}
          onCompleted={handleMovementCompleted}
        />
      ) : null}
    </div>
  )
}
