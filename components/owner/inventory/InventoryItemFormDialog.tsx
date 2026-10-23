"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import apiClient from "@/lib/axios-config"
import {
  getInventoryApiError,
  getInventoryDomainsForBusiness,
  getInventoryDuplicateSignal,
  getInventoryUnitLabel,
  INVENTORY_TRACKING_UNIT_OPTIONS,
  inventoryCostToInput,
  inventoryCostToMinor,
} from "@/lib/inventory"
import { useAuthContext } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type {
  InventoryDuplicateSignal,
  InventoryDomain,
  InventoryItem,
  InventoryTrackingUnit,
} from "@/types/inventory"

type InventoryItemFormDialogProps = {
  open: boolean
  mode: "create" | "edit"
  item?: InventoryItem | null
  defaultCurrency: string
  trackingUnitLocked?: boolean
  domainOptions?: Array<{ value: InventoryDomain; label: string }>
  onOpenChange: (open: boolean) => void
  onSaved: (item: InventoryItem) => void
  onViewExisting?: (inventoryItemId: string) => void
  onReceiveFirstDelivery?: (item: InventoryItem) => void
}

export function InventoryItemFormDialog({
  open,
  mode,
  item,
  defaultCurrency,
  trackingUnitLocked = false,
  domainOptions: allowedDomainOptions,
  onOpenChange,
  onSaved,
  onViewExisting,
  onReceiveFirstDelivery,
}: InventoryItemFormDialogProps) {
  const { user } = useAuthContext()
  const businessDomainOptions = useMemo(() => getInventoryDomainsForBusiness(user), [user])
  const domainOptions = allowedDomainOptions ?? businessDomainOptions
  const [name, setName] = useState("")
  const [domain, setDomain] = useState<InventoryDomain>("food_service")
  const [category, setCategory] = useState("")
  const [trackingUnit, setTrackingUnit] = useState<InventoryTrackingUnit>("piece")
  const [lowStockThreshold, setLowStockThreshold] = useState("0")
  const [unitCost, setUnitCost] = useState("")
  const [costCurrency, setCostCurrency] = useState(defaultCurrency || "EUR")
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [duplicateSignal, setDuplicateSignal] = useState<InventoryDuplicateSignal | null>(null)
  const [createdItem, setCreatedItem] = useState<InventoryItem | null>(null)

  useEffect(() => {
    if (!open) return
    const currency = item?.costCurrency || defaultCurrency || "EUR"
    setName(item?.name || "")
    setDomain(item?.domain || domainOptions[0]?.value || "food_service")
    setCategory(item?.category || "")
    setTrackingUnit(item?.trackingUnit || "piece")
    setLowStockThreshold(String(item?.lowStockThreshold ?? 0))
    setUnitCost(inventoryCostToInput(item?.unitCostMinor ?? null, currency))
    setCostCurrency(currency)
    setIsActive(item?.isActive ?? true)
    setError(null)
    setDuplicateSignal(null)
    setCreatedItem(null)
  }, [defaultCurrency, domainOptions, item, open])

  const save = async (allowCategoryVariant = false) => {
    setError(null)
    setDuplicateSignal(null)

    if (!name.trim()) {
      setError("Item name is required")
      return
    }
    if (!/^\d+$/.test(lowStockThreshold.trim())) {
      setError("Low-stock threshold must be a whole number in the item's tracking unit")
      return
    }

    let unitCostMinor: number | null
    try {
      unitCostMinor = inventoryCostToMinor(unitCost, costCurrency)
    } catch (costError) {
      setError(costError instanceof Error ? costError.message : "Enter a valid unit cost")
      return
    }

    const payload = {
      name: name.trim(),
      domain,
      category: category.trim() || null,
      trackingUnit,
      lowStockThreshold: Number(lowStockThreshold),
      unitCostMinor,
      costCurrency: unitCostMinor === null ? null : costCurrency.trim().toUpperCase(),
      isActive,
      allowCategoryVariant,
    }

    setSaving(true)
    try {
      const response = mode === "create"
        ? await apiClient.post<{ item: InventoryItem }>("/owner/inventory/items", payload)
        : await apiClient.patch<{ item: InventoryItem }>(
            `/owner/inventory/items/${encodeURIComponent(item?.inventoryItemId || "")}`,
            payload,
          )
      const savedItem = response.data.item
      toast.success(mode === "create" ? "Inventory item created" : "Inventory item updated")
      onSaved(savedItem)
      if (mode === "create") {
        setCreatedItem(savedItem)
        return
      }
      onOpenChange(false)
    } catch (requestError) {
      const signal = getInventoryDuplicateSignal(requestError)
      if (signal) {
        setDuplicateSignal(signal)
      } else {
        setError(getInventoryApiError(
          requestError,
          mode === "create" ? "Inventory item could not be created" : "Inventory item could not be updated",
        ))
      }
    } finally {
      setSaving(false)
    }
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    void save(false)
  }

  const viewExisting = () => {
    if (!duplicateSignal) return
    onOpenChange(false)
    onViewExisting?.(duplicateSignal.candidate.inventoryItemId)
  }

  const reactivateExisting = async () => {
    if (!duplicateSignal) return
    setSaving(true)
    setError(null)
    try {
      const response = await apiClient.patch<{ item: InventoryItem }>(
        `/owner/inventory/items/${encodeURIComponent(duplicateSignal.candidate.inventoryItemId)}`,
        { isActive: true },
      )
      toast.success("Inventory item reactivated")
      onSaved(response.data.item)
      onOpenChange(false)
      onViewExisting?.(duplicateSignal.candidate.inventoryItemId)
    } catch (requestError) {
      setError(getInventoryApiError(requestError, "Inventory item could not be reactivated"))
    } finally {
      setSaving(false)
    }
  }

  if (mode === "create" && createdItem) {
    return (
      <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Inventory item created</DialogTitle>
            <DialogDescription>
              {createdItem.name} starts with zero stock. Record the first delivery when you are ready to add physical stock.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/20 p-4 text-sm">
            <p className="font-semibold">What happens next?</p>
            <p className="mt-1 text-muted-foreground">Receiving stock adds to On Hand. It does not change stock already reserved for orders.</p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                onViewExisting?.(createdItem.inventoryItemId)
              }}
            >
              View item
            </Button>
            {onReceiveFirstDelivery ? (
              <Button
                type="button"
                onClick={() => {
                  onReceiveFirstDelivery(createdItem)
                  onOpenChange(false)
                }}
              >
                Receive first delivery
              </Button>
            ) : (
              <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Create inventory item" : "Edit item details"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "The new item starts with zero stock. Use Receive after creating it to add stock."
                : "Update descriptive details without directly changing stock balances."}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}

          {duplicateSignal ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
              <p className="font-semibold">
                {duplicateSignal.conflictType === "strong"
                  ? duplicateSignal.candidate.isActive
                    ? `An inventory item named ${duplicateSignal.candidate.name} already exists and is tracked in ${getInventoryUnitLabel(duplicateSignal.candidate.trackingUnit)}.`
                    : "An inactive inventory item with this name already exists."
                  : `Another ${duplicateSignal.candidate.name} item tracked in ${getInventoryUnitLabel(duplicateSignal.candidate.trackingUnit)} already exists under ${duplicateSignal.candidate.category || "Uncategorised"}.`}
              </p>
              <p className="mt-1 text-xs text-amber-900/80">
                Available balance: {duplicateSignal.candidate.availableQuantity} {getInventoryUnitLabel(duplicateSignal.candidate.trackingUnit)}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={viewExisting} disabled={saving}>
                  View existing item
                </Button>
                {duplicateSignal.conflictType === "strong" && !duplicateSignal.candidate.isActive ? (
                  <Button type="button" size="sm" onClick={() => void reactivateExisting()} disabled={saving}>
                    Reactivate existing item
                  </Button>
                ) : null}
                {duplicateSignal.conflictType === "category_variant" ? (
                  <Button type="button" size="sm" onClick={() => void save(true)} disabled={saving}>
                    Continue with this category
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="inventory-item-name">Item name</Label>
              <Input
                id="inventory-item-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setDuplicateSignal(null)
                }}
                maxLength={120}
                placeholder="e.g. Tomatoes"
                disabled={saving}
                autoFocus
              />
            </div>

            {domainOptions.length > 1 ? (
              <div className="space-y-2">
                <Label>Domain</Label>
                <Select
                  value={domain}
                  onValueChange={(value: InventoryDomain) => {
                    setDomain(value)
                    setDuplicateSignal(null)
                  }}
                  disabled={saving}
                >
                  <SelectTrigger aria-label="Inventory domain"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {domainOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="inventory-item-category">Category</Label>
              <Input
                id="inventory-item-category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value)
                  setDuplicateSignal(null)
                }}
                maxLength={80}
                placeholder="e.g. Produce"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>Tracking unit</Label>
              <Select
                value={trackingUnit}
                onValueChange={(value: InventoryTrackingUnit) => {
                  setTrackingUnit(value)
                  setDuplicateSignal(null)
                }}
                disabled={saving || (mode === "edit" && trackingUnitLocked)}
              >
                <SelectTrigger aria-label="Tracking unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_TRACKING_UNIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mode === "edit" && trackingUnitLocked ? (
                <p className="text-xs text-muted-foreground">Locked because this item has stock or movement history.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Choose the unit you physically count. Packs, pieces, and bottles stay distinct.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="inventory-low-threshold">Low-stock threshold ({trackingUnit})</Label>
              <Input
                id="inventory-low-threshold"
                type="number"
                min="0"
                step="1"
                value={lowStockThreshold}
                onChange={(event) => setLowStockThreshold(event.target.value)}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">Triggers a low-stock warning.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inventory-unit-cost">Cost per {trackingUnit} (optional)</Label>
              <Input
                id="inventory-unit-cost"
                type="text"
                inputMode="decimal"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
                placeholder="0.00"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inventory-cost-currency">Cost currency</Label>
              <Input
                id="inventory-cost-currency"
                value={costCurrency}
                onChange={(event) => setCostCurrency(event.target.value.toUpperCase())}
                maxLength={3}
                placeholder="EUR"
                disabled={saving || !unitCost.trim()}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <div>
                <Label htmlFor="inventory-item-active">Active item</Label>
                <p className="mt-1 text-xs text-muted-foreground">Inactive items cannot receive or lose stock.</p>
              </div>
              <Switch
                id="inventory-item-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={saving}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {mode === "create" ? "Create item" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
