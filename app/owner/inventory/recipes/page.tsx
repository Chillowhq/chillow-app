"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  Soup,
  TriangleAlert,
} from "lucide-react"
import apiClient from "@/lib/axios-config"
import {
  formatInventoryMoneyMinor,
  getInventoryOperationalContexts,
  resolveInventoryOperationalContext,
} from "@/lib/inventory"
import { hasManagementPermission, MANAGER_PERMISSIONS } from "@/lib/manager-permissions"
import { useAuthContext } from "@/contexts/AuthContext"
import { RecipeBuilderDialog } from "@/components/owner/inventory/RecipeBuilderDialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  InventoryRecipe,
  InventoryRecipesResponse,
  InventoryRecipeStatus,
} from "@/types/inventory"

const PAGE_SIZE = 25
type RecipeStatusFilter = "all" | Extract<InventoryRecipeStatus, "active" | "disabled">

function RecipeStatusBadge({ status }: { status: InventoryRecipeStatus }) {
  const className = status === "active"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300"
    : status === "disabled"
      ? "bg-muted text-muted-foreground ring-border"
      : "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300"
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${className}`}>
      {status}
    </span>
  )
}

function RecipeCost({ recipe }: { recipe: InventoryRecipe }) {
  if (recipe.costing.status === "complete" && recipe.costing.estimatedCostMinor !== null && recipe.costing.currency) {
    return (
      <span className="font-medium tabular-nums">
        {formatInventoryMoneyMinor(recipe.costing.estimatedCostMinor, recipe.costing.currency)}
      </span>
    )
  }
  if (recipe.costing.status === "mixed_currency") {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-300">
        <TriangleAlert className="size-3.5" aria-hidden="true" /> Mixed currencies
      </span>
    )
  }
  return (
    <div>
      <span className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-300">
        <TriangleAlert className="size-3.5" aria-hidden="true" /> Missing cost
      </span>
      {recipe.costing.knownCostMinor !== null && recipe.costing.currency ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Known {formatInventoryMoneyMinor(recipe.costing.knownCostMinor, recipe.costing.currency)}
        </p>
      ) : null}
    </div>
  )
}

function RecipesLoadingState() {
  return (
    <div className="space-y-3 p-4" aria-label="Loading recipes">
      {[0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-16 w-full" />)}
    </div>
  )
}

export default function InventoryRecipesPage() {
  const { user, loading: authLoading } = useAuthContext()
  const searchParams = useSearchParams()
  const availableContexts = useMemo(() => getInventoryOperationalContexts(user), [user])
  const operationalContext = resolveInventoryOperationalContext(user, searchParams.get("context"), "foodService")
  const hasFoodService = availableContexts.includes("foodService")
  const isFoodServiceContext = hasFoodService && operationalContext === "foodService"
  const canViewRecipes = isFoodServiceContext && hasManagementPermission(user, MANAGER_PERMISSIONS.MENU_VIEW)
  const canManageRecipes = isFoodServiceContext && hasManagementPermission(user, MANAGER_PERMISSIONS.MENU_MANAGE) &&
    hasManagementPermission(user, MANAGER_PERMISSIONS.INVENTORY_RECIPE_MANAGE)
  const [status, setStatus] = useState<RecipeStatusFilter>("all")
  const [cursor, setCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([])
  const [data, setData] = useState<InventoryRecipesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<InventoryRecipe | null>(null)

  const loadRecipes = useCallback(async (signal?: AbortSignal) => {
    if (!user?.businessId || !canViewRecipes) return
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<InventoryRecipesResponse>("/owner/inventory/recipes", {
        params: {
          status,
          cursor: cursor || undefined,
          limit: PAGE_SIZE,
        },
        signal,
      })
      setData(response.data)
    } catch (requestError) {
      if (signal?.aborted) return
      setError(requestError instanceof Error ? requestError.message : "Recipes could not be loaded")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [canViewRecipes, cursor, status, user?.businessId])

  useEffect(() => {
    const controller = new AbortController()
    void loadRecipes(controller.signal)
    return () => controller.abort()
  }, [loadRecipes])

  const recipes = data?.recipes ?? []
  const pageNumber = cursorHistory.length + 1
  const resultSummary = useMemo(() => {
    if (loading) return "Loading recipes"
    if (error) return "Recipes could not be loaded"
    if (recipes.length === 0) return "No recipes found"
    return `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"} shown on page ${pageNumber}`
  }, [error, loading, pageNumber, recipes.length])

  const resetPagination = () => {
    setCursor(null)
    setCursorHistory([])
  }

  const handleSaved = (savedRecipe: InventoryRecipe) => {
    setData((current) => current ? {
      ...current,
      recipes: current.recipes.some((recipe) => recipe.menuItemId === savedRecipe.menuItemId)
        ? current.recipes.map((recipe) => recipe.menuItemId === savedRecipe.menuItemId ? savedRecipe : recipe)
        : [savedRecipe, ...current.recipes].slice(0, PAGE_SIZE),
    } : current)
    if (!editingRecipe && cursor !== null) {
      resetPagination()
    } else {
      void loadRecipes()
    }
  }

  const handleRemoved = (menuItemId: string) => {
    setData((current) => current ? {
      ...current,
      recipes: current.recipes.filter((recipe) => recipe.menuItemId !== menuItemId),
    } : current)
    void loadRecipes()
  }

  if (authLoading) {
    return <Card><RecipesLoadingState /></Card>
  }

  if (!canViewRecipes) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Soup className="size-5" aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-semibold">Menu access is required</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Recipe ingredients connect inventory items to menu items, so both Inventory and Menu viewing access are required.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-semibold">Recipes</h2>
          <p className="text-sm text-muted-foreground">
            Define the inventory ingredients and quantities used by each menu item.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">{resultSummary}</p>
          {canManageRecipes ? (
            <Button onClick={() => {
              setEditingRecipe(null)
              setBuilderOpen(true)
            }}>
              <Plus className="size-4" aria-hidden="true" /> Add ingredient tracking
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <Select
            value={status}
            onValueChange={(value: RecipeStatusFilter) => {
              setStatus(value)
              resetPagination()
            }}
          >
            <SelectTrigger className="w-full sm:w-52" aria-label="Filter recipes by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All recipes</SelectItem>
              <SelectItem value="active">Active recipes</SelectItem>
              <SelectItem value="disabled">Disabled recipes</SelectItem>
            </SelectContent>
          </Select>
          {loading && data ? <RefreshCw className="size-4 animate-spin text-muted-foreground" aria-label="Refreshing recipes" /> : null}
        </div>

        {loading && !data ? (
          <RecipesLoadingState />
        ) : error && !data ? (
          <CardContent className="flex min-h-72 flex-col items-center justify-center py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <RefreshCw className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-semibold">Recipes could not be loaded</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Check your connection and try again.</p>
            <Button className="mt-5" onClick={() => void loadRecipes()}>Try again</Button>
          </CardContent>
        ) : recipes.length === 0 ? (
          <CardContent className="flex min-h-72 flex-col items-center justify-center py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Soup className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-semibold">
              {status === "all" ? "No ingredient recipes yet" : `No ${status} recipes`}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {status === "all"
                ? "Create a recipe to connect a menu item to its inventory ingredients."
                : "Change the status filter to review other recipes."}
            </p>
            {canManageRecipes && status === "all" ? (
              <Button className="mt-5" onClick={() => {
                setEditingRecipe(null)
                setBuilderOpen(true)
              }}>
                <Plus className="size-4" aria-hidden="true" /> Add ingredient tracking
              </Button>
            ) : null}
          </CardContent>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-11 pl-6">Menu item</TableHead>
                    <TableHead>Ingredients</TableHead>
                    <TableHead>Estimated cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipes.map((recipe) => (
                    <TableRow key={recipe.menuInventoryRecipeId}>
                      <TableCell className="py-4 pl-6">
                        <p className="font-medium">{recipe.menuItem?.name || "Unavailable menu item"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{recipe.menuItem?.category || "Uncategorised"}</p>
                        {recipe.simpleStock ? (
                          <p className="mt-2 text-xs font-medium text-primary">
                            Sellable Stock: {recipe.simpleStock.availableQuantity ?? "Unavailable"} {recipe.simpleStock.unit}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{recipe.components.length} {recipe.components.length === 1 ? "ingredient" : "ingredients"}</p>
                        <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
                          {recipe.components.map((component) => component.inventoryItemName || "Unavailable item").join(", ")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {recipe.mode === "simple"
                            ? "Ingredients are recorded alongside sellable stock"
                            : "Ingredients are recorded when this item is prepared"}
                        </p>
                      </TableCell>
                      <TableCell><RecipeCost recipe={recipe} /></TableCell>
                      <TableCell><RecipeStatusBadge status={recipe.status} /></TableCell>
                      <TableCell className="pr-6 text-right">
                        {canManageRecipes && recipe.menuItem ? (
                          <Button variant="ghost" size="sm" onClick={() => {
                            setEditingRecipe(recipe)
                            setBuilderOpen(true)
                          }}>
                            <Pencil className="size-4" aria-hidden="true" /> Edit
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y md:hidden">
              {recipes.map((recipe) => (
                <article key={recipe.menuInventoryRecipeId} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{recipe.menuItem?.name || "Unavailable menu item"}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{recipe.menuItem?.category || "Uncategorised"}</p>
                      {recipe.simpleStock ? (
                        <p className="mt-2 text-xs font-medium text-primary">
                          Sellable Stock: {recipe.simpleStock.availableQuantity ?? "Unavailable"} {recipe.simpleStock.unit}
                        </p>
                      ) : null}
                    </div>
                    <RecipeStatusBadge status={recipe.status} />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ingredients</p>
                    <p className="mt-1 text-sm">
                      {recipe.components.map((component) => component.inventoryItemName || "Unavailable item").join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <RecipeCost recipe={recipe} />
                    {canManageRecipes && recipe.menuItem ? (
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditingRecipe(recipe)
                        setBuilderOpen(true)
                      }}>
                        <Pencil className="size-4" aria-hidden="true" /> Edit
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {!loading && !error && recipes.length > 0 ? (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">Page {pageNumber}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCursor(cursorHistory.at(-1) ?? null)
                  setCursorHistory((history) => history.slice(0, -1))
                }}
                disabled={cursorHistory.length === 0}
              >
                <ChevronLeft className="size-4" aria-hidden="true" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!data?.pagination.nextCursor) return
                  setCursorHistory((history) => [...history, cursor])
                  setCursor(data.pagination.nextCursor)
                }}
                disabled={!data?.pagination.hasNextPage}
              >
                Next <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {user?.businessId ? (
        <RecipeBuilderDialog
          open={builderOpen}
          recipe={editingRecipe}
          businessId={user.businessId}
          onOpenChange={(nextOpen) => {
            setBuilderOpen(nextOpen)
            if (!nextOpen) setEditingRecipe(null)
          }}
          onSaved={handleSaved}
          onRemoved={handleRemoved}
        />
      ) : null}
    </div>
  )
}
