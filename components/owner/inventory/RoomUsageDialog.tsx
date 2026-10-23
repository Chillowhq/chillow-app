"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Loader2, Minus, PackageCheck, PackageSearch, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import apiClient from "@/lib/axios-config"
import {
  formatInventoryQuantity,
  getCompatibleInventoryUnits,
  getInventoryApiError,
  getInventoryUnitLabel,
  inventoryQuantityToCanonical,
} from "@/lib/inventory"
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
import { Textarea } from "@/components/ui/textarea"
import type {
  InventoryItem,
  InventoryUnit,
  RoomUsageContextResponse,
  RoomUsageResponse,
} from "@/types/inventory"

type RoomUsageLine = {
  item: InventoryItem
  quantity: string
  unit: InventoryUnit
}

type RoomUsageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted: (result: RoomUsageResponse) => void
  initialServicePointId?: string | null
  initialRoomLabel?: string | null
  workflow?: "room_usage" | "service_room"
  housekeepingOperationId?: string | null
}

export function RoomUsageDialog({
  open,
  onOpenChange,
  onCompleted,
  initialServicePointId = null,
  initialRoomLabel = null,
  workflow = "room_usage",
  housekeepingOperationId = null,
}: RoomUsageDialogProps) {
  const [rooms, setRooms] = useState<RoomUsageContextResponse["rooms"]>([])
  const [servicePointId, setServicePointId] = useState("")
  const [search, setSearch] = useState("")
  const [candidates, setCandidates] = useState<InventoryItem[]>([])
  const [lines, setLines] = useState<RoomUsageLine[]>([])
  const [template, setTemplate] = useState<RoomUsageContextResponse["template"]>(null)
  const [note, setNote] = useState("")
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null)
  const isServiceRoomWorkflow = workflow === "service_room"

  useEffect(() => {
    if (!open) return
    setServicePointId(initialServicePointId?.trim() || "")
    setSearch("")
    setRooms([])
    setCandidates([])
    setLines([])
    setTemplate(null)
    setNote("")
    setError(null)
    idempotencyRef.current = null
  }, [initialServicePointId, open])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoadingRooms(true)
    setError(null)
    apiClient.get<RoomUsageContextResponse>("/owner/inventory/room-usage/context", {
      params: { housekeepingOperationId: housekeepingOperationId || undefined },
      signal: controller.signal,
    }).then((response) => {
      setRooms(response.data.rooms || [])
      setCandidates(response.data.items || [])
    }).catch((requestError) => {
      if (controller.signal.aborted) return
      setError(getInventoryApiError(requestError, "Rooms could not be loaded"))
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingRooms(false)
    })
    return () => controller.abort()
  }, [housekeepingOperationId, open])

  useEffect(() => {
    if (!open || !servicePointId) {
      setTemplate(null)
      setLines([])
      return
    }
    const controller = new AbortController()
    setLoadingTemplate(true)
    setTemplate(null)
    setLines([])
    setError(null)
    idempotencyRef.current = null
    apiClient.get<RoomUsageContextResponse>("/owner/inventory/room-usage/context", {
      params: {
        servicePointId,
        housekeepingOperationId: housekeepingOperationId || undefined,
      },
      signal: controller.signal,
    }).then((response) => {
      setRooms(response.data.rooms || [])
      setTemplate(response.data.template)
      setCandidates(response.data.items || [])
      setLines((response.data.template?.suggestions || []).map((suggestion) => ({
        item: suggestion.inventoryItem,
        quantity: String(suggestion.quantity),
        unit: suggestion.unit,
      })))
    }).catch((requestError) => {
      if (controller.signal.aborted) return
      setError(getInventoryApiError(requestError, "Standard supplies could not be loaded"))
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingTemplate(false)
    })
    return () => controller.abort()
  }, [housekeepingOperationId, open, servicePointId])

  const selectedIds = useMemo(() => new Set(lines.map((line) => line.item.inventoryItemId)), [lines])
  const normalizedSearch = search.trim().toLowerCase()
  const availableCandidates = candidates.filter((item) => (
    !selectedIds.has(item.inventoryItemId) &&
    (!normalizedSearch || [item.name, item.category].some((value) => value?.toLowerCase().includes(normalizedSearch)))
  ))

  const addItem = (item: InventoryItem) => {
    if (selectedIds.has(item.inventoryItemId)) return
    setLines((current) => [...current, { item, quantity: "1", unit: item.trackingUnit }])
    setError(null)
  }

  const updateLine = (inventoryItemId: string, update: Partial<Pick<RoomUsageLine, "quantity" | "unit">>) => {
    setLines((current) => current.map((line) => (
      line.item.inventoryItemId === inventoryItemId ? { ...line, ...update } : line
    )))
    idempotencyRef.current = null
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!servicePointId) {
      setError("Choose a room")
      return
    }
    if (lines.length === 0) {
      setError("Add at least one inventory item")
      return
    }
    let confirmedLines: RoomUsageLine[]
    try {
      confirmedLines = lines.filter((line) => {
        const quantity = line.quantity.trim()
        if (/^0(?:\.0+)?$/.test(quantity)) return false
        inventoryQuantityToCanonical(quantity, line.unit, line.item.trackingUnit)
        return true
      })
    } catch (quantityError) {
      setError(quantityError instanceof Error ? quantityError.message : "Enter valid quantities")
      return
    }
    if (confirmedLines.length === 0) {
      setError("Keep at least one supply above zero, or cancel without recording usage")
      return
    }

    const payload = {
      servicePointId,
      items: confirmedLines.map((line) => ({
        inventoryItemId: line.item.inventoryItemId,
        quantity: line.quantity.trim(),
        unit: line.unit,
      })),
      note: note.trim() || null,
      housekeepingOperationId: housekeepingOperationId || undefined,
    }
    const fingerprint = JSON.stringify(payload)
    if (idempotencyRef.current?.fingerprint !== fingerprint) {
      idempotencyRef.current = {
        fingerprint,
        key: housekeepingOperationId
          ? `housekeeping:${housekeepingOperationId}:supplies:v1`
          : crypto.randomUUID(),
      }
    }

    setSaving(true)
    try {
      const response = await apiClient.post<RoomUsageResponse>(
        "/owner/inventory/room-usage",
        payload,
        { headers: { "Idempotency-Key": idempotencyRef.current.key } },
      )
      toast.success(response.data.replayed
        ? isServiceRoomWorkflow
          ? "Room servicing supplies were already recorded"
          : "Room usage already recorded"
        : isServiceRoomWorkflow
          ? "Room servicing supplies recorded"
          : "Room usage recorded")
      onCompleted(response.data)
      onOpenChange(false)
    } catch (requestError) {
      setError(getInventoryApiError(requestError, "Room usage could not be recorded"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[min(92dvh,820px)] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{isServiceRoomWorkflow ? "Service Room" : "Record Room Usage"}</DialogTitle>
            <DialogDescription>
              {isServiceRoomWorkflow
                ? `Review the supplies actually used while servicing ${initialRoomLabel || "this room"}. Inventory changes only when you confirm.`
                : "Record the supplies actually used or removed from usable stock for one room."}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Room</Label>
            <Select
              value={servicePointId}
              onValueChange={setServicePointId}
              disabled={saving || loadingRooms || (isServiceRoomWorkflow && Boolean(initialServicePointId))}
            >
              <SelectTrigger aria-label="Room"><SelectValue placeholder="Choose a room" /></SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.servicePointId} value={room.servicePointId}>
                    {room.label}{room.roomType ? ` · ${room.roomType}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingRooms && rooms.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active hotel rooms are available.</p>
            ) : null}
          </div>

          <section className="space-y-3" aria-labelledby="room-usage-items-heading">
            <div>
              <h3 id="room-usage-items-heading" className="font-medium">Supplies used</h3>
              <p className="text-xs text-muted-foreground">Review the actual items and quantities before confirming. Remove an unused suggestion or set it to zero.</p>
            </div>

            {loadingTemplate ? (
              <div className="flex items-center rounded-lg border px-3 py-3 text-sm text-muted-foreground" role="status">
                <Loader2 className="mr-2 size-4 animate-spin" /> Loading standard supplies
              </div>
            ) : servicePointId && template?.configured ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                <PackageCheck className="mr-2 inline size-4" aria-hidden="true" />
                Standard supplies from {template.roomTypeName || "this Room Type"} are prefilled as suggestions. Change or remove anything that was not actually used.
              </div>
            ) : servicePointId ? (
              <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                This Room Type has no standard supply template. Add the actual supplies manually.
              </p>
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                Choose a room to load its suggested standard supplies.
              </p>
            )}

            {!loadingTemplate && template?.unavailableItems.length ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
                <AlertTriangle className="mr-2 inline size-4" aria-hidden="true" />
                {template.unavailableItems.length} unavailable template {template.unavailableItems.length === 1 ? "item was" : "items were"} skipped. Review the Room Type template.
              </div>
            ) : null}

            {lines.map((line) => {
              const compatibleUnits = getCompatibleInventoryUnits(line.item.trackingUnit)
              return (
                <div key={line.item.inventoryItemId} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_110px_130px_auto] sm:items-end">
                  <div>
                    <p className="font-medium">{line.item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Available: {formatInventoryQuantity(line.item.availableQuantity, line.item.trackingUnit)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`room-usage-${line.item.inventoryItemId}`} className="text-xs">Quantity</Label>
                    <Input
                      id={`room-usage-${line.item.inventoryItemId}`}
                      value={line.quantity}
                      onChange={(event) => updateLine(line.item.inventoryItemId, { quantity: event.target.value })}
                      inputMode="decimal"
                      disabled={saving}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Select
                      value={line.unit}
                      onValueChange={(unit: InventoryUnit) => updateLine(line.item.inventoryItemId, { unit })}
                      disabled={saving}
                    >
                      <SelectTrigger aria-label={`${line.item.name} unit`} className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {compatibleUnits.map((unit) => (
                          <SelectItem key={unit} value={unit}>{getInventoryUnitLabel(unit)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Remove ${line.item.name}`}
                    onClick={() => setLines((current) => current.filter((entry) => entry.item.inventoryItemId !== line.item.inventoryItemId))}
                    disabled={saving}
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              )
            })}

            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search hotel supplies"
                  aria-label="Search hotel inventory items"
                  className="h-11 pl-9"
                  disabled={saving}
                />
              </div>
              <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
                {availableCandidates.length === 0 ? (
                  <div className="flex items-center justify-center py-5 text-sm text-muted-foreground">
                    <PackageSearch className="mr-2 size-4" /> No matching active supplies
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
            </div>
          </section>

          <div className="space-y-2">
            <Label htmlFor="room-usage-note">Note (optional)</Label>
            <Textarea
              id="room-usage-note"
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
                idempotencyRef.current = null
              }}
              maxLength={1000}
              placeholder={isServiceRoomWorkflow ? "Add room servicing notes" : "Add operational context"}
              disabled={saving}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || loadingRooms || loadingTemplate || rooms.length === 0 || lines.length === 0}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {isServiceRoomWorkflow ? "Confirm Supplies" : "Record Usage"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
