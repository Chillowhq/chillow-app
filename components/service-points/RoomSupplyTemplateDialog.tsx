"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Loader2, Minus, PackageCheck, PackageSearch, Plus, Search } from "lucide-react"
import { toast } from "sonner"

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
import apiClient from "@/lib/axios-config"
import {
  getCompatibleInventoryUnits,
  getInventoryUnitLabel,
  HOTEL_OPERATIONAL_INVENTORY_DOMAINS,
  inventoryQuantityToCanonical,
} from "@/lib/inventory"
import type {
  HotelRoomType,
  HotelRoomTypeSupplyTemplateResponse,
} from "@/types/hotel-room-type"
import type {
  InventoryItem,
  InventoryItemsResponse,
  InventoryUnit,
} from "@/types/inventory"

type SupplyLine = {
  inventoryItemId: string
  item: InventoryItem | null
  quantity: string
  unit: InventoryUnit
  status: HotelRoomTypeSupplyTemplateResponse["items"][number]["status"]
}

type RoomSupplyTemplateDialogProps = {
  open: boolean
  roomType: HotelRoomType | null
  canManage?: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (roomType: HotelRoomType) => void
}

function apiMessage(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data
  if (typeof data?.error === "string" && data.error.trim()) return data.error
  if (typeof data?.message === "string" && data.message.trim()) return data.message
  return fallback
}

