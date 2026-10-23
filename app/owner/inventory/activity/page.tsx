"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CalendarRange, ChevronLeft, ChevronRight, History, RefreshCw, Search, X } from "lucide-react"
import apiClient from "@/lib/axios-config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthContext } from "@/contexts/AuthContext"
import { InventoryActivityList } from "@/components/owner/inventory/InventoryOverviewPanels"
import {
  buildInventoryHref,
  getInventoryDomainsForBusiness,
  getInventoryOperationalContexts,
  resolveInventoryOperationalContext,
} from "@/lib/inventory"
import type { InventoryItem, InventoryItemsResponse, InventoryMovementsResponse } from "@/types/inventory"

const PAGE_SIZE = 20

const MOVEMENT_TYPES = [
  { value: "all", label: "All activity" },
  { value: "RECEIVE", label: "Received stock" },
  { value: "RESERVE", label: "Stock reserved" },
  { value: "RELEASE", label: "Reservation released" },
  { value: "CONSUME", label: "Stock consumed" },
  { value: "WASTE", label: "Waste recorded" },
  { value: "ADJUSTMENT_INCREASE", label: "Stock corrected up" },
  { value: "ADJUSTMENT_DECREASE", label: "Stock corrected down" },
  { value: "COUNT_RECONCILIATION_INCREASE", label: "Count corrected up" },
  { value: "COUNT_RECONCILIATION_DECREASE", label: "Count corrected down" },
] as const

type ItemFilter = Pick<InventoryItem, "inventoryItemId" | "name" | "trackingUnit">

