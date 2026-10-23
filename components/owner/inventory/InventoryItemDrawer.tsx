"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Archive,
  Boxes,
  ClipboardList,
  PackageMinus,
  PackagePlus,
  Pencil,
  RefreshCw,
  RotateCcw,
  Scale,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import apiClient from "@/lib/axios-config"
import { formatInventoryQuantity, getInventoryApiError, getInventoryDomainLabel } from "@/lib/inventory"
import { formatMinorCurrency } from "@/lib/localization"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  InventoryDomain,
  InventoryItem,
  InventoryMovement,
  InventoryMovementResponse,
  InventoryMovementsResponse,
  InventoryRecipesResponse,
  LinkedInventoryRecipe,
} from "@/types/inventory"
import { InventoryItemFormDialog } from "./InventoryItemFormDialog"
import { InventoryMovementDialog, type InventoryMovementAction } from "./InventoryMovementDialog"
import { InventoryStockBadge } from "./InventoryStockBadge"
import { InventoryQuantitySummary } from "./InventoryQuantitySummary"

type InventoryItemDrawerProps = {
  open: boolean
  itemId: string | null
  defaultCurrency: string
  canManage: boolean
  canReceive: boolean
  canWaste: boolean
  canAdjust: boolean
  canViewRecipes: boolean
  domainOptions?: Array<{ value: InventoryDomain; label: string }>
  onOpenChange: (open: boolean) => void
  onItemChanged: (item: InventoryItem) => void
  onItemDeleted: (inventoryItemId: string) => void
  onViewItem: (inventoryItemId: string) => void
}

const movementLabels: Record<string, string> = {
  RECEIVE: "Received",
  RESERVE: "Reserved",
  RELEASE: "Released",
  CONSUME: "Consumed",
  WASTE: "Waste recorded",
  ADJUSTMENT_INCREASE: "Adjusted up",
  ADJUSTMENT_DECREASE: "Adjusted down",
  COUNT_RECONCILIATION_INCREASE: "Count adjusted up",
  COUNT_RECONCILIATION_DECREASE: "Count adjusted down",
  LEGACY_ORDER_DEDUCTION: "Legacy stock deduction",
  LEGACY_ORDER_RESTORE: "Legacy stock restore",
}

