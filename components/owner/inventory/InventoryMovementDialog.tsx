"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import apiClient from "@/lib/axios-config"
import {
  formatInventoryQuantity,
  getCompatibleInventoryUnits,
  getInventoryApiError,
  getInventoryUnitLabel,
  inventoryCostToMinor,
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
import type { InventoryItem, InventoryMovementResponse, InventoryUnit } from "@/types/inventory"
import { InventoryQuantitySummary } from "./InventoryQuantitySummary"

export type InventoryMovementAction = "receive" | "waste" | "adjust"

const actionContent: Record<InventoryMovementAction, {
  title: string
  description: string
  submit: string
  success: string
}> = {
  receive: {
    title: "Receive stock",
    description: "Record a delivery as additional On Hand stock. Reserved stock will not change.",
    submit: "Confirm receiving",
    success: "Stock received",
  },
  waste: {
    title: "Record waste",
    description: "Record stock that was lost, spoiled, damaged, or otherwise wasted.",
    submit: "Record waste",
    success: "Waste recorded",
  },
  adjust: {
    title: "Correct stock count",
    description: "The recorded quantity doesn't match what you physically counted. Record the correction here.",
    submit: "Confirm correction",
    success: "Stock count corrected",
  },
}

const wasteReasons = [
  ["spoilage", "Spoilage"],
  ["damaged", "Damaged"],
  ["preparation_waste", "Preparation waste"],
  ["staff_meal", "Staff meal"],
  ["complimentary", "Complimentary"],
  ["spillage", "Spillage"],
  ["other", "Other"],
] as const

const adjustmentReasons = [
  ["data_correction", "Data correction"],
  ["opening_balance_correction", "Opening balance correction"],
  ["other", "Other"],
] as const

type InventoryMovementDialogProps = {
  open: boolean
  action: InventoryMovementAction
  item: InventoryItem
  defaultCurrency: string
  onOpenChange: (open: boolean) => void
  onCompleted: (result: InventoryMovementResponse) => void
}

export function InventoryMovementDialog({
  open,
  action,
  item,
  defaultCurrency,
  onOpenChange,
  onCompleted,
}: InventoryMovementDialogProps) {
  const compatibleUnits = getCompatibleInventoryUnits(item.trackingUnit)
  const [quantity, setQuantity] = useState("")
  const [unit, setUnit] = useState<InventoryUnit>(item.trackingUnit)
  const [direction, setDirection] = useState<"increase" | "decrease">("increase")
  const [reason, setReason] = useState("spoilage")
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [costCurrency, setCostCurrency] = useState(defaultCurrency || "EUR")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null)

  useEffect(() => {
    if (!open) return
    setQuantity("")
    setUnit(item.trackingUnit)
    setDirection("increase")
    setReason(action === "waste" ? "spoilage" : "data_correction")
    setReference("")
    setNote("")
    setUnitCost("")
    setCostCurrency(item.costCurrency || defaultCurrency || "EUR")
    setError(null)
    idempotencyRef.current = null
  }, [action, defaultCurrency, item.costCurrency, item.trackingUnit, open])

  const impact = useMemo(() => {
    if (!/^\d+(?:\.\d+)?$/.test(quantity.trim()) || Number(quantity) <= 0) return null
    try {
      const canonicalQuantity = inventoryQuantityToCanonical(quantity, unit, item.trackingUnit)
      const delta = action === "receive"
        ? canonicalQuantity
        : action === "waste" || direction === "decrease"
          ? -canonicalQuantity
          : canonicalQuantity
      const nextOnHand = item.onHandQuantity + delta
      return {
        delta,
        canonicalQuantity,
        nextOnHand,
        nextAvailable: nextOnHand - item.reservedQuantity,
        wouldConflict: nextOnHand < item.reservedQuantity,
      }
    } catch {
      return null
    }
  }, [action, direction, item.onHandQuantity, item.reservedQuantity, item.trackingUnit, quantity, unit])

  const quantityLabel = action === "receive"
    ? "Quantity received"
    : action === "waste"
      ? "Quantity wasted"
      : "Correction quantity"

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!/^\d+(?:\.\d+)?$/.test(quantity.trim()) || Number(quantity) <= 0) {
      setError("Quantity must be greater than zero")
      return
    }

    const payload: Record<string, string | number | null> = {
      quantity: quantity.trim(),
      unit,
      reference: reference.trim() || null,
      note: note.trim() || null,
    }
    if (action === "waste") payload.reason = reason
    if (action === "adjust") {
      payload.direction = direction
      payload.reason = reason
    }
    if (action === "receive") {
      let unitCostMinor: number | null
      try {
        unitCostMinor = inventoryCostToMinor(unitCost, costCurrency)
      } catch (costError) {
        setError(costError instanceof Error ? costError.message : "Enter a valid unit cost")
        return
      }
      payload.unitCostMinor = unitCostMinor
      payload.costCurrency = unitCostMinor === null ? null : costCurrency.trim().toUpperCase()
    }

    const fingerprint = JSON.stringify(payload)
    if (idempotencyRef.current?.fingerprint !== fingerprint) {
      idempotencyRef.current = { fingerprint, key: crypto.randomUUID() }
    }

    setSaving(true)
    try {
      const response = await apiClient.post<InventoryMovementResponse>(
        `/owner/inventory/items/${encodeURIComponent(item.inventoryItemId)}/${action}`,
        payload,
        { headers: { "Idempotency-Key": idempotencyRef.current.key } },
      )
      toast.success(actionContent[action].success)
      onCompleted(response.data)
      onOpenChange(false)
    } catch (requestError) {
      setError(getInventoryApiError(requestError, `${actionContent[action].title} could not be completed`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[min(92dvh,760px)] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{actionContent[action].title}</DialogTitle>
            <DialogDescription>{actionContent[action].description}</DialogDescription>
          </DialogHeader>

          <section aria-labelledby="inventory-movement-item-heading" className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div>
              <h3 id="inventory-movement-item-heading" className="font-semibold">{item.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{item.category || "Uncategorised"} · Tracked in {item.trackingUnit}</p>
            </div>
            <InventoryQuantitySummary
              onHandQuantity={item.onHandQuantity}
              reservedQuantity={item.reservedQuantity}
              availableQuantity={item.availableQuantity}
              trackingUnit={item.trackingUnit}
              compact
            />
          </section>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {action === "adjust" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>Correction direction</Label>
                <Select value={direction} onValueChange={(value: "increase" | "decrease") => setDirection(value)} disabled={saving}>
                  <SelectTrigger aria-label="Adjustment direction"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Increase recorded stock</SelectItem>
                    <SelectItem value="decrease">Decrease recorded stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="inventory-movement-quantity">{quantityLabel}</Label>
              <Input
                id="inventory-movement-quantity"
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0"
                disabled={saving}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">This is the amount to add, remove, or correct—not the new total.</p>
            </div>

            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(value: InventoryUnit) => setUnit(value)} disabled={saving}>
                <SelectTrigger aria-label="Movement unit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {compatibleUnits.map((compatibleUnit) => (
                    <SelectItem key={compatibleUnit} value={compatibleUnit}>{getInventoryUnitLabel(compatibleUnit)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {action === "waste" || action === "adjust" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>Reason</Label>
                <Select value={reason} onValueChange={setReason} disabled={saving}>
                  <SelectTrigger aria-label={`${actionContent[action].title} reason`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(action === "waste" ? wasteReasons : adjustmentReasons).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {action === "receive" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="inventory-receive-cost">Cost per {item.trackingUnit} (optional)</Label>
                  <Input id="inventory-receive-cost" type="text" inputMode="decimal" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} placeholder="0.00" disabled={saving} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inventory-receive-currency">Currency</Label>
                  <Input id="inventory-receive-currency" value={costCurrency} onChange={(event) => setCostCurrency(event.target.value.toUpperCase())} maxLength={3} disabled={saving || !unitCost.trim()} />
                </div>
              </>
            ) : null}

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="inventory-movement-reference">Reference (optional)</Label>
              <Input id="inventory-movement-reference" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={200} placeholder="Invoice, delivery, or correction reference" disabled={saving} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="inventory-movement-note">Note (optional)</Label>
              <Textarea id="inventory-movement-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Add context for the inventory record" disabled={saving} />
            </div>
          </div>

          {impact ? (
            <section aria-live="polite" aria-labelledby="stock-impact-heading" className="rounded-xl border bg-muted/20 p-4">
              <h3 id="stock-impact-heading" className="text-sm font-semibold">Stock impact</h3>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Current On Hand</dt><dd className="mt-1 font-semibold tabular-nums">{formatInventoryQuantity(item.onHandQuantity, item.trackingUnit)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{impact.delta >= 0 ? "Quantity added" : "Quantity removed"}</dt><dd className="mt-1 font-semibold tabular-nums">{impact.delta >= 0 ? "+" : "−"}{formatInventoryQuantity(impact.canonicalQuantity, item.trackingUnit)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">New On Hand</dt><dd className="mt-1 font-semibold tabular-nums">{formatInventoryQuantity(impact.nextOnHand, item.trackingUnit)}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">Reserved stock remains {formatInventoryQuantity(item.reservedQuantity, item.trackingUnit)}. Resulting available stock: <span className="font-medium text-foreground">{formatInventoryQuantity(impact.nextAvailable, item.trackingUnit)}</span>.</p>
              {impact.wouldConflict ? <p className="mt-2 text-xs font-medium text-destructive">This would reduce On Hand below stock already reserved. Chillow will reject the change.</p> : null}
            </section>
          ) : null}

          {(action === "waste" || action === "adjust" && direction === "decrease") ? (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">On hand stock cannot be reduced below the quantity already reserved.</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {actionContent[action].submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