export function RoomSupplyTemplateDialog({
  open,
  roomType,
  canManage = true,
  onOpenChange,
  onSaved,
}: RoomSupplyTemplateDialogProps) {
  const [lines, setLines] = useState<SupplyLine[]>([])
  const [candidates, setCandidates] = useState<InventoryItem[]>([])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    if (!open || !roomType) return
    const controller = new AbortController()
    setLines([])
    setSearch("")
    setDebouncedSearch("")
    setError(null)
    setLoadingTemplate(true)
    apiClient.get<HotelRoomTypeSupplyTemplateResponse>(
      "/business/room-types/supply-template",
      { params: { roomTypeName: roomType.name }, signal: controller.signal },
    ).then((response) => {
      setLines(response.data.items.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        item: line.inventoryItem,
        quantity: String(line.quantity),
        unit: line.unit,
        status: line.status,
      })))
    }).catch((requestError) => {
      if (controller.signal.aborted) return
      setError(apiMessage(requestError, "Room supplies could not be loaded"))
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingTemplate(false)
    })
    return () => controller.abort()
  }, [open, roomType])

  useEffect(() => {
    if (!open || !roomType || !canManage) return
    const controller = new AbortController()
    setLoadingCandidates(true)
    apiClient.get<InventoryItemsResponse>("/owner/inventory/items", {
      params: {
        active: "true",
        domain: HOTEL_OPERATIONAL_INVENTORY_DOMAINS.join(","),
        search: debouncedSearch || undefined,
        limit: 100,
      },
      signal: controller.signal,
    }).then((response) => {
      setCandidates(response.data.items || [])
    }).catch((requestError) => {
      if (controller.signal.aborted) return
      setError(apiMessage(requestError, "Supplies could not be loaded"))
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingCandidates(false)
    })
    return () => controller.abort()
  }, [canManage, debouncedSearch, open, roomType])

  const selectedIds = useMemo(
    () => new Set(lines.map((line) => line.inventoryItemId)),
    [lines],
  )
  const availableCandidates = candidates.filter(
    (item) => !selectedIds.has(item.inventoryItemId),
  )
  const unavailableLineCount = lines.filter((line) => line.status !== "available").length

  const updateLine = (
    inventoryItemId: string,
    update: Partial<Pick<SupplyLine, "quantity" | "unit">>,
  ) => {
    setLines((current) => current.map((line) => (
      line.inventoryItemId === inventoryItemId ? { ...line, ...update } : line
    )))
    setError(null)
  }

  const addItem = (item: InventoryItem) => {
    if (selectedIds.has(item.inventoryItemId)) return
    setLines((current) => [...current, {
      inventoryItemId: item.inventoryItemId,
      item,
      quantity: "1",
      unit: item.trackingUnit,
      status: "available",
    }])
    setError(null)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!roomType || !canManage) return
    setError(null)
    if (unavailableLineCount > 0) {
      setError("Remove unavailable supplies before saving")
      return
    }
    try {
      for (const line of lines) {
        if (!line.item) throw new Error("Remove unavailable supplies before saving")
        inventoryQuantityToCanonical(line.quantity, line.unit, line.item.trackingUnit)
      }
    } catch (quantityError) {
      setError(quantityError instanceof Error ? quantityError.message : "Enter valid quantities")
      return
    }

    setSaving(true)
    try {
      const response = await apiClient.patch<HotelRoomTypeSupplyTemplateResponse>(
        "/business/room-types/supply-template",
        {
          roomTypeName: roomType.name,
          items: lines.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            quantity: line.quantity.trim(),
            unit: line.unit,
          })),
        },
      )
      if (response.data.roomType) onSaved(response.data.roomType)
      toast.success(lines.length ? "Room supplies saved" : "Room supplies cleared")
      onOpenChange(false)
    } catch (requestError) {
      setError(apiMessage(requestError, "Room supplies could not be saved"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[min(92dvh,820px)] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={save} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Room supplies · {roomType?.name}</DialogTitle>
            <DialogDescription>
              Choose the items your team normally uses to prepare this type of room. This does not change your stock.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
            <PackageCheck className="mr-2 inline size-4" aria-hidden="true" />
              Stock changes only when your team confirms what they actually used while servicing a room.
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}

          {unavailableLineCount > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
              <AlertTriangle className="mr-2 inline size-4" aria-hidden="true" />
              {unavailableLineCount} saved {unavailableLineCount === 1 ? "supply is" : "supplies are"} no longer available. Remove {unavailableLineCount === 1 ? "it" : "them"} before saving.
            </div>
          ) : null}

          <section className="space-y-3" aria-labelledby="standard-supplies-heading">
            <div>
              <h3 id="standard-supplies-heading" className="font-medium">Supplies for this room type</h3>
              <p className="text-xs text-muted-foreground">Your team can change quantities or remove items before recording what was actually used.</p>
            </div>

            {loadingTemplate ? (
              <div className="flex items-center justify-center rounded-lg border py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" /> Loading room supplies
              </div>
            ) : lines.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No supplies have been added yet.
              </div>
            ) : lines.map((line) => {
              const units = line.item
                ? getCompatibleInventoryUnits(line.item.trackingUnit)
                : [line.unit]
              return (
                <div key={line.inventoryItemId} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_110px_130px_auto] sm:items-end">
                  <div>
                    <p className="font-medium">{line.item?.name || "Unavailable inventory item"}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.status === "available" ? line.item?.category || "Uncategorised" : `Unavailable · ${line.inventoryItemId}`}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`room-supply-${line.inventoryItemId}`} className="text-xs">Quantity</Label>
                    <Input
                      id={`room-supply-${line.inventoryItemId}`}
                      value={line.quantity}
                      onChange={(event) => updateLine(line.inventoryItemId, { quantity: event.target.value })}
                      inputMode="decimal"
                      disabled={!canManage || saving || line.status !== "available"}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Select
                      value={line.unit}
                      onValueChange={(unit: InventoryUnit) => updateLine(line.inventoryItemId, { unit })}
                      disabled={!canManage || saving || line.status !== "available"}
                    >
                      <SelectTrigger aria-label={`${line.item?.name || line.inventoryItemId} unit`} className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => <SelectItem key={unit} value={unit}>{getInventoryUnitLabel(unit)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Remove ${line.item?.name || line.inventoryItemId}`}
                    onClick={() => setLines((current) => current.filter((entry) => entry.inventoryItemId !== line.inventoryItemId))}
                    disabled={!canManage || saving}
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              )
            })}
          </section>

          {canManage ? <section className="rounded-lg border bg-muted/20 p-3" aria-label="Add room supply">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search supplies"
                aria-label="Search supplies"
                className="h-11 pl-9"
                disabled={saving}
              />
            </div>
            <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
              {loadingCandidates ? (
                <div className="flex items-center justify-center py-5 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Loading supplies
                </div>
              ) : availableCandidates.length === 0 ? (
                <div className="flex items-center justify-center py-5 text-sm text-muted-foreground">
                  <PackageSearch className="mr-2 size-4" /> No matching supplies
                </div>
              ) : availableCandidates.map((item) => (
                <button
                  key={item.inventoryItemId}
                  type="button"
                  onClick={() => addItem(item)}
                  className="flex min-h-11 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-left hover:border-primary/50"
                  disabled={saving}
                >
                  <span>
                    <span className="block text-sm font-medium">{item.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {item.category || "Uncategorised"} · {getInventoryUnitLabel(item.trackingUnit)}
                    </span>
                  </span>
                  <Plus className="size-4 text-primary" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{canManage ? "Cancel" : "Close"}</Button>
            {canManage ? <Button type="submit" disabled={saving || loadingTemplate || unavailableLineCount > 0}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Save supplies
            </Button> : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
