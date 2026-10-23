"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { BedDouble, ChevronLeft, ChevronRight, Eye, PackagePlus, PackageSearch, Plus, RefreshCw, Search, X } from "lucide-react"
import apiClient from "@/lib/axios-config"
import {
  formatInventoryQuantity,
  getInventoryDomainLabel,
  getInventoryDomainsForBusiness,
  getInventoryOperationalContexts,
  resolveInventoryOperationalContext,
} from "@/lib/inventory"
import { hasManagementPermission, MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import { useAuthContext } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  InventoryActiveFilter,
  InventoryDomain,
  InventoryItem,
  InventoryItemsResponse,
  InventoryMovementResponse,
  InventoryStockStatusFilter,
} from "@/types/inventory"
import { InventoryItemDrawer } from "@/components/owner/inventory/InventoryItemDrawer"
import { InventoryItemFormDialog } from "@/components/owner/inventory/InventoryItemFormDialog"
import { InventoryStockBadge } from "@/components/owner/inventory/InventoryStockBadge"
import { RoomUsageDialog } from "@/components/owner/inventory/RoomUsageDialog"
import { InventoryMovementDialog, type InventoryMovementAction } from "@/components/owner/inventory/InventoryMovementDialog"

const PAGE_SIZE = 25

type MovementTarget = {
  item: InventoryItem
  action: InventoryMovementAction
}

function isStockStatusFilter(value: string | null): value is InventoryStockStatusFilter {
  return value === "all" || value === "low_stock" || value === "out_of_stock"
}

function isActiveFilter(value: string | null): value is InventoryActiveFilter {
  return value === "all" || value === "true" || value === "false"
}

function ItemsLoadingState() {
  return (
    <div className="space-y-3 p-4" aria-label="Loading inventory items">
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton key={row} className="h-14 w-full" />
      ))}
    </div>
  )
}