function formatMovementTime(value: string | null) {
  if (!value) return "Time unavailable"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Time unavailable"
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function movementQuantity(movement: InventoryMovement, item: InventoryItem) {
  const sign = movement.quantityDeltaOnHand > 0 || movement.quantityDeltaReserved > 0 ? "+" : "âˆ’"
  return `${sign}${formatInventoryQuantity(movement.canonicalQuantity, item.trackingUnit)}`
}

export function InventoryItemDrawer({
  open,
  itemId,
  defaultCurrency,
  canManage,
  canReceive,
  canWaste,
  canAdjust,
  canViewRecipes,
  domainOptions,
  onOpenChange,
  onItemChanged,
  onItemDeleted,
  onViewItem,
}: InventoryItemDrawerProps) {
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [recipes, setRecipes] = useState<LinkedInventoryRecipe[]>([])
  const [hasMoreMovements, setHasMoreMovements] = useState(false)
  const [hasMoreRecipes, setHasMoreRecipes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [movementsError, setMovementsError] = useState<string | null>(null)
  const [recipesError, setRecipesError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [movementAction, setMovementAction] = useState<InventoryMovementAction | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [lifecycleSaving, setLifecycleSaving] = useState(false)
  const [lifecycleError, setLifecycleError] = useState<string | null>(null)

  const loadItem = useCallback(async (signal?: AbortSignal) => {
    if (!itemId) return
    setLoading(true)
    setError(null)
    setMovementsError(null)
    setRecipesError(null)
    try {
      const [itemResult, movementResult] = await Promise.allSettled([
        apiClient.get<InventoryItem>(
          `/owner/inventory/items/${encodeURIComponent(itemId)}`,
          { signal },
        ),
        apiClient.get<InventoryMovementsResponse>("/owner/inventory/movements", {
          params: { inventoryItemId: itemId, limit: 8 },
          signal,
        }),
      ])
      if (itemResult.status === "rejected") throw itemResult.reason
      setItem(itemResult.value.data)
      if (movementResult.status === "fulfilled") {
        setMovements(movementResult.value.data.movements)
        setHasMoreMovements(movementResult.value.data.pagination.hasNextPage)
      } else if (!signal?.aborted) {
        setMovements([])
        setHasMoreMovements(false)
        setMovementsError(getInventoryApiError(
          movementResult.reason,
          "Recent movements could not be loaded",
        ))
      }

      if (canViewRecipes) {
        try {
          const recipeResponse = await apiClient.get<InventoryRecipesResponse>("/owner/inventory/recipes", {
            params: { inventoryItemId: itemId, limit: 6 },
            signal,
          })
          setRecipes(recipeResponse.data.recipes)
          setHasMoreRecipes(recipeResponse.data.pagination.hasNextPage)
        } catch (recipeError) {
          if (!signal?.aborted) {
            setRecipes([])
            setRecipesError(getInventoryApiError(recipeError, "Linked recipes could not be loaded"))
          }
        }
      } else {
        setRecipes([])
        setHasMoreRecipes(false)
      }
    } catch (requestError) {
      if (!signal?.aborted) {
        setError(getInventoryApiError(requestError, "Inventory item details could not be loaded"))
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [canViewRecipes, itemId])

  useEffect(() => {
    if (!open || !itemId) return
    const controller = new AbortController()
    void loadItem(controller.signal)
    return () => controller.abort()
  }, [itemId, loadItem, open])

  const handleItemSaved = (savedItem: InventoryItem) => {
    setItem(savedItem)
    onItemChanged(savedItem)
  }

  const handleMovementCompleted = (result: InventoryMovementResponse) => {
    setItem(result.item)
    setMovements((current) => [result.movement, ...current.filter(
      (movement) => movement.movementId !== result.movement.movementId,
    )].slice(0, 8))
    onItemChanged(result.item)
  }

  const setItemActive = async (isActive: boolean) => {
    if (!item) return
    setLifecycleSaving(true)
    setLifecycleError(null)
    try {
      const response = await apiClient.patch<{ item: InventoryItem }>(
        `/owner/inventory/items/${encodeURIComponent(item.inventoryItemId)}`,
        { isActive },
      )
      setItem(response.data.item)
      onItemChanged(response.data.item)
      toast.success(isActive ? "Inventory item reactivated" : "Inventory item archived")
    } catch (requestError) {
      setLifecycleError(getInventoryApiError(
        requestError,
        isActive ? "Inventory item could not be reactivated" : "Inventory item could not be archived",
      ))
    } finally {
      setLifecycleSaving(false)
    }
  }

  const removeItem = async () => {
    if (!item) return
    setLifecycleSaving(true)
    setLifecycleError(null)
    try {
      await apiClient.delete(`/owner/inventory/items/${encodeURIComponent(item.inventoryItemId)}`)
      setDeleteOpen(false)
      toast.success("Inventory item removed")
      onItemDeleted(item.inventoryItemId)
    } catch (requestError) {
      setLifecycleError(getInventoryApiError(requestError, "Inventory item could not be removed"))
      setDeleteOpen(false)
    } finally {
      setLifecycleSaving(false)
    }
  }

  const trackingUnitLocked = Boolean(
    item && (item.onHandQuantity !== 0 || item.reservedQuantity !== 0 || movements.length > 0),
  )
  const hasOperations = canReceive || canWaste || canAdjust

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          <SheetHeader className="sticky top-0 z-10 border-b bg-background px-5 py-4 pr-12">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate">{item?.name || "Inventory item"}</SheetTitle>
                <SheetDescription>{item ? item.category || "Uncategorised" : "Stock details and recent activity"}</SheetDescription>
              </div>
              {canManage && item && !item.isDeleted ? (
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit item
                </Button>
              ) : null}
            </div>
            {item ? (
              <div className="mt-3 flex flex-wrap gap-4">
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Item state</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.isActive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    {item.isDeleted ? "Removed" : item.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Stock state</p>
                  <InventoryStockBadge item={item} />
                </div>
              </div>
            ) : null}
          </SheetHeader>

          {loading && !item ? (
            <div className="space-y-4 p-5">
              <Skeleton className="h-28" />
              <Skeleton className="h-44" />
              <Skeleton className="h-52" />
            </div>
          ) : error || !item ? (
            <div className="flex min-h-96 flex-col items-center justify-center px-6 text-center">
              <RefreshCw className="size-8 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-4 font-semibold">Item details unavailable</h3>
              <p className="mt-1 text-sm text-muted-foreground">{error || "This inventory item could not be found."}</p>
              <Button className="mt-5" onClick={() => void loadItem()}>Try again</Button>
            </div>
          ) : (
            <div className="space-y-5 p-5">
              <section aria-labelledby="inventory-stock-summary-heading" className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 id="inventory-stock-summary-heading" className="font-semibold">Current stock</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Your current recorded quantities for this item.</p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">Alert: {formatInventoryQuantity(item.lowStockThreshold, item.trackingUnit)}</p>
                </div>
                <InventoryQuantitySummary
                  onHandQuantity={item.onHandQuantity}
                  reservedQuantity={item.reservedQuantity}
                  availableQuantity={item.availableQuantity}
                  trackingUnit={item.trackingUnit}
                  showFormula
                />
              </section>

              {hasOperations ? (
                <section aria-labelledby="inventory-actions-heading" className="rounded-xl border bg-muted/20 p-4">
                  <div className="mb-3">
                    <h3 id="inventory-actions-heading" className="font-semibold">Stock operations</h3>
                    {!item.isActive ? <p className="mt-1 text-xs text-muted-foreground">Reactivate this item before recording stock movements.</p> : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {canReceive ? <Button onClick={() => setMovementAction("receive")} disabled={!item.isActive}><PackagePlus className="size-4" aria-hidden="true" />Receive stock</Button> : null}
                    {canWaste ? <Button variant="outline" onClick={() => setMovementAction("waste")} disabled={!item.isActive}><PackageMinus className="size-4" aria-hidden="true" />Record waste</Button> : null}
                    {canAdjust ? <Button variant="outline" onClick={() => setMovementAction("adjust")} disabled={!item.isActive}><Scale className="size-4" aria-hidden="true" />Correct stock count</Button> : null}
                  </div>
                </section>
              ) : null}

              <Card className="gap-4 py-5 shadow-none">
                <CardHeader className="px-5">
                  <CardTitle className="text-base">Item configuration</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 px-5 text-sm sm:grid-cols-2">
                  {domainOptions && domainOptions.length > 1 ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Domain</p>
                      <p className="mt-1 font-medium">{getInventoryDomainLabel(item.domain)}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs text-muted-foreground">Tracking unit</p>
                    <p className="mt-1 font-medium">{item.trackingUnit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Low-stock threshold</p>
                    <p className="mt-1 font-medium">{formatInventoryQuantity(item.lowStockThreshold, item.trackingUnit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Unit cost</p>
                    <p className="mt-1 font-medium">
                      {item.unitCostMinor !== null && item.costCurrency
                        ? `${formatMinorCurrency(item.unitCostMinor, item.costCurrency)} per ${item.trackingUnit}`
                        : "Not set"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {canManage && !item.isDeleted ? (
                <section aria-labelledby="inventory-lifecycle-heading" className="rounded-lg border p-4">
                  <h3 id="inventory-lifecycle-heading" className="font-semibold">Item lifecycle</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Archive items you may use again. Remove items you no longer want in the Inventory workspace; historical records remain intact when needed.
                  </p>
                  {lifecycleError ? (
                    <p className="mt-3 text-sm text-destructive" role="alert">{lifecycleError}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.isActive ? (
                      <Button type="button" variant="outline" onClick={() => void setItemActive(false)} disabled={lifecycleSaving}>
                        <Archive className="size-4" aria-hidden="true" />
                        Archive item
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" onClick={() => void setItemActive(true)} disabled={lifecycleSaving}>
                        <RotateCcw className="size-4" aria-hidden="true" />
                        Reactivate item
                      </Button>
                    )}
                    <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)} disabled={lifecycleSaving}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      Remove item
                    </Button>
                  </div>
                </section>
              ) : null}


              <section aria-labelledby="recent-movements-heading">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h3 id="recent-movements-heading" className="font-semibold">Stock history</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Recorded movements for this item, including the actor and time where available.</p>
                  </div>
                  {hasMoreMovements ? <span className="text-xs text-muted-foreground">Latest 8</span> : null}
                </div>
                {movementsError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    {movementsError}
                  </div>
                ) : movements.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <ClipboardList className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-2 text-sm font-medium">No movements yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Receiving or adjusting stock will create the first record.</p>
                  </div>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {movements.map((movement) => (
                      <div key={movement.movementId} className="flex items-start justify-between gap-4 p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{movementLabels[movement.type] || movement.type}</p>
                          {movement.sourceType === "room_usage" ? (
                            <p className="mt-1 text-xs font-medium text-foreground">
                              {movement.servicePoint?.label || movement.servicePointId || "Room"} Â· Room Usage
                            </p>
                          ) : null}
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {formatMovementTime(movement.createdAt)}
                            {movement.performedBy?.name ? ` Â· Recorded by ${movement.performedBy.name}` : ""}
                          </p>
                          {movement.note ? <p className="mt-1 text-xs text-muted-foreground">{movement.note}</p> : null}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">{movementQuantity(movement, item)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">On hand {formatInventoryQuantity(movement.onHandAfter, item.trackingUnit)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="linked-recipes-heading">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h3 id="linked-recipes-heading" className="font-semibold">Menu usage</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Simple Stock and recipe relationships currently using this item.</p>
                  </div>
                  {hasMoreRecipes ? <span className="text-xs text-muted-foreground">First 6</span> : null}
                </div>
                {!canViewRecipes ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Menu viewing permission is required to see linked recipes.
                  </div>
                ) : recipesError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{recipesError}</div>
                ) : recipes.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <Boxes className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-2 text-sm font-medium">Not used in a recipe</p>
                    <p className="mt-1 text-xs text-muted-foreground">Recipe links will appear here when they are configured.</p>
                  </div>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {recipes.map((recipe) => {
                      const component = recipe.components.find((entry) => entry.inventoryItemId === item.inventoryItemId)
                      return (
                        <div key={recipe.menuInventoryRecipeId} className="flex items-center justify-between gap-4 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{recipe.menuItem?.name || "Unavailable menu item"}</p>
                            <p className="mt-1 text-xs capitalize text-muted-foreground">{recipe.status} recipe</p>
                            {recipe.simpleStock ? (
                              <p className="mt-1 text-xs text-primary">Simple Stock remains the sellable authority</p>
                            ) : null}
                          </div>
                          {component ? (
                            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                              {component.quantity} {component.unit}
                            </span>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {item ? (
        <>
          <InventoryItemFormDialog
            open={editOpen}
            mode="edit"
            item={item}
            defaultCurrency={defaultCurrency}
            trackingUnitLocked={trackingUnitLocked}
            domainOptions={domainOptions}
            onOpenChange={setEditOpen}
            onSaved={handleItemSaved}
            onViewExisting={onViewItem}
          />
          {movementAction ? (
            <InventoryMovementDialog
              open
              action={movementAction}
              item={item}
              defaultCurrency={defaultCurrency}
              onOpenChange={(nextOpen) => {
                if (!nextOpen) setMovementAction(null)
              }}
              onCompleted={handleMovementCompleted}
            />
          ) : null}
        </>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={(nextOpen) => !lifecycleSaving && setDeleteOpen(nextOpen)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {item?.name || "this inventory item"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This item will disappear from the operational Inventory workspace. Chillow will preserve its stock and order history internally whenever that history is still needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={lifecycleSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void removeItem()
              }}
              disabled={lifecycleSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
