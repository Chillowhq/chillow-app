"use client"

import { useEffect, useMemo, useState } from "react"
import { CircleDollarSign, Loader2, Plus, Search, Trash2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import apiClient from "@/lib/axios-config"
import {
  formatInventoryMoneyMinor,
  getCompatibleInventoryUnits,
  getInventoryApiError,
  getInventoryUnitLabel,
  inventoryQuantityToCanonical,
} from "@/lib/inventory"
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type {
  InventoryItem,
  InventoryItemsResponse,
  InventoryRecipe,
  InventoryRecipeMenuCandidate,
  InventoryRecipeResponse,
  InventoryUnit,
} from "@/types/inventory"

const INVENTORY_PAGE_SIZE = 100
const MAX_RECIPE_COMPONENTS = 100

type DraftComponent = {
  inventoryItemId: string
  quantity: string
  unit: InventoryUnit
}

type RecipeBuilderDialogProps = {
  open: boolean
  recipe: InventoryRecipe | null
  businessId: string
  onOpenChange: (open: boolean) => void
  onSaved: (recipe: InventoryRecipe) => void
  onRemoved: (menuItemId: string) => void
}

function menuItemId(item: InventoryRecipeMenuCandidate) {
  return item._id || item.id || ""
}

async function loadAllInventoryItems() {
  const items: InventoryItem[] = []
  let cursor: string | undefined

  do {
    const response = await apiClient.get<InventoryItemsResponse>("/owner/inventory/items", {
      params: {
        active: "all",
        domain: "food_service",
        stockStatus: "all",
        cursor,
        limit: INVENTORY_PAGE_SIZE,
      },
    })
    items.push(...response.data.items)
    cursor = response.data.pagination.nextCursor || undefined
  } while (cursor)

  return items.sort((left, right) => left.name.localeCompare(right.name))
}

export function RecipeBuilderDialog({
  open,
  recipe,
  businessId,
  onOpenChange,
  onSaved,
  onRemoved,
}: RecipeBuilderDialogProps) {
  const [menuItems, setMenuItems] = useState<InventoryRecipeMenuCandidate[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("")
  const [components, setComponents] = useState<DraftComponent[]>([])
  const [enabled, setEnabled] = useState(true)
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)
  const [ingredientPickerOpen, setIngredientPickerOpen] = useState(false)
  const [ingredientSearch, setIngredientSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const loadBuilder = async () => {
      setLoading(true)
      setError(null)
      setReplaceConfirmed(false)
      setIngredientSearch("")
      try {
        const [menuResponse, itemResults, recipeResponse] = await Promise.all([
          apiClient.get<InventoryRecipeMenuCandidate[]>("/menu-items", {
            params: { businessId },
          }),
          loadAllInventoryItems(),
          recipe
            ? apiClient.get<InventoryRecipeResponse>(
                `/owner/inventory/recipes/${encodeURIComponent(recipe.menuItemId)}`,
              )
            : Promise.resolve(null),
        ])
        if (cancelled) return

        const currentRecipe = recipeResponse?.data.recipe || null
        setMenuItems(menuResponse.data)
        setInventoryItems(itemResults)
        setSelectedMenuItemId(currentRecipe?.menuItemId || "")
        setEnabled(currentRecipe ? currentRecipe.status === "active" : true)
        setComponents(currentRecipe?.components.map((component) => ({
          inventoryItemId: component.inventoryItemId,
          quantity: String(component.quantity),
          unit: component.unit,
        })) || [])
      } catch (requestError) {
        if (!cancelled) {
          setError(getInventoryApiError(requestError, "Recipe details could not be loaded"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadBuilder()
    return () => {
      cancelled = true
    }
  }, [businessId, open, recipe])

  const inventoryById = useMemo(
    () => new Map(inventoryItems.map((item) => [item.inventoryItemId, item])),
    [inventoryItems],
  )
  const selectedMenuItem = menuItems.find((item) => menuItemId(item) === selectedMenuItemId) || null
  const isAddingToSimpleStock = selectedMenuItem?.inventory?.mode === "simple" ||
    Boolean(recipe?.simpleStock)
  const isReplacingLegacyStock = !recipe && (
    selectedMenuItem?.inventory?.trackingState === "legacy" ||
    selectedMenuItem?.trackStock === true && !selectedMenuItem?.inventory?.mode
  )
  const replacementRequired = isReplacingLegacyStock

  const availableMenuItems = useMemo(() => menuItems
    .filter((item) => recipe || (
      item.inventory?.mode !== "recipe" && !item.inventory?.ingredientTracking?.configured
    ))
    .sort((left, right) => left.name.localeCompare(right.name)), [menuItems, recipe])

  const selectedIngredientIds = useMemo(
    () => new Set(components.map((component) => component.inventoryItemId)),
    [components],
  )
  const ingredientMatches = useMemo(() => {
    const query = ingredientSearch.trim().toLowerCase()
    return inventoryItems.filter((item) => (
      item.isActive &&
      !selectedIngredientIds.has(item.inventoryItemId) &&
      (!query || item.name.toLowerCase().includes(query) || item.category?.toLowerCase().includes(query))
    )).slice(0, 50)
  }, [ingredientSearch, inventoryItems, selectedIngredientIds])

  const costProjection = useMemo(() => {
    const lines = components.map((component) => {
      const item = inventoryById.get(component.inventoryItemId)
      if (!item) return { component, item: null, error: "Inventory item is unavailable", costMinor: null }
      try {
        const canonicalQuantity = inventoryQuantityToCanonical(
          component.quantity,
          component.unit,
          item.trackingUnit,
        )
        const rawCost = item.unitCostMinor === null
          ? null
          : canonicalQuantity * item.unitCostMinor
        if (rawCost !== null && !Number.isSafeInteger(rawCost)) {
          return { component, item, error: "Estimated cost is too large", costMinor: null }
        }
        return {
          component,
          item,
          canonicalQuantity,
          error: null,
          costMinor: rawCost,
        }
      } catch (quantityError) {
        return {
          component,
          item,
          error: quantityError instanceof Error ? quantityError.message : "Invalid quantity",
          costMinor: null,
        }
      }
    })
    const missingCostItems = lines
      .filter((line) => line.item && (line.item.unitCostMinor === null || !line.item.costCurrency))
      .map((line) => line.item as InventoryItem)
    const currencies = [...new Set(lines
      .map((line) => line.item?.costCurrency)
      .filter((currency): currency is string => Boolean(currency)))]
    const knownCostMinor = currencies.length === 1
      ? lines.reduce((sum, line) => (
          line.item?.costCurrency === currencies[0] ? sum + (line.costMinor || 0) : sum
        ), 0)
      : null
    const hasErrors = lines.some((line) => Boolean(line.error))

    return {
      lines,
      missingCostItems,
      currencies,
      knownCostMinor,
      hasErrors,
      complete: !hasErrors && missingCostItems.length === 0 && currencies.length === 1,
    }
  }, [components, inventoryById])

  const addIngredient = (item: InventoryItem) => {
    setComponents((current) => [...current, {
      inventoryItemId: item.inventoryItemId,
      quantity: "1",
      unit: item.trackingUnit,
    }])
    setIngredientPickerOpen(false)
    setIngredientSearch("")
  }

  const updateComponent = (index: number, update: Partial<DraftComponent>) => {
    setComponents((current) => current.map((component, componentIndex) => (
      componentIndex === index ? { ...component, ...update } : component
    )))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!selectedMenuItemId) {
      setError("Choose a menu item")
      return
    }
    if (components.length === 0) {
      setError("Add at least one ingredient")
      return
    }
    if (costProjection.hasErrors) {
      setError("Correct the ingredient quantities before saving")
      return
    }
    const inactiveIngredient = components.find(
      (component) => inventoryById.get(component.inventoryItemId)?.isActive === false,
    )
    if (enabled && inactiveIngredient) {
      setError("Active recipes cannot use inactive inventory items")
      return
    }
    if (replacementRequired && !replaceConfirmed) {
      setError("Confirm the stock-system replacement before saving")
      return
    }

    setSaving(true)
    try {
      const response = await apiClient.put<InventoryRecipeResponse>(
        `/owner/inventory/recipes/${encodeURIComponent(selectedMenuItemId)}`,
        {
          components: components.map((component) => ({
            inventoryItemId: component.inventoryItemId,
            quantity: component.quantity,
            unit: component.unit,
          })),
          enabled,
          replaceLegacyStock: isReplacingLegacyStock && replaceConfirmed,
        },
      )
      toast.success(recipe ? "Recipe updated" : "Recipe created")
      onSaved(response.data.recipe)
      onOpenChange(false)
    } catch (requestError) {
      setError(getInventoryApiError(requestError, "Recipe could not be saved"))
    } finally {
      setSaving(false)
    }
  }

  const removeIngredientTracking = async () => {
    if (!recipe?.simpleStock) return
    setRemoving(true)
    setError(null)
    try {
      await apiClient.delete(
        `/owner/inventory/recipes/${encodeURIComponent(recipe.menuItemId)}`,
      )
      toast.success("Ingredient Tracking removed. Simple Stock remains active.")
      onRemoved(recipe.menuItemId)
      setRemoveConfirmOpen(false)
      onOpenChange(false)
    } catch (requestError) {
      setError(getInventoryApiError(requestError, "Ingredient Tracking could not be removed"))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && !removing && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-4xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>
              {recipe ? "Edit ingredient recipe" : isAddingToSimpleStock ? "Add Ingredient Tracking" : "Create ingredient recipe"}
            </DialogTitle>
            <DialogDescription>
              Set how much inventory one sale of this menu item uses.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> Loading recipe builder
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_260px]">
                <div className="space-y-2">
                  <Label>Menu item</Label>
                  <Select
                    value={selectedMenuItemId}
                    onValueChange={(value) => {
                      setSelectedMenuItemId(value)
                      setReplaceConfirmed(false)
                    }}
                    disabled={Boolean(recipe) || saving}
                  >
                    <SelectTrigger aria-label="Menu item">
                      <SelectValue placeholder="Choose a menu item" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMenuItems.map((item) => (
                        <SelectItem key={menuItemId(item)} value={menuItemId(item)}>
                          {item.name}{item.category ? ` · ${item.category}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!recipe && availableMenuItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Every current menu item already has an ingredient recipe.</p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <Label htmlFor="recipe-enabled">Recipe active</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Disabled recipes are not used for inventory.</p>
                  </div>
                  <Switch id="recipe-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={saving} />
                </div>
              </div>

              {isAddingToSimpleStock ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-semibold">Simple Stock remains active.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedMenuItem?.name || recipe?.menuItem?.name || "This menu item"} currently has{" "}
                    {recipe?.simpleStock?.availableQuantity ?? selectedMenuItem?.inventory?.availableQuantity ?? selectedMenuItem?.stockQuantity ?? "its current"}{" "}
                    {recipe?.simpleStock?.unit || selectedMenuItem?.inventory?.unit || "portions"} available.
                    Ingredient tracking records what is used during preparation and does not change the sellable portion count.
                  </p>
                </div>
              ) : null}

              {replacementRequired ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  <div className="flex gap-3">
                    <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold">
                        Replace legacy stock tracking
                      </p>
                      <p className="mt-1 text-xs">
                        Saving converts this menu item to an ingredient recipe. Existing order reservations can prevent a safe replacement.
                      </p>
                      <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={replaceConfirmed}
                          onChange={(event) => setReplaceConfirmed(event.target.checked)}
                          className="mt-0.5 size-4 accent-primary"
                        />
                        I understand and want to replace the current stock mapping.
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}

              <section aria-labelledby="recipe-ingredients-heading" className="rounded-xl border">
                <div className="flex flex-col justify-between gap-3 border-b p-4 sm:flex-row sm:items-center">
                  <div>
                    <h3 id="recipe-ingredients-heading" className="font-semibold">Ingredients</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Quantities are per one menu item sold.</p>
                  </div>
                  <Popover open={ingredientPickerOpen} onOpenChange={setIngredientPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving || components.length >= MAX_RECIPE_COMPONENTS}
                      >
                        <Plus className="size-4" aria-hidden="true" /> Add ingredient
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] p-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                          value={ingredientSearch}
                          onChange={(event) => setIngredientSearch(event.target.value)}
                          placeholder="Search inventory items"
                          aria-label="Search inventory items"
                          className="pl-9"
                          autoFocus
                        />
                      </div>
                      <ScrollArea className="mt-2 h-64">
                        <div className="space-y-1 pr-3">
                          {ingredientMatches.length === 0 ? (
                            <p className="px-2 py-8 text-center text-sm text-muted-foreground">No active ingredients found.</p>
                          ) : ingredientMatches.map((item) => (
                            <button
                              key={item.inventoryItemId}
                              type="button"
                              onClick={() => addIngredient(item)}
                              className="w-full rounded-md px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="block text-sm font-medium">{item.name}</span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {item.category || "Uncategorised"} · tracked in {getInventoryUnitLabel(item.trackingUnit)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>

                {components.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Add the first inventory ingredient to build this recipe.
                  </div>
                ) : (
                  <div className="divide-y">
                    {costProjection.lines.map((line, index) => {
                      const item = line.item
                      if (!item) {
                        return (
                          <div key={line.component.inventoryItemId} className="flex items-start justify-between gap-4 p-4">
                            <div>
                              <p className="text-sm font-medium">Unavailable inventory item</p>
                              <p className="mt-1 text-xs text-destructive">
                                {line.component.inventoryItemId} is no longer in the inventory catalog. Remove it before saving.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setComponents((current) => current.filter((_, componentIndex) => componentIndex !== index))}
                              disabled={saving}
                              aria-label="Remove unavailable inventory item"
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        )
                      }
                      const compatibleUnits = getCompatibleInventoryUnits(item.trackingUnit)
                      return (
                        <div key={line.component.inventoryItemId} className="grid gap-3 p-4 lg:grid-cols-[minmax(180px,1fr)_150px_130px_minmax(150px,auto)_40px] lg:items-start">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Tracked in {getInventoryUnitLabel(item.trackingUnit)}</p>
                            {!item.isActive ? <p className="mt-1 text-xs text-destructive">Inventory item is inactive</p> : null}
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`recipe-quantity-${index}`} className="sr-only">{item.name} quantity</Label>
                            <Input
                              id={`recipe-quantity-${index}`}
                              type="text"
                              inputMode="decimal"
                              value={line.component.quantity}
                              onChange={(event) => updateComponent(index, { quantity: event.target.value })}
                              aria-label={`${item.name} quantity`}
                              disabled={saving}
                            />
                            {line.error ? <p className="text-xs text-destructive">{line.error}</p> : null}
                          </div>
                          <Select
                            value={line.component.unit}
                            onValueChange={(value: InventoryUnit) => updateComponent(index, { unit: value })}
                            disabled={saving}
                          >
                            <SelectTrigger aria-label={`${item.name} unit`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {compatibleUnits.map((unit) => (
                                <SelectItem key={unit} value={unit}>{getInventoryUnitLabel(unit)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                            {item.unitCostMinor === null || !item.costCurrency ? (
                              <span className="text-amber-700 dark:text-amber-300">Missing unit cost</span>
                            ) : line.costMinor !== null ? (
                              <>
                                <span className="font-medium">{formatInventoryMoneyMinor(line.costMinor, item.costCurrency)}</span>
                                <span className="ml-1 text-xs text-muted-foreground">estimated</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Cost unavailable</span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setComponents((current) => current.filter((_, componentIndex) => componentIndex !== index))}
                            disabled={saving}
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section aria-labelledby="recipe-cost-heading" className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CircleDollarSign className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 id="recipe-cost-heading" className="font-semibold">Estimated ingredient cost</h3>
                    {components.length === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">Add ingredients to calculate an estimate.</p>
                    ) : costProjection.currencies.length > 1 ? (
                      <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                        A total cannot be calculated because ingredient costs use multiple currencies: {costProjection.currencies.join(", ")}.
                      </p>
                    ) : costProjection.complete && costProjection.knownCostMinor !== null ? (
                      <p className="mt-1 text-2xl font-semibold tabular-nums">
                        {formatInventoryMoneyMinor(costProjection.knownCostMinor, costProjection.currencies[0])}
                      </p>
                    ) : costProjection.knownCostMinor !== null && costProjection.currencies[0] ? (
                      <p className="mt-1 text-sm">
                        Known cost: <span className="font-semibold tabular-nums">{formatInventoryMoneyMinor(costProjection.knownCostMinor, costProjection.currencies[0])}</span>
                      </p>
                    ) : null}

                    {costProjection.missingCostItems.length > 0 ? (
                      <div className="mt-3 flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <p>
                          Add a unit cost to {costProjection.missingCostItems.map((item) => item.name).join(", ")} for a complete estimate.
                        </p>
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      This is an estimate from current per-unit inventory costs. The saved recipe cost is recalculated from the latest inventory costs.
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}

          <DialogFooter>
            {recipe?.simpleStock ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setError(null)
                  setRemoveConfirmOpen(true)
                }}
                disabled={saving || removing}
                className="sm:mr-auto"
              >
                {removing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                Remove Ingredient Tracking
              </Button>
            ) : null}
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving || removing}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={loading || saving || removing || !selectedMenuItemId || components.length === 0 || costProjection.hasErrors}
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {recipe ? "Save recipe" : isAddingToSimpleStock ? "Add Ingredient Tracking" : "Create recipe"}
            </Button>
          </DialogFooter>
        </form>

        <AlertDialog
          open={removeConfirmOpen}
          onOpenChange={(nextOpen) => {
            if (removing) return
            setRemoveConfirmOpen(nextOpen)
            if (!nextOpen) setError(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove ingredient tracking?</AlertDialogTitle>
              <AlertDialogDescription>
                Ingredient tracking will be removed from this menu item. Simple Stock and the current portion balance will remain unchanged.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error ? (
              <p className="text-sm font-medium text-destructive" role="alert">{error}</p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault()
                  void removeIngredientTracking()
                }}
                disabled={removing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {removing ? "Removing…" : "Remove tracking"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