function InventoryItemsCatalog() {
  const { user, loading: authLoading } = useAuthContext()
  const searchParams = useSearchParams()
  const initialStockStatus = searchParams.get("stockStatus")
  const initialActive = searchParams.get("active")
  const linkedInventoryItemId = searchParams.get("inventoryItemId")
  const operationalContext = resolveInventoryOperationalContext(user, searchParams.get("context"))

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [stockStatus, setStockStatus] = useState<InventoryStockStatusFilter>(
    isStockStatusFilter(initialStockStatus) ? initialStockStatus : "all",
  )
  const [active, setActive] = useState<InventoryActiveFilter>(
    isActiveFilter(initialActive) ? initialActive : "true",
  )
  const [domain, setDomain] = useState<InventoryDomain | "all">("all")
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([])
  const [data, setData] = useState<InventoryItemsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(linkedInventoryItemId)
  const [createOpen, setCreateOpen] = useState(false)
  const [roomUsageOpen, setRoomUsageOpen] = useState(false)
  const [movementTarget, setMovementTarget] = useState<MovementTarget | null>(null)

  const canManage = hasManagementPermission(user, MANAGER_PERMISSIONS.INVENTORY_MANAGE)
  const canReceive = hasManagementPermission(user, MANAGER_PERMISSIONS.INVENTORY_RECEIVE)
  const canWaste = hasManagementPermission(user, MANAGER_PERMISSIONS.INVENTORY_WASTE)
  const canAdjust = hasManagementPermission(user, MANAGER_PERMISSIONS.INVENTORY_ADJUST)
  const availableContexts = useMemo(() => getInventoryOperationalContexts(user), [user])
  const domainOptions = useMemo(
    () => getInventoryDomainsForBusiness(user, operationalContext),
    [operationalContext, user],
  )
  const hasLodging = operationalContext === "hotelOperations" && availableContexts.includes("hotelOperations")
  const hasFoodService = operationalContext === "foodService" && availableContexts.includes("foodService")
  const canViewRecipes = hasFoodService && hasManagementPermission(user, MANAGER_PERMISSIONS.MENU_VIEW)

  const resetPagination = useCallback(() => {
    setCursor(null)
    setCursorHistory([])
  }, [])

  useEffect(() => {
    if (linkedInventoryItemId) setSelectedItemId(linkedInventoryItemId)
  }, [linkedInventoryItemId])

  useEffect(() => {
    setDomain("all")
    setData(null)
    setSelectedItemId(linkedInventoryItemId)
    resetPagination()
  }, [linkedInventoryItemId, operationalContext, resetPagination])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      resetPagination()
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [resetPagination, search])

  const loadItems = useCallback(async (signal?: AbortSignal) => {
    if (!user?.businessId || domainOptions.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<InventoryItemsResponse>("/owner/inventory/items", {
        params: {
          active,
          domain: domain === "all"
            ? domainOptions.map((option) => option.value).join(",")
            : domain,
          stockStatus,
          search: debouncedSearch || undefined,
          cursor: cursor || undefined,
          limit: PAGE_SIZE,
        },
        signal,
      })
      setData(response.data)
    } catch (requestError) {
      if (signal?.aborted) return
      setError(requestError instanceof Error ? requestError.message : "Unable to load inventory items")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [active, cursor, debouncedSearch, domain, domainOptions, stockStatus, user?.businessId])

  useEffect(() => {
    const controller = new AbortController()
    void loadItems(controller.signal)
    return () => controller.abort()
  }, [loadItems])

  const filtersAreDefault = search.length === 0 && stockStatus === "all" && active === "true" && domain === "all"
  const pageNumber = cursorHistory.length + 1
  const items = data?.items ?? []
  const resultSummary = useMemo(() => {
    if (loading) return "Loading inventory items"
    if (error) return "Inventory items could not be loaded"
    if (items.length === 0) return "No inventory items found"
    return `${items.length} ${items.length === 1 ? "item" : "items"} shown on page ${pageNumber}`
  }, [error, items.length, loading, pageNumber])

  const clearFilters = () => {
    setSearch("")
    setDebouncedSearch("")
    setStockStatus("all")
    setActive("true")
    setDomain("all")
    resetPagination()
  }

  const handleNextPage = () => {
    if (!data?.pagination.nextCursor) return
    setCursorHistory((history) => [...history, cursor])
    setCursor(data.pagination.nextCursor)
  }

  const handlePreviousPage = () => {
    if (cursorHistory.length === 0) return
    setCursor(cursorHistory.at(-1) ?? null)
    setCursorHistory((history) => history.slice(0, -1))
  }

  const handleItemChanged = (updatedItem: InventoryItem) => {
    setData((current) => current ? {
      ...current,
      items: current.items.map((item) => (
        item.inventoryItemId === updatedItem.inventoryItemId ? updatedItem : item
      )),
    } : current)
    void loadItems()
  }

  const handleItemCreated = () => {
    void loadItems()
  }

  const handleQuickMovementCompleted = (result: InventoryMovementResponse) => {
    setMovementTarget(null)
    handleItemChanged(result.item)
  }

  if (authLoading && !data) {
    return <Card><ItemsLoadingState /></Card>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-semibold">{hasLodging ? "Hotel Operations stock items" : "Stock items"}</h2>
          <p className="text-sm text-muted-foreground">
            Search items, review availability, and record stock changes with confidence.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">{resultSummary}</p>
          {hasLodging && canManage ? (
            <Button variant="outline" onClick={() => setRoomUsageOpen(true)}>
              <BedDouble className="size-4" aria-hidden="true" />
              Record Room Usage
            </Button>
          ) : null}
          {canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Create item
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="gap-0 py-0">
        <div className="grid gap-3 border-b p-4 lg:grid-cols-[minmax(240px,1fr)_180px_180px_160px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item or category"
              aria-label="Search inventory items"
              className="pl-9"
            />
          </div>

          {domainOptions.length > 1 ? (
            <Select
              value={domain}
              onValueChange={(value: InventoryDomain | "all") => {
                setDomain(value)
                resetPagination()
              }}
            >
              <SelectTrigger aria-label="Filter by inventory domain">
                <SelectValue placeholder="Domain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All domains</SelectItem>
                {domainOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : <div className="hidden lg:block" />}

          <Select
            value={stockStatus}
            onValueChange={(value: InventoryStockStatusFilter) => {
              setStockStatus(value)
              resetPagination()
            }}
          >
            <SelectTrigger aria-label="Filter by stock status">
              <SelectValue placeholder="Stock status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock states</SelectItem>
              <SelectItem value="low_stock">Low stock</SelectItem>
              <SelectItem value="out_of_stock">Out of stock</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={active}
            onValueChange={(value: InventoryActiveFilter) => {
              setActive(value)
              resetPagination()
            }}
          >
            <SelectTrigger aria-label="Filter by item activity">
              <SelectValue placeholder="Item activity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All items</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            onClick={clearFilters}
            disabled={filtersAreDefault}
            className="justify-self-start lg:justify-self-end"
          >
            <X className="size-4" aria-hidden="true" />
            Clear
          </Button>
        </div>

        <div className="grid gap-3 border-b bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:grid-cols-3">
          <p><span className="font-semibold text-foreground">On hand:</span> Physical stock currently recorded.</p>
          <p><span className="font-semibold text-foreground">Reserved:</span> Committed to orders, not yet consumed.</p>
          <p><span className="font-semibold text-foreground">Available:</span> On hand minus reserved.</p>
        </div>

        {loading ? (
          <ItemsLoadingState />
        ) : error ? (
          <CardContent className="flex min-h-72 flex-col items-center justify-center py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <RefreshCw className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-semibold">Items could not be loaded</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Check your connection and try again. No inventory data was changed.
            </p>
            <Button className="mt-5" onClick={() => void loadItems()}>
              Try again
            </Button>
          </CardContent>
        ) : items.length === 0 ? (
          <CardContent className="flex min-h-72 flex-col items-center justify-center py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <PackageSearch className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-semibold">
              {filtersAreDefault ? "No inventory items yet" : "No items match these filters"}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {filtersAreDefault
                ? "Create an item, then record its first delivery to add physical stock."
                : "Try changing the search or stock filters to see more items."}
            </p>
            {!filtersAreDefault ? (
              <Button variant="outline" className="mt-5" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : canManage ? (
              <Button className="mt-5" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" aria-hidden="true" />
                Add inventory item
              </Button>
            ) : null}
          </CardContent>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-11 pl-6">Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Low stock alert</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.inventoryItemId}>
                      <TableCell className="py-4 pl-6">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          {!item.isActive ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Inactive</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.category || "Uncategorised"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInventoryQuantity(item.onHandQuantity, item.trackingUnit)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatInventoryQuantity(item.reservedQuantity, item.trackingUnit)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatInventoryQuantity(item.availableQuantity, item.trackingUnit)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatInventoryQuantity(item.lowStockThreshold, item.trackingUnit)}</TableCell>
                      <TableCell>
                        {item.isActive ? (
                          <InventoryStockBadge item={item} />
                        ) : (
                          <span className="inline-flex rounded-full border border-muted bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-1">
                          {canReceive && item.isActive ? (
                            <Button variant="ghost" size="sm" onClick={() => setMovementTarget({ item, action: "receive" })}>
                              <PackagePlus className="size-4" aria-hidden="true" />
                              Receive
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="sm" onClick={() => setSelectedItemId(item.inventoryItemId)}>
                            <Eye className="size-4" aria-hidden="true" />
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y md:hidden">
              {items.map((item) => (
                <article key={item.inventoryItemId} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{item.name}</h3>
                        {!item.isActive ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Inactive</span>
                        ) : null}
                      </div>
                    </div>
                    {item.isActive ? (
                      <InventoryStockBadge item={item} />
                    ) : (
                      <span className="inline-flex rounded-full border border-muted bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </div>
                  <dl className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">On hand</dt>
                      <dd className="mt-1 font-medium tabular-nums">{formatInventoryQuantity(item.onHandQuantity, item.trackingUnit)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Reserved</dt>
                      <dd className="mt-1 font-medium tabular-nums">{formatInventoryQuantity(item.reservedQuantity, item.trackingUnit)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Available</dt>
                      <dd className="mt-1 font-medium tabular-nums">{formatInventoryQuantity(item.availableQuantity, item.trackingUnit)}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    Low-stock threshold: {formatInventoryQuantity(item.lowStockThreshold, item.trackingUnit)}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {canReceive && item.isActive ? (
                      <Button variant="outline" onClick={() => setMovementTarget({ item, action: "receive" })}>
                        <PackagePlus className="size-4" aria-hidden="true" />
                        Receive stock
                      </Button>
                    ) : null}
                    <Button variant="outline" className="w-full" onClick={() => setSelectedItemId(item.inventoryItemId)}>
                      View item
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {!loading && !error && items.length > 0 ? (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">Page {pageNumber}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={cursorHistory.length === 0}>
                <ChevronLeft className="size-4" aria-hidden="true" />
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!data?.pagination.hasNextPage}>
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <InventoryItemDrawer
        key={selectedItemId || "closed-inventory-drawer"}
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
          void loadItems()
        }}
        onViewItem={setSelectedItemId}
      />

      <InventoryItemFormDialog
        open={createOpen}
        mode="create"
        defaultCurrency={user?.currency || "EUR"}
        domainOptions={domainOptions}
        onOpenChange={setCreateOpen}
        onSaved={handleItemCreated}
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
          onCompleted={handleQuickMovementCompleted}
        />
      ) : null}

      {hasLodging ? (
        <RoomUsageDialog
          open={roomUsageOpen}
          onOpenChange={setRoomUsageOpen}
          onCompleted={() => void loadItems()}
        />
      ) : null}
    </div>
  )
}

export default function InventoryItemsPage() {
  return (
    <Suspense fallback={<ItemsLoadingState />}>
      <InventoryItemsCatalog />
    </Suspense>
  )
}