export default function InventoryActivityPage() {
  const { user, loading: authLoading } = useAuthContext()
  const searchParams = useSearchParams()
  const availableContexts = useMemo(() => getInventoryOperationalContexts(user), [user])
  const operationalContext = resolveInventoryOperationalContext(user, searchParams.get("context"))
  const domainOptions = useMemo(
    () => getInventoryDomainsForBusiness(user, operationalContext),
    [operationalContext, user],
  )
  const includeContext = availableContexts.length > 1
  const [data, setData] = useState<InventoryMovementsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([])
  const [movementType, setMovementType] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [itemSearch, setItemSearch] = useState("")
  const [selectedItem, setSelectedItem] = useState<ItemFilter | null>(null)
  const [itemOptions, setItemOptions] = useState<ItemFilter[]>([])
  const [itemOptionsLoading, setItemOptionsLoading] = useState(false)
  const [itemOptionsError, setItemOptionsError] = useState<string | null>(null)
  const [itemMenuOpen, setItemMenuOpen] = useState(false)

  const domain = useMemo(
    () => domainOptions.map((option) => option.value).join(","),
    [domainOptions],
  )

  const resetPagination = useCallback(() => {
    setCursor(null)
    setCursorHistory([])
  }, [])

  useEffect(() => {
    resetPagination()
    setSelectedItem(null)
    setItemSearch("")
    setItemOptions([])
    setItemMenuOpen(false)
  }, [operationalContext, resetPagination])

  useEffect(() => {
    const query = itemSearch.trim()
    if (query.length < 2 || selectedItem?.name === query || domainOptions.length === 0) {
      setItemOptions([])
      setItemOptionsError(null)
      setItemOptionsLoading(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setItemOptionsLoading(true)
      setItemOptionsError(null)
      try {
        const response = await apiClient.get<InventoryItemsResponse>("/owner/inventory/items", {
          params: {
            active: "all",
            domain,
            search: query,
            limit: 8,
          },
          signal: controller.signal,
        })
        if (!controller.signal.aborted) {
          setItemOptions(response.data.items.map((item) => ({
            inventoryItemId: item.inventoryItemId,
            name: item.name,
            trackingUnit: item.trackingUnit,
          })))
          setItemMenuOpen(true)
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setItemOptions([])
          setItemOptionsError(requestError instanceof Error ? requestError.message : "Item search is unavailable")
          setItemMenuOpen(true)
        }
      } finally {
        if (!controller.signal.aborted) setItemOptionsLoading(false)
      }
    }, 300)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [domain, domainOptions.length, itemSearch, selectedItem?.name])

  const loadMovements = useCallback(async (signal?: AbortSignal) => {
    if (!user?.businessId || domainOptions.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<InventoryMovementsResponse>("/owner/inventory/movements", {
        params: {
          domain,
          inventoryItemId: selectedItem?.inventoryItemId || undefined,
          type: movementType === "all" ? undefined : movementType,
          from: fromDate || undefined,
          to: toDate || undefined,
          cursor: cursor || undefined,
          limit: PAGE_SIZE,
        },
        signal,
      })
      if (!signal?.aborted) setData(response.data)
    } catch (requestError) {
      if (!signal?.aborted) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load stock activity")
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [cursor, domain, domainOptions.length, fromDate, movementType, selectedItem?.inventoryItemId, toDate, user?.businessId])

  useEffect(() => {
    const controller = new AbortController()
    void loadMovements(controller.signal)
    return () => controller.abort()
  }, [loadMovements])

  const selectItem = (item: ItemFilter) => {
    setSelectedItem(item)
    setItemSearch(item.name)
    setItemOptions([])
    setItemOptionsError(null)
    setItemMenuOpen(false)
    resetPagination()
  }

  const clearItem = () => {
    setSelectedItem(null)
    setItemSearch("")
    setItemOptions([])
    setItemMenuOpen(false)
    resetPagination()
  }

  const clearFilters = () => {
    setMovementType("all")
    setFromDate("")
    setToDate("")
    clearItem()
  }

  const currentPage = cursorHistory.length + 1
  const movements = data?.movements || []
  const hasFilters = Boolean(selectedItem || fromDate || toDate || movementType !== "all")
  const itemHref = (inventoryItemId: string) => buildInventoryHref(
    "/owner/inventory/items",
    operationalContext,
    includeContext,
    { inventoryItemId },
  )

  if (authLoading && !data) {
    return (
      <div className="space-y-5" aria-label="Loading stock activity">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-semibold">Stock activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">See what changed, when it changed, and who recorded it.</p>
        </div>
        <Button asChild variant="outline">
          <Link href={buildInventoryHref("/owner/inventory", operationalContext, includeContext)}>Back to overview</Link>
        </Button>
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-5 py-4">
          <CardTitle className="text-base">Activity filters</CardTitle>
          <CardDescription>Search for an item, then use the filters only when you need them.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={itemSearch}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setItemSearch(nextValue)
                  if (selectedItem && nextValue !== selectedItem.name) setSelectedItem(null)
                  setItemMenuOpen(true)
                  resetPagination()
                }}
                onFocus={() => itemOptions.length > 0 && setItemMenuOpen(true)}
                placeholder="Search by inventory item"
                aria-label="Search activity by inventory item"
                aria-autocomplete="list"
                aria-expanded={itemMenuOpen}
                aria-controls="inventory-activity-item-options"
                className="pl-9 pr-10"
              />
              {selectedItem ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={clearItem}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  aria-label="Clear inventory item filter"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
              {itemMenuOpen && itemSearch.trim().length >= 2 ? (
                <div id="inventory-activity-item-options" role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
                  {itemOptionsLoading ? <p className="px-3 py-2 text-sm text-muted-foreground">Searching items…</p> : null}
                  {!itemOptionsLoading && itemOptions.map((item) => (
                    <button
                      key={item.inventoryItemId}
                      type="button"
                      role="option"
                      aria-selected={item.inventoryItemId === selectedItem?.inventoryItemId}
                      onClick={() => selectItem(item)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                      <span className="block font-medium">{item.name}</span>
                      <span className="block text-xs text-muted-foreground">Tracking in {item.trackingUnit}</span>
                    </button>
                  ))}
                  {!itemOptionsLoading && !itemOptions.length && !itemOptionsError ? <p className="px-3 py-2 text-sm text-muted-foreground">No matching inventory items.</p> : null}
                  {itemOptionsError ? <p className="px-3 py-2 text-sm text-destructive" role="alert">Item search could not be completed.</p> : null}
                </div>
              ) : null}
            </div>

            <Select
              value={movementType}
              onValueChange={(value) => {
                setMovementType(value)
                resetPagination()
              }}
            >
              <SelectTrigger aria-label="Filter by movement type"><SelectValue placeholder="Movement type" /></SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>

            {hasFilters ? (
              <Button type="button" variant="ghost" onClick={clearFilters}>
                <X className="size-4" aria-hidden="true" /> Clear filters
              </Button>
            ) : <div className="hidden lg:block" />}
          </div>

          <details className="rounded-xl border bg-muted/20">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <CalendarRange className="size-4 text-muted-foreground" aria-hidden="true" /> Date range
            </summary>
            <div className="grid gap-3 border-t p-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">
                <span>From</span>
                <Input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => {
                    setFromDate(event.target.value)
                    resetPagination()
                  }}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                <span>To</span>
                <Input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => {
                    setToDate(event.target.value)
                    resetPagination()
                  }}
                />
              </label>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="flex-row items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <CardTitle className="text-base">Activity history</CardTitle>
            <CardDescription aria-live="polite">
              {loading ? "Loading stock activity" : movements.length ? `${movements.length} movements shown on page ${currentPage}` : "No activity matches these filters"}
            </CardDescription>
          </div>
          {loading ? <RefreshCw className="size-4 animate-spin text-muted-foreground" aria-label="Loading stock activity" /> : <History className="size-4 text-muted-foreground" aria-hidden="true" />}
        </CardHeader>
        <CardContent className="p-5">
          {error && !data ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center" role="alert">
              <p className="font-semibold">Stock activity could not be loaded</p>
              <p className="mt-1 text-sm text-muted-foreground">No inventory data was changed. Check your connection and try again.</p>
              <Button className="mt-4" onClick={() => void loadMovements()}>Try again</Button>
            </div>
          ) : loading && !data ? <Skeleton className="h-72 rounded-xl" /> : (
            <InventoryActivityList movements={movements} timezone={user?.timezone || "UTC"} itemHref={itemHref} />
          )}
          {error && data ? <p className="mt-3 text-sm text-destructive" role="alert">The latest activity could not be refreshed. Showing the last loaded page.</p> : null}
          {data && (cursorHistory.length > 0 || data.pagination.hasNextPage) ? (
            <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">Page {currentPage}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || cursorHistory.length === 0}
                  onClick={() => {
                    setCursor(cursorHistory.at(-1) ?? null)
                    setCursorHistory((history) => history.slice(0, -1))
                  }}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" /> Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || !data.pagination.hasNextPage || !data.pagination.nextCursor}
                  onClick={() => {
                    if (!data.pagination.nextCursor) return
                    setCursorHistory((history) => [...history, cursor])
                    setCursor(data.pagination.nextCursor)
                  }}
                >
                  Next <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}